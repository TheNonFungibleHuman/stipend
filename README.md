# Stipend

**A budget for your AI agent, enforced before it signs anything.**

An agent that buys data with your card is an agent you cannot audit. Stipend gives it a wallet, a
spending policy checked between the price quote and the signature, and a receipt for every purchase
that settles on Solana devnet in about a tenth of a second.

**[Open the console](/#open-the-console)** · **[Documentation](/docs)** · **[Create an agent](/start)**

---

## What you can do with it

Your agent needs four small things from four different vendors to write one launch memo — live
search, a rendered page, an OCR pass, and the memo itself. Three of them normally want an account, a
card on file and a monthly plan, and none of them will sell you a single call.

Stipend covers those three. Your agent pays two to five cents per call, inside limits you set, and
every purchase is a devnet transaction you can open in an explorer.

| Real | Not real |
| --- | --- |
| Every settlement, signature and refusal on devnet | The demo stablecoin (`dUSD`) |
| Live signals fetched from the source at call time | The cached snapshot, served only when that source is down — and labelled |
| Model-written notes and memos | |

## The two guarantees

1. **A refused purchase is a signature that was never produced.** The policy runs before the
   transaction is built, so a blocked call moves no money and leaves a record saying why.
2. **Settlement is the authorisation.** The vendor re-reads the payee's balance on chain before it
   answers. No account, no API key, no billing table to reconcile.

## Start here

1. **Create an agent** — a name, a per-call cap, a daily budget. No ceiling imposed by us.
2. **Fund it** — the agent gets its own wallet and demo stablecoin.
3. **Run a task** — three paid services, each a real `402 → authorize → retry` handshake.
4. **Prove the cap** — lower the limit and watch a purchase get refused with the reason and no
   signature.
5. **Connect your own agent** — paste the setup prompt into Claude Code, Cursor or opencode, and it
   installs the MCP tool server itself.

Full walkthrough: **[Get started](/docs/get-started)**. Tool and API reference:
**[docs/MCP.md](docs/MCP.md)**.

## When you do not need this

If your agent only ever calls one vendor, that vendor already bills per call, and its own spend limit
is enough — keep what you have. Stipend earns its place when the vendor count rises, when a vendor
will not sell you a single call, or when you want one budget and one audit trail across all of them.

## The pieces

```
app/                     landing, onboarding, console, docs
  api/paid/[serviceId]   the vendors: 402 without proof, 200 after verification
  api/agents/[id]/authorize   the wallet service: policy check, then sign
lib/
  policy.ts              the pure decision function
  verify.ts              reads the chain and checks the payee was actually paid
  vendors/signals.ts     live signal fetch, with a labelled cached fallback
mcp/stipend-mcp.mjs      the MCP tool server (four tools, dependency-free)
docs7/                   the public docs site source (Docs7)
```

## Documentation

- **In-app:** `/docs` — nine pages covering the flow, integration, tools, API, policy and failures.
- **Docs7 source:** `docs7/` — the same material as a publishable docs site. See
  [docs7/README.md](docs7/README.md) to deploy it (`docs7 login` needs a human).

## Honest limits

- The demo instance holds the agent's keypair so the flow works without a browser extension; in
  production the key lives where the agent runs and the same key gates a signing service.
- `dUSD` is a devnet mint with no value.
- No custom on-chain program: the design uses SPL Token, the v4 Memo program and System transfers.

Built for the MLH × Solana Hackathon, November 2026.
