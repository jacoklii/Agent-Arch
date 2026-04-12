/**
 * Intent Classification — core/intent.ts
 *
 * In an agentic loop, the agent must decide WHAT the user wants before it can
 * decide HOW to help. This is "intent classification": mapping free-form natural
 * language to a structured action the agent knows how to perform.
 *
 * Why this matters:
 * Without intent classification, your agent can't route requests to the right
 * tool. "Send a note to Alice" looks very different from "Schedule a meeting
 * with Alice" as raw text — but once classified, the agent knows to call
 * sendEmail() vs. addEvent().
 *
 * Your job: implement classifyIntent() so the tests in tests/intent.test.ts pass.
 *
 * Hint: A real implementation would call Claude with tool_use to classify the
 * input. See curriculum concept: 02-mcp-and-tools
 */

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/**
 * The set of actions this agent understands.
 * UNKNOWN means the agent couldn't figure out what the user wants.
 */
export type IntentType =
  | 'SEND_EMAIL'
  | 'READ_EMAILS'
  | 'ADD_CALENDAR_EVENT'
  | 'LIST_CALENDAR_EVENTS'
  | 'UNKNOWN';

/**
 * The result of classifying a user's input.
 *
 * @property type            - Which action the user wants
 * @property confidence      - How sure we are (0.0 to 1.0)
 * @property extractedEntities - Key pieces of data pulled from the input
 *
 * Example:
 *   Input: "Send an email to alice@example.com with subject Hello"
 *   Result: {
 *     type: 'SEND_EMAIL',
 *     confidence: 0.95,
 *     extractedEntities: { to: 'alice@example.com', subject: 'Hello' }
 *   }
 */
export interface ClassifiedIntent {
  type: IntentType;
  confidence: number;
  extractedEntities: Record<string, string>;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * classifyIntent — maps a natural-language string to a structured intent.
 *
 * TODO: Implement this function.
 *
 * What to implement:
 *   Parse the input string and return the appropriate IntentType along with
 *   any relevant entities (email addresses, event titles, dates, etc.).
 *
 * Why it matters for agents:
 *   This is the "perceive" step of the agentic loop — without it, every request
 *   falls through to UNKNOWN and the agent can't take any action.
 *
 * Type signature to satisfy:
 *   (input: string) => ClassifiedIntent
 *
 * Approaches you might take:
 *   1. Simple keyword matching (search for "email", "send", "schedule", etc.)
 *   2. Regex patterns to extract entities like email addresses and dates
 *   3. Call Claude with tool_use to let the model classify for you (most powerful)
 *
 * When you're done, the tests in tests/intent.test.ts should pass.
 *
 * See concept: 02-mcp-and-tools (tool calling), 04-multi-step-reasoning
 */
export function classifyIntent(input: string): ClassifiedIntent {
  // TODO: Replace this stub with a real implementation.
  // Right now it always returns UNKNOWN, which means the agent loop
  // will never route to any tool — it just says "I don't understand."
  void input; // remove this line once you use the parameter
  return {
    type: 'UNKNOWN',
    confidence: 0,
    extractedEntities: {},
  };
}
