/**
 * Chat Handler
 *
 * Manages the AI teaching assistant: conversation history, Claude API calls,
 * SSE streaming responses, and curriculum endpoints.
 *
 * All conversation state is in-memory (single user, resets on server restart).
 * This is intentional — a fresh start each session keeps the learning flow clean.
 *
 * Endpoints exported (wired in server.ts):
 *   GET  /api/chat/welcome     → stream the opening message (idempotent)
 *   POST /api/chat             → send a message, stream the response
 *   POST /api/chat/reset       → clear conversation history
 *   GET  /api/curriculum       → list all concept metadata
 *   GET  /api/curriculum/:slug → get full content of one concept
 */

import Anthropic from '@anthropic-ai/sdk';
import { Request, Response } from 'express';
import { getAllConceptMetas, getConceptContent } from './curriculum-loader';

// ────────────────────────────────────────────────────────────
// Anthropic client
// ────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// ────────────────────────────────────────────────────────────
// Conversation history (in-memory, single user)
// ────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const conversationHistory: Message[] = [];

// ────────────────────────────────────────────────────────────
// System prompt
// ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const conceptIndex = getAllConceptMetas()
    .map(c => `  - [${c.slug}] ${c.title}: ${c.summary}`)
    .join('\n');

  return `You are the Agent Arch teaching assistant — a Socratic AI mentor guiding developers through building their first AI agent from scratch.

## YOUR ROLE

You guide users through the Agent Arch curriculum: learning agentic AI concepts while building a real, working personal agent (Task Automator, Research Assistant, or Custom).

You challenge users to think, not just copy. You ask questions before giving answers. You celebrate progress and push back when they take shortcuts.

## APPROACH

- **Socratic first:** Ask a question before explaining something. "What do you think happens if the API key is wrong?" is better than immediately explaining.
- **Hints, not solutions:** When a user is stuck, give the smallest useful hint. Never write their implementation for them — give code snippets only as illustrative *examples*, not paste-ready solutions.
- **Challenge decisions:** If a user proposes a bad architectural choice, ask questions that surface the problem rather than just saying "that's wrong."
- **Adapt your pace:** If someone answers your question well, move faster. If they're confused, slow down and use a concrete analogy.
- **Short responses:** Keep replies concise. 3-4 paragraphs max unless writing an explanation that genuinely needs more.

## CONCEPT LINKING

The platform has a curriculum viewer. When you explain a topic that maps to a lesson, include a [CONCEPT:slug] marker. The frontend will show an "Open lesson" button. Use this to invite deeper reading, not as a crutch.

Available concepts:
${conceptIndex || '  (No concepts loaded yet)'}

Example: If explaining the agentic loop, include [CONCEPT:01-what-is-an-agent] once in your response.
Include at most ONE concept link per response. Don't link to concepts that aren't relevant.

## AGENT TYPES

When the user hasn't chosen yet, ask them:

- **Task Automator:** Automates repetitive tasks — email management, calendar scheduling, reminders. Builds tools: sendEmail, readInbox, addCalendarEvent, setReminder.
- **Research Assistant:** Gathers and synthesizes information — web search, document summarization, fact extraction. Builds tools: searchWeb, readDocument, summarize, saveNote.
- **Custom:** Blank canvas. User defines the purpose and tools. More open-ended.

## FIRST MESSAGE

If this is the first message in the conversation, introduce yourself briefly (1-2 sentences) then ask: "What kind of agent do you want to build — a Task Automator, Research Assistant, or something Custom?"

## TONE

Encouraging but rigorous. Like a senior engineer who genuinely wants you to succeed but won't let you skip understanding the fundamentals. Occasionally use light humor. Never condescending.

## WHAT YOU KNOW ABOUT THE PROJECT

The user is working in a Node.js + TypeScript project called Agent Arch. The agent template lives in src/agents/. The backend uses Express + SQLite. They just unlocked the platform by debugging a broken init.ts file.`;
}

// ────────────────────────────────────────────────────────────
// SSE helpers
// ────────────────────────────────────────────────────────────

function setSSEHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();
}

function sendSSE(res: Response, payload: object) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ────────────────────────────────────────────────────────────
// Streaming helper — shared by welcomeHandler and chatHandler
// ────────────────────────────────────────────────────────────

async function streamAssistantResponse(res: Response) {
  let fullText = '';

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages: conversationHistory,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const delta = event.delta.text;
        fullText += delta;
        sendSSE(res, { type: 'text', delta });
      }
    }

    // Store the complete response in history
    conversationHistory.push({ role: 'assistant', content: fullText });
    sendSSE(res, { type: 'done' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[chat] Claude API error:', message);
    sendSSE(res, { type: 'error', message });
  } finally {
    res.end();
  }
}

// ────────────────────────────────────────────────────────────
// Route handlers
// ────────────────────────────────────────────────────────────

/**
 * GET /api/chat/welcome
 *
 * Streams the opening assistant message. Called once on frontend mount.
 * If the conversation already has history, returns done immediately
 * (idempotent — safe to call on every page reload).
 */
export async function welcomeHandler(_req: Request, res: Response) {
  setSSEHeaders(res);

  if (conversationHistory.length > 0) {
    // Already have a conversation — don't re-greet
    sendSSE(res, { type: 'done' });
    res.end();
    return;
  }

  // No user message for the welcome — just let the assistant speak first
  // We inject a silent system cue by temporarily adding a user turn
  conversationHistory.push({
    role: 'user',
    content: '__INIT__', // sentinel, replaced immediately after
  });

  // Remove the sentinel before streaming (assistant will respond to empty context)
  // Actually: keep it so the model has something to respond to, then strip from history
  await streamAssistantResponse(res);

  // Remove the __INIT__ sentinel — history should look like: [assistant: welcome msg]
  const initIndex = conversationHistory.findIndex(m => m.content === '__INIT__');
  if (initIndex !== -1) {
    conversationHistory.splice(initIndex, 1);
  }
}

/**
 * POST /api/chat
 *
 * Receives a user message, adds it to history, streams the assistant response.
 *
 * Body: { message: string }
 * Response: SSE stream of { type: 'text', delta: string }
 *                       | { type: 'done' }
 *                       | { type: 'error', message: string }
 */
export async function chatHandler(req: Request, res: Response) {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== 'string' || message.trim() === '') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  conversationHistory.push({ role: 'user', content: message.trim() });

  setSSEHeaders(res);
  await streamAssistantResponse(res);
}

/**
 * POST /api/chat/reset
 *
 * Clears conversation history. The next GET /api/chat/welcome will
 * start a fresh conversation.
 */
export function resetChatHandler(_req: Request, res: Response) {
  conversationHistory.length = 0;
  console.log('[chat] Conversation history cleared');
  res.json({ ok: true });
}

/**
 * GET /api/curriculum
 *
 * Returns metadata for all concepts (no body content).
 */
export function curriculumListHandler(_req: Request, res: Response) {
  res.json(getAllConceptMetas());
}

/**
 * GET /api/curriculum/:slug
 *
 * Returns the full content (frontmatter + body) for one concept.
 */
export function curriculumHandler(req: Request, res: Response) {
  const { slug } = req.params;
  const concept = getConceptContent(slug);

  if (!concept) {
    res.status(404).json({ error: `Concept not found: ${slug}` });
    return;
  }

  res.json(concept);
}
