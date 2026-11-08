import Link from 'next/link';

export interface DocPage {
  slug: string;
  title: string;
  summary: string;
  body: React.ReactNode;
}

const code = (text: string) => <pre className="docs__code">{text}</pre>;
const p = (text: React.ReactNode) => <p className="docs__p">{text}</p>;
const h = (text: string) => <h2 className="docs__h2">{text}</h2>;
const list = (items: React.ReactNode[]) => (
  <ul className="docs__ul">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);
const note = (text: React.ReactNode, tone?: 'warn') => (
  <div className={`docs__callout${tone ? ` docs__callout--${tone}` : ''}`}>{text}</div>
);

export const DOCS: DocPage[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    summary: 'What Stipend is, what it is not, and the two guarantees behind it.',
    body: (
      <>
        {p(
          <>
            Stipend gives an AI agent its own wallet and a spending policy that is enforced{' '}
            <strong>between the price quote and the signature</strong>. The agent buys what it needs
            one call at a time; each purchase settles on Solana devnet in about a tenth of a second
            and leaves a receipt anyone can open in an explorer.
          </>,
        )}

        {h('The two guarantees')}
        {list([
          <>
            <strong>A refused purchase is a signature that was never produced.</strong> The policy
            runs before the transaction is built, so a blocked call moves no money and leaves a
            record saying why.
          </>,
          <>
            <strong>Settlement is the authorisation.</strong> The vendor re-reads the payee&apos;s
            token balance on chain before it returns a byte. There is no account, no API key and no
            billing table to reconcile.
          </>,
        ])}

        {h('What it is not')}
        {list([
          'Not a router — nothing picks a vendor for you. Your agent decides what to buy.',
          "Not your model provider. DeepSeek, OpenAI and Anthropic already bill per call and already cap spend; Stipend sits below them, on the vendors that will not sell you one call.",
          'Not a custodian of value. The demo stablecoin is minted by the treasury and worth nothing.',
        ])}

        {h('The pieces')}
        {list([
          <>
            <strong>Agents</strong> — a keypair, a token account, an API token, and a policy.
          </>,
          <>
            <strong>Vendors</strong> — paid endpoints that answer <code>402</code> without proof and{' '}
            <code>200</code> after verification.
          </>,
          <>
            <strong>The wallet service</strong> — <code>/api/agents/:id/authorize</code>. The only
            place a signature can be produced.
          </>,
          <>
            <strong>The console</strong> — status, runs, limits, ledger, and the setup snippet for
            your own agent.
          </>,
        ])}

        {note(
          <>
            Start with <Link href="/start">Create your agent</Link>, or read{' '}
            <Link href="/docs/how-it-works">How a payment works</Link> first.
          </>,
        )}
      </>
    ),
  },
  {
    slug: 'how-it-works',
    title: 'How a payment works',
    summary: 'The three-step handshake, and where enforcement actually happens.',
    body: (
      <>
        {p(
          'Every purchase is the same three steps. The agent only performs the first and the third; the middle one is the wallet service, and it is the only place a signature exists.',
        )}
        {code(`agent                       vendor                    wallet service
  │  POST /api/paid/X ─────────▶ │                            │
  │ ◀──── 402 + price ────────── │                            │
  │  POST /api/agents/:id/authorize ──────────────────────────▶ │
  │        (x-agent-token)                                     │  1 allowlist
  │                                                           │  2 per-call cap
  │                                                           │  3 daily budget
  │ ◀──── payment header ───────────────────────────────────── │  sign + confirm
  │  POST /api/paid/X  (x-payment) ─▶ │                        │
  │                                    │ verify balance delta │
  │ ◀──── 200 + output + receipt ───── │                      │`)}
        {h('What the vendor checks')}
        {p(
          'It does not trust the client. It reads the transaction off devnet, sums the payee’s holdings of the mint before and after, and requires the delta to be at least the quoted amount. It also rejects a signature it has already seen, so a payment cannot be replayed for a second call.',
        )}
        {h('What the receipt contains')}
        {p(
          'A memo instruction travels with the transfer:',
        )}
        {code('stipend:v1:svc=market-intel:amt=40000:run=49ae9fa6')}
        {p(
          'Service, amount in base units, and the run id — readable on any explorer without our help. The transfer and the receipt are the same transaction.',
        )}
        {h('Why the treasury pays the fee')}
        {p(
          'The agent holds only the stablecoin; the treasury sponsors every transaction fee. That is what makes a four-cent sale net four cents instead of being eaten by the buyer’s SOL balance. It also means the agent cannot be stranded with tokens it cannot move.',
        )}
      </>
    ),
  },
  {
    slug: 'quickstart',
    title: 'Quickstart',
    summary: 'From clone to a settled payment in five minutes.',
    body: (
      <>
        {code(`pnpm install
cp .env.example .env        # DEEPSEEK_API_KEY is optional
pnpm build && pnpm start    # http://127.0.0.1:4310`)}
        {note(
          <>
            Use <code>pnpm build && pnpm start</code>, not <code>pnpm dev</code>. On machines behind
            a proxy that blocks Next&apos;s HMR websocket, dev mode never hydrates. See{' '}
            <Link href="/docs/troubleshooting">Troubleshooting</Link>.
          </>,
          'warn',
        )}
        {h('1 · Fund the fee wallet once')}
        {p(
          'The public devnet RPC faucet is closed, so the app shows a funding gate with the treasury address on first load. Send it ~0.5 devnet SOL from faucet.solana.com. After that the mint, wallets and accounts build themselves.',
        )}
        {h('2 · Create an agent')}
        {p(
          'Open /start, name it, set a per-call cap and a daily budget. You get back a wallet address, an API token and a console scoped to that agent. Press Add 25 dUSD to give it runway.',
        )}
        {h('3 · Run it')}
        {p(
          'In the console, press Run pipeline. The agent buys three services, each one a real 402 handshake, and the ledger fills with receipts you can open.',
        )}
        {h('4 · Prove the cap')}
        {p(
          'Set the per-call cap to $0.05 and run again. The $0.04 call settles; the $0.06 and $0.08 calls are refused with the reason and no signature.',
        )}
        {h('5 · Hand it to your own agent')}
        {p(
          <>
            Copy the prompt from the Agent panel into Claude Code, Cursor or opencode. See{' '}
            <Link href="/docs/integration">Integration</Link>.
          </>,
        )}
      </>
    ),
  },
  {
    slug: 'integration',
    title: 'Integration',
    summary: 'Three ways to attach a real agent: a prompt, an MCP config, or raw HTTP.',
    body: (
      <>
        {p(
          'The API token is not an LLM key. It never touches your model provider. It identifies one agent to the vendors and to the wallet service, and it can only authorise spending inside that agent’s caps.',
        )}
        {h('Option 1 — paste a prompt (recommended)')}
        {p(
          'The console prints a pre-filled prompt. Give it to any tool-capable agent and it installs the MCP server itself:',
        )}
        {code(`Add a tool server called "stipend" to my MCP configuration.
Transport: stdio
Command: node
Args: ["/absolute/path/to/mcp/stipend-mcp.mjs"]
Environment: STIPEND_URL, STIPEND_AGENT_ID, STIPEND_AGENT_TOKEN`)}
        {h('Option 2 — MCP config')}
        {code(`{
  "mcpServers": {
    "stipend": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/stipend-mcp.mjs"],
      "env": {
        "STIPEND_URL": "http://127.0.0.1:4310",
        "STIPEND_AGENT_ID": "<id>",
        "STIPEND_AGENT_TOKEN": "<stp_...>"
      }
    }
  }
}`)}
        {p(
          'Tools exposed: agent_status, buy_signals, buy_notes, buy_brief. The 402 handshake happens inside the server, so your agent sees a tool result and a receipt.',
        )}
        {h('Option 3 — raw HTTP')}
        {code(`// 1 · ask; a 402 comes back with a price
POST /api/paid/market-intel
  x-agent-token: stp_...

// 2 · authorise against the caps; 403 means refused
POST /api/agents/<id>/authorize
  x-agent-token: stp_...
  { "serviceId": "market-intel" }
→ { "header": "<base64 payment>", "signature": "...", "settleMs": 118 }

// 3 · retry with proof
POST /api/paid/market-intel
  x-agent-token: stp_...
  x-payment: <header>`)}
        {h('Sharing a dashboard')}
        {p(
          'The token doubles as a read-only console key: /app?token=stp_... opens exactly that agent’s dashboard, with spending, limit edits and every other agent hidden. Copy the link from the Agent panel.',
        )}
      </>
    ),
  },
  {
    slug: 'policy',
    title: 'Policy',
    summary: 'The three limits, the order they run in, and what a refusal means.',
    body: (
      <>
        {p(
          'The policy is a pure function, applied between the quote and the signature. It has no side effects and no network access, which is why it can be reasoned about.',
        )}
        {h('Order of checks')}
        {list([
          <>
            <strong>Payee allowlist</strong> — when set, only these vendor ids may be paid.
          </>,
          <>
            <strong>Per-call cap</strong> — a single purchase above this is refused.
          </>,
          <>
            <strong>Rolling 24h budget</strong> — a purchase that would cross it is refused.
          </>,
          <>
            <strong>Balance</strong> — the agent cannot spend tokens it does not hold.
          </>,
        ])}
        {h('What a refusal is')}
        {p(
          'It is not a failed transaction. No transaction is built, no fee is paid, and the signature does not exist. The ledger records a `refused` row with the reason, and — for an agent calling through MCP or HTTP — the reason comes back as data the agent can relay to a human.',
        )}
        {code(`403 { "error": "refused by policy",
      "code": "per-call",
      "reason": "$5.00 is over the $0.10 per-call cap" }`)}
        {h('What an agent cannot do')}
        {list([
          'Raise its own cap — policy edits are an operator action in the console.',
          'Spend outside the allowlist.',
          'Replay a settlement: a signature already used for one call is rejected.',
          'Move tokens it was not given.',
        ])}
        {h('Suggested starting points')}
        {list([
          'Exploration: $0.10 a call, $1.00 a day — enough for ~20 purchases.',
          'Production-ish: $0.25 a call, $10 a day, with an allowlist of the vendors you have reviewed.',
          'Never: a cap you would not be comfortable seeing hit every day, on its own.',
        ])}
      </>
    ),
  },
  {
    slug: 'operations',
    title: 'Operations',
    summary: 'Reading the console, funding an agent, and what the numbers mean.',
    body: (
      <>
        {h('The status strip')}
        {list([
          'Spent today / budget left — the rolling window the policy uses.',
          'Agent balance — stablecoin held by this agent right now.',
          'Paid calls and refused calls — refusals are first-class, not errors.',
          'Settle time — median sign-to-confirmed latency for this agent.',
          'Errors — calls that failed for reasons other than the policy.',
        ])}
        {h('The ledger')}
        {p(
          'One row per event: time, service, amount, decision, balance after, and a receipt link. `settled` rows carry a signature; `refused` rows say why and show “not signed”; `funded` rows are top-ups, so money entering the account is as visible as money leaving it.',
        )}
        {h('Funding an agent')}
        {p(
          'Add 25 dUSD mints demo stablecoin from the treasury into the agent’s wallet. On a real deployment this would be a transfer from your own wallet, and the ledger row would look the same.',
        )}
        {h('Run history')}
        {p(
          'Runs are derived from the ledger, grouped by run id, so the list survives a server restart. A run shows how many calls settled, how many were refused, and the total spend.',
        )}
        {h('Latency expectations')}
        {p(
          'Settlement is typically 100–300ms on devnet. The public RPC occasionally takes several seconds under load; the client retries with backoff rather than reporting a failure. Model-written steps add 5–12 seconds because the model reasons before it answers.',
        )}
      </>
    ),
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    summary: 'The five things that actually go wrong, and what each one means.',
    body: (
      <>
        {h('“The page is stuck on Connecting to devnet”')}
        {p(
          'You are running `pnpm dev` and the page never hydrated. Next’s HMR websocket is being blocked (common behind a corporate proxy). Use `pnpm build && pnpm start`.',
        )}
        {h('“Funding required” on first load')}
        {p(
          'The devnet RPC faucet is closed (`410 Gone`), so nothing can airdrop itself. Send devnet SOL to the treasury address shown on the gate, once, then press check again.',
        )}
        {h('A step says “computed deterministically”')}
        {p(
          'No model key, or the model call failed — the step note names the reason verbatim. Check `DEEPSEEK_API_KEY` in `.env` and restart. The fallback exists so a demo never dies, but it is always labelled.',
        )}
        {h('A call was refused')}
        {p(
          'That is the product working. The row gives the exact limit: per-call cap, daily budget, allowlist, or balance. Raise the limit in Limits if the purchase was legitimate — an agent cannot raise it for itself.',
        )}
        {h('The signal vendor shows “cached snapshot”')}
        {p(
          'The live source was unreachable, so a cached set was served and labelled. It never claims a fetch it did not make. Re-run when the network is back to get live results.',
        )}
        {h('Everything is slow')}
        {p(
          'The public devnet RPC rate-limits under load. A dedicated Helius or QuickNode devnet URL in `HELIUS_RPC_URL` removes the ceiling.',
        )}
      </>
    ),
  },
];
