/**
 * Agent Arch - Express Server
 *
 * Starts the backend API server. On startup, runs platform initialization.
 * The frontend polls /api/status to know whether to show the locked screen.
 *
 * Endpoints:
 *   GET  /api/status      → { locked, errors }
 *   POST /api/retry-init  → re-runs initPlatform(), returns new status
 */

import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { initPlatform, InitResult } from './setup/init';
import {
  welcomeHandler,
  chatHandler,
  resetChatHandler,
  curriculumListHandler,
  curriculumHandler,
} from './assistant-service/chat-handler';

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

  app.listen(PORT, () => {
    console.log(`[server] Backend running on http://localhost:${PORT}`);
    console.log(`[server] Status endpoint: http://localhost:${PORT}/api/status\n`);
  });
}

start().catch(err => {
  console.error('[server] Fatal error during startup:', err);
  process.exit(1);
});
