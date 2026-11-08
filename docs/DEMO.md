# Demo script — 90 seconds

Record at 1440 wide. Everything below is real; do not narrate anything the screen does not show.

| Time | Shot | What you say |
| --- | --- | --- |
| 0:00 | Landing `/`, first viewport | "An agent that buys data with your card is an agent you cannot audit. Stipend gives it a wallet, a budget, and a receipt for every purchase." |
| 0:12 | Scroll to the arithmetic strip | "A card charges thirty cents plus 2.9%, so selling four cents of data loses money. Solana charges five thousand lamports — which is the only reason per-call pricing exists." |
| 0:22 | Scroll to the proof panel | "Same three purchases: eighteen cents collected, nine hundred thousandths of a cent in fees, versus ninety-one cents on cards." |
| 0:32 | Click **Create your agent** → name it → set the cap to $0.10 | "Two limits are the whole product: a per-call cap and a daily budget. They are checked before anything is signed." |
| 0:45 | Step three: wallet, token, **Add 25 dUSD** | "It gets a wallet, an API token, and a funded balance. The token is not an LLM key — it only authorises spending from this wallet." |
| 0:55 | **Open the console** | "This is the console. Status, the job, run history, limits, and the ledger." |
| 1:00 | Click **Run pipeline** | "The agent asks a vendor. It gets a 402. It authorises the payment against the caps. It retries with proof." |
| 1:12 | Let one step settle, point at the receipt | "Four cents, settled in a hundred milliseconds. The vendor re-read the chain before it answered. That link opens the transaction." |
| 1:22 | Point at the memo line | "This is the memo receipt: service, amount, run id — self-describing on chain." |
| 1:30 | Set per-call cap to $0.05, click **Run pipeline** | "Now I lower the cap below two of the prices." |
| 1:38 | Let it refuse | "The four-cent call settles. The six and eight cent calls are refused — no signature, and the reason is in the ledger." |
| 1:48 | Scroll the ledger | "Every payment and every refusal, newest first, each with the balance after and the explorer link." |
| 1:56 | Close | "Stipend. Your agent gets a budget, not your keys." |

## Before you record

1. `pnpm build && pnpm start` (not `pnpm dev` — the HMR socket is blocked on this machine).
2. Fresh agent from `/start` so the console shows a clean balance and an empty ledger.
3. Confirm the header shows `DEEPSEEK/DEEPSEEK-CHAT`; if it says `no model key`, the `.env` did not
   load and the reasoning will be deterministic.
4. Open one explorer link beforehand to confirm devnet is responsive.
5. Check the Run pipeline step 1 says `fetched from the live source` — if it says `cached snapshot`,
   the network is down and you should re-run before recording.
