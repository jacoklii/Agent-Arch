# Using Claude Code in This Project

Claude Code is an AI coding assistant that operates in your terminal. It can read files, run commands, write code, and explain what it's doing. This guide covers when to lean on it — and when to work through something yourself.

---

## What Claude Code Can Do

- Read your entire codebase and answer questions about it
- Implement functions based on specifications (tests, interfaces, doc comments)
- Explain unfamiliar code patterns and suggest improvements
- Generate boilerplate: configs, schemas, transport setups, test scaffolding
- Debug errors by reading stack traces and tracing through code

---

## When to Code Yourself vs. Use Claude Code

The goal of this project is to learn. Using Claude Code to skip exercises defeats the purpose. Use this table as a guide:

| Task | Approach | Why |
|------|----------|-----|
| Implement `classifyIntent()` | **Try yourself first** | Keyword matching is learnable. You'll feel where it breaks. |
| Implement `memory.save/retrieve()` | **Try yourself first** | Understanding the interface is the lesson. |
| Set up Nodemailer transport config | **Use Claude Code** | Pure boilerplate. Understanding the auth options matters; writing them from scratch doesn't. |
| OAuth flow implementation | **Use Claude Code** | The token exchange dance is well-documented but tedious. Let Claude Code scaffold it; review it carefully. |
| Write retry/backoff logic | **Try yourself first** | The logic is short and teaches error handling patterns directly. |
| Deploy to Railway (first time) | **Use Claude Code** | Platform-specific CLI steps change. Claude Code knows the current workflow. |
| Wire up multi-step task sequence | **Use Claude Code after planning** | Plan the steps yourself first. Use Claude Code to implement the plumbing. |
| Write a new test case | **Try yourself first** | Writing tests teaches you to think about edge cases. |
| Understand an error message | **Ask Claude Code** | Explaining errors is its superpower. |

---

## How to Use Claude Code Effectively

### Be specific about what you want
Bad: *"Fix my memory system"*
Good: *"The `retrieve()` method in `src/agents/task-automator/core/memory.ts` should return entries whose key contains the query string. Right now it returns all entries. Fix the SQLite query."*

### Show it the test that's failing
```
The test in tests/memory.test.ts at line 45 is failing with:
  Expected: [{ key: 'user_pref', value: {...} }]
  Received: []
The `retrieve('user')` call should match keys containing 'user'.
```
Claude Code can read the test and trace the implementation to find the gap.

### Review every diff before accepting
Claude Code shows you what it changed. Read it. If you don't understand a change, ask it to explain before moving on. This is how you learn — not by blindly accepting output.

### Ask "why" not just "how"
After Claude Code writes something:
- *"Why did you use `INSERT OR REPLACE` instead of `UPDATE`?"*
- *"What would break if I used `JSON.parse` on every row instead of only on retrieval?"*

These follow-up questions are where the real learning happens.

---

## Claude Code in the Terminal

Start Claude Code in the project root:

```bash
claude
```

Or ask it a question directly:

```bash
claude "Why is my intent.test.ts failing? The classifyIntent function returns UNKNOWN for 'read my inbox'"
```

Claude Code will read your source files, check the test, and explain the mismatch.

---

## What Claude Code Won't Do Well

- **Make architectural decisions for you** — it will give you *an* answer, not necessarily *your* answer. The choices that matter (what to build, how to structure it) should come from you.
- **Replace understanding** — if Claude Code implements something and you can't explain it, you haven't learned it yet. Ask it to re-explain until you can.
- **Catch business logic bugs** — it can find syntax errors and suggest patterns, but it doesn't know your intent. If you tell it to make tests pass and your tests are wrong, it will make wrong tests pass.
