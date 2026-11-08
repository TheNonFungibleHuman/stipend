# Solana Hackathon (MLH) — the brief

_Extracted from the event pages on 2026-11-08 and rewritten as what it actually
means for our build. Times converted to Gulf Standard Time (UTC+4)._

---

## 1. The clock

| Event | ET | Our time (UTC+4) | Status |
| --- | --- | --- | --- |
| Hacking began | Fri 12:00 PM | Fri 20:00 | done |
| Solana 101 workshop | Sat 10:00 AM | Sat 18:00 | ended |
| Build with AI on Solana | Sat 10:30 AM | Sat 18:30 | ended |
| **Initial submission due** | **Sun 10:00 AM** | **Sun 19:00** | ~9h25m away at 09:35 |
| Hacking ends / final submission | Sun 11:45 AM | Sun 20:45 | hard gate |
| Submissions close | Sun 1:00 PM | Sun 22:00 | final |
| Closing ceremony | Sun 12:00 PM | Sun 21:00 | stream |

We are **not** at the start of a 48-hour weekend. We are in the last day of a
live event with 57+ submissions already in. Everything below assumes a single
working day: one product, one demo, one submission.

## 2. What is actually being judged

Only one sentence in the whole event description states the bar:

> "We're looking for a working product that uses Solana for something it's good
> at (speed, low fees, composability, on-chain ownership), not a chain bolted
> onto a web2 app."

That sentence is the rubric. It rules out more than it rules in:

- **Out:** a normal app with a "connect wallet" button and an NFT receipt.
- **Out:** a "decentralised" clone of something that works fine on a server.
- **In:** a product that would be *worse or impossible* on another rail.

So the winning question is not "what should I build on Solana?" It is **"what
becomes possible at $0.00025 per transaction and 400ms finality that is
impossible at 2.9% + $0.30?"** Anything we build should be an answer to that.

The prizes reinforce it:

| Track | Prize | What they say they want |
| --- | --- | --- |
| **Top 3 Overall** | $1,000 microgrant per team, to keep building | the three strongest projects, judged against that sentence above |
| **AI Track** | $100 gift card per member | "AI and Solana each do real work" |
| **DeFi Track** | $100 gift card per member | value moves faster / cheaper / more open |
| **Gaming Track** | $100 gift card per member | fun first, chain adds ownership or fairness |
| **Best Beginner** | $100 gift card per member | teams >50% first-time hackers |

One submission can enter **every** category it qualifies for. That is a
structural advantage: a single well-built product designed to sit on two tracks
doubles the expected value of the same 12 hours.

## 3. The AI track is written as a specification

Read the AI track's own words closely, because they are unusually specific:

> "use Solana to give AI systems something they can't get elsewhere, like
> **payments**, ownership, verifiability or coordination"

and then it lists, as a starter idea:

> "**Autonomous agents** that hold a wallet and act on-chain: trading, paying
> for APIs, managing a treasury, or executing tasks with **spending limits**"
> "**Machine payments:** AI services paid per request with micropayments or
> stablecoins"

The organisers have told us what they want to see. The safest way to lose is to
build a chatbot with a wallet bolted on. The safest way to win the AI track is
to build exactly the thing they described — an agent with a wallet and a budget,
paying for what it needs — and then make it undeniably real: real devnet
transactions, real limits enforced before signing, real receipts an auditor can
open in an explorer.

## 4. Constraints that shape the design

Facts about this machine and this window, checked, not assumed:

- **No Rust, no Cargo, no Solana CLI, no Anchor, and no WSL installed.** We
  cannot compile or deploy a custom on-chain program without sinking hours into
  a toolchain that is not here. Design around programs that already exist on
  devnet: the System program, SPL Token, Token-2022, Memo. This is a
  constraint, not a compromise — those primitives are enough for a real product.
- **Node 24 + pnpm** are available. TypeScript end to end.
- **`https://api.devnet.solana.com` is healthy** (4.4.0, ~590ms round trip).
  Airdrops and confirmation latency are the main demo risk, so the demo must
  never depend on a live faucet mid-presentation.
- **~11 hours of wall clock**, of which the last two belong to recording and
  submission.

## 5. What we are building

**Stipend** — budget-enforced Solana wallets for AI agents that pay per API call.

An agent gets its own keypair and a policy: a per-call cap, a daily cap, and a
payee allowlist. When the agent needs data, it hits a paid endpoint, gets a
`402 Payment Required`, checks the price against its policy, signs a Solana
transfer, gets a sub-second confirmation, and retries the call with proof of
payment. Every settlement writes a receipt anyone can open on an explorer.

Three things this product has that a web2 version cannot:

1. **The unit economics only exist here.** You cannot charge $0.02 for an API
   call on card rails — the fee is larger than the price. At Solana fees, a
   2-cent sale nets 2 cents.
2. **The budget is enforced at signing, not in a database.** The policy check
   sits between the request and the signature. A refused payment is a signature
   that never happened, and the ledger shows it as refused.
3. **The receipt is the proof.** Settlement is the authorisation: the endpoint
   verifies balances on devnet before it returns data. No accounts, no API keys,
   no trusted billing server.

Full spec: [PROJECT.md](./PROJECT.md).
