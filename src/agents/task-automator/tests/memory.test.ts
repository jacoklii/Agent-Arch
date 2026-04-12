/**
 * Memory Tests — tests/memory.test.ts
 *
 * These tests verify that the memory system correctly stores and retrieves
 * agent activity. Most of them FAIL right now — that's the point.
 *
 * Your goal: implement the memory functions in core/memory.ts until all tests pass.
 *
 * Run tests: npm test (from the task-automator directory)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemory, MemoryEntry } from '../core/memory';

// Helper to create a test memory entry
function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date(),
    input: 'test input',
    intent: 'UNKNOWN',
    result: 'test result',
    metadata: {},
    ...overrides,
  };
}

describe('Memory', () => {
  // Create a fresh memory instance before each test.
  // This ensures tests don't interfere with each other.
  let memory: ReturnType<typeof createMemory>;

  beforeEach(() => {
    memory = createMemory();
  });

  // ── save() and getAll() ───────────────────────────────────────

  it('saves an entry and retrieves it with getAll()', async () => {
    const entry = makeEntry({ input: 'send email to bob', intent: 'SEND_EMAIL' });

    await memory.save(entry);
    const all = await memory.getAll();

    // This FAILS with the stub (getAll always returns []).
    // Implement save() to store entries and getAll() to return them.
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(entry.id);
    expect(all[0].input).toBe('send email to bob');
  });

  it('stores multiple entries independently', async () => {
    await memory.save(makeEntry({ input: 'first action', intent: 'SEND_EMAIL' }));
    await memory.save(makeEntry({ input: 'second action', intent: 'ADD_CALENDAR_EVENT' }));
    await memory.save(makeEntry({ input: 'third action', intent: 'READ_EMAILS' }));

    const all = await memory.getAll();

    // This FAILS with the stub.
    expect(all).toHaveLength(3);
  });

  // ── clear() ───────────────────────────────────────────────────

  it('clears all entries', async () => {
    await memory.save(makeEntry({ input: 'something to forget' }));
    await memory.save(makeEntry({ input: 'another thing' }));

    await memory.clear();
    const all = await memory.getAll();

    // This PASSES vacuously with the stub (save is a no-op so nothing was
    // stored, and clear is also a no-op, and getAll returns []).
    // Once you implement save() and getAll(), this test will still pass
    // IF you also implement clear() correctly.
    expect(all).toHaveLength(0);
  });

  // ── retrieve() ────────────────────────────────────────────────

  it('retrieves entries matching a query string', async () => {
    await memory.save(makeEntry({ input: 'send email to bob@example.com', intent: 'SEND_EMAIL' }));
    await memory.save(makeEntry({ input: 'schedule a meeting', intent: 'ADD_CALENDAR_EVENT' }));
    await memory.save(makeEntry({ input: 'send email to carol@example.com', intent: 'SEND_EMAIL' }));

    const results = await memory.retrieve('email');

    // This FAILS with the stub (retrieve always returns []).
    // Implement retrieve() to filter entries by the query string.
    // A simple implementation: filter by entries where input.includes(query).
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(e => e.input.includes('email'))).toBe(true);
  });

  it('returns an empty array when no entries match the query', async () => {
    await memory.save(makeEntry({ input: 'schedule a meeting' }));

    const results = await memory.retrieve('email');

    // This PASSES with the stub (retrieve returns [] and we expect length 0).
    // Once you implement retrieve(), this should still pass — no emails saved.
    expect(results).toHaveLength(0);
  });

  it('respects the limit parameter in retrieve()', async () => {
    // Save 5 email entries
    for (let i = 0; i < 5; i++) {
      await memory.save(makeEntry({ input: `email action ${i}` }));
    }

    const results = await memory.retrieve('email', 2);

    // This FAILS with the stub.
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results.length).toBeGreaterThan(0);
  });
});
