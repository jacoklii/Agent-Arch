/**
 * Chat Handler
 *
 * Manages the AI teaching assistant: conversation history, Claude API calls,
 * SSE streaming responses, and curriculum endpoints.
 *
 * All conversation state is in-memory (single user, resets on server restart).
 * This is intentional — a fresh start each session keeps the learning flow clean.
 *
 * ## Tool Use (Session 5)
 *
 * The assistant can call 4 review tools mid-conversation:
 *   - runTests     → execute the task-automator test suite
 *   - analyzeCode  → inspect implementation files for quality issues
 *   - markComplete → mark a curriculum task as done
 *   - getProgress  → check the user's current progress state
 *
 * Two-phase pattern for tool use:
 *   1. Non-streaming call to detect tool_use blocks
 *   2. Execute tools internally, send SSE tool_call events to frontend
 *   3. Stream the continuation response via SSE
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
import { runTests } from '../reviewer/test-runner';
import { analyzeCode } from '../reviewer/code-analyzer';
import type { ProgressTracker } from '../reviewer/progress-tracker';
import { CURRICULUM_TASKS } from '../reviewer/progress-tracker';

// ────────────────────────────────────────────────────────────
// Anthropic client
// ────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// ────────────────────────────────────────────────────────────
// Reviewer integration (set by server.ts after startup)
// ────────────────────────────────────────────────────────────

let reviewTracker: ProgressTracker | null = null;

/**
 * configureReviewer(tracker)
 *
 * Called once from server.ts after the progress tracker is initialized.
 * Enables the Claude tools that require database access.
 */
export function configureReviewer(tracker: ProgressTracker) {
  reviewTracker = tracker;
  console.log('[chat] Reviewer tools configured');
}

// ────────────────────────────────────────────────────────────
// Conversation history (in-memory, single user)
// Uses Anthropic's MessageParam type to support tool_use/tool_result blocks.
// ────────────────────────────────────────────────────────────

const conversationHistory: Anthropic.MessageParam[] = [];

// ────────────────────────────────────────────────────────────
// Claude tool definitions (Session 5)
// ────────────────────────────────────────────────────────────

