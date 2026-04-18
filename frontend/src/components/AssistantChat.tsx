/**
 * AssistantChat
 *
 * The main teaching assistant interface. Streams responses from the backend
 * via SSE (using fetch + ReadableStream), renders markdown with syntax
 * highlighting, and detects [CONCEPT:slug] markers to open the lesson panel.
 *
 * Supports up to 4 chat tabs, each with an independent message history.
 * The backend session is shared — creating a new tab resets it server-side.
 *
 * User flow:
 *   1. On mount → GET /api/chat/welcome → streams opening message
 *   2. After first message → show agent type selector buttons
 *   3. User chats → POST /api/chat → streams response
 *   4. [CONCEPT:slug] in response → show "Open lesson" button
 *   5. + button → new tab (max 4), resets backend session
 *   6. × button → closes tab (disabled when only one tab remains)
 */

import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  conceptRefs: string[];
  isStreaming?: boolean;
}

interface ChatTab {
  id: string;
  label: string;
  messages: ChatMessage[];
  agentTypeChosen: boolean;
  streaming: boolean;
  error: string | null;
  input: string;
}

interface Props {
  onConceptOpen: (slug: string) => void;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function extractConcepts(text: string): { clean: string; slugs: string[] } {
  const slugs: string[] = [];
  const clean = text.replace(/\[CONCEPT:([^\]]+)\]/g, (_match, slug: string) => {
    slugs.push(slug.trim());
    return '';
  });
  return { clean: clean.trim(), slugs };
}

function randomId() {
  return Math.random().toString(36).slice(2);
}

// ────────────────────────────────────────────────────────────
// Markdown components
// ────────────────────────────────────────────────────────────

const markdownComponents = {
  code(props: React.ComponentPropsWithoutRef<'code'> & { node?: unknown }) {
    const { children, className, node: _node, ...rest } = props;
    const match = /language-(\w+)/.exec(className ?? '');
    return match ? (
      <SyntaxHighlighter
        style={oneDark as Record<string, React.CSSProperties>}
        language={match[1]}
        PreTag="div"
        customStyle={{ borderRadius: '6px', fontSize: '0.82rem', margin: '0.5rem 0' }}
        {...(rest as object)}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code
        style={{
          background: '#1e293b',
          color: '#7dd3fc',
          padding: '0.1em 0.35em',
          borderRadius: '3px',
          fontSize: '0.85em',
          fontFamily: "'Courier New', Courier, monospace",
        }}
        className={className}
        {...rest}
      >
        {children}
      </code>
    );
  },
};

// ────────────────────────────────────────────────────────────
// SSE reader
// ────────────────────────────────────────────────────────────

