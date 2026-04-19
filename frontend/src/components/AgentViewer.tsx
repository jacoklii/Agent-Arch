/**
 * Agent Viewer — components/AgentViewer.tsx
 *
 * The real-time dashboard for your agent. Shows you:
 *   - Whether the agent is running (idle / thinking / acting / error)
 *   - A live event log of everything the agent does
 *   - Controls to start, stop, and send messages to the agent
 *
 * Communication works via WebSocket:
 *   1. This component connects to ws://localhost:3000/ws (proxied to :3001)
 *   2. When you click "Send", it POSTs to /api/agent/send
 *   3. The backend runs your agent asynchronously
 *   4. Results arrive as WebSocket events: agent:thinking, agent:response, etc.
 *
 * This is the "observe your agent" interface — you can watch exactly what
 * your agent is doing, in real time, at each step of the agentic loop.
 *
 * See concept: 01-what-is-an-agent (the full loop, made visible)
 */

import { useEffect, useRef, useState } from 'react';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

type AgentState = 'idle' | 'thinking' | 'acting' | 'error';

interface AgentEventPayload {
  input?: string;
  tool?: string;
  params?: unknown;
  output?: {
    response: string;
    intent: string;
    toolsUsed: string[];
    success: boolean;
  };
  message?: string;
  state?: AgentState;
  timestamp: string;
}

