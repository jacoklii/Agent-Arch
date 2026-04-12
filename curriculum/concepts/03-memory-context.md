---
title: "Memory & Context"
order: 3
prerequisites: ["01-what-is-an-agent"]
summary: "Short-term vs. long-term memory, context window limits, and strategies for what to remember and forget."
---

# Memory & Context

Every LLM has a context window — a fixed-size buffer of tokens it can "see" at once. For a single chat message, this is plenty. For an agent that runs for hours, processes thousands of messages, and needs to remember user preferences from last week, it's a fundamental constraint you must design around.

## Two Types of Memory

**Short-term (in-context):** Everything in the current conversation array. Fast to access, automatically available to the model, but limited and ephemeral — gone when the process restarts.

**Long-term (external storage):** Information persisted to a database, file, or vector store. Survives restarts, can be arbitrarily large, but requires explicit retrieval — the model can't "see" it unless you put relevant parts into the context window.

## Implementing a Memory Interface

```typescript
interface Memory {
  // Persist a key-value pair to storage
  save(key: string, value: unknown): Promise<void>;

  // Retrieve a value — returns null if not found
  retrieve(key: string): Promise<unknown | null>;

  // List all keys (useful for building context summaries)
  list(): Promise<string[]>;

  // Delete everything (for testing / fresh starts)
  clear(): Promise<void>;
}
```

A concrete implementation might use SQLite:

```typescript
import Database from 'better-sqlite3';

const db = new Database('data/agent.db');
db.exec(`CREATE TABLE IF NOT EXISTS memory (key TEXT PRIMARY KEY, value TEXT)`);

async function save(key: string, value: unknown): Promise<void> {
  db.prepare(`INSERT OR REPLACE INTO memory (key, value) VALUES (?, ?)`)
    .run(key, JSON.stringify(value));
}
```

## Context Management Strategies

**Summarization:** When conversation history gets long, ask the model to summarize older exchanges into a compact paragraph, then replace those messages with the summary.

**Selective retrieval:** Don't dump all memory into every prompt. Search for relevant memories based on the current task (keyword match or semantic search) and inject only those.

**Structured memory:** Store typed records (tasks, preferences, facts) rather than raw text blobs. Easier to query, update, and reason about.

## The Forgetting Problem

More memory isn't always better. An agent that remembers everything will eventually inject irrelevant, outdated, or contradictory context. Build in a TTL (time-to-live) for memories, and mark facts as superseded when they're updated.

## Memory Architecture Visualised

```
┌─────────────────────────────────────────────────────┐
│                  Agent Memory                       │
│                                                     │
│  Short-term (in-context)       Long-term (SQLite)   │
│  ┌───────────────────┐         ┌─────────────────┐  │
│  │ messages array    │         │ memory table    │  │
│  │ [ user: "..."     │         │ key │ value     │  │
│  │   tool: "email"   │◀──────  │─────────────────│  │
│  │   result: "sent"  │ inject  │ pref│ {"tz":..} │  │
│  │   ...             │         │ ctx │ {"task":..}│  │
│  └───────────────────┘         └────────┬────────┘  │
│           │                             │           │
│           │ retrieve(key)               │           │
│           └─────────────────────────────┘           │
│                                                     │
│  Model only "sees" what's in the context array.     │
│  You control what gets retrieved and injected.      │
└─────────────────────────────────────────────────────┘
```

## In the Codebase

Open `src/agents/task-automator/core/memory.ts`. The `Memory` interface is defined and the `createMemory()` factory is stubbed. All four methods (`save`, `retrieve`, `getAll`, `clear`) throw `"not implemented"`.

Run `npm test` and watch `tests/memory.test.ts` fail — those failing tests are your specification.

## Hints

**Hint 1 (direction):** Start with an in-memory implementation using a `Map<string, unknown>`. Get the tests passing first, then swap in SQLite. The interface stays the same — only the backing store changes.

**Hint 2 (structure):** For the SQLite version, you only need one table: `CREATE TABLE IF NOT EXISTS memory (key TEXT PRIMARY KEY, value TEXT)`. Store values as `JSON.stringify()` and parse on retrieval.

**Hint 3 (retrieve with query):** The `retrieve(query)` method in the test expects a fuzzy search — it should return entries whose key *contains* the query string. Use `WHERE key LIKE ?` with `%${query}%` as the parameter.

## Quiz

**Q1.** Your agent processes 10,000 messages over a week. Putting all of them into the context window each time would be expensive and slow. What's the best approach?

- A) Only keep the last 5 messages — context beyond that isn't useful
- B) Summarise old messages into a compact paragraph and store recent messages in full
- C) Use a bigger model with a larger context window
- D) Delete old messages permanently

> **Answer:** B — Summarisation preserves important information from older exchanges without using the full token budget. The model needs *recent* exchanges in full for coherence.

---

**Q2.** An agent remembers a user preference: "always schedule meetings at 9am". Six months later the user says they hate morning meetings. The agent still schedules at 9am. What went wrong?

- A) The memory system was too slow
- B) The stored preference was never updated — the agent acted on stale memory
- C) The context window was too small
- D) The model ignored the memory

> **Answer:** B — Memory must be updatable. When the user states a new preference, the agent should `save()` the new value (overwriting the old one), not just append.

---

**Q3.** How would you verify that your `memory.save()` actually persists across process restarts?

- A) Run the tests — they check for persistence automatically
- B) Add a `console.log` inside `save()`
- C) Write a test that saves a value, kills the process, restarts it, and calls `retrieve()` to check it's still there
- D) Persistence isn't needed for an agent

> **Answer:** C — A unit test that mocks the database doesn't test real persistence. You need a test that creates a real SQLite file and verifies it survives a fresh `createMemory()` call.

## Deep Dive: Vector Memory for Semantic Retrieval

Key-value lookups work when you know exactly what you're looking for. But what if you want to find memories *related to* a task without knowing the exact key?

Vector memory solves this: instead of storing `key → value`, you store `text → embedding → value`, where the embedding is a dense numerical representation of the text's *meaning*. At retrieval time, you embed the query and find the stored items closest in "meaning space".

```typescript
// Conceptually:
const results = await vectorDB.search({
  query: "what are the user's communication preferences?",
  topK: 3,
});
// Returns memories about email preferences, Slack preferences, etc.
// even if none of them used the word "communication"
```

Libraries: `chromadb`, `qdrant-client`, or use SQLite + the `sqlite-vss` extension for a zero-setup option. This becomes important when your agent accumulates thousands of memories and simple key lookup is no longer sufficient.

## Questions to Consider

- How would you decide which memories are "relevant" for a given task?
- What's the risk of an agent acting on stale memory?
- How would you test that your memory system persists correctly across restarts?
