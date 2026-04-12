---
title: "Exercise: Memory System"
concept: "03-memory-context"
difficulty: "beginner"
recommendation: "try-yourself-first"
---

# Exercise: Memory System

## Objective

Implement the four methods in `src/agents/task-automator/core/memory.ts`: `save()`, `retrieve()`, `getAll()`, and `clear()`. These methods form the persistence layer that lets your agent remember things across messages and restarts.

---

## Starting Point

**File:** `src/agents/task-automator/core/memory.ts`

The `Memory` interface and `createMemory()` factory function are already defined. All four methods currently throw `"not implemented"`. Your task is to implement them.

The interface:

```typescript
interface Memory {
  save(key: string, value: unknown): Promise<void>;
  retrieve(query: string): Promise<MemoryEntry[]>;
  getAll(): Promise<MemoryEntry[]>;
  clear(): Promise<void>;
}
```

---

## Expected Outcome

After implementation:
- `save("user_pref", { timezone: "UTC" })` stores the value
- `getAll()` returns all stored entries
- `retrieve("user")` returns entries whose key contains `"user"`
- `clear()` removes all entries
- The data persists when you create a new `createMemory()` instance pointing to the same database file

---

## Test Criteria

```bash
cd src/agents/task-automator
npm test
```

`tests/memory.test.ts` has 7 test cases covering all four methods. All 7 should pass when your implementation is complete.

---

## Hints

> Work through these in order — each unlocks the next level.

**Hint 1 — Start in-memory:**
Don't start with SQLite. First implement the methods using a `Map<string, MemoryEntry>` stored in a module-level variable. Get all 7 tests green. This proves your logic is correct before you add database complexity.

```typescript
// Start here:
const store = new Map<string, MemoryEntry>();
```

**Hint 2 — Add SQLite:**
Once tests pass with the Map, swap in `better-sqlite3`. The schema is one table:

```sql
CREATE TABLE IF NOT EXISTS memory (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Use `JSON.stringify(value)` when saving and `JSON.parse(row.value)` when retrieving. `INSERT OR REPLACE` handles updates.

**Hint 3 — The `retrieve(query)` method:**
This method should do a fuzzy search by key. Use a `WHERE key LIKE ?` query with `%${query}%` as the parameter. The tests call `retrieve("user")` expecting to find entries whose key contains the word "user".

---

## Should I Use Claude Code?

**Try the in-memory implementation yourself first** — it's 20 lines and a great exercise in understanding the interface. For the SQLite integration, if you've never used `better-sqlite3`, you can use Claude Code to scaffold the database setup. Review the generated code carefully: understand the `prepare()` / `run()` / `all()` pattern before moving on.