interface AgentEvent {
  type:
    | 'agent:state'
    | 'agent:thinking'
    | 'agent:tool_call'
    | 'agent:response'
    | 'agent:error'
    | 'agent:memory_cleared';
  payload: AgentEventPayload;
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export default function AgentViewer() {
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [sending, setSending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);
  const lastLoggedStateRef = useRef<AgentState | null>(null);

  // ── Sync running state from backend on mount ─────────────────
  useEffect(() => {
    fetch('/api/agent/status')
      .then(r => r.json())
      .then((data: { isRunning?: boolean; state?: AgentState }) => {
        if (data.isRunning !== undefined) setIsRunning(data.isRunning);
        if (data.state) setAgentState(data.state);
      })
      .catch(() => { /* backend not ready yet */ });
  }, []);

  // ── WebSocket connection with auto-reconnect ─────────────────
  useEffect(() => {
    mountedRef.current = true;

    function connectWs() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(`ws://${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;
        console.log('[AgentViewer] WebSocket connected');
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('[AgentViewer] WebSocket disconnected');
        if (!mountedRef.current) return;
        // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current++;
        console.log(`[AgentViewer] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(connectWs, delay);
      };

      ws.onerror = () => {
        // onclose will handle reconnect — suppress noisy error logs
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as AgentEvent;

          // Skip duplicate agent:state entries (same state as last logged)
          if (data.type === 'agent:state' && data.payload.state === lastLoggedStateRef.current) {
            // Still sync isRunning without polluting the log
            if ((data.payload as { isRunning?: boolean }).isRunning !== undefined) {
              setIsRunning((data.payload as { isRunning?: boolean }).isRunning!);
            }
            setAgentState(data.payload.state!);
            return;
          }
          if (data.type === 'agent:state' && data.payload.state) {
            lastLoggedStateRef.current = data.payload.state;
          }

          // Add to event log (keep last 100)
          setEvents(prev => [data, ...prev].slice(0, 100));

          // Update UI state based on event type
          switch (data.type) {
            case 'agent:state':
              if (data.payload.state) {
                setAgentState(data.payload.state);
              }
              if ((data.payload as { isRunning?: boolean }).isRunning !== undefined) {
                setIsRunning((data.payload as { isRunning?: boolean }).isRunning!);
              }
              break;

            case 'agent:response':
              if (data.payload.output) {
                setLastResponse(data.payload.output.response);
                setError(null);
              }
              setSending(false);
              break;

            case 'agent:error':
              setError(data.payload.message ?? 'Unknown error');
              setSending(false);
              break;

            case 'agent:memory_cleared':
              setLastResponse(null);
              setError(null);
              break;
          }
        } catch (err) {
          console.error('[AgentViewer] Failed to parse event:', err);
        }
      };
    }

    connectWs();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll log to top when new events arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // ── API helpers ───────────────────────────────────────────────
  async function apiPost(path: string, body?: Record<string, unknown>) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function handleStart() {
    await apiPost('/api/agent/start');
    setIsRunning(true);
    setError(null);
  }

  async function handleStop() {
    await apiPost('/api/agent/stop');
    setIsRunning(false);
    setSending(false);
  }

  async function handleSend() {
    if (!testInput.trim() || !isRunning || sending) return;

    setSending(true);
    setLastResponse(null);
    setError(null);

    try {
      await apiPost('/api/agent/send', { message: testInput.trim() });
      // Response arrives via WebSocket — don't clear input until we get it
    } catch {
      setError('Failed to send message to agent. Is the backend running?');
      setSending(false);
    }
  }

  async function handleClearMemory() {
    await apiPost('/api/agent/memory/clear');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={styles.shell}>

      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>Agent Dashboard</span>
          <span style={styles.subtitle}>Task Automator · Real-time view</span>
        </div>
        <div style={styles.headerRight}>
          {/* WebSocket indicator */}
          <div style={styles.wsIndicator}>
            <div style={{
              ...styles.wsDot,
              background: wsConnected ? '#22c55e' : '#6b7280',
            }} />
            <span style={styles.wsLabel}>
              {wsConnected ? 'connected' : 'disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* ── WS disconnected warning ── */}
      {!wsConnected && (
        <div style={styles.warnBanner}>
          WebSocket not connected — agent activity won't appear live.
          Check that the backend is running on port 3001.
        </div>
      )}

      <div style={styles.content}>
        {/* ── Left panel: controls + last response ── */}
        <div style={styles.leftPanel}>

          {/* Agent state + controls */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>Agent Status</div>

            <div style={styles.stateRow}>
              <StateBadge state={agentState} />
              <div style={styles.controlButtons}>
                {!isRunning ? (
                  <button style={styles.btnStart} onClick={() => void handleStart()}>
                    Start Agent
                  </button>
                ) : (
                  <button style={styles.btnStop} onClick={() => void handleStop()}>
                    Stop Agent
                  </button>
                )}
                <button
                  style={{ ...styles.btnSecondary, opacity: !isRunning ? 0.4 : 1 }}
                  onClick={() => void handleClearMemory()}
                  disabled={!isRunning}
                >
                  Clear Memory
                </button>
              </div>
            </div>

            {!isRunning && (
              <p style={styles.hint}>
                Click "Start Agent" to begin. You'll need to implement
                core/intent.ts and tools/ before it does anything useful.
              </p>
            )}
          </div>

          {/* Test input */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>Send Test Input</div>
            <textarea
              style={{ ...styles.textarea, opacity: !isRunning ? 0.5 : 1 }}
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRunning
                  ? 'Try: "Send an email to alice@example.com"\nCtrl+Enter to send'
                  : 'Start the agent first...'
              }
              disabled={!isRunning || sending}
              rows={3}
            />
            <div style={styles.sendRow}>
              <span style={styles.hint}>Ctrl+Enter to send</span>
              <button
                style={{ ...styles.btnSend, opacity: (!isRunning || sending || !testInput.trim()) ? 0.4 : 1 }}
                onClick={() => void handleSend()}
                disabled={!isRunning || sending || !testInput.trim()}
              >
                {sending ? <><span className="spinner">⟳</span> Processing</> : 'Send'}
              </button>
            </div>
          </div>

          {/* Last response */}
          {(lastResponse || error) && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                {error ? 'Error' : 'Last Response'}
              </div>
              <pre style={{
                ...styles.responseText,
                color: error ? '#f87171' : '#e2e8f0',
                borderColor: error ? '#7f1d1d' : '#1f2937',
              }}>
                {error ?? lastResponse}
              </pre>
              {error && (
                <p style={{ ...styles.hint, marginTop: '0.5rem' }}>
                  This error is expected if you haven't implemented the tool yet.
                  Check the TODO comments in tools/email.ts or tools/calendar.ts.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: live event log ── */}
        <div style={styles.rightPanel}>
          <div style={styles.card} data-fill>
            <div style={styles.logHeader}>
              <span style={styles.cardHeader}>Live Event Log</span>
              <span style={styles.logCount}>{events.length} events</span>
            </div>

            {events.length === 0 ? (
              <div style={styles.emptyLog}>
                <p style={styles.emptyLogTitle}>No events yet.</p>
                <p style={styles.hint}>
                  Start the agent and send a message to see the agentic loop in action.
                  Each step — perceive, reason, act — will appear here.
                </p>
              </div>
            ) : (
              <div style={styles.logList}>
                {events.map((event, i) => (
                  <EventRow key={i} event={event} />
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function StateBadge({ state }: { state: AgentState }) {
  const colors: Record<AgentState, string> = {
    idle:     '#22c55e',
    thinking: '#f59e0b',
    acting:   '#7dd3fc',
    error:    '#ef4444',
  };

  const labels: Record<AgentState, string> = {
    idle:     'IDLE',
    thinking: 'THINKING',
    acting:   'ACTING',
    error:    'ERROR',
  };

  return (
    <div style={{ ...styles.stateBadge, borderColor: colors[state], color: colors[state] }}>
      <div style={{ ...styles.stateDot, background: colors[state] }} />
      {labels[state]}
    </div>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  const typeColors: Record<string, string> = {
    'agent:state':          '#6b7280',
    'agent:thinking':       '#f59e0b',
    'agent:tool_call':      '#7dd3fc',
    'agent:response':       '#22c55e',
    'agent:error':          '#ef4444',
    'agent:memory_cleared': '#a78bfa',
  };

  const color = typeColors[event.type] ?? '#94a3b8';
  const time = new Date(event.payload.timestamp).toLocaleTimeString();

  // Build a human-readable summary of the event payload
  let summary = '';
  switch (event.type) {
    case 'agent:thinking':
      summary = `Input: "${truncate(event.payload.input ?? '', 60)}"`;
      break;
    case 'agent:tool_call':
      summary = `Tool: ${event.payload.tool ?? '?'}`;
      break;
    case 'agent:response':
      summary = event.payload.output
        ? `[${event.payload.output.intent}] ${truncate(event.payload.output.response, 80)}`
        : '';
      break;
    case 'agent:error':
      summary = truncate(event.payload.message ?? '', 80);
      break;
    case 'agent:state':
      summary = `→ ${event.payload.state ?? '?'}`;
      break;
    case 'agent:memory_cleared':
      summary = 'Memory cleared';
      break;
  }

  const isHighlight = event.type === 'agent:response' || event.type === 'agent:error';

  return (
    <div style={{
      ...styles.eventRow,
      background: isHighlight ? 'rgba(31, 41, 55, 0.6)' : 'transparent',
      borderLeft: isHighlight ? `2px solid ${color}` : '2px solid transparent',
    }}>
      <span style={styles.eventTime}>{time}</span>
      <span style={{ ...styles.eventType, color, borderColor: color }}>
        {event.type.replace('agent:', '')}
      </span>
      {summary && (
        <span style={{ ...styles.eventSummary, color: event.type === 'agent:error' ? '#f87171' : '#94a3b8' }}>
          {summary}
        </span>
      )}
    </div>
  );
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  shell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
    color: '#e2e8f0',
    fontFamily: '"Courier New", Courier, monospace',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.25rem',
    borderBottom: '1px solid #1f2937',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  title: {
    color: '#7dd3fc',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
  },
  subtitle: {
    color: '#475569',
    fontSize: '0.75rem',
  },
  wsIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  wsDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  wsLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  warnBanner: {
    background: '#1c1917',
    borderBottom: '1px solid #78350f',
    color: '#fbbf24',
    padding: '0.5rem 1.25rem',
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    gap: '0',
  },
  leftPanel: {
    width: '380px',
    flexShrink: 0,
    borderRight: '1px solid #1f2937',
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '1rem',
  },
  card: {
    border: '1px solid #1f2937',
    borderRadius: '6px',
    padding: '0.75rem',
    background: '#0f172a',
  },
  cardHeader: {
    color: '#7dd3fc',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: '0.75rem',
  },
  stateRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
  },
  stateBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    border: '1px solid',
    borderRadius: '4px',
    padding: '0.3rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    letterSpacing: '0.1em',
  },
  stateDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  controlButtons: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  btnStart: {
    background: '#14532d',
    color: '#22c55e',
    border: '1px solid #22c55e',
    borderRadius: '4px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnStop: {
    background: '#450a0a',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '4px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSecondary: {
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #334155',
    borderRadius: '4px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSend: {
    background: '#1e3a5f',
    color: '#7dd3fc',
    border: '1px solid #7dd3fc',
    borderRadius: '4px',
    padding: '0.35rem 0.9rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  hint: {
    color: '#475569',
    fontSize: '0.75rem',
    lineHeight: '1.5',
    margin: '0.5rem 0 0 0',
  },
  textarea: {
    width: '100%',
    background: '#0a0a0a',
    border: '1px solid #1f2937',
    borderRadius: '4px',
    color: '#e2e8f0',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    padding: '0.5rem',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    lineHeight: '1.5',
  },
  sendRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.5rem',
  },
  responseText: {
    background: '#050d1a',
    border: '1px solid',
    borderRadius: '4px',
    padding: '0.6rem',
    fontSize: '0.8rem',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    margin: 0,
    maxHeight: '150px',
    overflowY: 'auto' as const,
  },
  logHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  logCount: {
    color: '#475569',
    fontSize: '0.7rem',
  },
  logList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    maxHeight: 'calc(100vh - 220px)',
    overflowY: 'auto' as const,
  },
  emptyLog: {
    padding: '1.5rem 0',
    textAlign: 'center' as const,
  },
  emptyLogTitle: {
    color: '#334155',
    marginBottom: '0.5rem',
    fontSize: '0.85rem',
  },
  eventRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    padding: '0.35rem 0.5rem',
    borderRadius: '3px',
    fontSize: '0.78rem',
    lineHeight: '1.4',
  },
  eventTime: {
    color: '#334155',
    flexShrink: 0,
    fontSize: '0.72rem',
    marginTop: '1px',
    fontVariantNumeric: 'tabular-nums',
  },
  eventType: {
    border: '1px solid',
    borderRadius: '3px',
    padding: '1px 5px',
    fontSize: '0.68rem',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
    flexShrink: 0,
    marginTop: '1px',
  },
  eventSummary: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
};
