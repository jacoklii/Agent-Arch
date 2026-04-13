/**
 * Progress Tracker
 *
 * SQLite-backed system for tracking user progress through the Agent Arch
 * curriculum. Stores which tasks are complete, which concepts have been
 * viewed, and quiz scores.
 *
 * All state is stored in the `user_progress` table. Single-user design —
 * userId is always 'default' (matches the single-user model used throughout
 * the rest of the backend).
 *
 * Used by:
 *   - server.ts: exposes /api/progress/* endpoints
 *   - chat-handler.ts: Claude tools call getProgress() and markTaskComplete()
 *   - ProgressTracker.tsx: polls /api/progress every 5 seconds
 */

import Database from 'better-sqlite3';

// ────────────────────────────────────────────────────────────
// Curriculum task list
// The ordered list of all 11 curriculum milestones.
// Lock logic: task at index N is locked if task at index N-1 is incomplete.
// ────────────────────────────────────────────────────────────

export const CURRICULUM_TASKS = [
  { id: 'fix-init',            label: 'Fix the broken init.ts',               requiresTest: false },
  { id: 'meet-assistant',      label: 'Have first conversation',               requiresTest: false },
  { id: 'choose-agent-type',   label: 'Choose your agent type',                requiresTest: false },
  { id: 'view-what-is-agent',  label: 'Read: What is an Agent?',               requiresTest: false },
  { id: 'view-mcp-tools',      label: 'Read: MCP and Tools',                   requiresTest: false },
  { id: 'view-memory-context', label: 'Read: Memory & Context',                requiresTest: false },
  { id: 'implement-intent',    label: 'Implement intent classification',        requiresTest: true },
  { id: 'implement-memory',    label: 'Implement memory system',               requiresTest: true },
  { id: 'implement-email',     label: 'Implement email tool',                  requiresTest: false },
  { id: 'implement-calendar',  label: 'Implement calendar tool',               requiresTest: false },
  { id: 'all-tests-pass',      label: 'All agent tests pass',                  requiresTest: true },
] as const;

const TOTAL_TASKS = CURRICULUM_TASKS.length;

// Map concept slugs to the task IDs they unlock
const CONCEPT_TO_TASK: Record<string, string> = {
  '01-what-is-an-agent': 'view-what-is-agent',
  '02-mcp-and-tools':    'view-mcp-tools',
  '03-memory-context':   'view-memory-context',
};

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface Progress {
  userId: string;
  conceptsViewed: string[];
  tasksCompleted: string[];
  quizScores: Record<string, number>;
  currentTask: string | null;
  overallProgress: number; // 0–100, computed from tasksCompleted.length / TOTAL_TASKS
}

