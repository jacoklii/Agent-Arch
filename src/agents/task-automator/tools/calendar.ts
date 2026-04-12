/**
 * Calendar Tool — tools/calendar.ts
 *
 * The calendar tool lets your agent schedule events and check availability.
 * Like the email tool, it follows the MCP tool pattern: a descriptor that
 * tells the AI what it can do, and an execute function that does it.
 *
 * See concept: 02-mcp-and-tools, 06-external-services
 */

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface CalendarEventParams {
  /** Event title */
  title: string;
  /** ISO 8601 start datetime (e.g. "2026-04-15T14:00:00") */
  startTime: string;
  /** ISO 8601 end datetime */
  endTime: string;
  /** Optional event description or agenda */
  description?: string;
  /** Optional: attendee email addresses (comma-separated) */
  attendees?: string;
  /** Optional: location or video call link */
  location?: string;
}

export interface CalendarResult {
  success: boolean;
  /** Event ID returned by the calendar provider on success */
  eventId?: string;
  /** Calendar link to view the event */
  eventLink?: string;
  /** Error description if success is false */
  error?: string;
}

export interface ListEventsParams {
  /** ISO 8601 start of the time range to list */
  startTime: string;
  /** ISO 8601 end of the time range to list */
  endTime: string;
  /** Max number of events to return (default: 20) */
  limit?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  attendees?: string[];
  location?: string;
}

// ──────────────────────────────────────────────────────────────
// MCP Tool Descriptors
// ──────────────────────────────────────────────────────────────

export const addEventTool = {
  name: 'add_calendar_event',
  description: 'Creates a new event on the user\'s calendar.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Event title or name',
      },
      startTime: {
        type: 'string',
        description: 'Start time in ISO 8601 format (e.g. 2026-04-15T14:00:00)',
      },
      endTime: {
        type: 'string',
        description: 'End time in ISO 8601 format',
      },
      description: {
        type: 'string',
        description: 'Optional event description or agenda',
      },
      attendees: {
        type: 'string',
        description: 'Optional: comma-separated attendee email addresses',
      },
      location: {
        type: 'string',
        description: 'Optional: physical location or video call link',
      },
    },
    required: ['title', 'startTime', 'endTime'],
  },
};

export const listEventsTool = {
  name: 'list_calendar_events',
  description: 'Lists upcoming calendar events within a time range.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      startTime: {
        type: 'string',
        description: 'Start of time range (ISO 8601)',
      },
      endTime: {
        type: 'string',
        description: 'End of time range (ISO 8601)',
      },
      limit: {
        type: 'number',
        description: 'Max number of events to return (default: 20)',
      },
    },
    required: ['startTime', 'endTime'],
  },
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * addEvent — creates a new calendar event.
 *
 * TODO: Implement this function.
 *
 * What to implement:
 *   Connect to a calendar provider (Google Calendar API, CalDAV, etc.) and
 *   create the event described by `params`. Return the event ID on success.
 *
 * Why it matters for agents:
 *   Scheduling is one of the highest-value tasks an agent can automate.
 *   Once this works, your agent can book meetings from a single sentence.
 *
 * Type signature:
 *   (params: CalendarEventParams) => Promise<CalendarResult>
 *
 * Getting started:
 *   Use the Google Calendar API with OAuth2:
 *     npm install googleapis
 *     Then set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env
 *   Follow: https://developers.google.com/calendar/api/guides/overview
 *
 * See concept: 06-external-services
 */
export async function addEvent(params: CalendarEventParams): Promise<CalendarResult> {
  // TODO: Replace this with a real calendar event creation implementation.
  void params;
  throw new Error(
    'addEvent is not implemented yet.\n' +
    'See the TODO comment in tools/calendar.ts for instructions.\n' +
    'Hint: start with the Google Calendar API quickstart guide.'
  );
}

/**
 * listEvents — retrieves calendar events in a time range.
 *
 * TODO: Implement this function.
 *
 * What to implement:
 *   Query your calendar provider for events between `params.startTime` and
 *   `params.endTime`. Return them as CalendarEvent objects.
 *
 * Why it matters for agents:
 *   An agent that can read your calendar can check availability before
 *   scheduling, summarize your week, or remind you about upcoming deadlines.
 *
 * Type signature:
 *   (params: ListEventsParams) => Promise<CalendarEvent[]>
 *
 * See concept: 06-external-services
 */
export async function listEvents(params: ListEventsParams): Promise<CalendarEvent[]> {
  // TODO: Replace this with a real calendar reading implementation.
  void params;
  throw new Error(
    'listEvents is not implemented yet.\n' +
    'See the TODO comment in tools/calendar.ts for instructions.'
  );
}
