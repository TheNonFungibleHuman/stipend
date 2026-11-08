# Stipend — budget-enforced agent payments

## Problem

An agent that needs paid inputs cannot be given a credit card. A card has no per-call limit, no
payee allowlist, and a 2.9% + $0.30 fee that makes a $0.04 purchase impossible. Giving an agent
a wallet instead moves the problem: something has to bound what it can spend, and something has
to prove to a human afterwards that the bound held.

## Outcome (who notices, and what changes for them)

An operator sets a budget once and then lets an agent buy data unattended. They notice two
things: a purchase that should have been refused was refused *before it was signed*, and every
purchase has a receipt they can open in a block explorer. The seller notices that it was paid
before it did any work, without an account or an API key.

## In scope

- Real devnet settlement: SPL token transfer + v4 Memo receipt per paid call.
- A pure policy function (per-call cap, daily budget, payee allowlist) applied between the 402
  and the signature.
- Server-side verification that the payee's balance actually increased, with replay rejection.
- Three paid services in a chain (intel → notes → brief) plus one deliberately overpriced vendor.
- A dashboard that shows the run, live budget, refusals, the settlement tape, and the card-rail
  comparison, at desktop and mobile widths.
- A deterministic mode so the demo works with no LLM key and no network luck.

## Non-goals

- Custom on-chain program. No Rust toolchain on this machine; the available primitives carry it.
- Mainnet, real money, or a stablecoin issuer integration.
- Multi-user accounts, auth, or a billing database — the point is that none are needed.
- A published npm SDK, a Chrome extension, or a mobile app.
- Real market data. The dataset is synthetic and labelled.

## Decisions

- **Self-hosted facilitator instead of a hosted one.** Why: the `exact` scheme is outcome-based,
  so verifying token-balance deltas ourselves is small, honest and demo-proof. Rejected: the
  hosted x402 facilitator, which would add an external failure mode to a live demo.
- **Treasury sponsors fees.** Why: it makes a $0.04 payment net $0.04 and lets the agent hold only
  stablecoin. Rejected: giving the agent SOL, which turns every call into a two-asset problem.
- **Policy in a pure function, not in the transaction builder.** Why: it can be tested without a
  network and it is the only thing between the agent and a payee. Rejected: embedding checks in
  the route handler.
- **Memo receipt instead of our own receipt account.** Why: no rent, no program, readable on any
  explorer. Rejected: a receipt PDA, which needs a deployed program.
- **Deterministic LLM fallback.** Why: a missing key must not break a live demo. Rejected:
  requiring a key.
- **Fixture mode for design verification.** Why: the dashboard must be inspectable and
  screenshot-able before devnet funding exists, and it doubles as a demo safety net. It is behind
  an env flag, off by default, and labelled in the UI when on.
- **Deferred higher option:** a small Anchor `escrow` program for hold-then-release payments.
  Why not now: no Rust/WSL toolchain, and the deadline does not allow a deploy pipeline.

## Acceptance

- [ ] `pnpm typecheck` exits 0.
- [ ] `POST /api/run` produces three settled steps with distinct devnet signatures, each openable
      on explorer.solana.com.
- [ ] Lowering the per-call cap to $0.05 and re-running produces a `refused` step whose reason
      names the cap, and no signature.
- [ ] `impeccable detect` reports zero findings on `app/`.
- [ ] Desktop (1440) and mobile (390) screenshots of the dashboard exist in `.impeccable/review/`.
- [ ] `node harness\dsh-build-command\spine-check.mjs --dir . --verbose` exits 0.
- [ ] A judge who has never seen the repo can read the README and know what to click.
