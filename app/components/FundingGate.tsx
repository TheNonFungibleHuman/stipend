'use client';

import { useState } from 'react';

interface Props {
  address: string;
  faucetUrl: string;
  message?: string;
  onCheck: () => void;
}

/**
 * The public devnet faucet is closed, so a fresh clone needs one transfer before
 * it can pay fees. This screen is the honest version of that: it names the
 * address, explains why, and re-checks instead of failing silently.
 */
export function FundingGate({ address, faucetUrl, message, onCheck }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="shell shell--gate">
      <div className="gate">
        <span className="gate__eyebrow">One-time setup</span>
        <h1 className="gate__title">Fund the fee wallet to bring devnet online.</h1>
        <p className="gate__body">
          {message ??
            'The treasury pays every transaction fee so the agent only needs stablecoins.'}{' '}
          Send <strong>0.5 SOL</strong> (devnet) to this address and the whole demo comes alive —
          mint, wallets and receipts are created on first load.
        </p>

        <div className="gate__addr">
          <code className="mono">{address}</code>
          <button className="btn btn--small btn--primary" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy address'}
          </button>
        </div>

        <ol className="gate__steps">
          <li>
            Open{' '}
            <a href={faucetUrl} target="_blank" rel="noreferrer">
              faucet.solana.com
            </a>{' '}
            and sign in with GitHub (the RPC faucet itself is closed on devnet).
          </li>
          <li>Paste the address above, keep the network on devnet, request SOL.</li>
          <li>Come back and press the button below.</li>
        </ol>

        <button className="btn btn--primary" onClick={onCheck}>
          I&apos;ve sent it — check again
        </button>

        <p className="gate__foot">
          Everything after this point is real: real devnet transactions, real settlement checks, real
          explorer links.
        </p>
      </div>
    </main>
  );
}
