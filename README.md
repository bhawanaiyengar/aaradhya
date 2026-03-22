# Aaradhya

Google-authenticated web chat for local OpenClaw.

## Architecture

- `web-client/` → React + Vite frontend, intended for GitHub Pages
- `server/` → local Express backend on your laptop
- backend talks to local OpenClaw through `openclaw gateway call`
- public backend exposure is intended to happen through Tailscale

## What is already implemented

- Google sign-in UI using Google Identity Services
- backend Google ID token verification
- app JWT session token for frontend auth restoration
- authenticated chat UI
- backend -> local OpenClaw request flow
- GitHub Pages-friendly Vite base path support
- env templates for frontend and backend

## Local development

1. Copy env templates:
   - `cp server/.env.example server/.env`
   - `cp web-client/.env.example web-client/.env`
2. Fill in:
   - `GOOGLE_CLIENT_ID`
   - `APP_JWT_SECRET`
   - `VITE_GOOGLE_CLIENT_ID`
3. Start both apps:
   - `npm run dev`
4. Open `http://localhost:3000`

## Required Google Cloud Console values

Create a **Web application** OAuth client and add these JavaScript origins:

- `http://localhost:3000`
- `https://<github-username>.github.io`

If you deploy to a repo subpath on GitHub Pages, the origin stays the same; only the path changes.

## Backend runtime notes

- default backend URL: `http://localhost:5001/api`
- backend uses a per-user OpenClaw session key like `aaradhya:<google-sub>`
- chat requests are sent with `deliver: false` so they stay inside this web app flow

## Tailscale

This machine currently needs Tailscale installed before the public backend step in `MAGIC.md` can be completed.

When Tailscale is available, the intended exposure flow is:

- run backend on `5001`
- expose it through Tailscale Serve/Funnel as needed
- point `VITE_API_BASE_URL` at `https://<machine>.ts.net/api`

## GitHub Pages deployment

You can deploy `web-client/dist` to GitHub Pages after setting the correct `VITE_BASE_PATH` for the repo path.
