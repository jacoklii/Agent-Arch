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

## Task Dependency Graph Visualised

```
"Schedule a meeting with Sarah about the roadmap"

  Step 1: classifyIntent()
          │
          ▼
  Step 2a: listEvents()          Step 2b: (wait)
  [find Sarah's free slots]
          │
          ▼
  Step 3: addEvent()
  [create calendar event]
          │
          ▼
  Step 4: sendEmail()
  [send invite to Sarah]
          │
          ▼
         done

  Steps 2a → 3 → 4 are sequential (each depends on the previous).
  No parallel paths here — order matters.
```

## In the Codebase

Open `src/agents/task-automator/core/intent.ts`. The `classifyIntent()` stub is the entry point for task decomposition — it determines *what* the user wants before the agent plans *how* to do it. Getting intent classification right is a prerequisite for multi-step execution.

## Hints

For the multi-step task exercise, start by hardcoding the plan for the "schedule meeting" scenario. Don't try to make the plan dynamic yet — get the sequence working first. Once `classifyIntent()` correctly returns `SCHEDULE_MEETING`, trigger the hardcoded four-step sequence and log each result. Then generalise.

## Quiz

**Q1.** Your agent has a 4-step plan. Step 2 fails. What's the best response?

- A) Immediately fail the whole task and tell the user
- B) Skip step 2 and continue with step 3
- C) Ask the model: given this failure, should we retry, try a different approach, or surface it to the user?
- D) Retry step 2 ten times before giving up

> **Answer:** C — The right recovery depends on context. The model knows the overall goal; it can reason about whether step 3 still makes sense without step 2's result.

---

**Q2.** What's the key advantage of an agent that replans at every step vs. one that plans once upfront?

- A) Replanning is always faster
- B) A single upfront plan is always more accurate
- C) Replanning adapts to new information discovered during execution (e.g., the calendar was already full)
- D) There is no practical difference

> **Answer:** C — Real-world conditions change. A plan made before checking Sarah's calendar might be invalid once you see she has a full week. Replanning lets the agent respond to what it actually discovers.

## Deep Dive: Sub-agent Orchestration

For large, parallelisable tasks, a single agent loop becomes a bottleneck. The solution: an orchestrator agent that spawns specialised sub-agents and collects their results.

```typescript
// Orchestrator
const results = await Promise.all([
  subAgent.run('Research competitor pricing'),
  subAgent.run('Summarise last quarter emails'),
  subAgent.run('List overdue calendar tasks'),
]);

// Synthesise
const summary = await llm.synthesise(results);
```

Each sub-agent runs independently with its own tool set and context. The orchestrator only sees the final results, keeping its context window small.

This pattern is useful when tasks are **independent** (no step depends on another) and **time-sensitive** (you need results fast). Be careful: each sub-agent adds latency and cost, and coordinating failures across multiple agents is more complex than handling them in a single loop.

## Questions to Consider

- How would you handle a plan where step 3 becomes impossible after step 2 succeeds?
- What's the difference between an agent that plans once and one that replans at every step?
- Why might you want to show the user the plan before executing it?
