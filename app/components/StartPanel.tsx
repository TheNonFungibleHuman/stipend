'use client';

import { useState } from 'react';
import type { PublicAgent } from '../types';
import { usd } from '../types';
import { agentConfig, agentPrompt } from '@/lib/prompt';

/**
 * What a personal agent's console shows instead of a run button.
 *
 * The pipeline belongs to the demo agent. A personal agent is meant to be used
 * from the owner's own agent, so this page explains the three steps, hands over
 * something to paste, and then gets out of the way: purchases show up in the
 * ledger below as the agent makes them.
 */
export function StartPanel({
  agent,
  baseUrl,
  balanceRaw,
  onFund,
  funding,
}: {
  agent: PublicAgent;
  baseUrl: string;
  balanceRaw: number;
  onFund: () => void;
  funding: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const prompt = agentPrompt({ origin: baseUrl, token: agent.token });
  const config = agentConfig({ origin: baseUrl, token: agent.token });

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(`fail:${key}`);
    }
  };

  const funded = balanceRaw > 0;

  return (
    <>
      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Use it from your own agent</h2>
          <span className="card__note">{funded ? 'ready' : 'needs funds'}</span>
        </div>

        <ol className="steps">
          <li className={`step${funded ? ' step--done' : ''}`}>
            <div className="step__head">
              <span className="step__n">1</span>
              <span className="step__title">Put money in this agent&apos;s wallet</span>
            </div>
            <p className="step__body">
              Your agent can only spend what is in its own Stipend wallet — never your card.
              Balance now: <strong>{usd(balanceRaw)}</strong>.
            </p>
            <button className="key key--go" onClick={onFund} disabled={funding}>
              {funding ? 'Adding…' : 'Add 25 dUSD'}
            </button>
          </li>

          <li className="step">
            <div className="step__head">
              <span className="step__n">2</span>
              <span className="step__title">Give your agent access</span>
            </div>
            <p className="step__body">
              Paste this into Claude Code, Cursor, opencode, or any agent that can add tools. It
              carries this agent&apos;s own key, so it can spend from this wallet and no other.
            </p>
            <button className="key key--quiet" onClick={() => void copy(prompt, 'prompt')}>
              {copied === 'prompt' ? 'Copied' : 'Copy instructions'}
            </button>
            <details className="step__more">
              <summary>Or add the server yourself</summary>
              <pre className="wire__body">{config}</pre>
              <button className="key key--quiet" onClick={() => void copy(config, 'config')}>
                {copied === 'config' ? 'Copied' : 'Copy config'}
              </button>
            </details>
          </li>

          <li className="step">
            <div className="step__head">
              <span className="step__n">3</span>
              <span className="step__title">Ask it for something</span>
            </div>
            <p className="step__body">
              Tell your agent what you want to know, for example:{' '}
              <em>&ldquo;Buy live signals about how competitors price AI observability tools.&rdquo;</em>{' '}
              Each purchase lands in the table below with its price and a link to the transaction, so
              you can see exactly what your agent bought and what it cost.
            </p>
          </li>
        </ol>

        <p className="wire__note">
          This runs on Solana devnet for now: the money is test money and has no value. Nothing here
          touches a real card or a real bank account.
        </p>

        <dl className="facts facts--foot">
          <div>
            <dt>Wallet</dt>
            <dd>
              <button
                className="mono linkish"
                onClick={() => void copy(agent.address, 'address')}
                title="Copy this address to send money from outside"
              >
                {agent.address}
              </button>
              {copied === 'address' && <span className="copied"> copied</span>}
            </dd>
          </div>
          <div>
            <dt>Read-only link</dt>
            <dd>
              <button
                className="mono linkish"
                onClick={() => void copy(`${baseUrl}/app?view=${agent.viewToken}`, 'view')}
              >
                share what this agent bought
              </button>
              {copied === 'view' && <span className="copied"> copied</span>}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
