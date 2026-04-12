/**
 * Agent Memory — core/memory.ts
 *
 * Agents need memory to be useful across multiple turns. Without it, every
 * interaction starts from scratch — the agent forgets what it just did, who
 * it talked to, and what worked or didn't.
 *
 * There are two types of memory:
 *   - Short-term (in-process): What happened in this session
 *   - Long-term (persistent): What happened across past sessions (SQLite, files, etc.)
 *
 * This file defines the Memory interface and a factory that creates memory instances.
 * Right now it's full of stubs — your job is to implement the actual storage logic.
 *
 * See concept: 03-memory-context
 */

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/**
 * A single record of something the agent did.
 * Saved after every action so the agent can look back at its history.
 */
export interface MemoryEntry {
  /** Unique identifier for this entry (use crypto.randomUUID() or a timestamp) */
  id: string;
  /** When the action happened */
  timestamp: Date;
  /** The user's original input that triggered this action */
  input: string;
  /** Which intent was classified (e.g. 'SEND_EMAIL') */
  intent: string;
  /** What the agent responded or did */
  result: string;
  /** Any extra data you want to store (tool params, errors, etc.) */
  metadata: Record<string, unknown>;
}

/**
 * The Memory interface — what all memory implementations must support.
 *
 * You could back this with:
 *   - A plain array (simple, in-memory only)
 *   - SQLite (persistent across restarts)
 *   - A vector database (enables semantic search)
 */
export interface Memory {
  /**
   * Save a new entry to memory.
   * Called after every agent action.
   */
  save(entry: MemoryEntry): Promise<void>;

  /**
   * Retrieve entries relevant to a query string.
   * A simple implementation might do substring matching.
   * A powerful implementation would use vector similarity search.
   *
   * @param query  - What to search for
   * @param limit  - Max number of entries to return (default: 10)
   */
  retrieve(query: string, limit?: number): Promise<MemoryEntry[]>;

  /**
   * Delete all memory entries.
   * Used when the user clicks "Clear Memory" in the dashboard.
   */
  clear(): Promise<void>;

  /**
   * Return every entry in memory (no filtering).
   * Used by the dashboard to display memory state.
   */
  getAll(): Promise<MemoryEntry[]>;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * createMemory — returns a Memory implementation.
 *
 * TODO: Implement the four methods below.
 *
 * What to implement:
 *   Replace each stub with real storage logic. Start simple: an in-memory
 *   array works fine for the first version. You can upgrade to SQLite later.
 *
 * Why it matters for agents:
 *   Memory is what separates a stateless chatbot from a true agent. With
 *   memory, your agent can say "you asked me to email Alice yesterday —
 *   should I follow up?" Without it, every run is a blank slate.
 *
 * See concept: 03-memory-context
 */
export function createMemory(): Memory {
  // TODO: Add storage here (e.g. an array, a SQLite connection, etc.)
  // Hint: Start with a simple array: const entries: MemoryEntry[] = [];

  return {
    /**
     * TODO: Implement save()
     * Store the entry so it can be retrieved later.
     * Type: (entry: MemoryEntry) => Promise<void>
     */
    async save(_entry: MemoryEntry): Promise<void> {
      // TODO: Add _entry to your storage
      // Remove the stub below once implemented.
    },

    /**
     * TODO: Implement retrieve()
     * Return entries whose input or result contains the query string.
     * Type: (query: string, limit?: number) => Promise<MemoryEntry[]>
     *
     * Hint: Array.filter() with String.includes() is a good starting point.
     * Advanced: use SQLite FTS or a vector similarity function.
     */
    async retrieve(_query: string, _limit: number = 10): Promise<MemoryEntry[]> {
      // TODO: Search your storage and return matching entries
      return [];
    },

    /**
     * TODO: Implement clear()
     * Remove all entries from storage.
     * Type: () => Promise<void>
     */
    async clear(): Promise<void> {
      // TODO: Empty your storage
    },

    /**
     * TODO: Implement getAll()
     * Return every entry, newest first.
     * Type: () => Promise<MemoryEntry[]>
     */
    async getAll(): Promise<MemoryEntry[]> {
      // TODO: Return all entries from your storage
      return [];
    },
  };
}
