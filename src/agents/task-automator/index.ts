/**
 * Task Automator Agent — index.ts
 *
 * This is the main agent loop. It ties together the three core components
 * of any agentic system:
 *
 *   1. PERCEIVE  — classifyIntent() reads the user's input and figures out
 *                  what action they want
 *   2. REASON    — The switch statement decides which tool to call
 *   3. ACT       — The tool function executes the action (send email, etc.)
 *   4. REMEMBER  — memory.save() records what happened for future reference
 *
 * Right now this agent works end-to-end — it just doesn't do much, because
 * classifyIntent() is a stub that always returns UNKNOWN, and the tool
 * functions all throw "not implemented."
 *
 * Your progression:
 *   Step 1: Implement classifyIntent() in core/intent.ts
 *           → The agent will start routing to the right tools
 *   Step 2: Implement sendEmail() in tools/email.ts
 *           → The agent will actually send emails
 *   Step 3: Implement addEvent() in tools/calendar.ts
 *           → The agent will schedule calendar events
 *   Step 4: Implement memory in core/memory.ts
 *           → The agent will remember past actions
 *
 * See concept: 01-what-is-an-agent (the agentic loop)
 */

import { classifyIntent } from './core/intent';
import { createMemory, MemoryEntry } from './core/memory';
import { sendEmail, readEmails, SendEmailParams } from './tools/email';
import { addEvent, listEvents, CalendarEventParams, ListEventsParams } from './tools/calendar';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface AgentInput {
  /** The user's natural-language request */
  message: string;
  /** Optional session ID for tracking conversations */
  sessionId?: string;
}

export interface AgentOutput {
  /** The agent's response to show the user */
  response: string;
  /** Which intent was detected */
  intent: string;
  /** Which tools were called during this run */
  toolsUsed: string[];
  /** Whether the action completed successfully */
  success: boolean;
}

// ──────────────────────────────────────────────────────────────
// Module-level state
// (persists within a single process session)
// ──────────────────────────────────────────────────────────────

// Create one memory instance that lives for the lifetime of this module.
// All calls to runAgent() share the same memory.
const memory = createMemory();

// ──────────────────────────────────────────────────────────────
// Main agent loop
// ──────────────────────────────────────────────────────────────

/**
 * runAgent — the core agent function.
 *
 * Receives a natural-language input, classifies its intent,
 * routes to the appropriate tool, and returns a response.
 * All activity is saved to memory and broadcast to the dashboard.
 *
 * @param input  - The user's message and optional session context
 * @returns      - The agent's response with metadata about what it did
 */
export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const toolsUsed: string[] = [];
  let response = '';
  let success = true;

  // ── Step 1: Classify the user's intent ──────────────────────
  // classifyIntent() is a stub right now — it returns UNKNOWN.
  // Once you implement it, the switch below will route correctly.
  const classified = classifyIntent(input.message);

  try {
    // ── Step 2: Route to the right tool ─────────────────────
    switch (classified.type) {

      case 'SEND_EMAIL': {
        // Extract entities from the classified intent.
        // Once classifyIntent() is implemented, these will be populated.
        const emailParams: SendEmailParams = {
          to: classified.extractedEntities['to'] ?? '',
          subject: classified.extractedEntities['subject'] ?? '(no subject)',
          body: classified.extractedEntities['body'] ?? input.message,
          cc: classified.extractedEntities['cc'],
        };

        if (!emailParams.to) {
          response = 'I couldn\'t find a recipient email address in your request. Who should I send this to?';
          success = false;
          break;
        }

        const result = await sendEmail(emailParams);
        toolsUsed.push('sendEmail');

        response = result.success
          ? `Email sent successfully to ${emailParams.to}! (Message ID: ${result.messageId})`
          : `Failed to send email: ${result.error}`;
        success = result.success;
        break;
      }

      case 'READ_EMAILS': {
        const emails = await readEmails({
          limit: Number(classified.extractedEntities['limit']) || 5,
          from: classified.extractedEntities['from'],
        });
        toolsUsed.push('readEmails');

        if (emails.length === 0) {
          response = 'No emails found matching your criteria.';
        } else {
          const summary = emails
            .map((e, i) => `${i + 1}. From: ${e.from} | Subject: ${e.subject}`)
            .join('\n');
          response = `Found ${emails.length} email(s):\n\n${summary}`;
        }
        break;
      }

      case 'ADD_CALENDAR_EVENT': {
        const eventParams: CalendarEventParams = {
          title: classified.extractedEntities['title'] ?? 'New Event',
          startTime: classified.extractedEntities['startTime'] ?? '',
          endTime: classified.extractedEntities['endTime'] ?? '',
          description: classified.extractedEntities['description'],
          attendees: classified.extractedEntities['attendees'],
          location: classified.extractedEntities['location'],
        };

        if (!eventParams.startTime || !eventParams.endTime) {
          response = 'I need a start time and end time to schedule the event. When should it be?';
          success = false;
          break;
        }

        const result = await addEvent(eventParams);
        toolsUsed.push('addEvent');

        response = result.success
          ? `Event "${eventParams.title}" scheduled! ${result.eventLink ? `View it: ${result.eventLink}` : ''}`
          : `Failed to create event: ${result.error}`;
        success = result.success;
        break;
      }

      case 'LIST_CALENDAR_EVENTS': {
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const listParams: ListEventsParams = {
          startTime: classified.extractedEntities['startTime'] ?? now.toISOString(),
          endTime: classified.extractedEntities['endTime'] ?? weekFromNow.toISOString(),
          limit: Number(classified.extractedEntities['limit']) || 10,
        };

        const events = await listEvents(listParams);
        toolsUsed.push('listEvents');

        if (events.length === 0) {
          response = 'No upcoming events found in the specified time range.';
        } else {
          const summary = events
            .map((e, i) => `${i + 1}. ${e.title} — ${e.startTime.toLocaleString()}`)
            .join('\n');
          response = `Found ${events.length} upcoming event(s):\n\n${summary}`;
        }
        break;
      }

      // ── Default: couldn't classify the intent ──────────────
      case 'UNKNOWN':
      default: {
        response =
          "I'm not sure how to help with that yet. " +
          'Try asking me to:\n' +
          '• Send an email (e.g. "Send an email to alice@example.com")\n' +
          '• Read emails (e.g. "Show me my recent emails")\n' +
          '• Schedule an event (e.g. "Schedule a meeting tomorrow at 2pm")\n' +
          '• List events (e.g. "What\'s on my calendar this week?")\n\n' +
          'Hint: implement classifyIntent() in core/intent.ts to add more intents!';
        success = false;
        break;
      }
    }
  } catch (err) {
    // Tool threw an error (e.g. "not implemented" stubs, network errors)
    const message = err instanceof Error ? err.message : String(err);
    response = `Error running agent: ${message}`;
    success = false;
  }

  // ── Step 3: Save to memory ───────────────────────────────────
  // memory.save() is a no-op stub right now.
  // Once you implement core/memory.ts, this will persist the action.
  const entry: MemoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date(),
    input: input.message,
    intent: classified.type,
    result: response,
    metadata: {
      toolsUsed,
      success,
      confidence: classified.confidence,
      sessionId: input.sessionId,
    },
  };
  await memory.save(entry);

  return {
    response,
    intent: classified.type,
    toolsUsed,
    success,
  };
}
