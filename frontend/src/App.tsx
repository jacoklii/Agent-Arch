import { useEffect, useState } from 'react';
import LockedScreen from './components/LockedScreen';
import AssistantChat from './components/AssistantChat';
import ConceptViewer from './components/ConceptViewer';
import AgentViewer from './components/AgentViewer';
import ProgressTracker from './components/ProgressTracker';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface InitError {
  category: 'ENV' | 'AUTH' | 'DB' | 'API';
  message: string;
  hint: string;
}

interface StatusResponse {
  locked: boolean;
  errors: InitError[];
  timestamp: string;
}

// ────────────────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────────────────

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'assistant' | 'agent'>('assistant');

  // Fetch the current platform status from the backend
  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatusResponse = await res.json();
      setStatus(data);
      setBackendDown(false);
    } catch {
      // Backend isn't up yet or crashed
      setBackendDown(true);
    } finally {
      setLoading(false);
    }
  }

  // Poll /api/status every 3 seconds
  // Once unlocked the polling continues (but shows success state)
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Called when a concept panel loads a lesson — tracks viewing for progress
  async function handleConceptView(slug: string) {
    try {
      await fetch('/api/progress/view-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
    } catch {
      // Non-critical — progress tracking failure shouldn't break the UI
    }
  }

  // Called when user clicks "Retry Initialization"
  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch('/api/retry-init', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatusResponse = await res.json();
      setStatus(data);
      setBackendDown(false);
    } catch {
      setBackendDown(true);
    } finally {
      setRetrying(false);
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div style={styles.centered}>
        <p style={styles.muted}>Connecting to backend...</p>
      </div>
    );
  }

  // ── Backend is unreachable ──
  if (backendDown) {
    return (
      <div style={styles.centered}>
        <div style={styles.errorBox}>
          <p style={styles.errorTitle}>⚠ Cannot reach backend</p>
          <p style={styles.muted}>
            Make sure the backend is running:
          </p>
          <code style={styles.code}>npm start</code>
          <p style={styles.muted} className="mt">
            Backend should be at <strong>http://localhost:3001</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── Platform is locked ──
  if (!status || status.locked) {
    return (
      <LockedScreen
        errors={status?.errors ?? []}
        onRetry={handleRetry}
        retrying={retrying}
      />
    );
  }

  // ── Platform is unlocked ✅ — show the teaching assistant + agent dashboard ──
  return (
    <div style={styles.appShell}>
      {/* Tab bar — switch between Teaching Assistant and Agent Dashboard */}
      <div style={styles.tabBar}>
        <button
          style={activeTab === 'assistant' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('assistant')}
        >
          Teaching Assistant
        </button>
        <button
          style={activeTab === 'agent' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('agent')}
        >
          Agent Dashboard
        </button>
      </div>

      {/* Teaching Assistant view */}
      {activeTab === 'assistant' && (
        <div style={styles.tabContent}>
          {/* LEFT: Progress sidebar */}
          <div style={styles.progressPanel}>
            <ProgressTracker />
          </div>

          {/* MIDDLE: Chat */}
          <div style={{
            flex: activeConcept ? '0 0 45%' : '1',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}>
            <AssistantChat onConceptOpen={setActiveConcept} />
          </div>

          {/* RIGHT: Concept panel (shown when a lesson is open) */}
          {activeConcept && (
            <div style={styles.conceptPanel}>
              <ConceptViewer
                slug={activeConcept}
                onClose={() => setActiveConcept(null)}
                onConceptView={handleConceptView}
              />
            </div>
          )}
        </div>
      )}

      {/* Agent Dashboard view */}
      {activeTab === 'agent' && (
        <div style={styles.tabContent}>
          <AgentViewer />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Inline styles (no external CSS dependency for Session 1)
// ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  appShell: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #1f2937',
    background: '#050d1a',
    flexShrink: 0,
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#475569',
    cursor: 'pointer',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.8rem',
    letterSpacing: '0.05em',
    padding: '0.6rem 1.25rem',
  },
  tabActive: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #7dd3fc',
    color: '#7dd3fc',
    cursor: 'pointer',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.8rem',
    letterSpacing: '0.05em',
    padding: '0.6rem 1.25rem',
  },
  tabContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressPanel: {
    width: '220px',
    flexShrink: 0,
    borderRight: '1px solid #1f2937',
    overflowY: 'auto',
    background: '#050d1a',
  },
  conceptPanel: {
    flex: '0 0 35%',
    borderLeft: '1px solid #1f2937',
    overflowY: 'auto',
  },
  centered: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
    padding: '1rem',
  },
  errorBox: {
    border: '1px solid #ef4444',
    borderRadius: '8px',
    padding: '2rem',
    maxWidth: '480px',
    textAlign: 'center',
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: '1.2rem',
    marginBottom: '1rem',
  },
  successBox: {
    border: '1px solid #22c55e',
    borderRadius: '8px',
    padding: '2rem',
    maxWidth: '480px',
    textAlign: 'center',
  },
  successTitle: {
    color: '#22c55e',
    fontSize: '1.4rem',
    marginBottom: '1rem',
  },
  muted: {
    color: '#94a3b8',
    fontSize: '0.9rem',
    lineHeight: '1.6',
  },
  code: {
    display: 'inline-block',
    background: '#1e293b',
    color: '#7dd3fc',
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    fontSize: '0.85rem',
  },
};
