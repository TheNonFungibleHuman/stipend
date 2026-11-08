# stipend

Spec: .audit/specs/stipend.md
Tickets: .audit/specs/stipend.tickets.md
Playbook: C:\Users\User\.agents\playbooks\build.md
Status: 4 Build (T4 blocked on funding, T5 next)

## Spine
- [x] 1 Grill (decisions in chat: direction, keys, submission standing, product flow)
- [x] 2 Spec
- [x] 3 Tickets
- [ ] 4 Build — T0, T1, T2, T3, T7, T8, T9 done; T4 blocked externally, T5 open
- [ ] 5 Review
- [ ] 6 PR (no remote: submission writeup plays this role)
- [ ] 7 Retro (optional)

## Frontier
- T5 README, submission writeup, demo script (open)
- T4 End-to-end devnet proof (blocked: treasury needs 0.5 SOL — devnet faucet is GitHub-gated)

## Log
- 2026-11-08 09:40 T0 typecheck exit 0. T0's source landed inside the trail commit by mistake;
  corrected in the next commit and not repeated.
- 2026-11-08 10:10 verify: `tsc --noEmit` exit 0; `next build` exit 0. T0 accepted.
- 2026-11-08 10:10 T1 committed (e420d0c). Verified: `STIPEND_FIXTURE=1` → `/api/state` 200,
  `fixture: true`, 4 ledger entries, snapshot + completed run returned.
- 2026-11-08 10:10 T2 committed (e420d0c). Coin-op world renders at 1440; first viewport shows the
  meter, pay slot and coin return.
- 2026-11-08 10:50 T3 done. `impeccable detect app` → `[]` (zero findings, down from 3). Evidence:
  `.impeccable/review/desktop.png` (1440x2400) and `mobile.png` (390x4400), both captured from the
  production build and opened to confirm they show the dashboard.
- 2026-11-08 10:52 T7/T8/T9 committed (9025898). Verified: `/`, `/start`, `/app`, `/api/state` all
  200; landing leads with the mechanism and two working CTAs; onboarding creates a real agent
  record with a keypair, token and caps. Funding the agent still needs T4: in fixture mode the
  top-up returns the honest "treasury needs SOL" error and onboarding shows it.
- 2026-11-08 note: `pnpm dev` cannot hydrate on this machine (a proxy blocks Next's HMR websocket);
  every visual verification runs against `next build && next start`.

## Next
- T5: README + submission writeup + 90-second demo script.
- T4 the moment funding lands: flip off `STIPEND_FIXTURE`, run `pnpm smoke`, then a console run.
