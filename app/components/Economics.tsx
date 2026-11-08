'use client';

import type { LedgerEntry } from '../types';
import { usd } from '../types';

interface Props {
  ledger: LedgerEntry[];
  agentTokens: number;
  mint?: string;
}

/** One plain transfer costs 5,000 lamports; only used to make the comparison concrete. */
const LAMPORTS_PER_CALL = 5_000;
const SOL_USD = 190;

export function Economics({ ledger, agentTokens, mint }: Props) {
  const settled = ledger.filter((entry) => entry.decision === 'settled');
  const collected = settled.reduce((sum, entry) => sum + entry.price, 0);
  const cardTotal = settled.reduce((sum, entry) => sum + (entry.cardFee ?? 0), 0);
  const feeLamports = settled.length * LAMPORTS_PER_CALL;
  const solanaTotal = (feeLamports / 1e9) * SOL_USD;
  const ratio = solanaTotal > 0 ? cardTotal / solanaTotal : 0;

  const cell = (key: string, value: string, note: string, tone?: 'ok' | 'warn') => (
    <div className="proof__cell" key={key}>
      <span className="proof__k">{key}</span>
      <span className={`proof__v${tone ? ` proof__v--${tone}` : ''}`}>{value}</span>
      <span className="proof__note">{note}</span>
    </div>
  );

  return (
    <section className="proof">
      <div className="proof__head">
        <h2 className="proof__title">Why this needs Solana</h2>
        <p className="proof__lede">
          {settled.length > 0
            ? `Over ${settled.length} settled ${settled.length === 1 ? 'call' : 'calls'}, the network fee was ${ratio > 0 ? `${Math.round(ratio).toLocaleString()}× smaller` : 'far smaller'} than what a card processor would have charged to collect the same money.`
            : 'A card processor charges $0.30 plus 2.9% on every charge, so selling four cents of data loses about thirty cents. Solana charges about a hundred-thousandth of a cent for the same sale — which is the only reason a four-cent API call can exist.'}
        </p>
      </div>

      <div className="proof__grid">
        {cell('Collected', usd(collected), `${settled.length} paid calls`, 'ok')}
        {cell(
          'Solana fees',
          settled.length ? `$${solanaTotal.toFixed(6)}` : '—',
          `${LAMPORTS_PER_CALL.toLocaleString()} lamports a call, at $${SOL_USD}/SOL`,
        )}
        {cell(
          'Card rails would take',
          settled.length ? usd(cardTotal) : '$0.30+',
          '2.9% + $0.30 on every single charge',
          'warn',
        )}
        {cell('Agent runway', usd(agentTokens), 'stablecoin still in the agent wallet')}
      </div>

      {mint && (
        <p className="proof__foot">
          Settlement is the authorisation. The seller re-reads the payee&apos;s token balance on
          devnet before it returns a single byte, so there is no account, no API key and no billing
          database to reconcile. Payment and proof are the same object.
        </p>
      )}
    </section>
  );
}
