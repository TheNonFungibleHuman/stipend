'use client';

import { useState } from 'react';

interface Props {
  address: string;
  faucetUrl: string;
  message?: string;
  onCheck: () => void;
}

/**
 * The machine cannot be commissioned without a fee wallet. The public devnet
 * faucet is closed, so this is the honest version of that: name the address,
 * explain why, and re-check instead of failing silently.
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
    <main className="cabinet cabinet--gate">
      <div className="gate">
        <span className="screw screw--tl" aria-hidden="true" />
        <span className="screw screw--tr" aria-hidden="true" />
        <span className="screw screw--bl" aria-hidden="true" />
        <span className="screw screw--br" aria-hidden="true" />

        <span className="gate__eyebrow">Machine not commissioned</span>
        <h1 className="gate__title">The fee wallet needs 0.5 SOL to open for business.</h1>
        <p className="gate__body">
          {message ?? 'The treasury pays every transaction fee, so the agent only needs stablecoins.'}{' '}
          The devnet RPC faucet is closed, so this one transfer has to happen in a browser. After it
          lands, the mint, the wallets and the receipts all build themselves.
        </p>

        <div className="gate__addr">
          <code>{address}</code>
          <button className="switch switch--armed" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <ol className="gate__steps">
          <li>
            Open{' '}
            <a href={faucetUrl} target="_blank" rel="noreferrer">
              faucet.solana.com
            </a>{' '}
            and sign in with GitHub.
          </li>
          <li>Paste the address, keep the network on devnet, request SOL.</li>
          <li>Come back and press the button below.</li>
        </ol>

        <button className="key key--go" onClick={onCheck}>
          I&apos;ve sent it — check again
        </button>

        <p className="gate__foot">
          Everything after this is real: real devnet transactions, real settlement checks, real
          explorer links.
        </p>
      </div>
    </main>
  );
}
