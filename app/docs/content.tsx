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
            Stipend gives an AI agent its own wallet and a spending policy enforced{' '}
            <strong>between the price quote and the signature</strong>. The agent buys what it needs
            one call at a time; each purchase settles on Solana devnet in about a tenth of a second
            and leaves a receipt anyone can open in an explorer.
          </>,
        )}
        {note(
          <>
            Throughout these docs, <code>STIPEND_URL</code> means the console URL you were given.
            Everywhere you see it, substitute yours.
          </>,
        )}
        {h('The two guarantees')}
        {list([
          <>
            <strong>A refusal is not a failure.</strong> The policy runs before the transaction is
            built, so a blocked purchase is a signature that was never produced — and the record says
            why.
          </>,
          <>
            <strong>Settlement is the authorisation.</strong> The vendor re-reads the payee&apos;s
            balance on chain before it returns a byte. No account, no API key, no billing table.
          </>,
        ])}
        {h('What it is not')}
        {list([
          'Not a router — nothing picks a vendor for you. Your agent decides what to buy.',
          'Not your model provider. DeepSeek, OpenAI and Anthropic already bill per call and cap spend; Stipend sits below them, on the vendors that will not sell you one call.',
          'Not a custodian of value. The demo stablecoin is minted by the treasury and worth nothing.',
        ])}
        {h('When you do not need it')}
        {p(
          'If your agent only ever calls one vendor, that vendor already bills per call, and its own spend limit is enough — keep what you have. Stipend earns its place when the vendor count rises, when a vendor will not sell you a single call, or when you want one budget and one audit trail across all of them.',
        )}
        {h('The pieces')}
        {list([
          <><strong>Agent</strong> — a keypair, a token account, two keys, and a policy.</>,
          <><strong>Vendors</strong> — paid endpoints that answer 402 without proof and 200 after verification.</>,
          <><strong>Wallet service</strong> — /api/agents/:id/authorize, the only place a signature exists.</>,
          <><strong>Console</strong> — status, runs, limits, ledger, and the setup prompt for your own agent.</>,
        ])}
        {note(
          <>
            Start with <Link href="/docs/get-started">Get started</Link>, or read{' '}
            <Link href="/docs/how-it-works">How a payment works</Link> first.
          </>,
        )}
      </>
    ),
  },
  {
    slug: 'get-started',
    title: 'Get started',
    summary: 'Two ways in: connect your own agent, or try the demo agent.',
    body: (
      <>
        {p('You do not install anything to use Stipend. Everything below happens in the console.')}
        {note(
          'This runs on Solana devnet. The money is test money: it is minted for the demo and has no value. Nothing here touches a real card or a bank account.',
        )}
        {h('1 · Open the console')}
        {p(
          'Go to https://stipend-delta.vercel.app and choose Create your agent. You will be asked for a name, a per-call cap and a daily budget.',
        )}
        {note(
          'The limits are yours to set. Stipend imposes no ceiling — type any amount you are willing to lose. The only hard limit is that an agent cannot spend more than it holds.',
        )}
        {h('2 · Set the limits')}
        {list([
          <><strong>Per-call cap</strong> — the most a single purchase may cost. A $0.10 cap refuses a $5.00 vendor.</>,
          <><strong>Daily budget</strong> — a rolling 24-hour ceiling. When it is used up, the agent stops being able to buy.</>,
          <><strong>Payee allowlist</strong> — optional; restrict which vendors may be paid at all.</>,
        ])}
        {p('These are checked before a signature exists. Lowering them is the fastest way to see the product work.')}
        {h('3 · Fund the agent')}
        {p(
          'Press Add 25 dUSD in the Agent panel. That mints demo stablecoin from the treasury into the agent’s wallet, and it appears in the ledger as a funded row — money entering the account is as visible as money leaving it.',
        )}
        {h('4 · Use it from your own agent')}
        {p(
          'That is the real path. Your own agent — Claude Code, Cursor, opencode, anything that can add tools — buys through Stipend and pays from this agent’s wallet. The console page for your agent shows the three steps and a block of text to paste. Every purchase it makes appears in the ledger below with its price and a link to the transaction.',
        )}
        {h('5 · Or try the demo agent')}
        {p(
          'The demo agent is a shared sandbox for seeing the flow without setting anything up. Press Run pipeline and it buys three services it does not control:',
        )}
        {code(`Signal Search   live public discussion for the goal     $0.04
Summariser      decision-grade notes                      $0.06
Brief Writer    a one-page memo                            $0.08`)}
        {p(
          'Each step is a real 402 → authorize → retry handshake. When it finishes, the ledger has three receipts with explorer links, and the memo is on screen.',
        )}
        {h('6 · Prove the cap')}
        {p(
          'Set the per-call cap to $0.05 and run the demo again. The $0.04 call settles; the $0.06 and $0.08 calls are refused with the reason, and no signature is produced. Nothing is charged for a refusal, because the money never moves.',
        )}
        {h('7 · If something is refused')}
        {p(
          <>
            A refused purchase is not an error. It means the policy said no, and nothing was signed.
            See <Link href="/docs/troubleshooting">When a payment is refused</Link> for each reason
            and what to change.
          </>,
        )}
      </>
    ),
  },
  {
    slug: 'how-it-works',
    title: 'How a payment works',
    summary: 'The three-step handshake, what the vendor verifies, and where enforcement happens.',
    body: (
      <>
        {p(
          'Every purchase is the same three steps. The agent performs the first and the third; the middle one is the wallet service, and it is the only place a signature exists.',
        )}
        {code(`agent                       vendor                    wallet service
  │  POST /api/paid/X ─────────▶ │                            │
  │ ◀──── 402 + price ────────── │                            │
  │  POST /api/agents/:id/authorize ──────────────────────────▶ │
  │        (owner key)                                         │  1 allowlist
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
        {code('stipend:v1:svc=market-intel:amt=40000:run=49ae9fa6')}
        {p(
          'Service, amount in base units, and the run id — readable on any explorer without our help. The transfer and the receipt are the same transaction.',
        )}
        {h('Why the treasury pays the fee')}
        {p(
          'The agent holds only the stablecoin; the treasury sponsors every fee. That is what makes a four-cent sale net four cents, and it means an agent can never be stranded with tokens it cannot move.',
        )}
        {h('What an agent cannot do')}
        {list([
          'Raise its own cap — policy edits are an operator action.',
          'Spend outside the allowlist.',
          'Replay a settlement.',
          'Move tokens it was not given.',
        ])}
      </>
    ),
  },
  {
    slug: 'integration',
    title: 'Connect your agent',
    summary: 'Three ways to attach a real agent: a prompt, an MCP config, or raw HTTP.',
    body: (
      <>
        {p('Each agent has two keys, and they are not interchangeable:')}
        {list([
          <><strong>Owner key</strong> (stp_…) — the agent presents it to spend; it also opens your console with full control. Keep it private.</>,
          <><strong>View key</strong> (stp_view_…) — opens the same console read-only. Safe to share: it cannot spend, edit limits, or reveal the owner key.</>,
        ])}
        {h('Option 1 — paste a prompt (recommended)')}
        {p(
          'The console prints a prompt pre-filled with your keys. Give it to any tool-capable agent and it configures the MCP server itself:',
        )}
        {code(`Add a tool server called "stipend" to my MCP configuration.

Transport: stdio
Command: node
Args: ["/path/to/mcp/stipend-mcp.mjs"]
Environment:
  STIPEND_URL=https://stipend-delta.vercel.app
  STIPEND_AGENT_ID=<your agent id>
  STIPEND_AGENT_TOKEN=<your owner key>

It provides four tools: agent_status, buy_signals, buy_notes, buy_brief.
Call agent_status first when you are unsure about budget. If a call is refused,
do not retry it — report the refusal reason instead.`)}
        {h('Option 2 — MCP config')}
        {code(`{
  "mcpServers": {
    "stipend": {
      "command": "node",
      "args": ["/path/to/mcp/stipend-mcp.mjs"],
      "env": {
        "STIPEND_URL": "https://stipend-delta.vercel.app",
        "STIPEND_AGENT_ID": "<your agent id>",
        "STIPEND_AGENT_TOKEN": "<your owner key>"
      }
    }
  }
}`)}
        {p(
          'The server is one dependency-free file. It makes no network calls except to the deployment URL and holds no key material of its own.',
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
          'Copy the read-only link from the Agent panel (/app?view=…). It opens one agent’s dashboard and nothing else: no spending, no limit edits, no owner key, no other agents. The owner link (/app?token=…) keeps full control — treat it like the money it can move.',
        )}
      </>
    ),
  },
  {
    slug: 'use-cases',
    title: 'Use cases',
    summary: 'Six things an agent can buy per call that it could not buy at all before.',
    body: (
      <>
        {p(
          'Every case below has the same shape: a vendor that would normally require an account, a card on file, and a plan you cannot cancel per call.',
        )}
        {h('1 · Pricing and positioning research')}
        {p(
          'An agent asked to write a launch memo buys live discussion about the category, distils it into notes, and writes the memo. About $0.18 for the whole run, versus a research seat per month.',
        )}
        {h('2 · Competitive monitoring')}
        {p(
          'A scheduled agent checks what changed in competitors’ public pricing and release notes once a day. At four cents a check, a month of daily monitoring costs about $1.20 — cheaper than one seat, and no account with any site it reads.',
        )}
        {h('3 · Due diligence on a token or a market')}
        {p(
          'Before an agent acts on a market view, it buys current signal and a summary rather than trusting a model’s memory. The receipt is the provenance: you can show exactly what it read and when.',
        )}
        {h('4 · Enriching a dataset, one record at a time')}
        {p(
          'A pipeline needs an OCR pass, a page render, or a classification per row. Per-record purchase means you pay for the rows you process, and a failure stops at one record instead of burning a monthly quota.',
        )}
        {h('5 · Incident triage')}
        {p(
          'An on-call agent buys a summary of what changed on a status page and a search for whether others see the same failure. Two cents of data at 3am, instead of a human tabbing through dashboards.',
        )}
        {h('6 · Giving a non-human buyer an actual budget')}
        {p(
          'Any workflow where you want an agent to spend — but only inside limits you set, with a record of every refusal — is the same shape. The vendor does not matter; the control does.',
        )}
      </>
    ),
  },
  {
    slug: 'best-practices',
    title: 'Best practices',
    summary: 'How to set limits, read refusals, and keep an agent from going wrong.',
    body: (
      <>
        {h('Set limits you would be comfortable losing')}
        {p(
          'The right daily budget is the amount you would not mind losing to a bug. The right per-call cap is the most you would pay for one answer without checking.',
        )}
        {list([
          'Trying the product — $0.10 a call, $1.00 a day.',
          'A working agent — $0.25 a call, $10 a day.',
          'Budgeted monitoring — $0.50 a call, $50 a day.',
        ])}
        {note(
          'There is no ceiling imposed by Stipend. There is also no safety net beyond the caps you set: an agent with a $500 daily budget and a broken loop will spend $500.',
          'warn',
        )}
        {h('Treat a refusal as data, not an error')}
        {p(
          'A refused call means the policy did its job, and the reason names the exact limit. Two rules: never retry a refusal (it will be refused again), and report the reason to whoever set the limit — it is written for a human.',
        )}
        {h('Use the allowlist when the vendor list is known')}
        {p(
          'An allowlist turns “any vendor” into “these three, forever”. It is the cheapest protection against a prompt-injected agent deciding to buy from somewhere new.',
        )}
        {h('Ask for status before spending')}
        {p(
          'agent_status is free. An agent that checks its budget first avoids surprise refusals and half-finished tasks it cannot pay to complete.',
        )}
        {h('Do not top up reflexively')}
        {p(
          'If an agent keeps running out, the fix is usually a smaller task or a higher cap — not a bigger wallet. A wallet that refills itself hides the signal you need.',
        )}
        {h('Keep the view key for sharing')}
        {p(
          'The owner key can move money. Put it in the agent’s environment and nowhere else. Use the view key for dashboards, screenshots and teammates.',
        )}
        {h('Prove the refusal in a demo')}
        {p(
          'Nothing communicates the product faster than lowering the cap mid-demo and showing a purchase refused with a reason and no signature. Do it in every demo — it is the thesis in one click.',
        )}
      </>
    ),
  },
  {
    slug: 'tools',
    title: 'Tools',
    summary: 'The four MCP tools, what they cost, and what they return.',
    body: (
      <>
        {p(
          'The MCP server exposes four tools. Three spend money; one is free. Prices are per call and are enforced by the agent’s policy like any other purchase.',
        )}
        {h('agent_status — free')}
        {p(
          'Returns balance, per-call cap, daily cap, spend in the last 24 hours, calls left at the cap, and the price list. Call it before spending when unsure.',
        )}
        {code('{ }')}
        {h('buy_signals — $0.04')}
        {p(
          'Live public discussion for a query, fetched at call time. Returns up to six items with title, points, comment count, date and a discussion link — plus the transaction that paid for it.',
        )}
        {code('{ "query": "usage-based pricing for developer tools" }')}
        {h('buy_notes — $0.06')}
        {p(
          'Decision-grade notes distilled from the signals. Reuses the threads already bought in this session, so you do not pay twice for the same fetch. Returns three to five notes labelled with the engine that wrote them.',
        )}
        {code('{ "query": "how should we price per call?" }')}
        {h('buy_brief — $0.08')}
        {p('A one-page memo: recommendation first, then reasoning, then risk. 120 words or fewer.')}
        {code('{ "query": "should we move to usage-based pricing this quarter?" }')}
        {h('What a refusal looks like')}
        {p(
          'Every paid tool can return an error with a reason instead of data: “refused by policy: $5.00 is over the $0.10 per-call cap”. No money moved, no signature exists, and the ledger has a refused row.',
        )}
        {h('Chaining')}
        {p(
          'buy_notes and buy_brief use whatever was bought earlier in the session. A typical run is buy_signals → buy_notes → buy_brief: about $0.18 and a memo grounded in threads fetched in the last minute.',
        )}
      </>
    ),
  },
  {
    slug: 'api',
    title: 'HTTP API',
    summary: 'The four endpoints behind the product, for agents that do not speak MCP.',
    body: (
      <>
        {p(
          'All endpoints take and return JSON. Amounts are integer base units of the demo mint (6 decimals), so 40000 is $0.04.',
        )}
        {h('POST /api/paid/{serviceId}')}
        {p('The vendor. Without proof it challenges; with proof it verifies and answers.')}
        {code(`402 Payment Required
{
  "error": "payment required",
  "accepts": {
    "scheme": "exact", "network": "solana:devnet",
    "serviceId": "market-intel", "price": 40000,
    "payee": "4Nd1…", "mint": "4brU…"
  }
}

200 OK  (with x-payment)
{
  "serviceId": "market-intel", "engine": "fetch", "source": "live",
  "output": { "signals": [ … ] },
  "receipt": { "signature": "5j7s…", "slot": 519936076 }
}`)}
        {p('Errors: 401 unknown agent token, 402 unverified payment, 404 unknown service, 502 vendor failed after settlement.')}
        {h('POST /api/agents/{id}/authorize')}
        {p('The wallet service. Checks the policy, then signs. Requires x-agent-token for that agent.')}
        {code(`200 → { "header": "<base64 proof>", "signature": "…", "settleMs": 118, "price": 40000 }
403 → { "error": "refused by policy", "code": "per-call",
        "reason": "$5.00 is over the $0.10 per-call cap" }`)}
        {h('GET /api/agents/{id}/status')}
        {p('Free. What an agent checks before spending. Requires x-agent-token.')}
        {code(`{
  "agent": { "id": "8798951c", "name": "Atlas", "balance": 98320000, "policy": { … } },
  "spentToday": 1180000, "remainingToday": 48820000, "callsLeft": 1952,
  "services": [ { "id": "market-intel", "name": "Signal Search", "price": 40000 } ]
}`)}
        {h('PATCH /api/agents/{id}')}
        {p(
          'Change limits. Requires the owner key when one is presented; a view key is rejected with 403. Limits apply to the next purchase, never to one already signed.',
        )}
        {code('{ "perCallCap": 250000, "dailyCap": 25000000 }')}
        {h('Headers')}
        {list([
          <><code>x-agent-token</code> — the owner key. Identifies and authorises the agent.</>,
          <><code>x-payment</code> — base64 proof returned by authorize.</>,
          <><code>x-payment-required</code> — present on 402 responses; always “exact”.</>,
        ])}
      </>
    ),
  },
  {
    slug: 'policy',
    title: 'Policy',
    summary: 'The four checks, the order they run in, and what a refusal means.',
    body: (
      <>
        {p(
          'The policy is a pure function applied between the quote and the signature. It has no side effects and no network access, which is why it can be reasoned about.',
        )}
        {h('Order of checks')}
        {list([
          <><strong>Payee allowlist</strong> — when set, only these vendor ids may be paid.</>,
          <><strong>Per-call cap</strong> — a single purchase above this is refused.</>,
          <><strong>Rolling 24h budget</strong> — a purchase that would cross it is refused.</>,
          <><strong>Balance</strong> — the agent cannot spend tokens it does not hold.</>,
        ])}
        {p('The first failure wins and becomes the reason.')}
        {h('What a refusal is')}
        {p(
          'Not a failed transaction. No transaction is built, no fee is paid, and the signature does not exist. The ledger records a refused row with the reason, and the reason returns as data to the caller.',
        )}
        {code(`403 { "error": "refused by policy", "code": "per-call",
      "reason": "$5.00 is over the $0.10 per-call cap" }`)}
        {p('Codes: not-allowed, per-call, daily, balance.')}
        {h('Editing limits')}
        {p(
          'Limits are editable from the console at any time and apply to the next purchase, never to one already signed. An agent cannot edit its own limits — that is an operator action.',
        )}
        {h('Suggested starting points')}
        {list([
          'Exploration: $0.10 a call, $1.00 a day.',
          'Working agent: $0.25 a call, $10 a day.',
          'Budgeted monitoring: $0.50 a call, $50 a day.',
          'There is no ceiling imposed by the product. The only hard limit is the agent’s balance.',
        ])}
      </>
    ),
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    summary: 'The failures that actually happen, and what each one means.',
    body: (
      <>
        {h('A step says “computed deterministically”')}
        {p(
          'No model key on the instance, or the model call failed — the step note names the reason verbatim. The fallback exists so a run never dies mid-demo, but it is always labelled.',
        )}
        {h('A call was refused')}
        {p(
          'That is the product working. The row gives the exact limit in words. Raise the limit in Limits if the purchase was legitimate; an agent cannot raise it for itself.',
        )}
        {h('The signal vendor shows “cached snapshot”')}
        {p(
          'The live source was unreachable, so a cached set was served and labelled. It never claims a fetch it did not make. Re-run when the network is back.',
        )}
        {h('Settlement is slow')}
        {p(
          'The public devnet RPC throttles under load. 100–300ms is normal; multi-second confirms mean throttling. A dedicated RPC endpoint removes the ceiling.',
        )}
        {h('A view link will not let me change anything')}
        {p(
          'Correct — that is the read-only key. Use the owner link (/app?token=…) to edit limits and spend.',
        )}
        {h('The ledger is empty but the agent has a balance')}
        {p(
          'The balance is the wallet; the ledger only records events. A funded agent with no runs has an empty ledger until its first purchase.',
        )}
        {h('“Funding required” on first load')}
        {p(
          'The demo instance needs devnet SOL for fees and the public RPC faucet is closed. The gate shows the treasury address; whoever operates the instance funds it once, then everything else builds itself.',
        )}
      </>
    ),
  },
];
