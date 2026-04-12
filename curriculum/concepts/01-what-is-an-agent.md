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

## The Loop Visualised

```
┌─────────────────────────────────────────────────────┐
│                    Agent Loop                       │
│                                                     │
│   ┌──────────┐    reason    ┌──────────┐            │
│   │          │─────────────▶│   LLM    │            │
│   │ Context  │              │  think() │            │
│   │(history) │◀─────────────│          │            │
│   └──────────┘    decision  └────┬─────┘            │
│        ▲                         │ tool call?       │
│        │ result                  ▼                  │
│        │               ┌──────────────────┐         │
│        └───────────────│  Tool Executor   │         │
│                        │ (email/calendar) │         │
│                        └──────────────────┘         │
│                                                     │
│   Loop exits when: decision.type === 'done'         │
└─────────────────────────────────────────────────────┘
```

## In the Codebase

Open `src/agents/task-automator/index.ts` — the agentic loop is implemented there. You'll see the `while (true)` loop, the call to the LLM, and the tool dispatch. This is the entry point for everything you'll build in Sessions 4 and 5.

## Quiz

**Q1.** What's the key difference between a chatbot and an agent?

- A) Chatbots use LLMs; agents don't
- B) Agents take actions and loop until a task is done; chatbots respond once per message
- C) Agents are faster because they skip the reasoning step
- D) Chatbots have more tools available

> **Answer:** B — The defining characteristic of an agent is the *loop* and the ability to *act* in the world.

---

**Q2.** A user asks: "What's the capital of France?" Which is better: a plain prompt or an agent?

- A) An agent — it can search the web to verify
- B) A plain prompt — it's a single question with a known answer
- C) An agent — it will be more accurate
- D) Neither — use a database lookup

> **Answer:** B — Agents add overhead (multiple LLM calls, tool calls). Simple Q&A is cheaper and faster as a plain prompt.

## Deep Dive: Persisting Agent State

What happens if your agent crashes mid-task? Without state persistence, it loses everything and the user has to start over.

The fix: checkpoint `context` to storage after every step.

```typescript
async function agentLoop(task: string): Promise<string> {
  // Load checkpoint if resuming a previous run
  let context = await memory.retrieve('agent_context') ?? { task, history: [] };

  while (true) {
    const decision = await llm.think(context);

    if (decision.type === 'done') {
      await memory.clear(); // clean up finished task
      return decision.result;
    }

    const result = await tools[decision.tool](decision.args);
    context.history.push(`${decision.tool}: ${result}`);

    // Save state after every step
    await memory.save('agent_context', context);
  }
}
```

This pairs with `core/memory.ts` — implementing that module (Concept 3 exercise) is what makes resumable agents possible.

## Questions to Consider

- What's the difference between a function call and a tool call?
- Why does an agent need persistent memory?
- What could go wrong if an agent loops forever?
