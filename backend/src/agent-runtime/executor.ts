/**
 * Agent Executor — backend/src/agent-runtime/executor.ts
 *
 * The executor is the bridge between your agent code and the outside world.
 * It does three things:
 *
 *   1. Runs the agent — calls runAgent() from your task-automator
 *   2. Broadcasts events — sends real-time WebSocket updates to the dashboard
 *   3. Persists logs — writes every event to SQLite so you can review history
 *
 * The dashboard (AgentViewer.tsx) connects to the WebSocket and displays these
 * events in real time — you'll see your agent "thinking" and "acting" live.
 *
 * Why run the agent here instead of calling it directly from a route?
 * Because agent runs can take seconds or minutes. The HTTP route returns
 * immediately (202 Accepted) and the actual work happens asynchronously.
 * Results arrive via WebSocket — this is the standard pattern for long-running
 * background tasks in web applications.
 *
 * See concept: 01-what-is-an-agent, 05-error-handling
 */

import * as http from 'http';
import * as path from 'path';
import Database from 'better-sqlite3';
import { WebSocketServer, WebSocket } from 'ws';
import type { Request, Response } from 'express';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type AgentState = 'idle' | 'thinking' | 'acting' | 'error';

/**
 * Every event the agent emits has a type and a payload.
 * The dashboard subscribes to these events and updates the UI.
 */
export type AgentEvent =
  | { type: 'agent:state';         payload: { state: AgentState; timestamp: string } }
  | { type: 'agent:thinking';      payload: { input: string; timestamp: string } }
  | { type: 'agent:tool_call';     payload: { tool: string; params: unknown; timestamp: string } }
  | { type: 'agent:response';      payload: { output: AgentRunOutput; timestamp: string } }
  | { type: 'agent:error';         payload: { message: string; timestamp: string } }
  | { type: 'agent:memory_cleared'; payload: { timestamp: string } };

interface AgentRunOutput {
  response: string;
  intent: string;
  toolsUsed: string[];
  success: boolean;
}

interface LogEntry {
  id: number;
  timestamp: string;
  event_type: string;
  payload: string;
}

// ──────────────────────────────────────────────────────────────
// Dynamic agent loader
//
// The agent template lives outside the backend directory:
//   /src/agents/task-automator/index.ts
//
// We load it dynamically so the backend doesn't need to know
// the agent's internal structure. The agent is a black box —
// it receives input and returns output.
//
// Path breakdown (relative to this file):
//   This file:       /backend/src/agent-runtime/executor.ts
//   Agent template:  /src/agents/task-automator/index.ts
//   Relative path:   ../../../../src/agents/task-automator/index
//
// Note: This cross-directory import is fine at runtime with ts-node
// (which is what `npm run dev` uses). If you run `tsc --build`, you'll
// need to adjust backend/tsconfig.json's rootDir to include /src/.
// ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let agentModule: any = null;

