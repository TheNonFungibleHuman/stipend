'use client';

import { useState } from 'react';
import type { ChainSnapshot, PublicAgent } from '../types';
import { shortAddress, usd } from '../types';
import { agentPrompt } from '@/lib/prompt';

interface Props {
  agent: PublicAgent;
  snapshot?: ChainSnapshot;
  baseUrl: string;
  readOnly?: boolean;
  onFund?: () => void;
  funding?: boolean;
  onAllowlist?: (allowlist: string[]) => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
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

/** Identity, funding, and the three ways to hand this agent to a real runtime. */
export function AgentPanel({ agent, snapshot, baseUrl, readOnly, onFund, funding, onAllowlist }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [payee, setPayee] = useState('');
  const [tab, setTab] = useState<'prompt' | 'config' | 'http'>('prompt');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const ownerUrl = `${origin}/app?token=${agent.token}`;
  const viewUrl = `${origin}/app?view=${agent.viewToken}`;

  const prompt = agentPrompt({ origin, token: agent.token });

  const config = `{
  "mcpServers": {
    "stipend": {
      "url": "${origin}/api/mcp",
      "headers": {
        "Authorization": "Bearer ${agent.token}"
      }
    }
  }
}`;

  const http = `// 1 · ask the vendor (no payment yet) — you get a 402
const ask = await fetch('${baseUrl}/api/paid/market-intel', {
  method: 'POST',
  headers: { 'x-agent-token': TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'what are people saying about usage-based pricing' }),
});

// 2 · authorise it against the caps. 403 means the policy refused it.
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
  headers: { 'x-agent-token': TOKEN, 'x-payment': header, 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'what are people saying about usage-based pricing' }),
});
const { output, receipt } = await paid.json();`;

  const active = tab === 'prompt' ? prompt : tab === 'config' ? config : http;

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
            <CopyButton value={agent.address} label="Copy" />
          </dd>
        </div>
        <div>
          <dt>API token</dt>
          <dd className="facts__mono">
            {readOnly ? (
              <span className="agentpanel__muted">hidden in a shared view</span>
            ) : (
              <>
                {revealed ? agent.token : `${agent.token.slice(0, 7)}${'•'.repeat(12)}`}
                <button className="switch" onClick={() => setRevealed((value) => !value)}>
                  {revealed ? 'Hide' : 'Reveal'}
                </button>
                <CopyButton value={agent.token} label="Copy" />
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Caps</dt>
          <dd>
            {usd(agent.policy.perCallCap)} a call · {usd(agent.policy.dailyCap)} a day
          </dd>
        </div>
        <div>
          <dt>Payees</dt>
          <dd>
            <div className="payees">
              {agent.policy.allowlist.length === 0 && (
                <span className="payees__empty">any vendor can be paid</span>
              )}
              {agent.policy.allowlist.map((entry) => (
                <span className="payee" key={entry}>
                  <span className="mono">{entry}</span>
                  {!readOnly && (
                    <button
                      className="payee__x"
                      aria-label={`Remove ${entry}`}
                      onClick={() =>
                        onAllowlist?.(agent.policy.allowlist.filter((item) => item !== entry))
                      }
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!readOnly && (
              <form
                className="payees__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = payee.trim();
                  if (!value || agent.policy.allowlist.includes(value)) return;
                  onAllowlist?.([...agent.policy.allowlist, value]);
                  setPayee('');
                }}
              >
                <input
                  className="field__input field__input--tight"
                  value={payee}
                  placeholder="vendor id or wallet address"
                  onChange={(event) => setPayee(event.target.value)}
                  spellCheck={false}
                />
                <button className="key key--quiet" type="submit" disabled={!payee.trim()}>
                  Add
                </button>
              </form>
            )}
            <span className="payees__hint">
              Your agent can only pay these. Leave it empty to allow any vendor.
            </span>
          </dd>
        </div>
        <div>
          <dt>Mint</dt>
          <dd className="facts__mono">
            {shortAddress(snapshot?.mint ?? '', 6)}
            {snapshot?.mint && <CopyButton value={snapshot.mint} label="Copy" />}
          </dd>
        </div>
      </dl>

      {readOnly ? (
        <p className="agentpanel__readonly">
          Read-only view of one agent. It was opened with a view key, so it can see the balance, the
          limits and every record — and it cannot spend, change limits, read the agent&apos;s token,
          or see any other agent on this machine.
        </p>
      ) : (
        <div className="agentpanel__share">
          <div className="agentpanel__shareline">
            <span className="agentpanel__sharelabel">
              Your console link — full control, keep it private
            </span>
            <CopyButton value={ownerUrl} label="Copy" />
          </div>
          <div className="agentpanel__shareline">
            <span className="agentpanel__sharelabel">
              Read-only link — safe to share, cannot spend or edit
            </span>
            <CopyButton value={viewUrl} label="Copy" />
          </div>
        </div>
      )}

      {/* Funding lives in the setup steps on a personal agent's page, so this
          button only appears where it is the only way to fund (the demo). */}
      {!readOnly && onFund && (
        <div className="agentpanel__fund">
          <button className="key key--go key--wide" onClick={onFund} disabled={funding}>
            {funding ? 'Adding…' : 'Add 25 dUSD'}
          </button>
          <p className="agentpanel__fundnote">
            Mints demo stablecoin from the treasury into this agent&apos;s wallet. It lands in the
            ledger as a <span className="mono">funded</span> row, so the balance never changes
            without a record.
          </p>
        </div>
      )}

      {!readOnly && (
      <div className="agentpanel__wire">
        <div className="agentpanel__tabs" role="tablist" aria-label="How to connect your agent">
          <button
            role="tab"
            aria-selected={tab === 'prompt'}
            className={`switch${tab === 'prompt' ? ' switch--armed' : ''}`}
            onClick={() => setTab('prompt')}
          >
            Paste a prompt
          </button>
          <button
            role="tab"
            aria-selected={tab === 'config'}
            className={`switch${tab === 'config' ? ' switch--armed' : ''}`}
            onClick={() => setTab('config')}
          >
            MCP config
          </button>
          <button
            role="tab"
            aria-selected={tab === 'http'}
            className={`switch${tab === 'http' ? ' switch--armed' : ''}`}
            onClick={() => setTab('http')}
          >
            Raw HTTP
          </button>
        </div>

        <div className="agentpanel__codewrap">
          <pre className="wire__body">{active}</pre>
          <CopyButton value={active} label="Copy block" />
        </div>

        {tab === 'prompt' && (
          <p className="wire__note">
            Give this to Claude Code, Cursor, opencode or any tool-capable agent. There is nothing to
            install: the tools are served over HTTP from this deployment, and your agent token is the
            only credential. It exposes <span className="mono">buy_signals</span>,{' '}
            <span className="mono">buy_notes</span>, <span className="mono">buy_brief</span> and{' '}
            <span className="mono">agent_status</span> — the 402 handshake happens inside the server,
            so your agent just sees a tool result and a receipt. If your client only speaks stdio,{' '}
            <a className="wire__link" href="/stipend-mcp.mjs" download>
              download the single-file server
            </a>{' '}
            instead.
          </p>
        )}
        {tab === 'config' && (
          <p className="wire__note">
            Paste into the client&apos;s MCP config. This is a remote server: no command, no path, no
            package to install. The bearer token authorises spending from this wallet only.
          </p>
        )}
        {tab === 'http' && (
          <p className="wire__note">
            If you would rather not use MCP, this is the same handshake over plain HTTP. Replace{' '}
            <span className="mono">TOKEN</span> with the API token above. Your model provider key
            never goes anywhere near this — this token only authorises spending from this wallet,
            inside the caps.
          </p>
        )}
      </div>
      )}
    </section>
  );
}
