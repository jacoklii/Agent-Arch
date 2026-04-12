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

## Questions to Consider

- What's the difference between a retry and a re-plan?
- When should an agent ask the user for help vs. trying to solve a failure on its own?
- How would you test your retry logic without actually waiting for delays?
