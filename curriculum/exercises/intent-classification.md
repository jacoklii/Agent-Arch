---
title: "Exercise: Intent Classification"
concept: "04-multi-step-reasoning"
difficulty: "beginner"
recommendation: "try-yourself-first"
---

# Exercise: Intent Classification

## Objective

Implement `classifyIntent()` in `src/agents/task-automator/core/intent.ts` so that the agent correctly identifies what a user wants to do from a plain-text message.

The function signature is already there. Your job is to make it return the right `IntentType` for inputs like "send an email to alice" or "add a meeting tomorrow at 3pm".

---

## Starting Point

**File:** `src/agents/task-automator/core/intent.ts`

Open it. You'll see:

```typescript
export function classifyIntent(input: string): IntentType {
  // TODO: implement intent classification
  return IntentType.UNKNOWN;
}
```

And the `IntentType` enum listing the supported intent types. The function currently returns `UNKNOWN` for everything.

---

## Expected Outcome

After your implementation, calling `classifyIntent()` with these inputs should return the correct type:

| Input | Expected |
|-------|----------|
| `"send email to bob@example.com"` | `SEND_EMAIL` |
| `"read my inbox"` | `READ_EMAIL` |
| `"add meeting tomorrow at 3pm"` | `ADD_CALENDAR` |
| `"what's on my calendar today?"` | `LIST_CALENDAR` |
| `"what is the weather?"` | `UNKNOWN` |

---

## Test Criteria

Run the test suite from the project root:

```bash
cd src/agents/task-automator
npm test
```

`tests/intent.test.ts` has 6 test cases. You need at least 4 to pass to consider this exercise complete. Getting all 6 is the stretch goal.

---

## Hints

> Read all three hints only as far as you need. Stop when you feel unblocked.

**Hint 1 — Direction:**
You don't need an LLM for this. Simple keyword matching works well for the test cases. Think about what words appear in each category of input:
- Emails involve: "email", "send", "inbox", "message"
- Calendar involves: "meeting", "calendar", "event", "schedule"

**Hint 2 — Structure:**
A `switch`/`if-else` chain checking `input.toLowerCase().includes(keyword)` will pass the tests. Start with the most specific keywords first to avoid false matches.

**Hint 3 — Stretch goal (entity extraction):**
One test checks that `classifyIntent()` also extracts entities (the email address, the date/time). If you want to tackle this, look at the test — it checks a return value that includes both the intent type *and* an `entities` object. Simple regex can extract email addresses (`/[\w.]+@[\w.]+/`) and relative dates ("tomorrow", "next week").

---

## Should I Use Claude Code?

**Try yourself first.** Keyword matching is a learnable pattern, and writing it by hand will give you a concrete feel for where simple classification breaks down. Once your solution passes the tests, ask Claude Code: *"What are the limitations of my keyword-based approach? What would an LLM-based classifier handle that mine doesn't?"* — that's a better use of AI assistance than having it write the code for you.
