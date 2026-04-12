/**
 * Email Tool — tools/email.ts
 *
 * Tools are how agents interact with the outside world. This file defines
 * the email tool: a structured interface that the agent uses to send and
 * read emails.
 *
 * Each tool has two parts:
 *   1. A descriptor (name, description, inputSchema) — tells the AI model
 *      what the tool does and what parameters it needs
 *   2. An execute function — actually performs the action
 *
 * This pattern comes from the Model Context Protocol (MCP), which standardizes
 * how AI models discover and call tools.
 *
 * See concept: 02-mcp-and-tools, 06-external-services
 */

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface SendEmailParams {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Email body (plain text or HTML) */
  body: string;
  /** Optional CC addresses (comma-separated) */
  cc?: string;
}

export interface EmailResult {
  success: boolean;
  /** Message ID returned by the email provider on success */
  messageId?: string;
  /** Error description if success is false */
  error?: string;
}

export interface ReadEmailsParams {
  /** Max number of emails to return */
  limit?: number;
  /** Filter: only return emails from this address */
  from?: string;
  /** Filter: only return emails with this subject */
  subject?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

// ──────────────────────────────────────────────────────────────
// MCP Tool Descriptors
//
// These objects describe the tool to the AI model. Claude uses them
// to decide when to call a tool and what parameters to pass.
// The inputSchema field follows the JSON Schema standard.
// ──────────────────────────────────────────────────────────────

export const sendEmailTool = {
  name: 'send_email',
  description: 'Sends an email to one or more recipients on behalf of the user.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      to: {
        type: 'string',
        description: 'Recipient email address',
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
      },
      body: {
        type: 'string',
        description: 'Email body content (plain text)',
      },
      cc: {
        type: 'string',
        description: 'Optional: comma-separated CC addresses',
      },
    },
    required: ['to', 'subject', 'body'],
  },
};

export const readEmailsTool = {
  name: 'read_emails',
  description: 'Retrieves recent emails from the user\'s inbox.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Max number of emails to return (default: 10)',
      },
      from: {
        type: 'string',
        description: 'Optional: filter by sender email address',
      },
      subject: {
        type: 'string',
        description: 'Optional: filter by subject line (partial match)',
      },
    },
    required: [],
  },
};

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

/**
 * sendEmail — sends an email via an external email provider.
 *
 * TODO: Implement this function.
 *
 * What to implement:
 *   Connect to an email provider (Gmail API, SendGrid, Nodemailer + SMTP, etc.)
 *   and send the email described by `params`. Return the message ID on success.
 *
 * Why it matters for agents:
 *   This is the "act" step of the agentic loop. Without a real implementation,
 *   your agent can classify intent perfectly but still can't DO anything.
 *
 * Type signature:
 *   (params: SendEmailParams) => Promise<EmailResult>
 *
 * Getting started:
 *   Option A (simplest): Use Nodemailer with a Gmail App Password
 *     npm install nodemailer @types/nodemailer
 *     Then set GMAIL_USER and GMAIL_APP_PASSWORD in .env
 *
 *   Option B: Use the SendGrid API
 *     npm install @sendgrid/mail
 *     Then set SENDGRID_API_KEY in .env
 *
 * See concept: 06-external-services
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  // TODO: Replace this with a real email sending implementation.
  // Remove the throw once you've connected to an email provider.
  void params;
  throw new Error(
    'sendEmail is not implemented yet.\n' +
    'See the TODO comment in tools/email.ts for instructions.\n' +
    'Hint: try Nodemailer with a Gmail App Password to get started quickly.'
  );
}

/**
 * readEmails — fetches recent emails from the user's inbox.
 *
 * TODO: Implement this function.
 *
 * What to implement:
 *   Connect to an email provider and retrieve the most recent emails
 *   matching the optional filters in `params`.
 *
 * Why it matters for agents:
 *   A task-automating agent that can only send emails is half an agent.
 *   Reading emails lets your agent react to incoming messages — reply,
 *   summarize, extract tasks, etc.
 *
 * Type signature:
 *   (params: ReadEmailsParams) => Promise<EmailMessage[]>
 *
 * See concept: 06-external-services
 */
export async function readEmails(params: ReadEmailsParams): Promise<EmailMessage[]> {
  // TODO: Replace this with a real email reading implementation.
  void params;
  throw new Error(
    'readEmails is not implemented yet.\n' +
    'See the TODO comment in tools/email.ts for instructions.'
  );
}
