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
- status: open

## T2 — Replace the visual world
- blocked by: T1
- surface: `app/globals.css`, `app/components/*`, `app/layout.tsx`
- acceptance: the dashboard renders in the committed direction at 1440 and the first viewport
  shows the mechanism (a budget that can be spent and refused), not a generic hero.
- status: open

## T3 — Detector clean and two-viewport evidence
- blocked by: T2
- surface: `app/`
- acceptance: `impeccable detect app` reports zero findings, and `desktop.png` (1440) plus
  `mobile.png` (390) exist in `.impeccable/review/` and show the built dashboard.
- status: open

## T4 — End-to-end settlement proof on devnet
- blocked by: none (external: one-time treasury funding)
- surface: treasury wallet
- acceptance: a normal run settles three calls; each signature is confirmed on devnet and the
  agent's token balance drops by exactly the quoted total.
- status: open

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
