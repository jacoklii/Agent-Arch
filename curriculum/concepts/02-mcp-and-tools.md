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

## Questions to Consider

- What happens if the model calls a tool that doesn't exist?
- How would you prevent a tool from taking a destructive action without confirmation?
- Why is the `description` field more important than the `name` field?
