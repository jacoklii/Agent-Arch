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

## Questions to Consider

- How would you decide which memories are "relevant" for a given task?
- What's the risk of an agent acting on stale memory?
- How would you test that your memory system persists correctly across restarts?