const REVIEW_TOOLS: Anthropic.Tool[] = [
  {
    name: 'runTests',
    description:
      'Run the test suite for the task-automator agent and get structured pass/fail results. ' +
      'Use this when the user claims to have implemented something to verify before praising their work. ' +
      'Always run tests before marking a test-required task as complete.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file: {
          type: 'string',
          description: 'Optional: specific test file to run, e.g. "intent.test.ts". Omit to run all tests.',
        },
      },
      required: [],
    },
  },
  {
    name: 'analyzeCode',
    description:
      'Analyze the user\'s implementation files (intent.ts, memory.ts, email.ts, calendar.ts) ' +
      'for code quality: remaining stubs, error handling, TypeScript types, documentation. ' +
      'Use this when the user wants feedback on their code before tests pass.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'markComplete',
    description:
      'Mark a curriculum task as complete in the progress tracker. ' +
      'Only call this after verifying the task is genuinely done (tests pass, user demonstrated understanding). ' +
      'Valid task IDs: ' + CURRICULUM_TASKS.map(t => t.id).join(', '),
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The curriculum task ID to mark complete',
          enum: CURRICULUM_TASKS.map(t => t.id),
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'getProgress',
    description:
      'Get the user\'s current curriculum progress: which tasks are complete, ' +
      'which concepts they\'ve viewed, and overall completion percentage. ' +
      'Use this at the start of a session or when advising the user on what to do next.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// ────────────────────────────────────────────────────────────
// Tool executor
// ────────────────────────────────────────────────────────────

async function executeReviewTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  if (!reviewTracker) {
    return { error: 'Reviewer not initialized — this is a bug, report it.' };
  }

  switch (toolName) {
    case 'runTests': {
      const file = typeof input.file === 'string' ? input.file : undefined;
      const results = await runTests(file);
      const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
      return { results, summary: { totalPassed, totalFailed, allPassing: totalFailed === 0 } };
    }

    case 'analyzeCode': {
      return analyzeCode();
    }

    case 'markComplete': {
      const taskId = typeof input.taskId === 'string' ? input.taskId : null;
      if (!taskId) return { error: 'taskId is required' };
      reviewTracker.markTaskComplete(taskId);
      return { ok: true, taskId, message: `Task "${taskId}" marked complete.` };
    }

    case 'getProgress': {
      return reviewTracker.getProgress();
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ────────────────────────────────────────────────────────────
// System prompt
// ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const conceptIndex = getAllConceptMetas()
    .map(c => `  - [${c.slug}] ${c.title}: ${c.summary}`)
    .join('\n');

  const taskList = CURRICULUM_TASKS
    .map((t, i) => `  ${i + 1}. ${t.id} — ${t.label}${t.requiresTest ? ' (tests must pass)' : ''}`)
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

## REVIEW TOOLS (Session 5)

You have access to 4 tools for verifying user progress:

- **runTests(file?)** — Run the agent test suite. ALWAYS call this when the user claims to have implemented intent classification or the memory system. Do not praise their work or mark tests-required tasks complete without running tests first.
- **analyzeCode()** — Review code quality. Call this when the user wants feedback on their implementation.
- **markComplete(taskId)** — Mark a task complete. Only call after genuine verification (passing tests for test-required tasks, or demonstrated understanding for others).
- **getProgress()** — Check current progress. Call this at the start of a session or when advising what to do next.

Curriculum tasks (in order):
${taskList}

### Verification rules:
- For tasks marked "(tests must pass)": run runTests() and verify all tests in that area pass before calling markComplete()
- For other tasks: use your judgment — did the user actually do the thing?
- When tests fail: share the specific failure messages and ask guiding questions, don't just fix it for them
- When tests pass: celebrate briefly, then call markComplete() and guide to the next task

## AGENT TYPES

When the user hasn't chosen yet, ask them:

- **Task Automator:** Automates repetitive tasks — email management, calendar scheduling, reminders. Builds tools: sendEmail, readInbox, addCalendarEvent, setReminder.
- **Research Assistant:** Gathers and synthesizes information — web search, document summarization, fact extraction. Builds tools: searchWeb, readDocument, summarize, saveNote.
- **Custom:** Blank canvas. User defines the purpose and tools. More open-ended.

When the user chooses an agent type, call markComplete('choose-agent-type').

## FIRST MESSAGE

If this is the first message in the conversation, introduce yourself briefly (1-2 sentences) then ask: "What kind of agent do you want to build — a Task Automator, Research Assistant, or something Custom?"

Also call getProgress() early in the first real conversation to orient yourself to where the user is in the curriculum.

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
// Core streaming helper
// ────────────────────────────────────────────────────────────

/**
 * streamFromMessages(res, messages)
 *
 * Streams the assistant's text response over SSE given the current
 * message history. Appends the completed response to conversationHistory.
 */
async function streamFromMessages(res: Response, messages: Anthropic.MessageParam[]) {
  let fullText = '';

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages,
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

  conversationHistory.push({ role: 'assistant', content: fullText });
  return fullText;
}

// ────────────────────────────────────────────────────────────
// Two-phase assistant handler
// ────────────────────────────────────────────────────────────

/**
 * streamAssistantResponse(res)
 *
 * Two-phase pattern:
 *   Phase 1 — Non-streaming call with tools defined. If Claude wants to use
 *              a tool, we execute it and send SSE tool_call events.
 *   Phase 2 — Stream the continuation (or the original text if no tools used).
 *
 * The SSE connection stays open throughout both phases.
 */
async function streamAssistantResponse(res: Response) {
  try {
    // Phase 1: non-streaming with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages: conversationHistory,
      tools: REVIEW_TOOLS,
    });

    if (response.stop_reason === 'tool_use') {
      // ── Tool use path ──────────────────────────────────────

      // Add the assistant's tool_use turn to history
      conversationHistory.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        // Notify frontend a tool is running (shown as status indicator)
        sendSSE(res, { type: 'tool_call', tool: block.name, status: 'running' });

        let result: unknown;
        try {
          result = await executeReviewTool(block.name, block.input as Record<string, unknown>);
        } catch (err) {
          result = { error: `Tool execution failed: ${String(err)}` };
        }

        sendSSE(res, { type: 'tool_call', tool: block.name, status: 'done', result });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      // Add tool results as the next user turn
      conversationHistory.push({ role: 'user', content: toolResults });

      // Phase 2: stream the continuation
      await streamFromMessages(res, conversationHistory);

    } else {
      // ── No tool use — stream text blocks directly ──────────

      // If the response has text content, we could stream it from Phase 1
      // but it's simpler and more consistent to re-request as a stream.
      // Since no tools were called, just stream normally.
      const textContent = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('');

      if (textContent) {
        // Emit the already-fetched text as deltas (simulating streaming)
        sendSSE(res, { type: 'text', delta: textContent });
        conversationHistory.push({ role: 'assistant', content: textContent });
      }
    }

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

  // No user message for the welcome — just let the assistant speak first.
  // Inject a silent user cue so the model has something to respond to.
  conversationHistory.push({
    role: 'user',
    content: '__INIT__',
  });

  await streamAssistantResponse(res);

  // Remove the __INIT__ sentinel — history should look like: [assistant: welcome msg]
  const initIndex = conversationHistory.findIndex(
    m => typeof m.content === 'string' && m.content === '__INIT__'
  );
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
 *                       | { type: 'tool_call', tool: string, status: 'running'|'done', result?: unknown }
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

  // Mark meet-assistant complete on first real user message
  if (reviewTracker && conversationHistory.filter(m => m.role === 'user').length === 1) {
    reviewTracker.markTaskComplete('meet-assistant');
  }

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
