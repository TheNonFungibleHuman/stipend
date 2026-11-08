# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the operator who has to give an AI permission to spend.** A developer or technical
founder running an agent that needs paid inputs — data, summarisation, rendering — who cannot
hand it a credit card because a card has no per-call limit and no receipt an auditor accepts.
They are at a laptop, deciding in one sitting whether to trust the thing with money.

**Secondary: the judge or reviewer of the demo.** Someone technical, familiar with wallets and
402-style payment flows, who has seen a dozen "AI + blockchain" projects today and is looking
for the one that would still work if the pitch deck disappeared.

## Product Purpose

Give an autonomous agent its own wallet with a spending policy that is enforced between the
price quote and the signature, then let it buy what it needs one call at a time. Success means
an operator can say "here is $1.00 a day, $0.10 a call" and watch an agent transact inside that
envelope with proof of every cent — including proof of the payments that never happened.

## Positioning

Two claims a neighbouring product could not truthfully copy:

1. **The refusal happens at the signing boundary.** Not a dashboard alert, not a database flag —
   a policy check that runs before a transaction exists, so a blocked purchase is a signature
   that was never produced. The audit trail records refusals as first-class events.
2. **Settlement is the authorisation.** The seller returns data only after re-reading the
   payee's token balance from the chain itself. No accounts, no API keys, no billing table to
   reconcile; the receipt *is* the proof of payment.

## Operating Context

Judged and demoed in a browser on a laptop, on devnet, in a few minutes, with no wallet
extension and no sign-up. The audience will click the buttons live. Market data is synthetic
and says so. The build has no Rust toolchain, so nothing may depend on deploying a custom
on-chain program.

## Capabilities and Constraints

- TypeScript only, Next.js App Router, `@solana/web3.js` v1 + `@solana/spl-token`.
- On-chain primitives available without a custom program: System transfers, SPL Token, the v4
  Memo program (verified executable on devnet), associated token accounts.
- Test stablecoin: an SPL mint we control (`dUSD`, 6 decimals) created on first run.
- Wire format follows the x402 `exact` scheme shape (`402` + `accepts` + a payment proof
  header); the facilitator is self-hosted, verification reads `pre/postTokenBalances`.
- The treasury sponsors every transaction fee, so the agent holds only stablecoin. This is what
  makes a $0.04 sale economic.
- The public devnet faucet is closed (`410 Gone`); first run needs one manual transfer to the
  treasury before anything can settle. The product says this out loud instead of failing.
- LLM reasoning is optional: DeepSeek, OpenAI or Anthropic when a key is present, a
  deterministic engine otherwise. Every paid service must work with no key.
- The demo must survive a bad devnet minute: retries with backoff, idempotent bootstrap, no
  external service that can 500 the demo.

## Brand Commitments

Name: **Stipend**. Voice: plain, specific, numbers-first, no growth-speak. Never claim a
capability the build does not have; label synthetic data as synthetic.

## Evidence on Hand

- `lib/policy.ts` — the pure decision function that produces refusals.
- `lib/verify.ts` — settlement verification against token balance deltas.
- `lib/pay.ts` — the quote → policy → sign → retry loop.
- Real devnet transactions with memo receipts, once the treasury is funded.
- No testimonials, customers, benchmarks or pricing claims exist. Do not invent them.

## Product Principles

1. **A refusal is a feature, not an error.** Show it with the same weight as a settlement.
2. **Every number on screen is checkable.** If it links to a receipt, link to it.
3. **The agent is not trusted and does not need to be.** The policy and the chain do the work.
4. **Say the true thing about state.** Unfunded, degraded, or deterministic — name it.
5. **Money leaving must feel physical.** Spend is a motion the operator can feel, not a table row.

## Accessibility & Inclusion

Keyboard reachable throughout, visible focus rings, `prefers-reduced-motion` honoured, and
colour never the only carrier of a state (every state also carries a word).
