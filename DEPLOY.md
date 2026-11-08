# Deploy

Two things make a deployed instance different from this machine, and both are handled:

1. **No writable disk.** Wallet keys, agents and the ledger live in Upstash Redis when its credentials are present, and in `.devnet/` locally. `lib/persist.ts` is the only thing that knows which.
2. **No browser login for the operator.** You deploy, then set the environment variables below in the host's dashboard.

## 1 · Create the database (2 minutes, free)

1. Go to [upstash.com](https://upstash.com) → **Create Database** → any region near your users → free tier.
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the REST API section.

> On Vercel you can also do this from **Storage → Upstash → Connect**, which injects
> `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Both names work.

## 2 · Deploy

```bash
vercel login                 # once, in a browser
vercel link                  # links this folder to a project
vercel env add DEEPSEEK_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel --prod
```

`vercel login` is interactive — it opens a browser and asks you to approve. It cannot be scripted
from an agent session; that is the one step a human has to run.

## 3 · First load

The instance bootstraps itself on the first request: it generates a treasury, creates the demo mint,
creates provider accounts and seeds the demo agent. Then it shows the funding gate, because the
devnet RPC faucet is closed.

- Send ~0.5 devnet SOL to the treasury address shown on the gate ([faucet.solana.com](https://faucet.solana.com)).
- Press "check again". From that moment the agents can settle.
- `/app?token=…` is the owner console; `/app?view=…` is the read-only link.

## Environment variables

| Variable | Required | Why |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | yes, in production | persistence |
| `DEEPSEEK_API_KEY` | no | model reasoning; without it the vendors say "computed deterministically" |
| `HELIUS_RPC_URL` | recommended | public devnet RPC throttles under load |
| `LLM_MODEL` | no | defaults to `deepseek-flash` (V4.1 Flash) |

## What protects the model key

- It is read only inside route handlers. Nothing prefixed `NEXT_PUBLIC_`, and the production build
  is checked for it — the string appears in zero client bundles.
- Every model-backed vendor call is rate limited per caller (60/hour) and per vendor (240/hour),
  counted in Redis so the budget is shared across every serverless instance.
- Off-topic requests are rejected **before** the model is reached, so the key cannot be used as a
  general-purpose assistant.
- A run is capped at three model calls, so a loop cannot drain it.
- Errors never echo request headers, and the key is never logged.

## If you would rather not use Vercel

Any host with a persistent disk works with zero code changes: delete the Redis variables and the
app falls back to `.devnet/`. Railway, Render and Fly all provide a volume; Vercel does not.
