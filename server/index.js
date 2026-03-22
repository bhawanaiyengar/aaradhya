import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);
const app = express();

const PORT = Number(process.env.PORT || 5001);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `${CLIENT_URL},http://localhost:3000`)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const APP_JWT_SECRET = process.env.APP_JWT_SECRET || 'change-me-in-production';
const OPENCLAW_SESSION_PREFIX = process.env.OPENCLAW_SESSION_PREFIX || 'webchat';
const OPENCLAW_CHAT_TIMEOUT_MS = Number(process.env.OPENCLAW_CHAT_TIMEOUT_MS || 45000);

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: false,
  }),
);
app.use(express.json({ limit: '1mb' }));

function signAppToken(user) {
  return jwt.sign(user, APP_JWT_SECRET, { expiresIn: '7d' });
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  try {
    req.user = jwt.verify(token, APP_JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function gatewayCall(method, params) {
  const { stdout } = await execFileAsync('openclaw', [
    'gateway',
    'call',
    method,
    '--params',
    JSON.stringify(params),
    '--json',
  ]);

  return JSON.parse(stdout);
}

function toOpenClawSessionKey(user) {
  return `${OPENCLAW_SESSION_PREFIX}:${user.sub}`;
}

function flattenTextParts(message) {
  if (!message?.content || !Array.isArray(message.content)) return '';
  return message.content
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();
}

async function waitForAssistantReply(sessionKey, startedAt) {
  const deadline = Date.now() + OPENCLAW_CHAT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const history = await gatewayCall('chat.history', { sessionKey, limit: 20 });
    const messages = Array.isArray(history.messages) ? history.messages : [];
    const candidates = messages.filter(
      (message) =>
        message.role === 'assistant' &&
        typeof message.timestamp === 'number' &&
        message.timestamp >= startedAt,
    );

    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const text = flattenTextParts(candidates[i]);
      if (text) {
        return { text, history };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  throw new Error('Timed out waiting for OpenClaw reply');
}

app.get('/api/health', async (_req, res) => {
  try {
    const status = await execFileAsync('openclaw', ['status']);
    res.json({ ok: true, openclaw: 'reachable', detail: status.stdout.trim() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!googleClient || !GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Server is missing GOOGLE_CLIENT_ID' });
    }

    const credential = req.body?.credential;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      return res.status(401).json({ error: 'Google token did not include expected identity fields' });
    }

    const user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture || null,
    };

    return res.json({ token: signAppToken(user), user });
  } catch (error) {
    return res.status(401).json({ error: 'Google sign-in failed', detail: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const sessionKey = toOpenClawSessionKey(req.user);
    const startedAt = Date.now();

    await gatewayCall('chat.send', {
      sessionKey,
      message,
      deliver: false,
      idempotencyKey: crypto.randomUUID(),
    });

    const reply = await waitForAssistantReply(sessionKey, startedAt);

    return res.json({
      reply: reply.text,
      sessionKey,
      historyCount: Array.isArray(reply.history.messages) ? reply.history.messages.length : 0,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Chat request failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Aaradhya server listening on http://localhost:${PORT}`);
});
