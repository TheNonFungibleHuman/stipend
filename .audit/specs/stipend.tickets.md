# Stipend — tickets

Spec: .audit/specs/stipend.md

## T0 — Walking skeleton: devnet bootstrap, 402 loop, dashboard shell
- blocked by: none
- surface: `lib/*`, `app/api/*`, `app/components/*`
- acceptance: `pnpm typecheck` exits 0 and the app renders the funding gate or the dashboard.
- status: done

## T1 — Fixture harness for design verification
- blocked by: none
- surface: `lib/fixture.ts`, `app/api/state/route.ts`, `app/api/run/route.ts`
- acceptance: with `STIPEND_FIXTURE=1`, `/api/state` returns a populated snapshot, ledger and a
  completed run whose steps include one settled and one refused, and the dashboard renders it.
- status: done

## T2 — Replace the visual world
- blocked by: T1
- surface: `app/globals.css`, `app/components/*`, `app/layout.tsx`
- acceptance: the dashboard renders in the committed direction at 1440 and the first viewport
  shows the mechanism (a budget that can be spent and refused), not a generic hero.
- status: done

## T3 — Detector clean and two-viewport evidence
- blocked by: T2
- surface: `app/`
- acceptance: `impeccable detect app` reports zero findings, and `desktop.png` (1440) plus
  `mobile.png` (390) exist in `.impeccable/review/` and show the built dashboard.
- status: done

## T7 — Landing page at `/`
- blocked by: T2
- surface: `app/page.tsx`
- acceptance: a first-time visitor learns what this is, what it costs the seller, and presses one
  of two working calls to action within one viewport.
- status: done

## T8 — Onboarding flow at `/start`
- blocked by: T7 (shares the plate and card vocabulary)
- surface: `app/start/page.tsx`, `app/components/Onboard.tsx`, `app/api/agents/*`
- acceptance: naming an agent, setting both caps and creating it returns a wallet address and an
  API token, and the console opens scoped to that agent.
- status: done

## T9 — Multi-agent registry and agent-scoped runs
- blocked by: none
- surface: `lib/agents.ts`, `lib/agent.ts`, `app/api/state/route.ts`
- acceptance: two agents hold separate policies, balances and ledgers; the console switcher changes
  which agent a run spends from.
- status: done

## T4 — End-to-end settlement proof on devnet
- blocked by: none (external: one-time treasury funding)
- surface: treasury wallet
- acceptance: a normal run settles three calls; each signature is confirmed on devnet and the
  agent's token balance drops by exactly the quoted total.
- status: done

## T10 — Console as an operations dashboard
- blocked by: T9
- surface: `app/components/Console.tsx`, `StatusStrip`, `RunsTable`, `LedgerTable`, `LimitsEditor`,
  `AgentPanel`, `RunSteps`
- acceptance: `/app` shows status metrics, job steps, run history, limits and the ledger with no
  marketing copy; run history survives a server restart because it is derived from the ledger.
- status: done

## T11 — Landing carries the argument: proof, FAQ, motion
- blocked by: T7
- surface: `app/page.tsx`, `Proof.tsx`, `Faq.tsx`, `Reveal.tsx`, `CountUp.tsx`
- acceptance: the card-rail arithmetic, the eight questions and the console panel list live on `/`;
  sections reveal on scroll and render visible with JS disabled.
- status: done

## T12 — Agent-authorised spending endpoint
- blocked by: T8
- surface: `app/api/agents/[id]/authorize/route.ts`, `AgentPanel`
- acceptance: a caller presenting a valid agent token gets a signed, policy-checked payment header;
  an over-cap request returns 403 with the reason and produces no signature.
- status: done

## T5 — README, submission writeup, demo script
- blocked by: T2
- surface: `README.md`, `docs/SUBMISSION.md`, `docs/DEMO.md`
- acceptance: a judge can start the app from the README in under three commands and the writeup
  states what is real and what is synthetic.
- status: open

## T6 — Review and close-out
- blocked by: T3, T4, T5
- surface: whole repo
- acceptance: `code-review` findings applied once, `spine-check.mjs` exits 0, spec boxes ticked.
- status: open
