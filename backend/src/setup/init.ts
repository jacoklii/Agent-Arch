/**
 * Agent Arch - Platform Initialization
 *
 * This file runs when the server starts. It checks that everything is
 * configured correctly before allowing users into the platform.
 *
 * ⚠️  THIS FILE IS INTENTIONALLY BROKEN ⚠️
 *
 * There are 4 bugs in this file, each marked with:
 *   // BUG: explanation of what's wrong
 *   // TODO: what you need to fix
 *
 * Your job is to find and fix all 4 bugs.
 * Read the error messages on the locked screen - they'll guide you.
 *
 * When all bugs are fixed AND your .env file is set up correctly,
 * clicking "Retry Initialization" will unlock the platform.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

dotenv.config();

// ============================================================
// Types
// ============================================================

export interface InitError {
  category: 'ENV' | 'AUTH' | 'DB' | 'API';
  message: string;
  hint: string;
}

export interface InitResult {
  success: boolean;
  errors: InitError[];
}

// ============================================================
// BUG #1: Environment Variable Validation
//
// This function is supposed to check that all required environment
// variables exist before the app starts. Without these checks,
// the app will crash later with cryptic errors instead of helpful ones.
//
// TODO: Fix the check below so it correctly detects missing variables.
//       process.env.SOME_VAR returns `undefined` when the variable isn't set.
//       The current comparison is checking for the wrong value.
// ============================================================
function validateEnvironment(): InitError[] {
  const errors: InitError[] = [];
  const required = [
    { name: 'CLAUDE_API_KEY', description: 'Your Claude API key' },
    { name: 'SESSION_SECRET', description: 'Secret key for session security' },
    { name: 'NODE_ENV', description: 'Application environment' },
  ];

  for (const variable of required) {
    // BUG: process.env returns `undefined` for missing variables, not `null`
    //      This check will never catch missing variables!
    if (process.env[variable.name] === null) {
      errors.push({
        category: 'ENV',
        message: `Missing required environment variable: ${variable.name} (${variable.description})`,
        hint: `Add ${variable.name} to your .env file. See .env.example for reference.`,
      });
    }
  }

  return errors;
}

// ============================================================
// BUG #2: Auth Initialization
//
// Session secrets protect your application from session hijacking.
// They need to be long and random — a short or empty secret is
// a security vulnerability.
//
// TODO: Fix the length check so it requires at least 32 characters.
//       The current check is too permissive.
// ============================================================
function initAuth(): InitError | null {
  const sessionSecret = process.env.SESSION_SECRET || '';

  // BUG: This only checks that the secret is not empty (length >= 1).
  //      A secret of "x" would pass this check — that's dangerously insecure.
  //      Fix: require at least 32 characters for a secure secret.
  if (sessionSecret.length < 1) {
    return {
      category: 'AUTH',
      message: `Session secret is missing or too short (found ${sessionSecret.length} chars, need 32+)`,
      hint: 'Set SESSION_SECRET in your .env file to a random 32+ character string. Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    };
  }

  return null;
}

// ============================================================
// BUG #3: Database Connection
//
// SQLite needs to write a database file to disk. The path below
// is correct, but there's a step missing before we try to open it.
//
// TODO: Ensure the parent directory exists before opening the database.
//       SQLite cannot create intermediate directories automatically.
//       Add the missing line before `new Database(DB_PATH)`.
// ============================================================

// The database file lives in the project's data/ directory
const DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'agent-arch.db');

function initDatabase(): InitError | null {
  try {
    const dir = path.dirname(DB_PATH);

    // BUG: The data/ directory doesn't exist yet and we never create it.
    //      SQLite will fail with SQLITE_CANTOPEN because it can't write to
    //      a directory that doesn't exist.
    //
    //      TODO: Add this line before opening the database:
    //      if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    //
    //      (The `dir` variable above already has the correct path)

    const db = new Database(DB_PATH);

    // Set up the initial schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS platform_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Record successful initialization
    const insert = db.prepare(
      `INSERT OR REPLACE INTO platform_state (key, value) VALUES (?, ?)`
    );
    insert.run('initialized_at', new Date().toISOString());

    db.close();
    return null;
  } catch (error) {
    return {
      category: 'DB',
      message: `Database initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      hint: 'The data/ directory needs to exist before SQLite can create the database file. Check the TODO comment in initDatabase().',
    };
  }
}

// ============================================================
// BUG #4: API Key Validation
//
// Before the platform starts, we validate that the Claude API key
// looks correct. Claude API keys always start with "sk-ant-".
//
// TODO: Fix the validation logic — the condition is inverted.
//       The function currently approves invalid keys and rejects valid ones.
// ============================================================
function validateApiKey(): InitError | null {
  const apiKey = process.env.CLAUDE_API_KEY || '';

  if (!apiKey) {
    return {
      category: 'API',
      message: 'CLAUDE_API_KEY is not set',
      hint: 'Add your Claude API key to .env. Get one at https://console.anthropic.com. Keys look like: sk-ant-api03-...',
    };
  }

  // BUG: This logic is inverted! `=== false` flips the boolean result.
  //      For a key like "sk-ant-api03-abc123":
  //        "sk-ant-api03-abc123".startsWith("sk-ant-") → true
  //        true === false → false  ← so isValid is false for a VALID key!
  //
  //      TODO: Remove the `=== false` to fix the logic.
  const isValid = apiKey.startsWith('sk-ant-') === false;

  if (!isValid) {
    return {
      category: 'API',
      message: `Invalid API key format (key does not start with "sk-ant-")`,
      hint: 'Check your CLAUDE_API_KEY in .env. Valid keys start with "sk-ant-". You can find your key at https://console.anthropic.com',
    };
  }

  return null;
}

// ============================================================
// Main Initialization Function
//
// Runs all checks in sequence and collects errors.
// Called by the server on startup and on retry requests.
// ============================================================
export async function initPlatform(): Promise<InitResult> {
  const errors: InitError[] = [];

  // Run all checks
  const envErrors = validateEnvironment();
  errors.push(...envErrors);

  const authError = initAuth();
  if (authError) errors.push(authError);

  const dbError = initDatabase();
  if (dbError) errors.push(dbError);

  const apiError = validateApiKey();
  if (apiError) errors.push(apiError);

  return {
    success: errors.length === 0,
    errors,
  };
}