interface ProgressRow {
  user_id: string;
  concepts_viewed: string;
  tasks_completed: string;
  quiz_scores: string;
  current_task: string | null;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────

/**
 * createProgressTracker(db)
 *
 * Creates the user_progress table if it doesn't exist, then returns
 * an object with methods for reading and updating progress.
 *
 * Pattern matches createExecutor() in agent-runtime/executor.ts.
 */
export function createProgressTracker(db: Database.Database) {
  // Create table on first use
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_progress (
      user_id         TEXT NOT NULL DEFAULT 'default' PRIMARY KEY,
      concepts_viewed TEXT NOT NULL DEFAULT '[]',
      tasks_completed TEXT NOT NULL DEFAULT '[]',
      quiz_scores     TEXT NOT NULL DEFAULT '{}',
      current_task    TEXT,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure the default user row exists
  db.prepare(`
    INSERT OR IGNORE INTO user_progress (user_id) VALUES ('default')
  `).run();

  // ── Prepared statements ──────────────────────────────────

  const getRow = db.prepare<[], ProgressRow>(
    `SELECT * FROM user_progress WHERE user_id = 'default'`
  );

  const updateRow = db.prepare<[string, string, string, string | null]>(`
    UPDATE user_progress
    SET concepts_viewed = ?,
        tasks_completed = ?,
        quiz_scores     = ?,
        current_task    = ?,
        updated_at      = CURRENT_TIMESTAMP
    WHERE user_id = 'default'
  `);

  // ── Helpers ──────────────────────────────────────────────

  function readRow(): ProgressRow {
    return getRow.get()!;
  }

  function toProgress(row: ProgressRow): Progress {
    const tasksCompleted: string[] = JSON.parse(row.tasks_completed);
    return {
      userId: row.user_id,
      conceptsViewed: JSON.parse(row.concepts_viewed),
      tasksCompleted,
      quizScores: JSON.parse(row.quiz_scores),
      currentTask: row.current_task,
      overallProgress: Math.round((tasksCompleted.length / TOTAL_TASKS) * 100),
    };
  }

  function save(row: ProgressRow, conceptsViewed: string[], tasksCompleted: string[], quizScores: Record<string, number>, currentTask: string | null) {
    updateRow.run(
      JSON.stringify(conceptsViewed),
      JSON.stringify(tasksCompleted),
      JSON.stringify(quizScores),
      currentTask
    );
    // suppress unused warning
    void row;
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Returns the current progress state for the default user.
   */
  function getProgress(): Progress {
    return toProgress(readRow());
  }

  /**
   * Records that the user has viewed a concept lesson.
   * If the concept maps to a task (e.g. viewing "01-what-is-an-agent"
   * completes "view-what-is-agent"), that task is also marked complete.
   */
  function markConceptViewed(slug: string): void {
    const row = readRow();
    const conceptsViewed: string[] = JSON.parse(row.concepts_viewed);
    const tasksCompleted: string[] = JSON.parse(row.tasks_completed);
    const quizScores: Record<string, number> = JSON.parse(row.quiz_scores);

    if (!conceptsViewed.includes(slug)) {
      conceptsViewed.push(slug);
    }

    // Auto-complete the linked task if it exists
    const linkedTask = CONCEPT_TO_TASK[slug];
    if (linkedTask && !tasksCompleted.includes(linkedTask)) {
      tasksCompleted.push(linkedTask);
      console.log(`[progress] Auto-completed task "${linkedTask}" from viewing concept "${slug}"`);
    }

    save(row, conceptsViewed, tasksCompleted, quizScores, row.current_task);
  }

  /**
   * Marks a specific curriculum task as complete.
   * Idempotent — calling multiple times is safe.
   */
  function markTaskComplete(taskId: string): void {
    const row = readRow();
    const conceptsViewed: string[] = JSON.parse(row.concepts_viewed);
    const tasksCompleted: string[] = JSON.parse(row.tasks_completed);
    const quizScores: Record<string, number> = JSON.parse(row.quiz_scores);

    if (!tasksCompleted.includes(taskId)) {
      tasksCompleted.push(taskId);
      console.log(`[progress] Task "${taskId}" marked complete (${tasksCompleted.length}/${TOTAL_TASKS})`);
    }

    // Auto-advance current task to the next incomplete one
    const nextTask = CURRICULUM_TASKS.find(t => !tasksCompleted.includes(t.id))?.id ?? null;
    save(row, conceptsViewed, tasksCompleted, quizScores, nextTask);
  }

  /**
   * Updates the user's current active task (what they're working on now).
   * The assistant calls this when guiding users to the next step.
   */
  function updateCurrentTask(task: string | null): void {
    const row = readRow();
    const conceptsViewed: string[] = JSON.parse(row.concepts_viewed);
    const tasksCompleted: string[] = JSON.parse(row.tasks_completed);
    const quizScores: Record<string, number> = JSON.parse(row.quiz_scores);
    save(row, conceptsViewed, tasksCompleted, quizScores, task);
  }

  /**
   * Records a quiz score for a given topic.
   * Keeps the highest score if already recorded.
   */
  function recordQuizScore(topic: string, score: number): void {
    const row = readRow();
    const conceptsViewed: string[] = JSON.parse(row.concepts_viewed);
    const tasksCompleted: string[] = JSON.parse(row.tasks_completed);
    const quizScores: Record<string, number> = JSON.parse(row.quiz_scores);

    if (!quizScores[topic] || score > quizScores[topic]) {
      quizScores[topic] = score;
    }

    save(row, conceptsViewed, tasksCompleted, quizScores, row.current_task);
  }

  return {
    getProgress,
    markConceptViewed,
    markTaskComplete,
    updateCurrentTask,
    recordQuizScore,
    CURRICULUM_TASKS,
  };
}

export type ProgressTracker = ReturnType<typeof createProgressTracker>;
