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

## Questions to Consider

- What happens to your agent if a third-party service changes its API?
- How would you handle a webhook that arrives while your agent is already processing another task?
- Why should you use the narrowest OAuth scopes possible?
