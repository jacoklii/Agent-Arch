---
title: "Error Handling & Retries"
order: 5
prerequisites: ["02-mcp-and-tools", "04-multi-step-reasoning"]
summary: "Graceful failure, exponential backoff, user feedback loops, and knowing when to give up."
---

# Error Handling & Retries

Agents interact with the real world: flaky APIs, rate limits, network timeouts, malformed data. Unlike a web request that can just return a 500, an agent mid-task needs to decide: retry, route around the failure, or surface it to the user.

## The Retry Pattern

For transient failures (network hiccups, rate limits), retry with exponential backoff:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;

      // Exponential backoff: 500ms, 1000ms, 2000ms...
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`[retry] Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('unreachable');
}
```

## Error Categories

Not all errors should be retried:

| Error Type | Strategy |
|---|---|
| Network timeout | Retry with backoff |
| Rate limit (429) | Retry after `Retry-After` header |
| Invalid input (400) | Don't retry — fix the input |
| Auth failure (401) | Don't retry — surface to user |
| Server error (500) | Retry a few times, then fail |

## User-Facing Error Messages

Internal errors contain stack traces and internal state — never show these to users. Map errors to human-readable messages:

```typescript
function toUserMessage(err: unknown): string {
  if (err instanceof RateLimitError) {
    return "The email service is busy. I'll try again in a moment.";
  }
  if (err instanceof AuthError) {
    return "I need permission to access your calendar. Can you reconnect it?";
  }
  return "Something went wrong. I've logged the error and will try a different approach.";
}
```

## When to Give Up

Some failures are unrecoverable. Build a circuit breaker: after N failures in a window, stop attempting and alert the user rather than hammering a broken service.

Define "give up" criteria clearly: failing to send an email after 3 retries should surface to the user — silently dropping the task is never acceptable.

## Logging for Debugging

Every tool call should be logged with: input, output, duration, success/failure. When something goes wrong in production, this is the only way to understand what happened.

## Retry Timing Visualised

```
Attempt 1 ──▶ FAIL
              │ wait 500ms
Attempt 2 ──────────▶ FAIL
                      │ wait 1000ms
Attempt 3 ──────────────────────▶ FAIL
                                  │ throw (max attempts reached)

Timeline: ──|500ms|──────|1000ms|──────────────▶

Exponential backoff: delay = baseDelay × 2^(attempt-1)
  attempt 1: 500 × 2^0 = 500ms
  attempt 2: 500 × 2^1 = 1000ms
  attempt 3: 500 × 2^2 = 2000ms
```

## In the Codebase

Open `src/agents/task-automator/tools/email.ts` and `tools/calendar.ts`. Both currently throw `"not implemented"` — these are the spots where real network calls will live, and where errors will happen. Once you implement them (Email Integration exercise), wrap each tool call with `withRetry()`.

## Hints

**Hint 1:** Don't add retry logic inside the tool functions themselves. Wrap them at the call site in the agent loop — that way you can tune retry parameters per-tool without changing the tool implementations.

**Hint 2:** To test retry logic without actually waiting, pass a test-controlled delay function: `withRetry(fn, 3, 1, testDelay)` where `testDelay` is a mock that resolves immediately. Your tests stay fast without changing the production code.

## Quiz

**Q1.** A `sendEmail()` call returns a 400 Bad Request error (the "to" address is malformed). Should you retry?

- A) Yes — retry 3 times with backoff
- B) No — 400 means the request itself is invalid. Retrying will get the same error
- C) Yes — maybe the server was having a bad day
- D) Depends on the email provider

> **Answer:** B — Only retry on transient errors (network issues, rate limits, server errors). An invalid request will fail every time regardless of how many retries you attempt.

---

**Q2.** Your agent fails to send an email after 3 retries. What should it do?

- A) Silently log the error and mark the task as complete
- B) Crash the process and restart
- C) Surface a clear, human-readable error to the user with enough context to take action
- D) Try a fourth time just in case

> **Answer:** C — Silently dropping failures is the worst outcome. The user needs to know *what* failed and *what they can do about it* (e.g., "I couldn't send the email — your Gmail connection may have expired. Reconnect it here.").

## Deep Dive: Circuit Breakers

Retry logic helps with transient failures. But if a service is truly down, retrying hammers a broken system and burns your rate limit budget.

A circuit breaker tracks recent failures. After N failures in a time window, it *opens* — all subsequent calls fail immediately without hitting the service. After a cooldown period, it *half-opens* to test if the service recovered.

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const cooldownMs = 30_000;
      if (Date.now() - this.lastFailureTime > cooldownMs) {
        this.state = 'half-open'; // try once
      } else {
        throw new Error('Circuit open — service unavailable');
      }
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= 5) this.state = 'open';
  }

  private reset() {
    this.failures = 0;
    this.state = 'closed';
  }
}
```

Use one circuit breaker per external service. When the circuit is open, your agent can immediately tell the user "Gmail is unavailable right now" rather than waiting through three retry cycles to reach the same conclusion.

## Questions to Consider

- What's the difference between a retry and a re-plan?
- When should an agent ask the user for help vs. trying to solve a failure on its own?
- How would you test your retry logic without actually waiting for delays?
