---
title: "Deployment & Production"
order: 7
prerequisites: ["05-error-handling", "06-external-services"]
summary: "Running your agent in the cloud, environment configuration, monitoring, and accessing your local machine via webhooks."
---

# Deployment & Production

A local agent that only runs when your laptop is open isn't very useful. Deployment moves your agent to a cloud server so it runs 24/7, can receive webhooks, and can be triggered from anywhere. The good news: it's a Node.js process — deployment is simpler than you might think.

## Choosing a Platform

For a personal agent, you want zero-ops hosting:

| Platform | Free Tier | Sleep on Inactivity | Webhook Support |
|---|---|---|---|
| Railway | Yes (limited) | No | Yes |
| Render | Yes | Yes (30s cold start) | Yes |
| Fly.io | Yes | No | Yes |

For an agent that needs to respond quickly (e.g., to incoming emails), avoid platforms that sleep. Railway is recommended here.

## Environment Configuration

Your agent needs secrets (API keys, OAuth tokens) in production. Never deploy a `.env` file — use the platform's environment variable dashboard.

```bash
# Set on Railway via CLI:
railway variables set CLAUDE_API_KEY=sk-ant-...
railway variables set GMAIL_CLIENT_SECRET=...

# Or set in their web dashboard
```

Validate all required env vars at startup and fail loudly if any are missing — better to crash on boot than to silently fail mid-task.

## Connecting Back to Your Local Machine

Your cloud agent can act on your local computer via two patterns:

**Pattern 1 — Webhooks + local receiver:**
Run a small local server that receives commands from your cloud agent:

```typescript
// On your laptop: receives commands from the cloud agent
app.post('/execute', (req, res) => {
  const { command, args } = req.body;
  // Verify the request is from your agent (shared secret)
  if (req.headers['x-agent-secret'] !== process.env.LOCAL_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  // Execute locally
  executeLocalCommand(command, args);
  res.json({ ok: true });
});
```

**Pattern 2 — Polling:**
Your laptop polls the cloud agent for pending tasks. Simpler, but adds latency.

## Monitoring

In production, you need to know when your agent fails. At minimum:

```typescript
process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught exception:', err);
  // Alert via email/Slack/webhook before exiting
  notifyOwner(`Agent crashed: ${err.message}`).finally(() => process.exit(1));
});
```

Add structured logging so you can search your logs: each log line should have `timestamp`, `level`, `event`, and relevant context.

## Deployment Checklist

- [ ] All secrets in platform env vars (not in code)
- [ ] Startup validates all required env vars
- [ ] Unhandled exceptions are caught and reported
- [ ] Webhook endpoints verify signatures
- [ ] Health check endpoint at `GET /health`
- [ ] Logs include enough context to debug failures

## Deployment Architecture Visualised

```
                    ┌─────────────────────────┐
  User Browser ────▶│   Railway/Render/Fly.io │
                    │                         │
                    │   ┌─────────────────┐   │
                    │   │  Express Server  │   │
                    │   │  (backend)       │   │
                    │   └────────┬────────┘   │
                    │            │             │
                    │   ┌────────▼────────┐   │
                    │   │  Agent Runtime  │──────────▶ Claude API
                    │   └────────┬────────┘   │
                    └────────────│────────────┘
                                 │ POST /execute
                                 ▼
                    ┌────────────────────────┐
                    │  Local Receiver        │
                    │  (your laptop)         │
                    │  ngrok / fixed IP      │
                    └────────────────────────┘
                                 │
                                 ▼
                    Files, Calendar, Local APIs
```

## In the Codebase

`backend/server.ts` is the Express server that gets deployed. `.env.example` lists every environment variable the app needs — copy this to `.env` locally, and add each variable to your deployment platform's environment dashboard before deploying.

## Hints

**Hint 1 (Railway quick start):** Install the Railway CLI (`npm install -g @railway/cli`), run `railway login`, then `railway up` from the project root. Railway auto-detects Node.js and runs your `start` script. Set env vars with `railway variables set KEY=value`.

**Hint 2 (local webhook receiver):** Install `ngrok` and run `ngrok http 3001` to get a public HTTPS URL for your local server. Paste this URL into your Railway deployment's `LOCAL_RECEIVER_URL` env var. Now your cloud agent can POST commands to your laptop.

**Hint 3 (health check):** Railway and Render check `GET /health` to decide if your app is running. Make sure `backend/server.ts` has this route returning `{ status: 'ok' }` before you deploy.

## Quiz

**Q1.** Your deployed agent stops responding. What's the first thing to check?

- A) Restart the deployment immediately
- B) Check the platform's live logs for the last error message
- C) Redeploy from scratch
- D) Check if the local receiver is running

> **Answer:** B — Logs tell you *why* it stopped. Restarting without checking the logs means you'll likely hit the same issue again. Look for uncaught exceptions, missing env vars, or failed startup validation.

---

**Q2.** You need to add a new environment variable to your deployed agent. What's the correct approach?

- A) Add it to `.env` and commit to git
- B) Hardcode the value in the source temporarily
- C) Add it via the deployment platform's environment variable dashboard, then redeploy
- D) SSH into the server and set it directly

> **Answer:** C — Platform env var dashboards are the right place. Never commit secrets to git. SSH-editing server config is fragile and won't survive redeployments.

## Deep Dive: Cost Optimisation

Running an agent in production means every LLM call costs money. A task that triggers 15 Claude API calls at 2,000 tokens each = 30,000 tokens. At current pricing that's small, but an agent running hundreds of tasks per day adds up.

**Prompt caching:** Claude supports [prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching). Mark your system prompt and tool definitions with `cache_control: { type: "ephemeral" }`. The first call populates the cache; subsequent calls within 5 minutes pay ~10% of the normal input token price. For an agent that makes many sequential calls with the same tools and system prompt, this can cut costs by 80%.

**Token counting before sending:** Use `client.beta.messages.countTokens()` to estimate cost before making the actual call. If a context has grown huge (summarisation failed, huge tool result), trim it before sending.

**Batching tool calls:** When the model wants to call multiple independent tools, modern Claude models can emit multiple `tool_use` blocks in one response. Your executor should run these in parallel with `Promise.all()` rather than sequentially — same cost, faster completion.

## Questions to Consider

- What's the first thing you should check if your deployed agent stops responding?
- How would you deploy a new version without dropping in-flight tasks?
- What's the minimum monitoring you need before trusting your agent with real actions?
