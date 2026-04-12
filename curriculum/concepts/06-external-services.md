---
title: "Connecting External Services"
order: 6
prerequisites: ["02-mcp-and-tools", "05-error-handling"]
summary: "API authentication, rate limiting, webhooks for real-time triggers, and keeping credentials secure."
---

# Connecting External Services

Your agent's usefulness is proportional to what it can reach. Email, calendars, task managers, databases, Slack — each requires authentication, respects rate limits, and has its own failure modes. Getting this layer right is what separates a demo from a tool you actually rely on.

## API Key Management

Never hardcode credentials. Load them from environment variables and validate at startup:

```typescript
function loadCredentials() {
  const required = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'CALENDAR_API_KEY'];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required credentials: ${missing.join(', ')}`);
  }

  return {
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    },
    calendar: { apiKey: process.env.CALENDAR_API_KEY! },
  };
}
```

## OAuth Flow

Many services use OAuth — the user authorizes your app, you get a short-lived access token and a long-lived refresh token. Store the refresh token securely; use it to get new access tokens silently.

```typescript
async function getAccessToken(): Promise<string> {
  if (isExpired(storedToken)) {
    // Exchange refresh token for new access token
    storedToken = await oauth.refresh(storedRefreshToken);
  }
  return storedToken.accessToken;
}
```

## Rate Limiting

APIs have rate limits. Respect them by tracking your request count and queuing when you're near the limit:

```typescript
class RateLimiter {
  private requests: number[] = [];  // timestamps of recent requests

  async throttle(limit: number, windowMs: number): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < windowMs);

    if (this.requests.length >= limit) {
      const oldestInWindow = this.requests[0];
      const waitMs = windowMs - (now - oldestInWindow) + 10;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    this.requests.push(Date.now());
  }
}
```

## Webhooks for Real-Time Triggers

Polling is wasteful. Webhooks let external services push events to your agent — "new email arrived", "calendar event starting in 10 minutes", "payment received".

Your agent needs a public HTTPS endpoint to receive webhooks. In development, tools like `ngrok` expose your local server. In production, your cloud deployment handles this.

```typescript
app.post('/webhooks/gmail', (req, res) => {
  // Verify the webhook signature first!
  if (!verifyGmailSignature(req)) {
    return res.status(401).send('Unauthorized');
  }

  const notification = req.body;
  agent.handleEmailEvent(notification);
  res.status(200).send('OK');
});
```

## Security Considerations

- Always verify webhook signatures before processing
- Store tokens in encrypted storage, never in git
- Use scopes: request only the permissions your agent actually needs
- Rotate credentials periodically

## OAuth Flow Visualised

```
User                Your App              Google Auth
────                ────────              ───────────
  │                     │                     │
  │── "Connect Gmail" ──▶│                     │
  │                     │── redirect ─────────▶│
  │                     │                     │
  │◀────────────── login page ────────────────│
  │                     │                     │
  │── user approves ────────────────────────▶│
  │                     │                     │
  │                     │◀── auth code ───────│
  │                     │                     │
  │                     │── exchange code ────▶│
  │                     │                     │
  │                     │◀── access token  ───│
  │                     │    + refresh token  │
  │                     │                     │
  │                     │ [store refresh token]│
  │                     │ [use access token]  │
```

## In the Codebase

`src/agents/task-automator/tools/email.ts` and `tools/calendar.ts` are where Gmail and Google Calendar connections live. For the Email Integration exercise, you don't need to implement full OAuth from scratch — you can start with Nodemailer using a Gmail app password (simpler), then graduate to OAuth if needed.

## Hints

**Hint 1 (email without full OAuth):** Create a Gmail app password at myaccount.google.com → Security → App passwords. Use it with Nodemailer: `{ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } }`. This avoids the OAuth dance entirely for personal use.

**Hint 2 (calendar):** Google Calendar has a simpler API key option for read-only access. For write access (adding events), you'll need OAuth, but the `googleapis` npm package handles most of the complexity — `google.auth.OAuth2` manages token refresh automatically.

## Quiz

**Q1.** Where should you store your Gmail OAuth refresh token?

- A) In `.env` committed to git — it's just a config value
- B) Hardcoded in the source file for easy access
- C) In an environment variable on the deployment platform, never in the repository
- D) In a public config file so other services can access it

> **Answer:** C — A refresh token gives permanent access to a user's account. It must never be committed to git. Use platform environment variables or an encrypted secrets manager.

---

**Q2.** Your agent sends emails. Gmail allows 500 emails per day. A bug causes the agent to send the same email 600 times in a loop. What mechanism would have prevented this?

- A) A circuit breaker that opens after repeated failures
- B) Rate limiting — tracking outbound request count and refusing to exceed the daily limit
- C) OAuth — it prevents too many requests automatically
- D) Exponential backoff on retries

> **Answer:** B — Rate limiting is a proactive control. A circuit breaker reacts to *failures*, but a runaway email loop might succeed every time until the quota is exhausted. Tracking send counts and enforcing a per-day limit is the right defence.

## Deep Dive: Webhook Signature Verification

When a webhook arrives at your server, you can't be sure it came from the legitimate service — anyone can POST to your endpoint. Services solve this by signing requests with a shared secret.

Gmail uses Pub/Sub push notifications. Google Calendar uses watch channels. Both include a header or payload field you can verify:

```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(
  payload: string,
  receivedSignature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  return expected === receivedSignature;
}

app.post('/webhooks/gmail', (req, res) => {
  const rawBody = JSON.stringify(req.body);
  const sig = req.headers['x-goog-signature'] as string;

  if (!verifyWebhookSignature(rawBody, sig, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }

  // Now safe to process
  agent.handleEmailEvent(req.body);
  res.status(200).send('OK');
});
```

The `timingSafeEqual` approach (or string equality on equal-length digests) prevents an attacker from learning the secret by timing how long the comparison takes.

## Questions to Consider

- What happens to your agent if a third-party service changes its API?
- How would you handle a webhook that arrives while your agent is already processing another task?
- Why should you use the narrowest OAuth scopes possible?
