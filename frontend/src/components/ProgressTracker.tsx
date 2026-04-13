/**
 * ProgressTracker
 *
 * Left sidebar component showing the user's curriculum progress:
 *   - Progress bar (% complete)
 *   - Visual checklist of all 11 curriculum tasks
 *   - Lock/unlock state based on sequential completion
 *   - "Run Tests" button with inline results display
 *
 * Polls /api/progress every 5 seconds so completions triggered by the
 * assistant (via markComplete tool) show up automatically.
 */

import { useEffect, useState } from 'react';

// ────────────────────────────────────────────────────────────
// Types (must match backend interfaces)
// ────────────────────────────────────────────────────────────

interface Progress {
  userId: string;
  conceptsViewed: string[];
  tasksCompleted: string[];
  quizScores: Record<string, number>;
  currentTask: string | null;
  overallProgress: number;
}

interface TestError {
  test: string;
  message: string;
}

interface TestResult {
  file: string;
  passed: number;
  failed: number;
  errors: TestError[];
}

// ────────────────────────────────────────────────────────────
// Curriculum task list (mirrors backend CURRICULUM_TASKS)
// ────────────────────────────────────────────────────────────

const TASKS = [
  { id: 'fix-init',            label: 'Fix the broken init.ts',              requiresTest: false },
  { id: 'meet-assistant',      label: 'Have first conversation',              requiresTest: false },
  { id: 'choose-agent-type',   label: 'Choose your agent type',               requiresTest: false },
  { id: 'view-what-is-agent',  label: 'Read: What is an Agent?',              requiresTest: false },
  { id: 'view-mcp-tools',      label: 'Read: MCP and Tools',                  requiresTest: false },
  { id: 'view-memory-context', label: 'Read: Memory & Context',               requiresTest: false },
  { id: 'implement-intent',    label: 'Implement intent classification',       requiresTest: true },
  { id: 'implement-memory',    label: 'Implement memory system',              requiresTest: true },
  { id: 'implement-email',     label: 'Implement email tool',                 requiresTest: false },
  { id: 'implement-calendar',  label: 'Implement calendar tool',              requiresTest: false },
  { id: 'all-tests-pass',      label: 'All agent tests pass',                 requiresTest: true },
] as const;

// ────────────────────────────────────────────────────────────
// ProgressTracker component
// ────────────────────────────────────────────────────────────

