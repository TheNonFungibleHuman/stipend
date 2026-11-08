# Stipend as an MCP tool server

An existing agent — Claude Code, Cursor, opencode, antigravity, anything that speaks Model Context
Protocol — can buy Stipend's paid services as tools. The `402 → authorize → retry` handshake happens
inside the server, so the calling agent just sees a normal tool result with data and a receipt.

## What it exposes

| Tool | Cost | What it returns |
| --- | --- | --- |
| `agent_status` | free | balance, per-call cap, daily budget, spend so far, calls left, service prices |
| `buy_signals` | ~$0.04 | live public discussion for a query: titles, points, comment counts, dates, links |
| `buy_notes` | ~$0.06 | 3–5 decision-grade notes distilled from those threads, written by the model |
| `buy_brief` | ~$0.08 | a one-page memo: recommendation, reasoning, risk |

Every paid call enforces the agent's policy first. If a purchase would break the per-call cap, the
daily budget or the allowlist, the tool returns `isError` with the reason and **no signature is
produced** — the money genuinely does not move.

## Install

Nothing to download. The tools are a **remote MCP server** on the deployment itself, authenticated
with your agent's owner token.

```text
URL:    https://stipend-delta.vercel.app/api/mcp
Header: Authorization: Bearer stp_...
```

### Claude Code

```bash
claude mcp add --transport http stipend https://stipend-delta.vercel.app/api/mcp \
  --header "Authorization: Bearer <owner token>"
```

### Any client with a JSON config (Cursor, opencode, Claude Desktop, DSH)

```json
{
  "mcpServers": {
    "stipend": {
      "url": "https://stipend-delta.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <owner token>"
      }
    }
  }
}
```

The token is the owner key from the console (`/app?token=…`). It authorises spending from **that
agent's wallet only**, and every call still goes through the policy — a remote server is not a
weaker guarantee than a local one, because the money moves on chain either way.

### If your client only speaks stdio

A single-file, dependency-free server is published alongside the app:

```bash
curl -fsSL https://stipend-delta.vercel.app/stipend-mcp.mjs -o stipend-mcp.mjs
```

```json
{
  "mcpServers": {
    "stipend": {
      "command": "node",
      "args": ["/absolute/path/to/stipend-mcp.mjs"],
      "env": {
        "STIPEND_URL": "https://stipend-delta.vercel.app",
        "STIPEND_AGENT_ID": "<agent id>",
        "STIPEND_AGENT_TOKEN": "<stp_...>"
      }
    }
  }
}
```

### Or: give your agent the prompt

The console prints a prompt you can paste straight into a tool-capable agent, and it configures
itself. That is the intended path for a non-technical operator.

## Verify it yourself

```bash
node tools/mcp-smoke.mjs
```

It spawns the server exactly as a client would, sends `initialize`, `notifications/initialized`,
`tools/list`, then `agent_status`, `buy_signals` and `buy_notes` — the last two make real devnet
purchases. Expected output includes `written by DeepSeek V4.1 Flash` and an explorer link per
purchase.

## Does it work on devnet?

Yes, fully. The server talks to your local Stipend instance, which settles on devnet. Purchases
complete in ~100–300ms and produce real transactions. The only thing that is not real money is
`dUSD`, the demo stablecoin the treasury mints — so the flow is end-to-end real except the value.

## Security notes

- The token is scoped to one agent and can only do one thing: ask the wallet service to sign a
  payment **within that agent's caps**. It cannot read other agents, drain the treasury, or change
  policy.
- Policy edits are an operator action (the console), not a tool. An agent cannot raise its own cap.
- The server makes no network calls except to `STIPEND_URL`; it holds no key material.

## Framing for the demo

> "Your agent already has a model. Give it a budget, and it can buy what it needs from vendors it
> has no account with. I'll paste the setup prompt into Claude Code and ask it to research pricing —
> it buys six live threads for four cents, writes the notes, and every purchase is a devnet
> transaction with a cap it cannot cross."
