/**
 * Curriculum Loader
 *
 * Reads markdown lesson files from /curriculum/concepts/, parses their
 * frontmatter, and exposes them to the chat handler and API routes.
 *
 * Files are loaded eagerly at module import time so the system prompt
 * is always ready without async setup.
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ConceptMeta {
  slug: string;          // filename without .md, e.g. "01-what-is-an-agent"
  title: string;         // from frontmatter
  order: number;         // from frontmatter — used for sorting
  prerequisites: string[]; // slugs of required prior concepts
  summary: string;       // one-sentence description shown in system prompt
}

export interface ConceptContent extends ConceptMeta {
  body: string;          // markdown body after frontmatter is stripped
}

// ────────────────────────────────────────────────────────────
// Path resolution
// ────────────────────────────────────────────────────────────

// From backend/src/assistant-service/ → up 3 levels → agent-arch/
const CONCEPTS_DIR = path.resolve(__dirname, '../../../curriculum/concepts');

// ────────────────────────────────────────────────────────────
// Loading logic
// ────────────────────────────────────────────────────────────

function loadConcepts(): ConceptContent[] {
  if (!fs.existsSync(CONCEPTS_DIR)) {
    console.warn(`[curriculum] Concepts directory not found: ${CONCEPTS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(CONCEPTS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort(); // alphabetical = order by filename prefix

  const concepts: ConceptContent[] = [];

  for (const filename of files) {
    const slug = filename.replace(/\.md$/, '');
    const filepath = path.join(CONCEPTS_DIR, filename);

    try {
      const raw = fs.readFileSync(filepath, 'utf-8');
      const parsed = matter(raw);

      concepts.push({
        slug,
        title: parsed.data.title ?? slug,
        order: parsed.data.order ?? 0,
        prerequisites: parsed.data.prerequisites ?? [],
        summary: parsed.data.summary ?? '',
        body: parsed.content,
      });
    } catch (err) {
      console.warn(`[curriculum] Failed to parse ${filename}:`, err);
    }
  }

  return concepts.sort((a, b) => a.order - b.order);
}

// Eagerly loaded at module import time
const allConcepts: ConceptContent[] = loadConcepts();

console.log(`[curriculum] Loaded ${allConcepts.length} concept(s):`,
  allConcepts.map(c => c.slug).join(', ') || '(none)');

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Returns metadata for all concepts (no body content).
 * Used to build the compact system prompt index.
 */
export function getAllConceptMetas(): ConceptMeta[] {
  return allConcepts.map(({ slug, title, order, prerequisites, summary }) => ({
    slug, title, order, prerequisites, summary,
  }));
}

/**
 * Returns the full content (including body) for a single concept.
 * Returns null if the slug is not found.
 */
export function getConceptContent(slug: string): ConceptContent | null {
  return allConcepts.find(c => c.slug === slug) ?? null;
}