export default function ProgressTracker() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch progress ──────────────────────────────────────

  async function fetchProgress() {
    try {
      const res = await fetch('/api/progress');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Progress = await res.json();
      setProgress(data);
    } catch {
      // Silently fail — backend may not be ready yet
    }
  }

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Run tests ────────────────────────────────────────────

  async function handleRunTests() {
    setRunning(true);
    setError(null);
    setShowResults(false);

    try {
      const res = await fetch('/api/review/run-tests', { method: 'POST' });
      const data = await res.json() as { ok: boolean; results?: TestResult[]; error?: string };

      if (!data.ok || !data.results) {
        setError(data.error ?? 'Test run failed');
      } else {
        setTestResults(data.results);
        setShowResults(true);
        // Refresh progress in case tests passing triggered auto-complete
        await fetchProgress();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  }

  // ── Task state helpers ───────────────────────────────────

  function isCompleted(taskId: string): boolean {
    return progress?.tasksCompleted.includes(taskId) ?? false;
  }

  function isLocked(index: number): boolean {
    if (index === 0) return false; // first task always unlocked
    return !isCompleted(TASKS[index - 1].id);
  }

  function isCurrent(taskId: string): boolean {
    return progress?.currentTask === taskId;
  }

  // ── Test summary ─────────────────────────────────────────

  const totalPassed = testResults?.reduce((s, r) => s + r.passed, 0) ?? 0;
  const totalFailed = testResults?.reduce((s, r) => s + r.failed, 0) ?? 0;
  const allPassing = totalFailed === 0 && totalPassed > 0;

  // ── Render ────────────────────────────────────────────────

  const pct = progress?.overallProgress ?? 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>PROGRESS</span>
        <span style={styles.headerPct}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${pct}%` }} />
      </div>

      {/* Completion count */}
      <p style={styles.countLabel}>
        {progress?.tasksCompleted.length ?? 0} / {TASKS.length} tasks
      </p>

      {/* Task list */}
      <div style={styles.taskList}>
        {TASKS.map((task, i) => {
          const completed = isCompleted(task.id);
          const locked = !completed && isLocked(i);
          const current = !completed && !locked && isCurrent(task.id);

          let icon = '○'; // unlocked, not started
          let iconColor = '#475569';
          if (completed) { icon = '✓'; iconColor = '#22c55e'; }
          else if (locked)  { icon = '●'; iconColor = '#374151'; }
          else if (current) { icon = '→'; iconColor = '#7dd3fc'; }

          return (
            <div
              key={task.id}
              style={{
                ...styles.taskItem,
                opacity: locked ? 0.4 : 1,
              }}
            >
              <span style={{ ...styles.taskIcon, color: iconColor }}>{icon}</span>
              <span style={{
                ...styles.taskLabel,
                color: completed ? '#22c55e' : locked ? '#374151' : current ? '#e2e8f0' : '#94a3b8',
                textDecoration: completed ? 'line-through' : 'none',
              }}>
                {task.label}
                {task.requiresTest && !completed && (
                  <span style={styles.testBadge}>test</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Run Tests section */}
      <div style={styles.section}>
        <button
          style={{
            ...styles.runBtn,
            opacity: running ? 0.6 : 1,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
          onClick={handleRunTests}
          disabled={running}
        >
          {running ? '⟳ Running...' : '▶ Run Tests'}
        </button>

        {error && (
          <p style={styles.errorMsg}>{error}</p>
        )}

        {showResults && testResults && (
          <div style={styles.results}>
            {/* Summary line */}
            <p style={{
              ...styles.resultSummary,
              color: allPassing ? '#22c55e' : '#ef4444',
            }}>
              {allPassing
                ? `✓ All ${totalPassed} tests passing`
                : `✗ ${totalFailed} failing, ${totalPassed} passing`}
            </p>

            {/* Per-file results */}
            {testResults.map(result => (
              <div key={result.file} style={styles.fileResult}>
                <p style={styles.fileName}>
                  {result.file}
                  <span style={{
                    ...styles.fileStatus,
                    color: result.failed === 0 ? '#22c55e' : '#ef4444',
                  }}>
                    {result.failed === 0 ? ' ✓' : ` ✗ ${result.failed} fail`}
                  </span>
                </p>

                {/* Error details */}
                {result.errors.map((err, j) => (
                  <div key={j} style={styles.errorDetail}>
                    <p style={styles.errorTest}>{err.test}</p>
                    <pre style={styles.errorMsg2}>
                      {err.message.slice(0, 200)}
                      {err.message.length > 200 ? '…' : ''}
                    </pre>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Styles — terminal aesthetic matching the app theme
// ────────────────────────────────────────────────────────────

const mono = '"Courier New", Courier, monospace';

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: mono,
    fontSize: '0.75rem',
    color: '#94a3b8',
    padding: '0.75rem',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    background: '#050d1a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1f2937',
    paddingBottom: '0.5rem',
    marginBottom: '0.25rem',
  },
  headerTitle: {
    color: '#7dd3fc',
    letterSpacing: '0.1em',
    fontSize: '0.7rem',
  },
  headerPct: {
    color: '#7dd3fc',
    fontWeight: 'bold',
  },
  barTrack: {
    width: '100%',
    height: '4px',
    background: '#1f2937',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #1d4ed8, #7dd3fc)',
    borderRadius: '2px',
    transition: 'width 0.4s ease',
  },
  countLabel: {
    margin: 0,
    color: '#475569',
    fontSize: '0.7rem',
    textAlign: 'right' as const,
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
    flex: 1,
    overflowY: 'auto' as const,
  },
  taskItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.4rem',
    lineHeight: '1.4',
  },
  taskIcon: {
    flexShrink: 0,
    width: '12px',
    fontSize: '0.7rem',
    marginTop: '1px',
  },
  taskLabel: {
    fontSize: '0.72rem',
    lineHeight: '1.4',
    flex: 1,
  },
  testBadge: {
    display: 'inline-block',
    marginLeft: '4px',
    padding: '0 3px',
    background: '#1f2937',
    color: '#7dd3fc',
    borderRadius: '2px',
    fontSize: '0.6rem',
    verticalAlign: 'middle',
  },
  section: {
    borderTop: '1px solid #1f2937',
    paddingTop: '0.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  runBtn: {
    background: '#0f1f38',
    border: '1px solid #1d4ed8',
    color: '#7dd3fc',
    fontFamily: mono,
    fontSize: '0.72rem',
    padding: '0.35rem 0.6rem',
    borderRadius: '3px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    letterSpacing: '0.03em',
  },
  errorMsg: {
    margin: 0,
    color: '#ef4444',
    fontSize: '0.68rem',
    wordBreak: 'break-all' as const,
  },
  results: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  resultSummary: {
    margin: 0,
    fontWeight: 'bold',
    fontSize: '0.72rem',
  },
  fileResult: {
    background: '#0a0a0a',
    border: '1px solid #1f2937',
    borderRadius: '3px',
    padding: '0.35rem',
  },
  fileName: {
    margin: 0,
    color: '#94a3b8',
    fontSize: '0.68rem',
    marginBottom: '0.2rem',
  },
  fileStatus: {
    fontWeight: 'bold',
  },
  errorDetail: {
    marginTop: '0.25rem',
    paddingTop: '0.25rem',
    borderTop: '1px solid #1f2937',
  },
  errorTest: {
    margin: 0,
    color: '#f97316',
    fontSize: '0.65rem',
    marginBottom: '0.15rem',
  },
  errorMsg2: {
    margin: 0,
    color: '#6b7280',
    fontSize: '0.62rem',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    lineHeight: '1.4',
  },
};
