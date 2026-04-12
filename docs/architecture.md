# System Architecture

## Overview

Agent Arch is a local web app with three main layers: a React frontend, an Express backend, and an agent runtime. All three run on your machine during development. The agent runtime is the part designed to eventually run in the cloud.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (React)                              │
│                                                                      │
│  LockedScreen    AssistantChat    AgentViewer    ConceptViewer       │
│      │                │               │               │             │
└──────┼────────────────┼───────────────┼───────────────┼─────────────┘
       │                │               │               │
       │         HTTP + WebSocket/SSE   │               │ HTTP
       ▼                ▼               ▼               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Express Backend (Node.js)                       │
│                                                                      │
│  server.ts                                                           │
│    │                                                                 │
│    ├─ /api/status         → setup/init.ts (locked/unlocked check)    │
│    ├─ /api/chat           → assistant-service/chat-handler.ts        │
│    ├─ /api/curriculum     → assistant-service/curriculum-loader.ts   │
│    ├─ /api/agent/*        → agent-runtime/executor.ts                │
│    └─ /api/progress       → reviewer/progress-tracker.ts             │
│                                                                      │
│  SQLite DB: data/agent-arch.db                                       │
└──────────────────────────────────────────────────────────────────────┘
       │
       ├─ Claude API (Anthropic)
       │
       └─ Agent Runtime
              │
              ├─ src/agents/task-automator/index.ts   (agent loop)
              ├─ core/intent.ts                       (intent classification)
              ├─ core/memory.ts                       (persistence)
              ├─ tools/email.ts                       (Gmail integration)
              └─ tools/calendar.ts                    (Google Calendar)
```

---

## Component Responsibilities

### Frontend (`frontend/src/`)

**LockedScreen.tsx** — Shown on first load until `backend/setup/init.ts` is fixed. Displays which env vars are missing and which init checks failed. Has a "Retry" button that re-calls `/api/status`.

**AssistantChat.tsx** — The main teaching interface. Streams responses from the backend via SSE. Can display concept lessons inline when the assistant references curriculum content.

**AgentViewer.tsx** — Real-time dashboard showing the agent's current state: which tool it just called, what arguments it used, what the result was, and what's stored in memory. Receives updates via WebSocket from the agent runtime.

**ConceptViewer.tsx** — Side panel that fetches and renders markdown lesson files from `/api/curriculum/{slug}`. Handles syntax highlighting and navigation between the 7 concepts.

---

### Backend (`backend/`)

**server.ts** — Entry point. Registers all routes, initialises the database, and starts the WebSocket server. Calls `init.ts` on boot to validate configuration.

**setup/init.ts** — The intentionally broken file from Session 1. Validates env vars, sets up the database tables, and verifies the Claude API key. The frontend stays locked until this passes.

**assistant-service/chat-handler.ts** — Receives chat messages, builds a system prompt (including relevant curriculum content), calls the Claude API, and streams the response back. This is the "teaching assistant" brain.

**assistant-service/curriculum-loader.ts** — Reads markdown files from `curriculum/concepts/` at request time. Parses frontmatter for metadata (title, prerequisites, order). Serves them via `/api/curriculum`.

**agent-runtime/executor.ts** — Runs the user's agent code (`src/agents/task-automator/index.ts`) in a subprocess. Captures tool call events and forwards them to the frontend via WebSocket.

**reviewer/progress-tracker.ts** — Tracks which exercises are started and complete. Stores state in SQLite. Exposes `/api/progress` for the frontend checklist.

---

### Agent Template (`src/agents/task-automator/`)

The code the *learner* builds. Starts as stubs with TODOs and failing tests. By the end of Session 5 (code review), all stubs are implemented and all tests pass.

**index.ts** — The agentic loop. Calls the LLM, dispatches tool calls, feeds results back into context. This is the core "perceive → reason → act" cycle.

**core/intent.ts** — Classifies a plain-text user message into an `IntentType`. Drives which tools the agent considers calling.

**core/memory.ts** — Persistent key-value storage backed by SQLite. Used to remember user preferences, task history, and agent state across restarts.

**tools/email.ts** — Sends and reads email via Gmail. Exposes MCP tool descriptors so the LLM can call them by name.

**tools/calendar.ts** — Creates and lists Google Calendar events. Same tool descriptor pattern as email.

---

## Data Flow: User Message → Agent Action

```
User types message
        │
        ▼
AssistantChat.tsx
  POST /api/chat
        │
        ▼
chat-handler.ts
  builds system prompt
  includes relevant curriculum
  calls Claude API (streaming)
        │
        ├─ Claude returns text → streamed back to browser
        │
        └─ Claude returns tool_use
                  │
                  ▼
            executor.ts
              dispatches to agent tool
              (email.ts, calendar.ts, etc.)
                  │
                  ▼
            tool executes
            result returned to Claude
                  │
                  ▼
            Claude continues reasoning
            (may call more tools)
                  │
                  ▼
            final text response
            streamed to browser
```

---

## Database Schema

**SQLite file:** `data/agent-arch.db` (created on first run)

```sql
-- Stores agent memory (key-value)
CREATE TABLE memory (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,    -- JSON-serialised
  created_at INTEGER,
  updated_at INTEGER
);

-- Tracks exercise/concept completion per user session
CREATE TABLE progress (
  id         TEXT PRIMARY KEY, -- e.g. "exercise:intent-classification"
  status     TEXT,             -- "not_started" | "in_progress" | "complete"
  started_at INTEGER,
  completed_at INTEGER
);

-- Chat history for the teaching assistant
CREATE TABLE messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT,             -- "user" | "assistant"
  content    TEXT,
  created_at INTEGER
);
```

---

## Key Design Decisions

**Why SQLite?** Zero setup — no database server to install. A single file in `data/`. Easy to inspect with the SQLite CLI or DB Browser. For a personal agent running on one machine, it's more than sufficient.

**Why Express over Next.js/Remix?** The backend is a teaching tool, not a production API. Express makes the routing and middleware visible. Students can trace a request from `server.ts` to `chat-handler.ts` without framework magic in the way.

**Why webhooks + local receiver?** Cloud agents can't reach your laptop directly (no public IP, no open ports). The local receiver pattern — a small HTTP server running on your machine, exposed via ngrok — lets a cloud-hosted agent trigger local actions. This is the production pattern for personal agents.

**Why stream responses?** LLM responses can take 5–20 seconds for complex multi-step tasks. Streaming (SSE) shows the model's output as it arrives rather than waiting for the full response. This makes the agent feel responsive and lets users see it "thinking".
