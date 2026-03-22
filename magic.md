# MAGIC.md — Formal Specification for a Google-Auth OpenClaw Web Chat

## 0. Purpose

This document is an implementation specification for OpenClaw.

The goal is to create a working web application with these properties:

1. The **frontend is hosted on GitHub Pages**.
2. The **backend runs on the user's laptop**.
3. The **backend is exposed publicly only through Tailscale**.
4. The **backend talks to the user's local OpenClaw instance**.
5. The website supports **Google Authentication**.
6. After login, the user sees a **chat window**.
7. Messages sent from the chat window are answered by the user's **local OpenClaw AI engine**.

This file should be treated as a build contract, not a suggestion.

---

## 1. Non-Negotiable Architecture

OpenClaw must implement exactly this architecture unless the user explicitly overrides it.

### Required architecture
- **Frontend host:** GitHub Pages
- **Backend host:** user's laptop
- **Public backend access:** Tailscale HTTPS URL
- **AI runtime:** local OpenClaw on the same laptop as the backend
- **Authentication:** Google Auth only

### Forbidden substitutions unless user explicitly asks
- Do **not** default to Vercel for the frontend.
- Do **not** move the backend to Render, Railway, Fly, Heroku, or any other cloud host.
- Do **not** replace Tailscale with another tunnel unless the user explicitly asks.
- Do **not** replace Google Auth with another auth provider.

### Required request path
User Browser
→ GitHub Pages frontend
→ Tailscale public backend URL
→ backend running on laptop
→ local OpenClaw on laptop
→ response back through same chain

---

## 2. End-State Requirements

The project is complete only when all of the following are true:

1. A public frontend URL exists on GitHub Pages.
2. Opening the frontend shows a Google sign-in page.
3. Google sign-in succeeds.
4. Authenticated state is preserved correctly.
5. The user is taken into a chat UI.
6. Sending a chat message reaches the laptop backend.
7. The backend reaches local OpenClaw.
8. A valid reply appears in the web chat.

---

## 3. Human vs OpenClaw Responsibilities

### OpenClaw should do automatically
OpenClaw should handle as much of the implementation as possible, including:
- creating or modifying frontend code
- creating or modifying backend code
- wiring frontend to backend
- wiring backend to local OpenClaw
- preparing env/config files
- preparing GitHub Pages deployment config
- starting/checking local backend
- checking local OpenClaw status
- guiding Tailscale setup/use
- testing login and chat
- debugging implementation issues

### Human-only tasks
OpenClaw should stop and ask the human only for:
1. Google Cloud Console actions
2. account sign-ins (Google, GitHub, Tailscale) when required
3. permission/approval prompts that cannot be automated

OpenClaw should minimize human work and provide exact values to copy/paste.

---

## 4. Machine Prerequisites

OpenClaw should verify these before implementation:

1. `git` installed
2. `node` and `npm` installed
3. OpenClaw installed
4. OpenClaw gateway running or runnable
5. Tailscale installed
6. Tailscale signed in
7. user has a GitHub account
8. user has a Google account or Google Workspace account

If something is missing, OpenClaw should stop and give the smallest corrective step.

---

## 5. Directory / Project Expectations

If starting from a blank folder, OpenClaw should create a project with at least:

- `web-client/` — frontend project suitable for static deployment to GitHub Pages
- `server/` — backend project running locally on laptop
- `MAGIC.md` — this spec
- `.env.example` files where appropriate
- README/setup notes if useful

OpenClaw may choose implementation details, but the final system must satisfy this spec.

---

## 6. Frontend Specification

### Frontend hosting requirement
The frontend **must** be deployable to GitHub Pages.

### Frontend responsibilities
The frontend must:
1. show a Google login screen
2. use Google Identity Services for browser sign-in
3. send the Google credential/ID token to the backend
4. restore authenticated state correctly
5. display a chat UI after login
6. send chat messages to backend API
7. render assistant replies clearly

### Frontend environment requirements
The frontend must accept/configure at least:
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_API_BASE_URL`

### Frontend local-development rule
For local development, frontend and backend hostnames must match.

Recommended local values:
- frontend: `http://localhost:3000`
- backend API base: `http://localhost:5001/api`

Do not mix `localhost` and `127.0.0.1` casually.

### Frontend auth persistence rule
Because live deployment is cross-site:
- frontend should not rely only on cookies
- backend auth token should be persisted safely on frontend if required by architecture
- frontend should restore auth state on reload
- frontend should clear auth state on logout or invalid session

---

## 7. Backend Specification

### Backend hosting requirement
The backend **must run on the user's laptop**.
This is required.

### Backend responsibilities
The backend must:
1. expose auth endpoints
2. verify Google ID tokens server-side
3. create/find local users
4. create application auth/session state
5. expose chat endpoints
6. call local OpenClaw on the laptop
7. return assistant replies to frontend

### Backend local runtime requirement
The backend should run on a local port such as:
- `5001`

### Backend environment requirements
The backend should accept/configure at least:
- `PORT`
- `CLIENT_URL`
- `ALLOWED_ORIGINS`
- `GOOGLE_CLIENT_ID`
- `OPENCLAW_URL`
- any auth secret needed by implementation

Typical values:
- `PORT=5001`
- `OPENCLAW_URL=http://localhost:18789`
- `CLIENT_URL=https://<github-pages-host>`
- `ALLOWED_ORIGINS=https://<github-pages-host>,http://localhost:3000`

### Backend auth requirement
Backend must verify Google ID tokens using Google's verification library.
Use the Google `sub` claim as the stable external identity.

---

## 8. Tailscale Specification

### Role of Tailscale
Tailscale is used **only** to expose the laptop backend publicly.

