/**
 * LockedScreen
 *
 * The first thing users see. Displays platform initialization errors
 * with hints that guide them to backend/src/setup/init.ts.
 *
 * Design goal: look like a terminal output, feel educational not frustrating.
 */

import { useState } from 'react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface InitError {
  category: 'ENV' | 'AUTH' | 'DB' | 'API';
  message: string;
  hint: string;
}

interface Props {
  errors: InitError[];
  onRetry: () => void;
  retrying: boolean;
}

// ────────────────────────────────────────────────────────────
// Category metadata
// ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<InitError['category'], { label: string; color: string; icon: string }> = {
  ENV: { label: 'ENV',  color: '#f97316', icon: '⚙' },
  AUTH: { label: 'AUTH', color: '#a78bfa', icon: '🔐' },
  DB:   { label: 'DB',   color: '#60a5fa', icon: '🗄' },
  API:  { label: 'API',  color: '#f43f5e', icon: '🔑' },
};

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default function LockedScreen({ errors, onRetry, retrying }: Props) {
  const [expandedHints, setExpandedHints] = useState<Set<number>>(new Set());

  function toggleHint(index: number) {
    setExpandedHints(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div style={styles.root}>
      <div style={styles.terminal}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <span style={styles.dot} />
          <span style={{ ...styles.dot, background: '#f59e0b' }} />
          <span style={{ ...styles.dot, background: '#22c55e' }} />
          <span style={styles.headerTitle}>agent-arch — initialization</span>
        </div>

        {/* ── Title block ── */}
        <div style={styles.titleBlock}>
          <pre style={styles.asciiTitle}>{LOCK_ASCII}</pre>
          <p style={styles.subtitle}>
            Platform locked. Fix the errors below to continue.
          </p>
        </div>

        {/* ── File to fix ── */}
        <div style={styles.fileBox}>
          <span style={styles.fileLabel}>FILE TO FIX  </span>
          <span style={styles.filePath}>backend/src/setup/init.ts</span>
        </div>

        {/* ── Errors ── */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>
            {errors.length === 0
              ? '✓ No errors — waiting for backend...'
              : `${errors.length} error${errors.length !== 1 ? 's' : ''} found:`}
          </p>

          {errors.map((error, i) => {
            const meta = CATEGORY_META[error.category];
            const hintOpen = expandedHints.has(i);

            return (
              <div key={i} style={styles.errorCard}>
                {/* Error row */}
                <div style={styles.errorRow}>
                  <span style={{ ...styles.badge, background: meta.color + '22', color: meta.color }}>
                    {meta.icon} {meta.label}
                  </span>
                  <span style={styles.errorMessage}>{error.message}</span>
                </div>

                {/* Hint toggle */}
                <button
                  style={styles.hintToggle}
                  onClick={() => toggleHint(i)}
                >
                  {hintOpen ? '▼ hide hint' : '▶ show hint'}
                </button>

                {hintOpen && (
                  <div style={styles.hint}>
                    <span style={styles.hintLabel}>HINT  </span>
                    {error.hint}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Steps ── */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>HOW TO FIX:</p>
          <ol style={styles.steps}>
            <li>Open <code style={styles.inlineCode}>backend/src/setup/init.ts</code></li>
            <li>Find each <code style={styles.inlineCode}>// BUG:</code> comment and fix the code</li>
            <li>Copy <code style={styles.inlineCode}>.env.example</code> → <code style={styles.inlineCode}>.env</code> and fill in your values</li>
            <li>Click <strong>Retry Initialization</strong> below (no restart needed)</li>
          </ol>
        </div>

        {/* ── Retry button ── */}
        <div style={styles.buttonRow}>
          <button
            style={{
              ...styles.retryButton,
              ...(retrying ? styles.retryButtonDisabled : {}),
            }}
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? '⟳  Retrying...' : '↺  Retry Initialization'}
          </button>
        </div>

        {/* ── Footer ── */}
        <p style={styles.footer}>
          The platform auto-polls every 3s — or click Retry after making changes.
          Read the README for full instructions.
        </p>

      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ASCII art
// ────────────────────────────────────────────────────────────

const LOCK_ASCII = `
  ╔══════════════════════════════════════╗
  ║                                      ║
  ║      AGENT ARCH — INIT FAILED        ║
  ║                                      ║
  ╚══════════════════════════════════════╝
`;

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2rem 1rem',
    fontFamily: "'Courier New', Courier, monospace",
  },
  terminal: {
    width: '100%',
    maxWidth: '720px',
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    background: '#1f2937',
    padding: '0.6rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderBottom: '1px solid #374151',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#ef4444',
  },
  headerTitle: {
    color: '#6b7280',
    fontSize: '0.75rem',
    marginLeft: '8px',
  },
  titleBlock: {
    padding: '1.5rem 2rem 0.5rem',
    borderBottom: '1px solid #1f2937',
  },
  asciiTitle: {
    color: '#ef4444',
    fontSize: '0.75rem',
    lineHeight: '1.4',
    margin: '0 0 1rem 0',
    whiteSpace: 'pre',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '0.9rem',
    margin: '0 0 1rem 0',
  },
  fileBox: {
    margin: '0 2rem',
    padding: '0.6rem 1rem',
    background: '#0f172a',
    border: '1px solid #1e3a5f',
    borderRadius: '4px',
    fontSize: '0.85rem',
    marginTop: '1rem',
    marginBottom: '0.5rem',
  },
  fileLabel: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  filePath: {
    color: '#e2e8f0',
  },
  section: {
    padding: '1rem 2rem',
    borderTop: '1px solid #1f2937',
  },
  sectionLabel: {
    color: '#6b7280',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '0.75rem',
  },
  errorCard: {
    marginBottom: '0.75rem',
    background: '#0f172a',
    border: '1px solid #1f2937',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  errorRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
  },
  badge: {
    fontSize: '0.7rem',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '3px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    marginTop: '1px',
  },
  errorMessage: {
    color: '#fca5a5',
    fontSize: '0.85rem',
    lineHeight: '1.5',
  },
  hintToggle: {
    display: 'block',
    background: 'transparent',
    border: 'none',
    borderTop: '1px solid #1f2937',
    color: '#475569',
    fontSize: '0.75rem',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  hint: {
    padding: '0.75rem 1rem',
    background: '#0a0f1a',
    color: '#94a3b8',
    fontSize: '0.82rem',
    lineHeight: '1.6',
    borderTop: '1px solid #1e3a5f',
  },
  hintLabel: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  steps: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    lineHeight: '2',
    paddingLeft: '1.5rem',
    margin: 0,
  },
  inlineCode: {
    background: '#1e293b',
    color: '#7dd3fc',
    padding: '1px 5px',
    borderRadius: '3px',
    fontSize: '0.8rem',
  },
  buttonRow: {
    padding: '1rem 2rem',
    borderTop: '1px solid #1f2937',
  },
  retryButton: {
    background: '#1e40af',
    color: '#e2e8f0',
    border: '1px solid #2563eb',
    borderRadius: '4px',
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontFamily: "'Courier New', Courier, monospace",
    cursor: 'pointer',
    width: '100%',
    letterSpacing: '0.05em',
  },
  retryButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  footer: {
    padding: '0.75rem 2rem 1rem',
    color: '#374151',
    fontSize: '0.75rem',
    borderTop: '1px solid #1a2030',
    margin: 0,
  },
};
