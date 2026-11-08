# stipend

Spec: .audit/specs/stipend.md
Tickets: .audit/specs/stipend.tickets.md
Playbook: C:\Users\User\.agents\playbooks\build.md
Status: 4 Build (T5 next)

## Spine
- [x] 1 Grill (decisions in chat: direction, keys, submission standing, product flow)
- [x] 2 Spec
- [x] 3 Tickets
- [ ] 4 Build — T0–T4, T7–T12 done; T5 open
- [ ] 5 Review
- [ ] 6 PR (no remote: submission writeup plays this role)
- [ ] 7 Retro (optional)

## Frontier
- T5 README, submission writeup, demo script (open)

## Log
- 2026-11-08 09:40 T0 typecheck exit 0. T0's source landed inside the trail commit by mistake;
  corrected in the next commit and not repeated.
- 2026-11-08 10:10 verify: `tsc --noEmit` exit 0; `next build` exit 0. T0 accepted.
- 2026-11-08 10:10 T1 committed (e420d0c). `STIPEND_FIXTURE=1` → `/api/state` 200, ledger + run.
- 2026-11-08 10:50 T3 done. `impeccable detect app` → `[]`. Evidence in `.impeccable/review/`.
- 2026-11-08 10:52 T7/T8/T9 committed (9025898). `/`, `/start`, `/app`, `/api/state` all 200.
- 2026-11-08 11:05 **T4 done — treasury funded by the operator (2.49 SOL).** `pnpm smoke` settled a
  real transfer: sig 41G6i3Xe…, slot 519936076, memo `stipend:v1:svc=market-intel:amt=40000:run=…`,
  agent 24.96→24.92, provider 0.04→0.08, 117ms to confirm. Then a full run: 3/3 settled
  (112ms, 111ms, 8909ms), spend $0.18.
- 2026-11-08 11:12 **Cap refusal proven live.** Cap set to $0.05 → Market Intel ($0.04) settled;
  Summarizer ($0.06) and Brief Writer ($0.08) refused with "$0.06 is over the $0.05 per-call cap"
  and no signature. Cap restored to $0.10.
- 2026-11-08 11:30 T10/T11/T12 done. Four bugs found and fixed on the way:
  1. `cardFeeFor` charged $0.03 instead of $0.30 flat — understated the whole argument 30×.
  2. The brief-writer vendor 500'd when handed a summariser payload; runService now validates
     shape and falls back to the known dataset.
  3. `provisionAgent` minted free runway when an RPC read failed (balance read 0 ≠ no tokens).
     Reads now return null on failure and minting never happens on an unknown balance; runs no
     longer top up at all.
  4. Run history vanished on restart because it lived in memory. It is now derived from the ledger.
  5. Top-ups were invisible; they are now `funded` ledger rows.
  6. Scroll reveals hid all content below the hero until JS ran — sections are visible in the
     server HTML and only hide after mount.
- 2026-11-08 12:10 **Model key wired (operator-supplied).** `DEEPSEEK_API_KEY` in `.env`; verified
  `engine=model model=deepseek-chat` on the summariser and brief writer, and the memo is model
  prose citing the threads by name.
- 2026-11-08 12:15 **Synthetic dataset removed.** The signal vendor now fetches live public
  discussion (HN Algolia) at call time, derives its own queries from the goal, and reports
  `engine=fetch source=live` with 6 real results; a cached snapshot is served only when the source
  is unreachable and the step then says `cached`. FAQ, landing footer and README updated to match.
- 2026-11-08 12:20 UI fixes from review: ledger rebuilt as 5 columns so the explorer receipt is
  always visible (it was being clipped); top-up moved out of the header into the Agent panel as a
  real button with a consequence note; model name shown in the console header; `.switch` controls
  restyled to read as buttons.
- 2026-11-08 14:05 **Reasoning-budget bug (real AI failure).** `deepseek-flash` is DeepSeek-V4.1-Flash
  and is a *reasoning* model: reasoning tokens are drawn from `max_tokens`, so the 400-token calls
  returned empty `content` and silently fell back to the deterministic engine. Fixed: 2,500-token
  floor, `reasoning_effort: low`, and `llmLastError()` surfaced in the step note so a fallback can
  never look like a choice.
- 2026-11-08 14:20 **MCP tool server shipped and proven.** `mcp/stipend-mcp.mjs` (dependency-free,
  stdio): `agent_status`, `buy_signals`, `buy_notes`, `buy_brief`. Verified with
  `tools/mcp-smoke.mjs` — initialize, tools/list, and two real purchases ($0.04 + $0.06, one settled
  in 138ms with an explorer link, notes "written by DeepSeek V4.1 Flash"). Policy also proven through
  MCP: `refused by policy: would reach $1.04, over the $1.00 daily budget`. Token-authed
  `/api/agents/:id/status` added so the MCP never reads unauthenticated state. Docs in `docs/MCP.md`.
- 2026-11-08 14:40 **T13 shared read-only console.** `/app?token=stp_...` resolves one agent from its
  token and returns `readOnly: true` with other agents hidden; the console disables run, limits and
  funding, and the Agent panel hides the token itself. Verified: `readOnly=True agentsVisible=0`.
- 2026-11-08 14:50 **T14 docs site.** `/docs` + seven pages (Introduction, How a payment works,
  Quickstart, Integration, Policy, Operations, Troubleshooting) with a sticky sidebar, pager and
  anchored landing nav (Docs · How it works · FAQ · Console). All seven routes 200 and prerendered.
- 2026-11-08 note: `pnpm dev` cannot hydrate on this machine (a proxy blocks Next's HMR websocket);
  every visual verification runs against `next build && next start`.

## Next
- Record the demo (docs/DEMO.md) and paste the submission writeup.
- Optional: operator sessions so a shared instance can host several people.
