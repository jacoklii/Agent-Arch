/**
 * ConceptViewer
 *
 * Side panel that renders a curriculum lesson in markdown with syntax
 * highlighting. Appears when the teaching assistant references a concept.
 *
 * Props:
 *   slug      — concept filename slug, e.g. "01-what-is-an-agent"
 *   onClose   — called when the user closes the panel
 */

import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface ConceptMeta {
  slug: string;
  title: string;
  order: number;
  prerequisites: string[];
  summary: string;
}

interface ConceptContent extends ConceptMeta {
  body: string;
}

interface Props {
  slug: string;
  onClose: () => void;
  onConceptView?: (slug: string) => void;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default function ConceptViewer({ slug, onClose, onConceptView }: Props) {
  const [content, setContent] = useState<ConceptContent | null>(null);
  const [allConcepts, setAllConcepts] = useState<ConceptMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlug, setCurrentSlug] = useState(slug);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // ── Copy to clipboard helper ─────────────────────────────
  function copyCode(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(c => c === id ? null : c), 2000);
    }).catch(() => {
      // Clipboard API not available — silently ignore
    });
  }

  // ── Markdown components (defined here to access copyCode) ─
  const markdownComponents = {
    code(props: React.ComponentPropsWithoutRef<'code'> & { node?: unknown }) {
      const { children, className, node: _node, ...rest } = props;
      const match = /language-(\w+)/.exec(className ?? '');
      const codeText = String(children).replace(/\n$/, '');
      const blockId = codeText.slice(0, 30);

      return match ? (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => copyCode(codeText, blockId)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              zIndex: 1,
              background: copiedId === blockId ? '#14532d' : '#1e293b',
              border: `1px solid ${copiedId === blockId ? '#22c55e' : '#374151'}`,
              color: copiedId === blockId ? '#22c55e' : '#64748b',
              borderRadius: '3px',
              padding: '2px 8px',
              fontSize: '0.65rem',
              cursor: 'pointer',
              fontFamily: "'Courier New', Courier, monospace",
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {copiedId === blockId ? '✓ copied' : 'copy'}
          </button>
          <SyntaxHighlighter
            style={oneDark as Record<string, React.CSSProperties>}
            language={match[1]}
            PreTag="div"
            customStyle={{ borderRadius: '6px', fontSize: '0.82rem', margin: '0.75rem 0' }}
            {...(rest as object)}
          >
            {codeText}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code style={styles.inlineCode} className={className} {...rest}>
          {children}
        </code>
      );
    },
  };

  // Load all concept metadata for the nav list (once on mount)
  useEffect(() => {
    fetch('/api/curriculum')
      .then(r => r.json())
      .then((data: ConceptMeta[]) => setAllConcepts(data))
      .catch(() => setAllConcepts([]));
  }, []);

  // Load concept body whenever currentSlug changes
  useEffect(() => {
    setLoading(true);
    setContent(null);
    fetch(`/api/curriculum/${currentSlug}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data: ConceptContent) => {
        setContent(data);
        setLoading(false);
        // Notify parent so concept viewing is tracked for progress
        onConceptView?.(currentSlug);
      })
      .catch(() => {
        setContent(null);
        setLoading(false);
      });
  }, [currentSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll body to top when lesson changes
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentSlug]);

  // When parent passes a new slug, sync it in
  useEffect(() => {
    setCurrentSlug(slug);
  }, [slug]);

  // ── Keyboard navigation ──────────────────────────────────
  // Arrow keys navigate lessons, Escape closes the panel.
  // Guard: skip if user is typing in an input/textarea.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        onClose();
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && allConcepts.length > 0) {
        e.preventDefault();
        const idx = allConcepts.findIndex(c => c.slug === currentSlug);
        if (e.key === 'ArrowRight' && idx < allConcepts.length - 1) {
          setCurrentSlug(allConcepts[idx + 1].slug);
        } else if (e.key === 'ArrowLeft' && idx > 0) {
          setCurrentSlug(allConcepts[idx - 1].slug);
        }
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [allConcepts, currentSlug, onClose]);

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerLabel}>
          {loading ? 'Loading...' : (content?.title ?? 'Lesson')}
        </span>
        <button style={styles.closeBtn} onClick={onClose} title="Close lesson (Esc)">
          ✕
        </button>
      </div>

      {/* Concept navigation */}
      {allConcepts.length > 0 && (
        <nav style={styles.nav}>
          {allConcepts.map(c => (
            <button
              key={c.slug}
              style={c.slug === currentSlug ? styles.navActive : styles.navItem}
              onClick={() => setCurrentSlug(c.slug)}
              title={c.summary}
            >
              {c.order}. {c.title}
            </button>
          ))}
          {/* Prev / Next arrow controls */}
          {(() => {
            const idx = allConcepts.findIndex(c => c.slug === currentSlug);
            return (
              <div style={styles.navArrows}>
                <button
                  style={idx <= 0 ? styles.navArrowDisabled : styles.navArrow}
                  onClick={() => idx > 0 && setCurrentSlug(allConcepts[idx - 1].slug)}
                  disabled={idx <= 0}
                  title="Previous lesson (←)"
                >
                  ← Prev
                </button>
                <span style={styles.navArrowHint}>← → to navigate</span>
                <button
                  style={idx >= allConcepts.length - 1 ? styles.navArrowDisabled : styles.navArrow}
                  onClick={() => idx < allConcepts.length - 1 && setCurrentSlug(allConcepts[idx + 1].slug)}
                  disabled={idx >= allConcepts.length - 1}
                  title="Next lesson (→)"
                >
                  Next →
                </button>
              </div>
            );
          })()}
        </nav>
      )}

      {/* Body */}
      <div ref={bodyRef} style={styles.body}>
        {loading && (
          <p style={styles.muted}>Loading lesson...</p>
        )}

        {!loading && !content && (
          <p style={styles.error}>Could not load concept "{currentSlug}"</p>
        )}

        {!loading && content && (
          <div style={styles.markdown}>
            <Markdown components={markdownComponents}>
              {content.body}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: "'Courier New', Courier, monospace",
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #1f2937',
    background: '#111827',
    flexShrink: 0,
  },
  headerLabel: {
    color: '#7dd3fc',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
  },
  closeBtn: {
    background: 'none',
    border: '1px solid #374151',
    color: '#94a3b8',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    lineHeight: 1,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    padding: '0.5rem',
    borderBottom: '1px solid #1f2937',
    background: '#0a0a0a',
    flexShrink: 0,
  },
  navItem: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '0.35rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    transition: 'color 0.1s',
  },
  navActive: {
    background: '#1e293b',
    border: 'none',
    color: '#7dd3fc',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '0.35rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
  },
  navArrows: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '0.4rem',
    paddingTop: '0.4rem',
    borderTop: '1px solid #1f2937',
  },
  navArrow: {
    background: 'none',
    border: 'none',
    color: '#7dd3fc',
    cursor: 'pointer',
    fontSize: '0.7rem',
    fontFamily: 'inherit',
    padding: '0.2rem 0.3rem',
  },
  navArrowDisabled: {
    background: 'none',
    border: 'none',
    color: '#1f2937',
    cursor: 'not-allowed',
    fontSize: '0.7rem',
    fontFamily: 'inherit',
    padding: '0.2rem 0.3rem',
  },
  navArrowHint: {
    color: '#374151',
    fontSize: '0.6rem',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem 1.25rem 2rem',
  },
  markdown: {
    lineHeight: 1.7,
    fontSize: '0.88rem',
    color: '#cbd5e1',
  },
  muted: {
    color: '#64748b',
    fontSize: '0.85rem',
  },
  error: {
    color: '#ef4444',
    fontSize: '0.85rem',
  },
  inlineCode: {
    background: '#1e293b',
    color: '#7dd3fc',
    padding: '0.1em 0.35em',
    borderRadius: '3px',
    fontSize: '0.85em',
    fontFamily: "'Courier New', Courier, monospace",
  },
};
