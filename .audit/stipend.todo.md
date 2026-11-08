# stipend

Spec: .audit/specs/stipend.md
Tickets: .audit/specs/stipend.tickets.md
Playbook: C:\Users\User\.agents\playbooks\build.md
Status: 4 Build (T3 next)

## Spine
- [x] 1 Grill (decisions taken in chat: direction, keys, submission standing)
- [x] 2 Spec
- [x] 3 Tickets
- [ ] 4 Build — T0, T1, T2 done; T3, T4, T5 open
- [ ] 5 Review
- [ ] 6 PR (no remote: submission writeup plays this role)
- [ ] 7 Retro (optional)

## Frontier
- T3 Detector clean and two-viewport evidence (open)
- T4 End-to-end devnet proof (open, blocked on external treasury funding)
- T5 README, submission writeup, demo script (open)

## Log
- 2026-11-08 09:40 T0 typecheck exit 0. Note: T0's source landed inside the trail commit
  (38bd093) by mistake — the playbook says code must not ride in a trail commit. Code subject
  corrected in the next commit; rule kept from here on.
- 2026-11-08 10:10 verify: `tsc --noEmit` exit 0; `next build` exit 0 (Compiled successfully in
  726ms, Finished TypeScript, 3/3 static pages). T0 accepted.
- 2026-11-08 10:10 T1 committed (e420d0c). Verified: `STIPEND_FIXTURE=1` → `/api/state` 200,
  `fixture: true`, 4 ledger entries, snapshot + completed run returned.
- 2026-11-08 10:10 T2 committed (e420d0c). Verified: dashboard renders the coin-op world at 1440
  in production mode (screenshot reviewed), first viewport shows the meter, pay slot and coin
  return. Detector and mobile capture still owed → T3.
- 2026-11-08 note: `pnpm dev` cannot hydrate on this machine (proxy blocks Next's HMR websocket);
  all visual verification runs against `next build && next start`.