function loadAgent(): boolean {
  if (agentModule) return true;

  try {
    const agentPath = path.resolve(__dirname, '../../../../src/agents/task-automator/index');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    agentModule = require(agentPath);
    console.log('[agent-runtime] Agent module loaded successfully');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[agent-runtime] Could not load agent module:', message);
    console.warn('[agent-runtime] Make sure /src/agents/task-automator/index.ts exists');
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// Executor factory
// ──────────────────────────────────────────────────────────────

/**
 * createExecutor — wires up the WebSocket server and returns HTTP route handlers.
 *
 * Called once from server.ts during startup, with the WebSocket server instance.
 * Returns an object of route handlers to be registered on the Express app.
 *
 * @param wss  - The WebSocket server (attached to the http.Server in server.ts)
 * @param db   - The SQLite database for log persistence
 */
export function createExecutor(wss: WebSocketServer, db: Database.Database) {
  // ── SQLite setup ───────────────────────────────────────────
  // Create the agent_logs table if it doesn't exist.
  // Each row stores one agent event for historical review.
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP,
      event_type TEXT NOT NULL,
      payload    TEXT NOT NULL
    )
  `);

  const insertLog = db.prepare(
    'INSERT INTO agent_logs (event_type, payload) VALUES (?, ?)'
  );

  // ── State ─────────────────────────────────────────────────
  let currentState: AgentState = 'idle';
  let isRunning = false;

  // ── Event broadcasting ─────────────────────────────────────
  /**
   * broadcast — sends an event to all connected WebSocket clients
   * and persists it to the SQLite log.
   */
  function broadcast(event: AgentEvent) {
    const message = JSON.stringify(event);

    // Send to all connected dashboard clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    // Persist to SQLite for historical review
    try {
      insertLog.run(event.type, JSON.stringify(event.payload));
    } catch (err) {
      console.error('[agent-runtime] Failed to write log:', err);
    }
  }

  function setState(state: AgentState) {
    currentState = state;
    broadcast({ type: 'agent:state', payload: { state, timestamp: new Date().toISOString() } });
  }

  // ── Agent runner ───────────────────────────────────────────
  /**
   * runAgentTask — executes the agent and broadcasts lifecycle events.
   * Called asynchronously from handleSend (does not block the HTTP response).
   */
  async function runAgentTask(message: string) {
    if (!loadAgent()) {
      broadcast({
        type: 'agent:error',
        payload: {
          message: 'Agent module not found. Make sure /src/agents/task-automator/index.ts exists.',
          timestamp: new Date().toISOString(),
        },
      });
      setState('error');
      return;
    }

    setState('thinking');
    broadcast({
      type: 'agent:thinking',
      payload: { input: message, timestamp: new Date().toISOString() },
    });

    try {
      setState('acting');

      // Call the user's runAgent() function
      const output: AgentRunOutput = await agentModule.runAgent({ message });

      // Broadcast the result
      broadcast({
        type: 'agent:response',
        payload: { output, timestamp: new Date().toISOString() },
      });

      setState('idle');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      broadcast({
        type: 'agent:error',
        payload: { message: errorMessage, timestamp: new Date().toISOString() },
      });
      setState('error');
    }
  }

  // ── Push current state to newly connected WebSocket clients ──
  // When the frontend reconnects (e.g. after switching tabs), the WS
  // client is new and has no state. Sending agent:state immediately
  // lets the dashboard reflect the real running state without waiting
  // for the next broadcast event.
  wss.on('connection', (ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'agent:state',
        payload: { state: currentState, isRunning, timestamp: new Date().toISOString() },
      }));
    }
  });

  // ── Route handlers ─────────────────────────────────────────

  /**
   * POST /api/agent/start
   * Marks the agent as "running" so it's ready to accept messages.
   * (The agent doesn't do anything until you send it a message.)
   */
  function handleStart(_req: Request, res: Response) {
    if (isRunning) {
      res.json({ ok: true, state: currentState, message: 'Agent is already running.' });
      return;
    }

    isRunning = true;
    setState('idle');
    console.log('[agent-runtime] Agent started');
    res.json({ ok: true, state: currentState });
  }

  /**
   * POST /api/agent/stop
   * Marks the agent as stopped. Any in-flight tasks will still complete.
   */
  function handleStop(_req: Request, res: Response) {
    isRunning = false;
    setState('idle');
    console.log('[agent-runtime] Agent stopped');
    res.json({ ok: true, state: 'idle' });
  }

  /**
   * GET /api/agent/status
   * Returns the current agent state and WebSocket connection count.
   */
  function handleStatus(_req: Request, res: Response) {
    res.json({
      state: currentState,
      isRunning,
      wsClients: wss.clients.size,
      agentLoaded: agentModule !== null,
    });
  }

  /**
   * POST /api/agent/send
   * Sends a message to the agent for processing.
   *
   * Returns HTTP 202 immediately — the agent runs async.
   * The actual response arrives via WebSocket (agent:response event).
   *
   * This teaches the async task dispatch pattern:
   *   Client → POST /send → 202 Accepted
   *   Agent runs...
   *   Client ← WebSocket agent:response event
   */
  function handleSend(req: Request, res: Response) {
    const { message } = req.body as { message?: string };

    if (!message) {
      res.status(400).json({ error: '`message` is required in the request body' });
      return;
    }

    if (!isRunning) {
      res.status(409).json({
        error: 'Agent is not running. Call POST /api/agent/start first.',
      });
      return;
    }

    // Return immediately — the dashboard gets the result via WebSocket
    res.status(202).json({
      ok: true,
      message: 'Agent is processing your input. Watch the dashboard for results.',
    });

    // Run agent async (don't await — we already sent the response)
    runAgentTask(message).catch(err => {
      console.error('[agent-runtime] Unhandled error in runAgentTask:', err);
    });
  }

  /**
   * GET /api/agent/logs?limit=50
   * Returns recent agent log entries from SQLite.
   */
  function handleLogs(req: Request, res: Response) {
    const limit = Math.min(Number(req.query['limit']) || 50, 500);

    try {
      const rows = db
        .prepare('SELECT * FROM agent_logs ORDER BY id DESC LIMIT ?')
        .all(limit) as LogEntry[];

      res.json(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  }

  /**
   * POST /api/agent/memory/clear
   * Tells the agent to clear its memory state.
   * Broadcasts an agent:memory_cleared event to the dashboard.
   */
  function handleMemoryClear(_req: Request, res: Response) {
    broadcast({
      type: 'agent:memory_cleared',
      payload: { timestamp: new Date().toISOString() },
    });

    // Note: The in-process memory in the agent module is NOT reset here,
    // because we don't have a direct reference to it. The agent module
    // would need to export a clearMemory() function for that.
    // This broadcasts the event so the dashboard reflects the action.

    console.log('[agent-runtime] Memory cleared event broadcast');
    res.json({ ok: true });
  }

  return {
    handleStart,
    handleStop,
    handleStatus,
    handleSend,
    handleLogs,
    handleMemoryClear,
  };
}

/**
 * attachWebSocket — mounts the WebSocket server on the HTTP server.
 *
 * Only accepts connections at the /ws path.
 * All other upgrade requests are rejected.
 *
 * Why /ws specifically? Because the Vite dev proxy is configured to
 * forward `ws://localhost:3000/ws` to `ws://localhost:3001/ws`.
 * Other paths (like the default WS at /) won't reach the backend.
 */
export function attachWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    console.log(`[agent-runtime] Dashboard connected (${wss.clients.size} clients)`);

    ws.on('close', () => {
      console.log(`[agent-runtime] Dashboard disconnected (${wss.clients.size} clients)`);
    });

    ws.on('error', (err) => {
      console.error('[agent-runtime] WebSocket error:', err.message);
    });
  });

  console.log('[agent-runtime] WebSocket server ready at /ws');
  return wss;
}