async function readSSEStream(
  response: Response,
  onDelta: (delta: string) => void,
  onDone: () => void,
  onError: (message: string) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) { onError('No response body'); return; }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as { type: string; delta?: string; message?: string };
            if (payload.type === 'text' && payload.delta) onDelta(payload.delta);
            else if (payload.type === 'done') onDone();
            else if (payload.type === 'error') onError(payload.message ?? 'Unknown error');
          } catch { /* malformed — skip */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default function AssistantChat({ onConceptOpen }: Props) {
  const [tabs, setTabs] = useState<ChatTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const tabCounterRef = useRef(0);
  const initializedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTab?.messages]);

  // ── Tab state updater ──
  function updateTab(tabId: string, patch: Partial<ChatTab>) {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...patch } : t));
  }

  // ── Stream a response into a specific message in a specific tab ──
  async function streamIntoMessage(response: Response, tabId: string, messageId: string) {
    let accumulated = '';
    await readSSEStream(
      response,
      (delta) => {
        accumulated += delta;
        const { clean } = extractConcepts(accumulated);
        setTabs(prev => prev.map(t =>
          t.id === tabId
            ? { ...t, messages: t.messages.map(m => m.id === messageId ? { ...m, content: clean, isStreaming: true } : m) }
            : t
        ));
      },
      () => {
        const { clean, slugs } = extractConcepts(accumulated);
        setTabs(prev => prev.map(t =>
          t.id === tabId
            ? { ...t, streaming: false, error: null, messages: t.messages.map(m => m.id === messageId ? { ...m, content: clean, conceptRefs: slugs, isStreaming: false } : m) }
            : t
        ));
      },
      (errMsg) => {
        setTabs(prev => prev.map(t =>
          t.id === tabId
            ? { ...t, streaming: false, error: errMsg, messages: t.messages.map(m => m.id === messageId ? { ...m, content: `*(Error: ${errMsg})*`, isStreaming: false } : m) }
            : t
        ));
      },
    );
  }

  // ── Fetch welcome message for a tab ──
  async function fetchWelcome(tabId: string) {
    const msgId = randomId();
    setTabs(prev => prev.map(t =>
      t.id === tabId
        ? { ...t, streaming: true, messages: [{ id: msgId, role: 'assistant', content: '', conceptRefs: [], isStreaming: true }] }
        : t
    ));
    try {
      const res = await fetch('/api/chat/welcome');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await streamIntoMessage(res, tabId, msgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTabs(prev => prev.map(t =>
        t.id === tabId
          ? { ...t, streaming: false, messages: [{ id: msgId, role: 'assistant', content: `*(Could not connect to assistant: ${msg})*`, conceptRefs: [], isStreaming: false }] }
          : t
      ));
    }
  }

  // ── Create a new tab (max 4) ──
  async function createTab() {
    if (tabs.length >= 4) return;
    tabCounterRef.current += 1;
    const tabId = randomId();
    const newTab: ChatTab = {
      id: tabId,
      label: `Chat ${tabCounterRef.current}`,
      messages: [],
      agentTypeChosen: false,
      streaming: false,
      error: null,
      input: '',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    await fetch('/api/chat/reset', { method: 'POST' });
    await fetchWelcome(tabId);
  }

  // ── Delete a tab (blocked when only one remains) ──
  function deleteTab(tabId: string) {
    if (tabs.length <= 1) return;
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      const next = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && next.length > 0) {
        setActiveTabId(next[Math.min(idx, next.length - 1)].id);
      }
      return next;
    });
  }

  // ── Initial mount: create first tab ──
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    tabCounterRef.current = 1;
    const tabId = randomId();
    setTabs([{ id: tabId, label: 'Chat 1', messages: [], agentTypeChosen: false, streaming: false, error: null, input: '' }]);
    setActiveTabId(tabId);
    void fetchWelcome(tabId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send a user message on the active tab ──
  async function sendMessage(text: string) {
    if (!activeTab || !text.trim() || activeTab.streaming) return;
    const tabId = activeTabId;
    const trimmed = text.trim();
    const userMsgId = randomId();
    const assistantMsgId = randomId();

    setTabs(prev => prev.map(t =>
      t.id === tabId
        ? {
            ...t,
            streaming: true,
            input: '',
            messages: [
              ...t.messages,
              { id: userMsgId, role: 'user', content: trimmed, conceptRefs: [] },
              { id: assistantMsgId, role: 'assistant', content: '', conceptRefs: [], isStreaming: true },
            ],
          }
        : t
    ));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await streamIntoMessage(res, tabId, assistantMsgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTabs(prev => prev.map(t =>
        t.id === tabId
          ? { ...t, streaming: false, messages: t.messages.map(m => m.id === assistantMsgId ? { ...m, content: `*(Connection error: ${msg})*`, isStreaming: false } : m) }
          : t
      ));
    }
  }

  // ── Agent type selection ──
  function handleAgentSelect(type: string) {
    updateTab(activeTabId, { agentTypeChosen: true });
    void sendMessage(`I want to build a ${type}.`);
  }

  // ── Reset current tab's conversation ──
  async function handleReset() {
    if (!activeTab || activeTab.streaming) return;
    await fetch('/api/chat/reset', { method: 'POST' });
    updateTab(activeTabId, { agentTypeChosen: false, error: null });
    await fetchWelcome(activeTabId);
  }

  // ── Export conversation as markdown ──
  function handleExport() {
    if (!activeTab || activeTab.messages.length === 0) return;
    const lines = activeTab.messages.map(m =>
      `### ${m.role === 'user' ? 'You' : 'Assistant'}\n\n${m.content}`
    ).join('\n\n---\n\n');
    const text = `# Agent Arch — Conversation Export\n_${new Date().toLocaleString()}_\n\n---\n\n${lines}`;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-arch-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── "I'm Stuck" hint request ──
  function handleStuck() {
    void sendMessage("I'm stuck and need help. Can you give me a targeted hint for what I should do next? Don't give me the full solution — just a nudge in the right direction.");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      void sendMessage(activeTab?.input ?? '');
    }
  }

  const showAgentSelector =
    !activeTab?.agentTypeChosen &&
    activeTab?.messages.length === 1 &&
    !activeTab.messages[0].isStreaming;

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={tab.id === activeTabId ? styles.tabActive : styles.tab}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span style={styles.tabLabel}>{tab.label}</span>
            {tabs.length > 1 && (
              <button
                style={styles.tabCloseBtn}
                onClick={e => { e.stopPropagation(); deleteTab(tab.id); }}
                title="Close chat"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {tabs.length < 4 && (
          <button style={styles.newTabBtn} onClick={() => void createTab()} title="New chat">
            +
          </button>
        )}
      </div>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <span style={styles.headerTitle}>AGENT ARCH</span>
          <span style={styles.headerSub}> — Teaching Assistant</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            style={!activeTab || activeTab.messages.length === 0 ? styles.resetBtnDisabled : styles.resetBtn}
            onClick={handleExport}
            disabled={!activeTab || activeTab.messages.length === 0}
            title="Export conversation as Markdown"
          >
            Export
          </button>
          <button
            style={activeTab?.streaming ? styles.resetBtnDisabled : styles.resetBtn}
            onClick={handleReset}
            disabled={!activeTab || activeTab.streaming}
            title="Reset this conversation"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Message list */}
      <div style={styles.messageList}>
        {(activeTab?.messages ?? []).map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onConceptOpen={onConceptOpen}
          />
        ))}

        {showAgentSelector && (
          <div style={styles.agentSelector}>
            <p style={styles.agentSelectorLabel}>Choose your agent type:</p>
            <div style={styles.agentBtnRow}>
              {[
                { label: 'Task Automator', desc: 'Email, calendar, reminders' },
                { label: 'Research Assistant', desc: 'Search, summarize, notes' },
                { label: 'Custom', desc: 'You define the purpose' },
              ].map(({ label, desc }) => (
                <button
                  key={label}
                  style={styles.agentBtn}
                  onClick={() => handleAgentSelect(label)}
                >
                  <span style={styles.agentBtnLabel}>{label}</span>
                  <span style={styles.agentBtnDesc}>{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab?.streaming && activeTab.messages[activeTab.messages.length - 1]?.isStreaming && (
          <span className="cursor-blink" style={styles.cursor}>▋</span>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {activeTab?.error && (
        <div style={styles.errorBanner}>
          <span>⚠ {activeTab.error}</span>
          <button
            style={styles.errorRetryBtn}
            onClick={() => { updateTab(activeTabId, { error: null }); void fetchWelcome(activeTabId); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Input area */}
      <div style={styles.inputArea}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <textarea
            ref={textareaRef}
            style={activeTab?.streaming ? styles.textareaDisabled : styles.textarea}
            value={activeTab?.input ?? ''}
            onChange={e => updateTab(activeTabId, { input: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question... (Ctrl+Enter to send)"
            disabled={!activeTab || activeTab.streaming}
            rows={3}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              style={activeTab?.streaming ? styles.stuckBtnDisabled : styles.stuckBtn}
              onClick={handleStuck}
              disabled={!activeTab || activeTab.streaming}
              title="Ask for a targeted hint on your current task"
            >
              I'm Stuck
            </button>
          </div>
        </div>
        <button
          style={activeTab?.streaming || !activeTab?.input.trim() ? styles.sendBtnDisabled : styles.sendBtn}
          onClick={() => void sendMessage(activeTab?.input ?? '')}
          disabled={!activeTab || activeTab.streaming || !activeTab.input.trim()}
        >
          {activeTab?.streaming ? <><span className="spinner">⟳</span></> : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// MessageBubble sub-component
// ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onConceptOpen,
}: {
  message: ChatMessage;
  onConceptOpen: (slug: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div style={isUser ? styles.userBubbleWrapper : styles.assistantBubbleWrapper}>
      <div style={isUser ? styles.roleTagUser : styles.roleTagAssistant}>
        {isUser ? 'YOU' : 'ASSISTANT'}
      </div>

      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        {isUser ? (
          <p style={styles.userText}>{message.content}</p>
        ) : (
          <div style={styles.markdownWrapper}>
            <Markdown components={markdownComponents}>
              {message.content}
            </Markdown>
          </div>
        )}
      </div>

      {!message.isStreaming && message.conceptRefs.length > 0 && (
        <div style={styles.conceptLinks}>
          {message.conceptRefs.map(slug => (
            <button
              key={slug}
              style={styles.conceptLinkBtn}
              onClick={() => onConceptOpen(slug)}
            >
              Open lesson →
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const mono = "'Courier New', Courier, monospace";

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
    color: '#e2e8f0',
    fontFamily: mono,
    overflow: 'hidden',
  },
  // ── Tab bar ──
  tabBar: {
    display: 'flex',
    alignItems: 'stretch',
    background: '#070d18',
    borderBottom: '1px solid #1f2937',
    flexShrink: 0,
    minHeight: '34px',
    overflowX: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0 0.75rem',
    cursor: 'pointer',
    background: '#050a12',
    color: '#4b5563',
    fontSize: '0.72rem',
    fontFamily: mono,
    border: 'none',
    borderRight: '1px solid #1f2937',
    whiteSpace: 'nowrap' as const,
    minWidth: '80px',
    userSelect: 'none' as const,
  },
  tabActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0 0.75rem',
    cursor: 'pointer',
    background: '#0a0a0a',
    color: '#e2e8f0',
    fontSize: '0.72rem',
    fontFamily: mono,
    border: 'none',
    borderRight: '1px solid #1f2937',
    borderTop: '2px solid #2563eb',
    whiteSpace: 'nowrap' as const,
    minWidth: '80px',
    userSelect: 'none' as const,
  },
  tabLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tabCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    padding: '0 0.15rem',
    fontSize: '1rem',
    lineHeight: '1',
    fontFamily: mono,
    flexShrink: 0,
    borderRadius: '2px',
  },
  newTabBtn: {
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    padding: '0 0.85rem',
    fontSize: '1.1rem',
    fontFamily: mono,
    alignSelf: 'center',
    lineHeight: '1',
  },
  // ── Header ──
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.25rem',
    borderBottom: '1px solid #1f2937',
    background: '#111827',
    flexShrink: 0,
  },
  headerTitle: {
    color: '#7dd3fc',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    letterSpacing: '0.1em',
  },
  headerSub: {
    color: '#64748b',
    fontSize: '0.8rem',
  },
  resetBtn: {
    background: 'none',
    border: '1px solid #374151',
    color: '#94a3b8',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '0.3rem 0.7rem',
    fontSize: '0.75rem',
    fontFamily: mono,
  },
  resetBtnDisabled: {
    background: 'none',
    border: '1px solid #1f2937',
    color: '#374151',
    cursor: 'not-allowed',
    borderRadius: '4px',
    padding: '0.3rem 0.7rem',
    fontSize: '0.75rem',
    fontFamily: mono,
  },
  // ── Messages ──
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  assistantBubbleWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.25rem',
    animation: 'fadeInUp 0.2s ease',
  },
  userBubbleWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.25rem',
    animation: 'fadeInUp 0.2s ease',
  },
  roleTagAssistant: {
    fontSize: '0.65rem',
    color: '#7dd3fc',
    letterSpacing: '0.1em',
    fontWeight: 'bold',
  },
  roleTagUser: {
    fontSize: '0.65rem',
    color: '#94a3b8',
    letterSpacing: '0.1em',
    fontWeight: 'bold',
  },
  assistantBubble: {
    maxWidth: '85%',
    color: '#cbd5e1',
    fontSize: '0.88rem',
    lineHeight: 1.7,
  },
  userBubble: {
    background: '#1e293b',
    borderRadius: '8px 8px 2px 8px',
    padding: '0.6rem 0.9rem',
    maxWidth: '70%',
  },
  userText: {
    margin: 0,
    color: '#e2e8f0',
    fontSize: '0.88rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  markdownWrapper: {
    lineHeight: 1.7,
  },
  conceptLinks: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '0.25rem',
  },
  conceptLinkBtn: {
    background: 'none',
    border: '1px solid #2563eb',
    color: '#7dd3fc',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    fontFamily: mono,
  },
  cursor: {
    color: '#7dd3fc',
    fontSize: '1rem',
    display: 'block',
    height: '1.2rem',
  },
  // ── Agent selector ──
  agentSelector: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '8px',
    padding: '1rem',
  },
  agentSelectorLabel: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    margin: '0 0 0.75rem 0',
  },
  agentBtnRow: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  agentBtn: {
    background: '#1e293b',
    border: '1px solid #2563eb',
    color: '#e2e8f0',
    cursor: 'pointer',
    borderRadius: '6px',
    padding: '0.6rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.2rem',
    fontFamily: mono,
    minWidth: '140px',
  },
  agentBtnLabel: {
    color: '#7dd3fc',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  agentBtnDesc: {
    color: '#64748b',
    fontSize: '0.72rem',
  },
  // ── Error ──
  errorBanner: {
    background: '#1c0a0a',
    borderTop: '1px solid #7f1d1d',
    color: '#fca5a5',
    padding: '0.5rem 1.25rem',
    fontSize: '0.8rem',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  errorRetryBtn: {
    background: 'none',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '0.2rem 0.6rem',
    fontSize: '0.72rem',
    fontFamily: mono,
    flexShrink: 0,
  },
  // ── Input ──
  stuckBtn: {
    background: 'none',
    border: '1px solid #374151',
    color: '#f59e0b',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '0.2rem 0.7rem',
    fontSize: '0.72rem',
    fontFamily: mono,
  },
  stuckBtnDisabled: {
    background: 'none',
    border: '1px solid #1f2937',
    color: '#374151',
    cursor: 'not-allowed',
    borderRadius: '4px',
    padding: '0.2rem 0.7rem',
    fontSize: '0.72rem',
    fontFamily: mono,
  },
  inputArea: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem 1.25rem',
    borderTop: '1px solid #1f2937',
    background: '#0d1117',
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    background: '#111827',
    border: '1px solid #374151',
    color: '#e2e8f0',
    borderRadius: '6px',
    padding: '0.6rem 0.8rem',
    fontSize: '0.85rem',
    fontFamily: mono,
    resize: 'none',
    outline: 'none',
    lineHeight: 1.5,
  },
  textareaDisabled: {
    flex: 1,
    background: '#0a0a0a',
    border: '1px solid #1f2937',
    color: '#4b5563',
    borderRadius: '6px',
    padding: '0.6rem 0.8rem',
    fontSize: '0.85rem',
    fontFamily: mono,
    resize: 'none',
    outline: 'none',
    lineHeight: 1.5,
    cursor: 'not-allowed',
  },
  sendBtn: {
    background: '#2563eb',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    borderRadius: '6px',
    padding: '0.6rem 1.1rem',
    fontSize: '0.85rem',
    fontFamily: mono,
    fontWeight: 'bold',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
  sendBtnDisabled: {
    background: '#1e293b',
    border: 'none',
    color: '#4b5563',
    cursor: 'not-allowed',
    borderRadius: '6px',
    padding: '0.6rem 1.1rem',
    fontSize: '0.85rem',
    fontFamily: mono,
    fontWeight: 'bold',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
};
