/**
 * Agent Arch - Express Server
 *
 * Starts the backend API server. On startup, runs platform initialization.
 * The frontend polls /api/status to know whether to show the locked screen.
 *
 * Endpoints:
 *   GET  /api/status           → { locked, errors }
 *   POST /api/retry-init       → re-runs initPlatform(), returns new status
 *
 *   POST /api/agent/start      → start the agent runtime
 *   POST /api/agent/stop       → stop the agent runtime
 *   GET  /api/agent/status     → agent state + WS client count
 *   POST /api/agent/send       → send a message to the agent (async, WS response)
 *   GET  /api/agent/logs       → recent agent log entries from SQLite
 *   POST /api/agent/memory/clear → clear agent memory
 *
 *   WebSocket: ws://localhost:3001/ws  → real-time agent events for the dashboard
 */

import * as http from 'http';
import * as fs from 'fs';
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import Database from 'better-sqlite3';
import * as path from 'path';
import { initPlatform, InitResult } from './setup/init';
import { attachWebSocket, createExecutor } from './agent-runtime/executor';
import {
  welcomeHandler,
  chatHandler,
  resetChatHandler,
  curriculumListHandler,
  curriculumHandler,
  configureReviewer,
} from './assistant-service/chat-handler';
import { createProgressTracker } from './reviewer/progress-tracker';
import { runTests } from './reviewer/test-runner';
import { analyzeCode } from './reviewer/code-analyzer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ────────────────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────────────────

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

app.use(express.json());

// ────────────────────────────────────────────────────────────
// State
// Track the most recent init result in memory
// ────────────────────────────────────────────────────────────

let currentInitResult: InitResult = {
  success: false,
  errors: [{
    category: 'ENV',
    message: 'Platform has not been initialized yet',
    hint: 'The server is starting up — wait a moment and retry.',
  }],
};

// Lazily set after tracker is created in start() — lets retry handler
// mark fix-init complete without needing to pass tracker through closure chains.
let _markFixInit: (() => void) | null = null;

// ────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────

/**
 * GET /api/status
 *
 * Returns the current initialization state.
 * The frontend polls this every 3 seconds to check if it should unlock.
 */
