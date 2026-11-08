# Stipend

**A budget for your AI agent, enforced before it signs anything.**

Stipend gives an agent its own Solana wallet, a spending policy that is checked between the price
quote and the signature, and a receipt for every purchase that settles on devnet in about a tenth
of a second. It buys what it needs, one call at a time, from vendors it does not control.

Live at `/` (the pitch), `/start` (create an agent), `/app` (the console).

---

## Why it exists

An agent that buys data with your card is an agent you cannot audit. A card has no per-call limit,
no payee allowlist, and a 2.9% + $0.30 fee that makes a four-cent purchase impossible before it
starts. Solana charges ~5,000 lamports for the same sale, which is the only reason per-call
pricing can exist at all.

Two things follow, and they are the product:

1. **The refusal happens at the signing boundary.** Not a dashboard alert, not a database flag. A
   blocked purchase is a signature that was never produced, and the ledger records the refusal
   with the reason.
2. **Settlement is the authorisation.** The vendor re-reads the payee's token balance on chain
   before it returns a byte. No accounts, no API keys, no billing table to reconcile.

## How a payment works

```
agent                    vendor                       wallet service
  │  POST /api/paid/X ──────▶ │                              │
  │ ◀──── 402 + price ─────── │                              │
  │  POST /api/agents/<id>/authorize ───────────────────────▶ │
  │        (x-agent-token)                                     │  cap? budget? allowlist?
  │ ◀──── payment header ──────────────────────────────────── │  sign + confirm
  │  POST /api/paid/X  (x-payment) ──▶ │                       │
  │                                    │ verify balance delta  │
  │ ◀──── 200 + output + receipt ───── │                       │
```

Step 2 is the only place a signature can be produced, and it is the only thing the agent is not
allowed to do for itself.

## Run it

```bash
pnpm install
cp .env.example .env       # add DEEPSEEK_API_KEY for model reasoning (optional)
pnpm build && pnpm start   # http://127.0.0.1:4310
```

First run needs one manual transfer: the devnet RPC faucet is closed, so the app shows a funding
gate with the treasury address. Send it ~0.5 devnet SOL via [faucet.solana.com](https://faucet.solana.com)
once; after that the mint, wallets and receipts build themselves.

`pnpm dev` is broken on machines behind a proxy that blocks Next's HMR websocket. Use
`pnpm build && pnpm start`; that is also what a reviewer should see.

## What is real

| Real | Synthetic |
| --- | --- |
| Every settlement, signature and balance change on devnet | The demo stablecoin (`dUSD`), minted by the treasury |
| Every refusal, recorded with the reason and no signature | The cached signal snapshot, served only when the live source is unreachable |
| The signals vendor's live fetch at call time | |
| Model reasoning in the summariser and the memo | |

The console prints which engine ran on every step: `fetched from the live source`, `computed by
deepseek-chat`, or `computed deterministically`. It never claims more than it did.

## What it costs

An agent buys three things in the demo pipeline:

| Service | What it does | Price |
| --- | --- | --- |
| Signal Search | Fetches live public discussion for the goal | $0.04 |
| Summariser | Turns the threads into decision-grade notes | $0.06 |
| Brief Writer | Writes the one-page memo | $0.08 |

A card processor would charge ~$0.91 to collect that $0.18. Solana charges ~$0.000003.

## Layout

```
app/
  page.tsx              landing: the argument, the arithmetic, the FAQ
  start/page.tsx        onboarding: name → caps → wallet + token
  app/page.tsx          console: status, job, runs, limits, agent, ledger
  api/paid/[serviceId]  the vendors: 402 without proof, 200 after verification
  api/agents/[id]/authorize  the wallet service: policy check, then sign
  api/state             one poll for the whole console
lib/
  policy.ts             the pure decision function (per-call cap, daily budget, allowlist)
  pay.ts                quote → policy → sign → retry with proof
  verify.ts             reads the chain and checks the payee's balance actually grew
  vendor/signals.ts     live signal fetch with a labelled cached fallback
  agents.ts             agent records: keypair, policy, API token
```

## Policy

Three limits, checked in this order, before anything is signed:

1. **Payee allowlist** — when set, only these vendors can be paid.
2. **Per-call cap** — a single purchase above this is refused.
3. **Rolling 24h budget** — a purchase that would cross it is refused.

Lower the cap to $0.05 in the console and run the pipeline: the $0.04 call settles, the $0.06 and
$0.08 calls are refused with `$0.06 is over the $0.05 per-call cap`, and no signature exists for
either.

## Honest limits

- The agent's keypair is held by this server so the demo runs without a browser extension. In
  production the key lives where the agent runs and the same token gates a signing service or a
  policy program. The enforcement point moves; the guarantee does not.
- `dUSD` is a devnet mint with no value.
- There is no custom on-chain program: this machine has no Rust toolchain, so the design uses the
  primitives that already exist on devnet (SPL Token, the v4 Memo program, System transfers).

Built for the MLH × Solana Hackathon, November 2026.
