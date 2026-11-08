'use client';

import { useState } from 'react';
import type { ChainSnapshot, PublicAgent } from '../types';
import { shortAddress, usd } from '../types';

interface Props {
  agent: PublicAgent;
  snapshot?: ChainSnapshot;
  baseUrl: string;
  onFund?: () => void;
  funding?: boolean;
}

function Copy({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="switch"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

/** Identity and the exact handshake an agent uses to spend from this account. */
export function AgentPanel({ agent, snapshot, baseUrl, onFund, funding }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const snippet = `// 1 · ask the vendor (no payment yet) — you get a 402
const ask = await fetch('${baseUrl}/api/paid/market-intel', {
  method: 'POST',
  headers: { 'x-agent-token': TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'ai observability pricing' }),
});

// 2 · authorise it against your caps. 403 means the policy refused it.
const quote = (await ask.json()).accepts;
const auth = await fetch('${baseUrl}/api/agents/${agent.id}/authorize', {
  method: 'POST',
  headers: { 'x-agent-token': TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({ serviceId: quote.serviceId }),
});
if (!auth.ok) throw new Error((await auth.json()).reason);
const { header } = await auth.json();

// 3 · retry with proof. The vendor re-reads the chain, then returns data.
const paid = await fetch('${baseUrl}/api/paid/market-intel', {
  method: 'POST',
  headers: {
    'x-agent-token': TOKEN,
    'x-payment': header,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ query: 'ai observability pricing' }),
});
const { output, receipt } = await paid.json();`;

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Agent</h2>
        <span className="card__note">{agent.demo ? 'demo' : 'yours'}</span>
      </div>

      <dl className="facts">
        <div>
          <dt>Name</dt>
          <dd>{agent.name}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{usd(snapshot?.agent.tokensRaw ?? agent.tokensRaw ?? 0)}</dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd className="facts__mono">
            {shortAddress(agent.address, 8)}
            <Copy value={agent.address} label="Copy" />
          </dd>
        </div>
        <div>
          <dt>API token</dt>
          <dd className="facts__mono">
            {revealed ? agent.token : `${agent.token.slice(0, 7)}${'•'.repeat(12)}`}
            <button className="switch" onClick={() => setRevealed((value) => !value)}>
              {revealed ? 'Hide' : 'Reveal'}
            </button>
            <Copy value={agent.token} label="Copy" />
          </dd>
        </div>
        <div>
          <dt>Caps</dt>
          <dd>
            {usd(agent.policy.perCallCap)} a call · {usd(agent.policy.dailyCap)} a day
          </dd>
        </div>
        <div>
          <dt>Allowlist</dt>
          <dd>
            {agent.policy.allowlist.length > 0 ? agent.policy.allowlist.join(', ') : 'any vendor'}
          </dd>
        </div>
        <div>
          <dt>Mint</dt>
          <dd className="facts__mono">
            {shortAddress(snapshot?.mint ?? '', 6)}
            {snapshot?.mint && <Copy value={snapshot.mint} label="Copy" />}
          </dd>
        </div>
      </dl>

      <div className="agentpanel__fund">
        <button className="key key--go key--wide" onClick={onFund} disabled={funding || !onFund}>
          {funding ? 'Funding…' : 'Add 25 dUSD'}
        </button>
        <p className="agentpanel__fundnote">
          Mints demo stablecoin from the treasury into this agent&apos;s wallet. It lands in the
          ledger as a <span className="mono">funded</span> row, so the balance never changes without
          a record.
        </p>
      </div>

      <button className="wire__summary agentpanel__toggle" onClick={() => setShowCode((v) => !v)}>
        {showCode ? '− ' : '+ '}Connect your agent
      </button>
      {showCode && (
        <>
          <pre className="wire__body">{snippet}</pre>
          <p className="wire__note">
            Swap <span className="mono">TOKEN</span> for the API token above. Your model provider key
            never goes anywhere near this — this token only authorises spending from this agent&apos;s
            wallet, and only inside the caps.
          </p>
        </>
      )}
    </section>
  );
}
