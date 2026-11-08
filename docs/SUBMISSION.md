# Submission — Stipend

**Tagline:** A budget for your AI agent, enforced before it signs anything.

## What it is

Stipend gives an AI agent its own Solana wallet and a spending policy that is checked between the
price quote and the signature. The agent buys data one call at a time from vendors it does not
control; each purchase settles on devnet in about a tenth of a second and leaves a receipt anyone
can open in an explorer. When a purchase breaks a limit, no signature is produced — and the ledger
records the refusal with the reason.

## The problem

An agent that buys data with your card is an agent you cannot audit. A card has no per-call limit,
no payee allowlist, and a $0.30 + 2.9% fee that makes a four-cent sale impossible before it starts.
That fee floor is why software is sold per seat instead of per answer — and per-seat pricing is
wrong for an agent that needs one answer at a time.

## How it works

1. **Ask.** The agent posts to a paid endpoint and gets a real `402 Payment Required` with a price.
2. **Authorise.** It calls `/api/agents/<id>/authorize` with its token. That endpoint is the wallet
   service: it checks the payee allowlist, the per-call cap and the rolling 24-hour budget, and only
   then signs a transfer from the agent's wallet. Over a limit, it returns `403` with the reason and
   produces no signature.
3. **Retry.** The agent repeats the call with the returned `x-payment` header. The vendor re-reads
   the payee's token balance on chain before it returns a single byte, so settlement **is** the
   authorisation. No accounts, no API keys, no billing table.

Every settlement carries a v4 memo receipt (`stipend:v1:svc=…:amt=…:run=…`), which makes the
transaction self-describing on any explorer.

## What is genuinely live

- **Signals vendor:** fetches real public discussion (Hacker News) at call time, building its own
  queries from the goal. The step reports `engine=fetch source=live` with the real result count.
- **Reasoning:** the summariser and the memo run on DeepSeek; the console shows the model on every
  step and in the header.
- **Settlement:** every payment is a devnet transaction with a verifiable signature and balance delta.
- **Refusals:** produced by a pure policy function, recorded with no signature.

Only the demo stablecoin (`dUSD`) and the cached fallback snapshot are synthetic, and both are
labelled wherever they appear.

## How it was built

Next.js (App Router) end to end, `@solana/web3.js` + `@solana/spl-token`, SPL Token transfers and the
v4 Memo program — no custom on-chain program, because this machine has no Rust toolchain and the
available primitives carry the design. Settlement verification reads `pre/postTokenBalances` deltas
rather than trusting a client claim. The design is a coin-op meter: an enamel cabinet, a mechanical
counter for budget left, a pay slot, and a coin return that fills with refused purchases.

## Challenges

- **The devnet RPC faucet is closed** (`410 Gone`), so provisioning had to become an explicit,
  honest funding gate rather than an airdrop.
- **Silent money bugs.** Our first wallet implementation minted itself free runway whenever an RPC
  read failed, because "read returned 0" and "no tokens" were conflated. Fixed by making a failed
  read return `null` and refusing to mint on an unknown balance — and by removing the automatic
  top-up from the run path entirely.
- **A vendor that 500s after taking money.** The brief writer crashed on a summariser payload. It
  now validates the shape it is handed and returns a proper `502` naming the settlement, so a paid
  failure is never silent.
- **Run history in memory.** The runs table emptied on every restart while the ledger kept its
  records. History is now derived from the ledger.

## What we would build next

- Move the policy fully on chain as a small Anchor program, so enforcement survives even a hostile
  server.
- Ship the MCP server so an existing agent — Claude Code, Cursor, opencode, antigravity — can call
  Stipend's paid services as a tool with one config line.
- Real vendor partners instead of the built-in signal source.

## Built with

`Next.js` · `TypeScript` · `@solana/web3.js` · `@solana/spl-token` · Solana devnet · v4 Memo program ·
DeepSeek · Hacker News Algolia API
