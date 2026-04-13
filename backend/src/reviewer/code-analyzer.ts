/**
 * Code Analyzer
 *
 * Inspects the user's agent implementation files for code quality issues:
 * remaining stubs, missing error handling, TypeScript `any` usage, and
 * missing documentation.
 *
 * Uses regex patterns rather than AST parsing — fast enough for the
 * educational feedback loop, and much simpler to maintain.
 *
 * Files analyzed:
 *   - src/agents/task-automator/core/intent.ts
 *   - src/agents/task-automator/core/memory.ts
 *   - src/agents/task-automator/tools/email.ts
 *   - src/agents/task-automator/tools/calendar.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface FileAnalysis {
  hasErrorHandling: boolean; // try/catch present
  hasAnyTypes: boolean;      // TypeScript `any` found
  hasStubs: boolean;         // unimplemented TODO stubs remain
  hasDocumentation: boolean; // JSDoc /** */ blocks present
  lineCount: number;
}

export interface AnalysisResult {
  score: number;             // 0–100 overall quality score
  issues: string[];          // specific problems found
  suggestions: string[];     // actionable improvement hints
  hasStubs: boolean;         // true if ANY file still has stubs
  fileResults: Record<string, FileAnalysis>;
}

// ────────────────────────────────────────────────────────────
// Files to analyze (relative to project root)
// ────────────────────────────────────────────────────────────

const AGENT_DIR = path.resolve(__dirname, '../../../src/agents/task-automator');

const FILES_TO_CHECK = [
  { key: 'intent.ts',   rel: 'core/intent.ts'   },
  { key: 'memory.ts',   rel: 'core/memory.ts'   },
  { key: 'email.ts',    rel: 'tools/email.ts'   },
  { key: 'calendar.ts', rel: 'tools/calendar.ts' },
];

// ────────────────────────────────────────────────────────────
// Patterns
// ────────────────────────────────────────────────────────────

// Stub detection: the original template throws "not implemented" errors
const STUB_PATTERNS = [
  /throw new Error\(['"`].*not implemented.*['"`]\)/i,
  /\/\/\s*TODO:/i,
  /\/\/\s*IMPLEMENT:/i,
  /Promise\.resolve\(\[\]\)/,      // stub memory.retrieve returning empty array
  /Promise\.resolve\(\)/,          // stub no-op saves
];

// TypeScript `any` usage (type annotation or cast)
const ANY_PATTERNS = [
  /:\s*any\b/,
  /\bas\s+any\b/,
  /<any>/,
];

// Error handling (at least one try/catch)
const ERROR_HANDLING_PATTERN = /\btry\s*\{[\s\S]*?\bcatch\b/;

// Documentation (JSDoc-style block comment)
const JSDOC_PATTERN = /\/\*\*/;

// ────────────────────────────────────────────────────────────
// Scoring weights
// ────────────────────────────────────────────────────────────

// Each file starts at 25 points. Deductions per issue:
const DEDUCTIONS = {
  stub: 15,          // unimplemented stub remaining
  noErrorHandling: 8, // no try/catch
  anyType: 3,        // each `any` usage
  noDocumentation: 2, // missing JSDoc
};

// ────────────────────────────────────────────────────────────
// Analysis logic
// ────────────────────────────────────────────────────────────

function analyzeFile(filePath: string): FileAnalysis {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    // File doesn't exist yet
    return {
      hasErrorHandling: false,
      hasAnyTypes: false,
      hasStubs: true,
      hasDocumentation: false,
      lineCount: 0,
    };
  }

  const hasStubs = STUB_PATTERNS.some(p => p.test(content));
  const hasAnyTypes = ANY_PATTERNS.some(p => p.test(content));
  const hasErrorHandling = ERROR_HANDLING_PATTERN.test(content);
  const hasDocumentation = JSDOC_PATTERN.test(content);
  const lineCount = content.split('\n').length;

  return { hasStubs, hasAnyTypes, hasErrorHandling, hasDocumentation, lineCount };
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

/**
 * analyzeCode()
 *
 * Analyzes the 4 agent implementation files and returns a quality report
 * with score, specific issues, and actionable suggestions.
 */
export function analyzeCode(): AnalysisResult {
  const fileResults: Record<string, FileAnalysis> = {};
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  let anyStubsRemaining = false;

  for (const { key, rel } of FILES_TO_CHECK) {
    const fullPath = path.join(AGENT_DIR, rel);
    const analysis = analyzeFile(fullPath);
    fileResults[key] = analysis;

    if (analysis.hasStubs) {
      anyStubsRemaining = true;
      issues.push(`${key}: Contains unimplemented stub code`);
      suggestions.push(`${key}: Replace the "not implemented" throws with your real implementation`);
      score -= DEDUCTIONS.stub;
    }

    if (!analysis.hasErrorHandling && analysis.lineCount > 20) {
      issues.push(`${key}: No try/catch error handling found`);
      suggestions.push(`${key}: Wrap async operations in try/catch to handle failures gracefully`);
      score -= DEDUCTIONS.noErrorHandling;
    }

    if (analysis.hasAnyTypes) {
      issues.push(`${key}: TypeScript \`any\` type detected — reduces type safety`);
      suggestions.push(`${key}: Replace \`any\` with specific types or \`unknown\` where needed`);
      score -= DEDUCTIONS.anyType;
    }

    if (!analysis.hasDocumentation && analysis.lineCount > 30) {
      suggestions.push(`${key}: Consider adding JSDoc comments to exported functions`);
      score -= DEDUCTIONS.noDocumentation;
    }
  }

  // Clamp score to 0–100
  score = Math.max(0, Math.min(100, score));

  // Add positive feedback if score is high
  if (score >= 80 && !anyStubsRemaining) {
    suggestions.push('Good work! Code quality looks solid. Focus on getting the tests to pass.');
  } else if (anyStubsRemaining) {
    suggestions.push('Start by implementing the stubs — even a minimal working version is better than a throw.');
  }

  return {
    score,
    issues,
    suggestions,
    hasStubs: anyStubsRemaining,
    fileResults,
  };
}
