---
title: "What Is an AI Agent?"
order: 1
prerequisites: []
summary: "The agentic loop — perceive, reason, act — and how agents differ from chatbots."
---

# What Is an AI Agent?

A chatbot answers questions. An agent *does things*. The distinction sounds simple, but it changes everything about how you design, build, and deploy AI systems.

An agent operates in a loop: it **perceives** its environment (reads files, calls APIs, checks calendars), **reasons** about what to do next (using an LLM to plan), and **acts** (executes tools, writes files, sends messages). It then perceives the result of that action and loops again — until the task is complete or it needs to ask for help.

## The Agentic Loop

```typescript
async function agentLoop(task: string): Promise<string> {
  let context = { task, history: [] as string[] };

  while (true) {
    // 1. Reason: ask the LLM what to do next
    const decision = await llm.think(context);

    if (decision.type === 'done') {
      return decision.result;
    }

    // 2. Act: call the chosen tool
    const result = await tools[decision.tool](decision.args);

    // 3. Perceive: feed the result back into context
    context.history.push(`${decision.tool}: ${result}`);
  }
}
```

## Agent vs. Chatbot

| | Chatbot | Agent |
|---|---|---|
| Memory | Per-message | Persistent across sessions |
| Actions | None (text only) | Reads/writes files, calls APIs |
| Loop | Single request/response | Multi-step until task complete |
| Goals | Answer a question | Complete a task |

## When to Use an Agent

Agents shine when a task requires **multiple steps**, **real-world actions**, or **ongoing operation**. "Schedule a meeting, email the attendees, and add it to my calendar" is a three-tool task — exactly what agents are built for.

Avoid agents for simple Q&A. A plain prompt is cheaper, faster, and easier to debug.

## Questions to Consider

- What's the difference between a function call and a tool call?
- Why does an agent need persistent memory?
- What could go wrong if an agent loops forever?