app.get('/api/status', (_req, res) => {
  res.json({
    locked: !currentInitResult.success,
    errors: currentInitResult.errors,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/retry-init
 *
 * Re-runs the platform initialization without restarting the server.
 * Called when the user clicks "Retry Initialization" on the locked screen.
 *
 * This lets users fix init.ts and immediately test their changes
 * without having to restart the dev server.
 */
app.post('/api/retry-init', async (_req, res) => {
  console.log('\n[init] Retrying platform initialization...');

  try {
    // Re-run init (dotenv already loaded, env vars are live)
    currentInitResult = await initPlatform();

    if (currentInitResult.success) {
      console.log('[init] ✅ Initialization succeeded — platform unlocked!');
      _markFixInit?.();
    } else {
      console.log(`[init] ❌ ${currentInitResult.errors.length} error(s) found:`);
      currentInitResult.errors.forEach(e => {
        console.log(`  [${e.category}] ${e.message}`);
      });
    }

    res.json({
      locked: !currentInitResult.success,
      errors: currentInitResult.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[init] Unexpected error during retry:', message);

    res.status(500).json({
      locked: true,
      errors: [{
        category: 'ENV',
        message: `Unexpected server error: ${message}`,
        hint: 'Check the server console for the full error. There may be a syntax error in init.ts.',
      }],
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health
 * Simple health check — always returns 200.
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ────────────────────────────────────────────────────────────
// Teaching Assistant routes (Session 2)
// ────────────────────────────────────────────────────────────

app.get('/api/chat/welcome', welcomeHandler);
app.post('/api/chat', chatHandler);
app.post('/api/chat/reset', resetChatHandler);
app.get('/api/curriculum', curriculumListHandler);
app.get('/api/curriculum/:slug', curriculumHandler);

// ────────────────────────────────────────────────────────────
// Startup
// ────────────────────────────────────────────────────────────

async function start() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║       AGENT ARCH - BACKEND           ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Run initialization on startup
  console.log('[init] Running platform initialization...');
  currentInitResult = await initPlatform();

  if (currentInitResult.success) {
    console.log('[init] ✅ Platform initialized successfully\n');
  } else {
    console.log(`[init] ⚠️  Platform locked — ${currentInitResult.errors.length} error(s) found:`);
    currentInitResult.errors.forEach(e => {
      console.log(`  [${e.category}] ${e.message}`);
    });
    console.log('\n  Fix the errors in backend/src/setup/init.ts');
    console.log('  Then click "Retry Initialization" in the browser\n');
  }

  // ── Agent runtime setup (Session 3) ─────────────────────────
  // Open the shared SQLite database.
  // The same database used by init.ts for platform state also stores agent logs.
  const dbPath = path.resolve(__dirname, '../../../data/agent-arch.db');

  // Ensure the data directory exists before opening the database.
  // init.ts may have failed to create it (that's intentional — it's a learning
  // exercise), so we create it here as a safety net.
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Create an HTTP server from the Express app.
  // We need an http.Server instance to attach the WebSocket server.
  // Both HTTP and WebSocket traffic share port 3001.
  const server = http.createServer(app);

  // Attach the WebSocket server at the /ws path.
  const wss = attachWebSocket(server);

  // Wire up the agent executor and register its route handlers.
  const executor = createExecutor(wss, db);

  app.post('/api/agent/start',        executor.handleStart);
  app.post('/api/agent/stop',         executor.handleStop);
  app.get('/api/agent/status',        executor.handleStatus);
  app.post('/api/agent/send',         executor.handleSend);
  app.get('/api/agent/logs',          executor.handleLogs);
  app.post('/api/agent/memory/clear', executor.handleMemoryClear);

  // ── Progress tracker + Code reviewer (Session 5) ─────────────────────────
  // Single progress tracker instance shared between routes and the assistant.
  const tracker = createProgressTracker(db);

  // Give the chat handler access to reviewer functions so Claude can call them
  // as tools mid-conversation.
  configureReviewer(tracker);

  // Wire up the fix-init auto-complete for the retry handler
  _markFixInit = () => tracker.markTaskComplete('fix-init');

  // If the platform is already unlocked at startup, mark fix-init immediately
  if (currentInitResult.success) {
    tracker.markTaskComplete('fix-init');
  }

  // Progress routes — track curriculum completion state
  app.get('/api/progress', (_req, res) => {
    res.json(tracker.getProgress());
  });

  app.post('/api/progress/view-concept', (req, res) => {
    const { slug } = req.body as { slug?: string };
    if (!slug || typeof slug !== 'string') {
      res.status(400).json({ error: 'slug is required' });
      return;
    }
    tracker.markConceptViewed(slug);
    res.json({ ok: true, progress: tracker.getProgress() });
  });

  app.post('/api/progress/complete', (req, res) => {
    const { taskId } = req.body as { taskId?: string };
    if (!taskId || typeof taskId !== 'string') {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }
    tracker.markTaskComplete(taskId);
    res.json({ ok: true, progress: tracker.getProgress() });
  });

  app.post('/api/progress/current-task', (req, res) => {
    const { task } = req.body as { task?: string | null };
    tracker.updateCurrentTask(task ?? null);
    res.json({ ok: true });
  });

  // Review routes — run tests and analyze code quality
  app.post('/api/review/run-tests', async (req, res) => {
    const { file } = req.body as { file?: string };
    console.log('[review] Running tests' + (file ? ` for ${file}` : ' (all)'));
    try {
      const results = await runTests(file);
      res.json({ ok: true, results });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post('/api/review/analyze', (_req, res) => {
    console.log('[review] Analyzing code quality');
    try {
      const analysis = analyzeCode();
      res.json({ ok: true, analysis });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  server.listen(PORT, () => {
    console.log(`[server] Backend running on http://localhost:${PORT}`);
    console.log(`[server] Status endpoint: http://localhost:${PORT}/api/status`);
    console.log(`[server] Agent WebSocket: ws://localhost:${PORT}/ws\n`);
  });
}

start().catch(err => {
  console.error('[server] Fatal error during startup:', err);
  process.exit(1);
});
