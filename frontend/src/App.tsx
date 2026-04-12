import { useEffect, useState } from 'react';
import LockedScreen from './components/LockedScreen';

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

  // ── Platform is unlocked ✅ ──
  return (
    <div style={styles.centered}>
      <div style={styles.successBox}>
        <p style={styles.successTitle}>✅ Platform Unlocked</p>
        <p style={styles.muted}>
          You fixed it! The teaching assistant is coming in Session 2.
        </p>
        <p style={styles.muted}>
          Great debugging work — that's exactly the skill you'll use to build your agent.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Inline styles (no external CSS dependency for Session 1)
// ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
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
