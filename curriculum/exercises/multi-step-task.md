---
title: "Exercise: Multi-Step Task"
concept: "04-multi-step-reasoning"
difficulty: "intermediate"
recommendation: "plan-yourself-wire-with-claude-code"
---

# Exercise: Multi-Step Task

## Objective

Make your agent handle a complex, multi-step request end-to-end:

> **"Schedule a meeting with Alice next Tuesday about the roadmap"**

This requires the agent to: check the calendar, find a free slot, create the event, and send an email invite — in that order, each step depending on the previous result.

---

## Starting Point

**File:** `src/agents/task-automator/index.ts`

The agent loop is already implemented. When the agent receives the "schedule meeting" message, it:
1. Classifies the intent (→ `SCHEDULE_MEETING`, once you implement `classifyIntent()`)
2. Calls tools in response to the model's decisions

Your task is to ensure the model can successfully decompose and execute this four-step plan using the tools available.

**Prerequisite exercises:** Complete the Intent Classification and Memory System exercises first. Email Integration (at least Level 1) is needed for step 4.

---

## The Four Steps

```
Step 1: classifyIntent("Schedule a meeting with Alice...")
        → SCHEDULE_MEETING + entities: { person: "Alice", date: "next Tuesday" }

Step 2: listEvents({ date: "next Tuesday" })
        → returns existing calendar events
        → agent finds a free slot

Step 3: addEvent({ title: "Roadmap discussion with Alice", date: ..., time: ... })
        → event created on calendar

Step 4: sendEmail({ to: "alice@example.com", subject: "Meeting invite", body: "..." })
        → invite sent
```

---

## Expected Outcome

When you type the scheduling request into the teaching assistant chat, the agent's console output should show all four tool calls in sequence, each with a result. The final response to the user should confirm the meeting was created and the invite sent.

You'll see this in the `AgentViewer` dashboard — each tool call and its result appear in real time.

---

## Test Criteria

There are no automated tests for this exercise. Test manually:

1. Make sure Intent Classification and Memory System exercises are complete
2. Start the full app: `npm run dev`
3. Open the browser at `http://localhost:5173`
4. Type: `"Schedule a meeting with Alice next Tuesday about the roadmap"`
5. Watch the `AgentViewer` panel — you should see 4 tool calls appear
6. The assistant's final message should confirm the meeting details

---

## Hints

**Hint 1 — Start with a hardcoded plan:**
Don't try to make this dynamic immediately. First, add a handler in `index.ts` that checks `if (intent === 'SCHEDULE_MEETING')` and then executes the four steps in hardcoded sequence. Once it works end-to-end, refactor to let the model drive the planning.

**Hint 2 — Mock the calendar:**
`tools/calendar.ts` throws "not implemented". For this exercise, return mock data from `listEvents()`:
```typescript
return {
  success: true,
  events: [
    { time: '9:00am', title: 'Standup' },
    { time: '2:00pm', title: 'Design review' },
  ],
  freeSlotsFound: ['10:00am', '11:00am', '3:00pm'],
};
```
The model will use these mock results to pick a free slot for the meeting.

**Hint 3 — Entity extraction for Alice's email:**
The user said "Alice" but `sendEmail()` needs an email address. You have two options:
1. Ask the model to assume `alice@example.com` for the exercise
2. Add a step that checks memory for Alice's contact info (`memory.retrieve("contact_alice")`)

Option 2 is more realistic and teaches you how memory integrates into multi-step flows.

---

## Stretch Goal: Dynamic Replanning

Once the basic four-step sequence works, try breaking it:
- Return an error from `addEvent()` (simulate a calendar conflict)
- Watch what the agent does — does it replan, ask the user, or fail silently?

If it fails silently, you've found a gap in your error handling. Go back to the Error Handling concept and implement the recovery pattern.

---

## Should I Use Claude Code?

**Plan the decomposition yourself.** Thinking through "what does this request require, in what order, with what dependencies" is the core skill this exercise teaches. Sketch the four steps on paper before writing code.

**Use Claude Code to wire up the steps** once you know what they are. If you're unsure how to pass the result of `listEvents()` into `addEvent()` within the agent loop, ask Claude Code: *"Given this agent loop structure, how do I pass the free slot result from listEvents into the addEvent call?"* That's a plumbing question — the architecture decision should be yours.
