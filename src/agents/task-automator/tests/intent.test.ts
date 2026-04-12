/**
 * Intent Classification Tests — tests/intent.test.ts
 *
 * These tests verify that classifyIntent() correctly maps natural-language
 * input to structured intents. Most of them FAIL right now — that's the point.
 *
 * Your goal: implement classifyIntent() in core/intent.ts until all tests pass.
 *
 * Run tests: npm test (from the task-automator directory)
 * Watch mode: npm run test:watch
 *
 * The one test that passes with the stub ("returns UNKNOWN for unrecognized input")
 * is your baseline — it shows the test runner is working.
 */

import { describe, it, expect } from 'vitest';
import { classifyIntent } from '../core/intent';

describe('classifyIntent', () => {

  // ── Email intents ────────────────────────────────────────────

  it('classifies email send requests', () => {
    const result = classifyIntent('Send an email to john@example.com about the project meeting');

    // This FAILS with the stub (returns UNKNOWN).
    // Implement classifyIntent() to detect email send requests.
    expect(result.type).toBe('SEND_EMAIL');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('classifies email read requests', () => {
    const result = classifyIntent('Show me my recent emails from alice@example.com');

    // This FAILS with the stub.
    expect(result.type).toBe('READ_EMAILS');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  // ── Calendar intents ─────────────────────────────────────────

  it('classifies calendar scheduling requests', () => {
    const result = classifyIntent('Schedule a team standup meeting tomorrow at 9am');

    // This FAILS with the stub.
    expect(result.type).toBe('ADD_CALENDAR_EVENT');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('classifies calendar listing requests', () => {
    const result = classifyIntent("What's on my calendar this week?");

    // This FAILS with the stub.
    expect(result.type).toBe('LIST_CALENDAR_EVENTS');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  // ── Unknown intents ───────────────────────────────────────────

  it('returns UNKNOWN for unrecognized input', () => {
    const result = classifyIntent('What is the meaning of life?');

    // This PASSES even with the stub — it's your baseline green test.
    // A well-implemented classifier should still return UNKNOWN for this.
    expect(result.type).toBe('UNKNOWN');
  });

  // ── Entity extraction ─────────────────────────────────────────

  it('extracts the recipient email address from send requests', () => {
    const result = classifyIntent('Send email to alice@example.com with subject Hello there');

    // This FAILS with the stub (extractedEntities is always {}).
    // Your implementation should extract structured data from the input.
    expect(result.type).toBe('SEND_EMAIL');
    expect(result.extractedEntities).toHaveProperty('to');
    expect(result.extractedEntities['to']).toBe('alice@example.com');
  });

  it('extracts the event title from scheduling requests', () => {
    const result = classifyIntent('Schedule a meeting called "Q2 Planning" for next Monday at 3pm');

    // This FAILS with the stub.
    expect(result.type).toBe('ADD_CALENDAR_EVENT');
    expect(result.extractedEntities).toHaveProperty('title');
  });
});
