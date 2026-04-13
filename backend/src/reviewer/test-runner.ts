/**
 * Test Runner
 *
 * Executes the vitest test suite for the task-automator agent and returns
 * structured pass/fail results. Used by the teaching assistant to verify
 * user implementations before marking tasks as complete.
 *
 * How it works:
 *   1. Spawns `npm test -- --reporter=json` in the task-automator directory
 *   2. Captures stdout (vitest writes JSON there with --reporter=json)
 *   3. Parses the JSON into TestResult[]
 *   4. Returns results even when tests fail (non-zero exit is expected)
 *
 * If vitest crashes before producing output (e.g. TypeScript compile error),
 * returns a synthetic error result explaining what happened.
 */

import { exec } from 'child_process';
import * as path from 'path';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface TestResult {
  file: string;         // basename, e.g. "intent.test.ts"
  passed: number;
  failed: number;
  errors: Array<{
    test: string;       // test name
    message: string;    // failure message / stack
  }>;
}

// Vitest JSON reporter output (partial shape — only what we need)
interface VitestJsonOutput {
  testResults?: Array<{
    testFilePath?: string;  // some versions use this
    name?: string;          // vitest v1 uses 'name'
    status?: string;
    assertionResults?: Array<{
      title?: string;
      ancestorTitles?: string[];
      status?: string;        // 'passed' | 'failed'
      failureMessages?: string[];
    }>;
  }>;
  // v2+ shape
  files?: Array<{
    filepath?: string;
    tasks?: Array<{
      name?: string;
      result?: { state?: string; errors?: Array<{ message?: string }> };
    }>;
  }>;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const AGENT_DIR = path.resolve(__dirname, '../../../src/agents/task-automator');
const TIMEOUT_MS = 30_000;

function syntheticError(message: string): TestResult[] {
  return [{
    file: 'all tests',
    passed: 0,
    failed: 1,
    errors: [{ test: 'runner', message }],
  }];
}

/** Extract just the filename from a full path */
function basename(filePath: string): string {
  return path.basename(filePath);
}

/** Parse vitest v1 JSON output (testResults array) */
function parseV1(output: VitestJsonOutput): TestResult[] | null {
  if (!output.testResults || !Array.isArray(output.testResults)) return null;

  return output.testResults.map(suite => {
    const file = basename(suite.testFilePath ?? suite.name ?? 'unknown');
    const assertions = suite.assertionResults ?? [];
    const passed = assertions.filter(a => a.status === 'passed').length;
    const failed = assertions.filter(a => a.status === 'failed').length;
    const errors = assertions
      .filter(a => a.status === 'failed')
      .map(a => ({
        test: [...(a.ancestorTitles ?? []), a.title ?? ''].filter(Boolean).join(' > '),
        message: (a.failureMessages ?? []).join('\n').trim() || 'Test failed',
      }));

    return { file, passed, failed, errors };
  });
}

/** Parse vitest v2+ JSON output (files array) */
function parseV2(output: VitestJsonOutput): TestResult[] | null {
  if (!output.files || !Array.isArray(output.files)) return null;

  return output.files.map(suite => {
    const file = basename(suite.filepath ?? 'unknown');
    const tasks = suite.tasks ?? [];
    const passed = tasks.filter(t => t.result?.state === 'pass').length;
    const failed = tasks.filter(t => t.result?.state === 'fail').length;
    const errors = tasks
      .filter(t => t.result?.state === 'fail')
      .map(t => ({
        test: t.name ?? 'unknown test',
        message: (t.result?.errors ?? []).map(e => e.message ?? '').join('\n').trim() || 'Test failed',
      }));

    return { file, passed, failed, errors };
  });
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

/**
 * runTests(file?)
 *
 * Runs the full test suite (or a specific file) in the task-automator directory.
 * Always resolves — never rejects. Test failures return results with failed > 0.
 *
 * @param file  Optional test filename, e.g. "intent.test.ts"
 */
export async function runTests(file?: string): Promise<TestResult[]> {
  return new Promise(resolve => {
    // Build the command:
    // `npm test` runs `vitest run` per task-automator/package.json
    // We add `-- --reporter=json` to get machine-readable output on stdout
    const fileArg = file ? ` -- --reporter=json ${file}` : ' -- --reporter=json';
    const cmd = `npm test${fileArg}`;

    exec(cmd, { cwd: AGENT_DIR, timeout: TIMEOUT_MS }, (_err, stdout, stderr) => {
      // _err may be non-null when tests fail (non-zero exit) — that's expected.
      // We still try to parse the output.

      // Extract JSON from stdout — vitest may print non-JSON lines before/after
      const jsonStart = stdout.indexOf('{');
      if (jsonStart === -1) {
        const hint = stderr
          ? `stderr: ${stderr.slice(0, 300)}`
          : 'No JSON output captured. Ensure vitest is installed: cd src/agents/task-automator && npm install';
        resolve(syntheticError(`Could not parse test output. ${hint}`));
        return;
      }

      const jsonString = stdout.slice(jsonStart);

      let parsed: VitestJsonOutput;
      try {
        parsed = JSON.parse(jsonString);
      } catch {
        resolve(syntheticError(`Malformed JSON from vitest. First 200 chars of stdout: ${jsonString.slice(0, 200)}`));
        return;
      }

      // Try v1 format first, then v2
      const results = parseV1(parsed) ?? parseV2(parsed);
      if (!results) {
        resolve(syntheticError('Unrecognized vitest JSON format. Upgrade agent-arch or report a bug.'));
        return;
      }

      if (results.length === 0) {
        resolve([{ file: 'no tests found', passed: 0, failed: 0, errors: [] }]);
        return;
      }

      resolve(results);
    });
  });
}
