---
title: "MCP & Tool Calling"
order: 2
prerequisites: ["01-what-is-an-agent"]
summary: "How Model Context Protocol extends agents with real-world capabilities via structured tool definitions."
---

# MCP & Tool Calling

The LLM at the core of your agent is stateless text in, text out. Tools are how you give it hands. **Model Context Protocol (MCP)** is the standard Anthropic defined for describing what tools are available and how to call them.

When you include tool definitions in your API request, the model can respond with a *tool use* block instead of plain text — telling your code exactly which tool to call and with what arguments. Your code executes the tool, returns the result, and the model continues reasoning.

## Defining a Tool

```typescript
const emailTool = {
  name: "send_email",
  description: "Send an email to one or more recipients",
  input_schema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Plain-text email body" },
    },
    required: ["to", "subject", "body"],
  },
};
```

The `description` field is critical — it's what the model reads to decide *when* to use the tool. Write it like documentation for a colleague.

## The Tool Call Cycle

```
1. You send: messages + tool definitions
2. Model responds: { type: "tool_use", name: "send_email", input: { to: "..." } }
3. Your code: executes the real function
4. You send back: { type: "tool_result", content: "Email sent successfully" }
5. Model continues: reasons about the result, may call more tools
```

## Tool Selection Strategy

Give the model focused, well-named tools. A tool named `do_email_stuff` with 12 parameters confuses both the model and you. Prefer narrow, composable tools: `send_email`, `read_inbox`, `search_emails`.

## Error Handling in Tools

Always return structured results, including failures:

```typescript
async function sendEmail(args: EmailArgs): Promise<ToolResult> {
  try {
    await emailClient.send(args);
    return { success: true, message: "Email sent" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
```

The model needs to know when a tool fails so it can decide what to do next — retry, try a different approach, or ask the user.

## The Tool Call Cycle Visualised

```
Your Code                          Claude API
────────                           ──────────
  │                                     │
  │── messages + tool definitions ─────▶│
  │                                     │
  │◀── { type: "tool_use",             │
  │       name: "send_email",           │
  │       input: { to: "..." } } ───────│
  │                                     │
  │ [execute real function]             │
  │                                     │
  │── { type: "tool_result",           │
  │     content: "Email sent" } ───────▶│
  │                                     │
  │◀── { type: "text",                 │
  │       text: "Done! Email sent." } ──│
  │                                     │
```

## In the Codebase

Look at `src/agents/task-automator/tools/email.ts` and `tools/calendar.ts`. Both files have the tool descriptors defined (the `input_schema` objects) but the implementations throw `"not implemented"`. Your job in the Email Integration exercise is to fill these in.

The tool descriptors are what the model reads. The implementation functions are what your code runs.

## Hints

When you implement `sendEmail()`, you don't need to connect to Gmail right away. Start by logging the arguments to the console — this lets you test the full tool-call cycle end-to-end before adding real I/O. Once the model is correctly calling the tool and you can see the right arguments arriving, *then* wire up the actual email sender.

## Quiz

**Q1.** Why does an agent need tools instead of just using the LLM's built-in knowledge?

- A) LLMs can't reason without tools
- B) Tools give the agent the ability to take actions and access real-time data beyond what the LLM knows
- C) Tools make the agent faster by skipping LLM calls
- D) Tools are only needed for advanced agents

> **Answer:** B — An LLM's knowledge is frozen at training time. Tools let it read your inbox, check today's calendar, and actually send emails.

---

**Q2.** A tool call fails with a `503 Service Unavailable` error. What should the agent do?

- A) Return the error directly to the user as-is
- B) Crash immediately to avoid further errors
- C) Return a structured failure result so the model can decide whether to retry or try a different approach
- D) Silently ignore the failure and continue

> **Answer:** C — The model needs to know the tool failed so it can reason about the next action. Crashing or hiding failures breaks the feedback loop.

## Deep Dive: Tool Design Principles

**Narrow beats broad.** A tool named `manage_email` with 15 parameters is hard for the model to use correctly. Split it: `send_email`, `read_inbox`, `search_emails`, `archive_email`. Each does one thing clearly.

**Idempotency matters.** If a tool call might be retried, make it safe to call twice. Sending the same email twice is bad. Querying a calendar twice is fine.

**Confirm before irreversible actions.** Deleting a file, sending an email to a large list, posting publicly — these should have a confirmation step. One pattern: add a `dryRun: boolean` parameter to destructive tools. When `dryRun: true`, describe what *would* happen without doing it. Let the model show the plan to the user before executing.

## Questions to Consider

- What happens if the model calls a tool that doesn't exist?
- How would you prevent a tool from taking a destructive action without confirmation?
- Why is the `description` field more important than the `name` field?