It is not the auth provider.
It is not the AI engine.
It is not the frontend host.

### Required Tailscale behavior
OpenClaw should configure or guide the user to expose backend port `5001` through Tailscale.

Typical command pattern:
- `tailscale serve --bg 5001`

### Result
The backend should become reachable at a public Tailscale HTTPS URL such as:
- `https://<machine>.ts.net`

The frontend must call:
- `https://<machine>.ts.net/api`

### Critical architecture rule
If the backend lives on the user's laptop, then the laptop is part of production.
If the laptop is asleep, offline, or disconnected from Tailscale, the live app will fail.

---

## 9. OpenClaw Integration Specification

### Required topology
OpenClaw runs locally on the same laptop as the backend.
The backend must call local OpenClaw, not a remote OpenClaw instance.

### Expected local endpoint
Typical local OpenClaw URL:
- `http://localhost:18789`

### OpenClaw runtime requirement
OpenClaw must be running before chat can work.
OpenClaw should check this and start or prompt as needed.

---

## 10. Google Authentication Specification

### Auth mode
Use Google Authentication only.
No alternate auth provider is required.

### Required flow
1. User clicks Sign in with Google on frontend.
2. Google returns ID token/credential to frontend.
3. Frontend sends credential to backend.
4. Backend verifies ID token with Google library.
5. Backend creates/fetches local user.
6. Backend issues app auth state.
7. Frontend restores logged-in state.
8. User enters chat UI.

### Human-only Google Console configuration
OpenClaw should guide the user through these exact actions:
1. create/select a Google Cloud project
2. configure OAuth consent screen if required
3. create a **Web application** OAuth client
4. add required Authorized JavaScript origins
5. add required redirect URIs if needed
6. copy the client ID back into app config

### Origins to guide user about
OpenClaw must tell the user the exact origins relevant to the setup, such as:
- `http://localhost:3000`
- `https://<github-username>.github.io`

If a project subpath is used on GitHub Pages, OpenClaw should still reason correctly about origin vs path.

---

## 11. GitHub Pages Deployment Specification

### Requirement
The frontend must be deployable and deployed through GitHub Pages.

### OpenClaw responsibilities
OpenClaw should:
1. prepare frontend for static build
2. create or configure GitHub repo if needed
3. push frontend code to GitHub if user approves
4. configure GitHub Pages deployment path
5. determine final frontend public URL
6. use that URL in auth/backend guidance

### Expected frontend URL shape
Something like:
- `https://<github-username>.github.io/<repo-name>/`

OpenClaw should account for base path requirements if the app is hosted under a repo path rather than root.

---

## 12. Implementation Order OpenClaw Must Follow

### Phase A — inspect and confirm prerequisites
- inspect machine
- verify OpenClaw
- verify Tailscale
- verify Node/npm/git
- verify working directory

### Phase B — establish project structure
- create frontend and backend structure if absent
- prepare env templates
- prepare deployment config for GitHub Pages

### Phase C — implement backend
- auth endpoints
- Google verification
- chat endpoints
- OpenClaw integration
- CORS/origin configuration

### Phase D — implement frontend
- Google sign-in page
- post-login chat UI
- auth restoration
- chat request/response flow

### Phase E — guide Google Console steps
- give exact values
- wait for human confirmation
- apply returned client ID where needed

### Phase F — start local runtime
- confirm OpenClaw
- start backend
- expose backend via Tailscale
- confirm backend health endpoint via Tailscale URL

### Phase G — deploy frontend to GitHub Pages
- build frontend
- push/deploy
- confirm public frontend URL

### Phase H — verify end-to-end
- login page loads
- Google login succeeds
- authenticated state persists
- chat opens
- first message gets OpenClaw reply

---

## 13. Minimum Runtime Bring-Up Commands

OpenClaw should know the practical startup flow is roughly:

### OpenClaw
- `openclaw status`
- if needed: `openclaw gateway start`

### Backend
- `cd server`
- `node server.js`

### Tailscale
- ensure logged in/connected
- `tailscale serve --bg 5001`

### Health checks
- check local backend health
- check Tailscale public backend health
- check frontend loads
- test login
- test chat

OpenClaw may adapt exact commands to project structure, but not the architecture.

---

## 14. Validation Criteria

OpenClaw must not declare success until all of these pass:

1. frontend public URL opens successfully
2. login button is visible
3. Google login succeeds without auth error
4. `/auth/me` or equivalent authenticated-state check succeeds after login
5. chat UI appears
6. a simple prompt like `hello` gets a real reply
7. reply is coming through local OpenClaw path

---

## 15. Debugging Order

If something fails, debug in this order:

1. machine prerequisites
2. Google OAuth client configuration
3. frontend/backend client ID mismatch
4. backend token verification
5. authenticated-state restoration (`/auth/me` or equivalent)
6. local hostname mismatch (`localhost` vs `127.0.0.1`)
7. Tailscale backend reachability
8. backend → OpenClaw connectivity
9. frontend post-login persistence

OpenClaw should avoid random guessing and follow this order.

---

## 16. Explicit Instruction to OpenClaw

If OpenClaw is reading this file in a folder for a new setup, it should interpret the user's request as:

> Build a Google-authenticated web chatbot where the frontend is hosted on GitHub Pages, the backend runs on this laptop, the backend is exposed publicly through Tailscale, and the chatbot uses this laptop's local OpenClaw runtime. Stop only when human action is required for Google Cloud Console, account sign-in, or approvals.

---

## 17. Success Statement

This specification is satisfied only when a non-expert user can:
1. open the public frontend URL,
2. sign in with Google,
3. see a chat window,
4. send a message,
5. receive a reply from their own OpenClaw running locally on their laptop.
