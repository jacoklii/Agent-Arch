---
title: "Multi-Step Reasoning"
order: 4
prerequisites: ["01-what-is-an-agent", "02-mcp-and-tools"]
summary: "Breaking complex tasks into steps, chain-of-thought planning, and handling dependencies between actions."
---

# Multi-Step Reasoning

The real power of an agent isn't any single tool call — it's the ability to **chain decisions across time**. "Schedule a meeting with Sarah next Tuesday about the project roadmap" requires checking Sarah's availability, finding a free slot, creating a calendar event, sending an email invite, and possibly updating a project doc. Each step depends on the result of the last.

## Planning Before Acting

For complex tasks, prompt the model to *plan* before *acting*:

```typescript
const planningPrompt = `
You have been given this task: "${task}"

Before taking any action, output a numbered plan of the steps required.
Consider: What information do you need? What order must steps happen in?
What could go wrong at each step?

Format: Step 1: [action] — Step 2: [action] ...
`;
```

This makes the agent's reasoning visible and catches impossible plans early (e.g., "send an email before finding the address").

## Task Decomposition

```typescript
interface TaskStep {
  id: string;
  description: string;
  tool: string;
  dependsOn: string[];   // step IDs that must complete first
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: unknown;
}
```

Building an explicit dependency graph lets you run independent steps in parallel and gracefully handle partial failures.

## Handling Ambiguity

When instructions are ambiguous ("schedule it for later"), an agent has two options:

1. **Ask for clarification** — Interrupt and ask the user before proceeding. Safe, but breaks automation.
2. **Make a reasonable assumption and proceed** — Faster, but log the assumption so the user can audit it.

Build in a rule: if the ambiguity affects an *irreversible* action (sending an email, deleting a file), always ask first.

## Self-Correction

Agents make mistakes. Design for recovery:

```typescript
if (stepResult.success === false) {
  // Ask the model: given this failure, what should we do next?
  const recovery = await llm.think({
    context: `Step "${step.description}" failed: ${stepResult.error}`,
    question: 'Should I retry, try a different approach, or ask the user?',
  });
}
```

## Questions to Consider

- How would you handle a plan where step 3 becomes impossible after step 2 succeeds?
- What's the difference between an agent that plans once and one that replans at every step?
- Why might you want to show the user the plan before executing it?
