/**
 * AssistantChat
 *
 * The main teaching assistant interface. Streams responses from the backend
 * via SSE (using fetch + ReadableStream), renders markdown with syntax
 * highlighting, and detects [CONCEPT:slug] markers to open the lesson panel.
 *
 * User flow:
 *   1. On mount → GET /api/chat/welcome → streams opening message
 *   2. After first message → show agent type selector buttons
 *   3. User chats → POST /api/chat → streams response
 *   4. [CONCEPT:slug] in response → show "Open lesson" button
 *   5. "New conversation" → POST /api/chat/reset → re-fetch welcome
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;           // display content — [CONCEPT:*] markers stripped
  conceptRefs: string[];     // concept slugs extracted from raw response
  isStreaming?: boolean;
}

interface Props {
  onConceptOpen: (slug: string) => void;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

// Extract [CONCEPT:slug] markers and return {clean text, slugs}
function extractConcepts(text: string): { clean: string; slugs: string[] } {
  const slugs: string[] = [];
  const clean = text.replace(/\[CONCEPT:([^\]]+)\]/g, (_match, slug: string) => {
    slugs.push(slug.trim());
    return ''; // remove the marker from display text
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
// Reads a fetch response body as SSE. Calls onDelta for each text chunk,
// onDone when the stream completes, onError on failure.
// Returns the accumulated full text.
// ────────────────────────────────────────────────────────────

async function readSSEStream(
  response: Response,
  onDelta: (delta: string) => void,
  onDone: () => void,
  onError: (message: string) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    onError('No response body');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on SSE event boundaries — each event ends with \n\n
      const events = buffer.split('\n\n');
      // Last element may be incomplete — keep it in the buffer
      buffer = events.pop() ?? '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              type: string;
              delta?: string;
              message?: string;
            };

            if (payload.type === 'text' && payload.delta) {
              onDelta(payload.delta);
            } else if (payload.type === 'done') {
              onDone();
            } else if (payload.type === 'error') {
              onError(payload.message ?? 'Unknown error');
            }
          } catch {
            // Malformed JSON line — skip
          }
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [agentTypeChosen, setAgentTypeChosen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Stream a response and update a specific message in state ──
  const streamIntoMessage = useCallback(
    async (response: Response, messageId: string) => {
      let accumulated = '';

      await readSSEStream(
        response,
        (delta) => {
          accumulated += delta;
          const { clean } = extractConcepts(accumulated);
          setMessages(prev =>
            prev.map(m =>
              m.id === messageId ? { ...m, content: clean, isStreaming: true } : m
            )
          );
        },
        () => {
          // Stream done — finalize, extract concepts
          const { clean, slugs } = extractConcepts(accumulated);
          setMessages(prev =>
            prev.map(m =>
              m.id === messageId
                ? { ...m, content: clean, conceptRefs: slugs, isStreaming: false }
                : m
            )
          );
          setStreaming(false);
          setError(null);
        },
        (errMsg) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === messageId
                ? { ...m, content: `*(Error: ${errMsg})*`, isStreaming: false }
                : m
            )
          );
          setStreaming(false);
          setError(errMsg);
        },
      );
    },
    []
  );

  // ── Fetch welcome message on mount ──
  const fetchWelcome = useCallback(async () => {
    const msgId = randomId();
    setMessages([{
      id: msgId,
      role: 'assistant',
      content: '',
      conceptRefs: [],
      isStreaming: true,
    }]);
    setStreaming(true);

    try {
      const res = await fetch('/api/chat/welcome');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await streamIntoMessage(res, msgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages([{
        id: msgId,
        role: 'assistant',
        content: `*(Could not connect to assistant: ${msg})*`,
        conceptRefs: [],
        isStreaming: false,
      }]);
      setStreaming(false);
    }
  }, [streamIntoMessage]);

  useEffect(() => {
    fetchWelcome();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send a user message ──
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    // Add user message
    const userMsgId = randomId();
    const assistantMsgId = randomId();

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: trimmed, conceptRefs: [] },
      { id: assistantMsgId, role: 'assistant', content: '', conceptRefs: [], isStreaming: true },
    ]);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await streamIntoMessage(res, assistantMsgId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `*(Connection error: ${msg})*`, isStreaming: false }
            : m
        )
      );
      setStreaming(false);
    }
  }, [streaming, streamIntoMessage]);

  // ── Agent type selection ──
  const handleAgentSelect = useCallback((type: string) => {
    setAgentTypeChosen(true);
    sendMessage(`I want to build a ${type}.`);
  }, [sendMessage]);

  // ── Reset conversation ──
  const handleReset = useCallback(async () => {
    if (streaming) return;
    await fetch('/api/chat/reset', { method: 'POST' });
    setAgentTypeChosen(false);
    setError(null);
    await fetchWelcome();
  }, [streaming, fetchWelcome]);

  // ── Keyboard handler ──
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // Show agent selector after the first assistant message if not yet chosen
  const showAgentSelector = !agentTypeChosen && messages.length === 1 && !messages[0].isStreaming;

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <span style={styles.headerTitle}>AGENT ARCH</span>
          <span style={styles.headerSub}> — Teaching Assistant</span>
        </div>
        <button
          style={streaming ? styles.resetBtnDisabled : styles.resetBtn}
          onClick={handleReset}
          disabled={streaming}
          title="Start a new conversation"
        >
          New conversation
        </button>
      </div>

      {/* Message list */}
      <div style={styles.messageList}>
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onConceptOpen={onConceptOpen}
          />
        ))}

        {/* Agent type selector */}
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

        {/* Streaming cursor */}
        {streaming && messages[messages.length - 1]?.isStreaming && (
          <span style={styles.cursor}>▋</span>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          ⚠ {error}
        </div>
      )}

      {/* Input area */}
      <div style={styles.inputArea}>
        <textarea
          ref={textareaRef}
          style={streaming ? styles.textareaDisabled : styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question... (Ctrl+Enter to send)"
          disabled={streaming}
          rows={3}
        />
        <button
          style={streaming || !input.trim() ? styles.sendBtnDisabled : styles.sendBtn}
          onClick={() => sendMessage(input)}
          disabled={streaming || !input.trim()}
        >
          Send
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

      {/* Concept links — shown below the message once streaming is done */}
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

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
    color: '#e2e8f0',
    fontFamily: "'Courier New', Courier, monospace",
    overflow: 'hidden',
  },
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
    fontFamily: 'inherit',
  },
  resetBtnDisabled: {
    background: 'none',
    border: '1px solid #1f2937',
    color: '#374151',
    cursor: 'not-allowed',
    borderRadius: '4px',
    padding: '0.3rem 0.7rem',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
  },
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
  },
  userBubbleWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.25rem',
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
    fontFamily: 'inherit',
  },
  cursor: {
    color: '#7dd3fc',
    animation: 'none',
    fontSize: '1rem',
    display: 'block',
    height: '1.2rem',
  },
  agentSelector: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '8px',
    padding: '1rem',
  },
  agentSelectorLabel: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    marginBottom: '0.75rem',
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
    fontFamily: 'inherit',
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
  errorBanner: {
    background: '#1c0a0a',
    borderTop: '1px solid #7f1d1d',
    color: '#fca5a5',
    padding: '0.5rem 1.25rem',
    fontSize: '0.8rem',
    flexShrink: 0,
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
    fontFamily: "'Courier New', Courier, monospace",
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
    fontFamily: "'Courier New', Courier, monospace",
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
    fontFamily: 'inherit',
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
    fontFamily: 'inherit',
    fontWeight: 'bold',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
};
