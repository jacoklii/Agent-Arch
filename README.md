# Agent Arch

> **Learn agentic AI by building a real AI agent.**  
> The platform starts broken. You fix it. That's the first lesson.

---

## What Is This?

Agent Arch is a hands-on learning platform where you build a personal AI agent — a task automator, research assistant, or custom agent you actually want to use. There are no passive lectures. You learn by debugging, building, and shipping real code.

**The platform starts locked.** You can't use it until you fix a broken initialization file. That debugging process teaches you exactly the concepts you'll need to build an agent: environment variables, configuration, authentication, and database connections.

## What You'll Build

By the end, you'll have a working AI agent that can:
- Read and send emails
- Manage your calendar
- Remember past conversations
- Reason through multi-step tasks
- Run in the cloud, acting on your behalf

## What You'll Learn

1. **What is an AI agent?** — The agentic loop: perceive → reason → act
2. **MCP & tool calling** — How agents use tools to interact with the world
3. **Memory & context** — Short-term and long-term agent memory
4. **Multi-step reasoning** — Breaking complex tasks into steps
5. **Error handling** — Making agents resilient
6. **External services** — Connecting to email, calendar, APIs
7. **Deployment** — Running your agent in the cloud

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Claude API key](https://console.anthropic.com) (free tier works)

### Step 1: Install dependencies

```bash
npm run install:all
```

### Step 2: Start the platform

```bash
npm start
```

Open **http://localhost:3000** in your browser.

You'll see a locked screen with error messages. That's expected. **This is the lesson.**

---

## Unlocking the Platform

The platform is locked because `backend/setup/init.ts` has bugs. Your job is to find and fix them.

### The file to fix:
```
backend/src/setup/init.ts
```

### What's broken (4 issues):

1. **Environment validation** — The code isn't checking for required environment variables correctly
2. **Auth initialization** — Session secret validation has a logic error
3. **Database connection** — The database can't be created (something's missing before the connection)
4. **API key validation** — The validation logic is inverted

Each bug is marked with a `// BUG:` comment and a `// TODO:` explaining what to fix.

### The environment file:

```bash
cp .env.example .env
```

Then edit `.env` and fill in:
- `CLAUDE_API_KEY` — Your Claude API key from [console.anthropic.com](https://console.anthropic.com)
- `SESSION_SECRET` — A random 32+ character string (run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### When you've fixed it:

Click **"Retry Initialization"** on the locked screen (no server restart needed).

If everything is correct, the platform unlocks and you'll meet your AI teaching assistant.

---

## Project Structure

```
agent-arch/
├── backend/
│   └── src/
│       └── setup/
│           └── init.ts    ← START HERE (this is broken)
├── frontend/
│   └── src/
│       └── components/
│           └── LockedScreen.tsx
├── .env.example           ← Copy to .env and fill in
└── README.md              ← You are here
```

---

## Philosophy

- **No passive content** — Every concept is learned by doing
- **Socratic teaching** — The AI assistant challenges your decisions, doesn't just answer questions
- **Real utility** — You're building something you'll actually use
- **Progressive** — You can't skip prerequisites

---

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite
- **AI:** Claude API (Sonnet 4.5)
- **Agent:** TypeScript

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_API_KEY` | Yes | Your Anthropic API key from [console.anthropic.com](https://console.anthropic.com) |
| `SESSION_SECRET` | Yes | Random 32+ char string used to sign auth sessions |
| `PORT` | No | Backend port (default: 3001) |
| `NODE_ENV` | No | `development` or `production` |

Generate a secure `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Architecture

```
Browser (localhost:3000)
       │
       │  HTTP / SSE / WebSocket
       ▼
  Express Backend (localhost:3001)
       │
       ├─ /api/status        ← platform lock check
       ├─ /api/chat          ← teaching assistant (SSE stream)
       ├─ /api/curriculum    ← lesson content
       ├─ /api/agent/*       ← agent runtime controls
       ├─ /api/progress/*    ← curriculum progress
       ├─ /api/review/*      ← test runner & code analysis
       └─ /ws (WebSocket)    ← real-time agent events
             │
        SQLite DB (data/agent-arch.db)
        Claude API (claude-sonnet-4-5)
```

---

## Deployment

To run your agent in the cloud (so it can receive webhooks and run 24/7):

### Railway (recommended)

1. Push your repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set environment variables in Railway's dashboard (same as `.env`)
4. Railway auto-detects Node.js and runs `npm start`
5. Your agent URL will be something like `https://agent-arch-production.up.railway.app`

### Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo, set build command: `npm run install:all && npm run build`
4. Set start command: `npm start`
5. Add environment variables in Render dashboard

### Fly.io

```bash
npm install -g flyctl
fly launch
fly secrets set CLAUDE_API_KEY=your-key SESSION_SECRET=your-secret
fly deploy
```

---

## Troubleshooting

### "Cannot reach backend" on the frontend

The Express server isn't running. In a new terminal:
```bash
npm start
```
Check that port 3001 is free: `lsof -i :3001`

### Platform stays locked after fixing init.ts

1. Save your file changes
2. Make sure your `.env` exists with all required variables
3. Click **Retry Initialization** (no server restart needed)
4. Check the terminal for error messages — the server logs exactly what's failing

### "CLAUDE_API_KEY is not configured" error

1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. Add your API key from [console.anthropic.com](https://console.anthropic.com)
3. Restart the backend: `npm start`

### WebSocket disconnected in Agent Dashboard

This is expected if the backend restarts. The dashboard auto-reconnects within a few seconds. If it doesn't reconnect, refresh the page.

### Tests fail with "cannot find module"

Run `npm run install:all` to ensure all dependencies are installed in both frontend and backend directories.

### SQLite database errors

Delete `data/agent-arch.db` and restart — the server recreates it automatically:
```bash
rm -f data/agent-arch.db && npm start
```

---

## Stuck?

1. Read the error messages on the locked screen carefully
2. Open `backend/src/setup/init.ts` and read every `// BUG:` and `// TODO:` comment
3. Check that your `.env` file exists and has all required variables
4. Still stuck? The hints on the locked screen will guide you
5. Use the **I'm Stuck** button in the teaching assistant chat for targeted hints

Good luck. You've got this.
