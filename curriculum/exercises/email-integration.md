---
title: "Exercise: Email Integration"
concept: "06-external-services"
difficulty: "intermediate"
recommendation: "use-claude-code-for-config"
---

# Exercise: Email Integration

## Objective

Implement `sendEmail()` and `readEmails()` in `src/agents/task-automator/tools/email.ts` so your agent can actually send and receive emails.

Both functions currently throw `"not implemented"`. You'll connect them to a real email service — starting simple (console logging or Nodemailer with an app password) and optionally graduating to full Gmail API OAuth.

---

## Starting Point

**File:** `src/agents/task-automator/tools/email.ts`

The tool descriptors (the `input_schema` objects the model reads) are already defined. You only need to implement the function bodies:

```typescript
export async function sendEmail(args: SendEmailArgs): Promise<ToolResult> {
  // TODO: implement
  throw new Error('not implemented');
}

export async function readEmails(args: ReadEmailArgs): Promise<ToolResult> {
  // TODO: implement
  throw new Error('not implemented');
}
```

---

## Expected Outcome

**Minimum (Level 1):** `sendEmail()` logs its arguments to the console instead of crashing. This lets you test the full agent → tool call → result loop without any external accounts.

**Level 2:** `sendEmail()` sends a real email via Nodemailer using a Gmail app password. You receive the email in your inbox.

**Level 3 (stretch):** `readEmails()` fetches real emails from Gmail using the Gmail API. Results are returned as structured `ToolResult` data.

---

## Test Criteria

There are no automated tests for this exercise — email integration requires real credentials that shouldn't be in the test suite. Instead, test manually:

1. Start the backend: `npm run dev` from the `backend/` directory
2. Open the teaching assistant chat in the browser
3. Type: `"Send an email to test@example.com with subject 'Hello' and body 'Testing my agent'"`
4. Watch the agent classify the intent, call the tool, and return a result
5. If you implemented Level 2: check your inbox

---

## Hints

**Hint 1 — Level 1 (console logging):**
The simplest valid implementation:

```typescript
export async function sendEmail(args: SendEmailArgs): Promise<ToolResult> {
  console.log('[email] Would send:', args);
  return { success: true, message: `Email to ${args.to} logged (not sent)` };
}
```

This is enough to test the entire agent pipeline without any accounts or credentials.

**Hint 2 — Level 2 (Nodemailer + Gmail app password):**
Install Nodemailer: `npm install nodemailer`. Create a Gmail app password at `myaccount.google.com → Security → 2-Step Verification → App passwords`. Add two env vars to `.env`:
```
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```
Then use: `nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })`.

**Hint 3 — `readEmails()` mock:**
If you're not ready for the Gmail API, return mock data from `readEmails()`:
```typescript
return {
  success: true,
  emails: [
    { from: 'alice@example.com', subject: 'Meeting notes', snippet: '...' }
  ]
};
```
The agent will treat mock data as real — this lets you test multi-step reasoning (e.g., "summarise my recent emails") without a real inbox connection.

---

## Should I Use Claude Code?

**Use Claude Code for the Nodemailer setup** — the transport configuration is boilerplate that's easy to get wrong (authentication options, TLS settings, error types). Give Claude Code the exact env var names you're using and ask it to generate the transport and `sendMail()` call. Then **review the code** before running it — check that it reads credentials from `process.env`, not hardcoded strings.

For the tool result structure and error handling, write that yourself. Understanding how errors propagate from the tool back to the agent is a core skill.
