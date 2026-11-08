'use client';

import type { LedgerEntry } from '../types';
import { usd } from '../types';

interface Props {
  ledger: LedgerEntry[];
  agentTokens: number;
  mint?: string;
}

/** A plain transfer costs 5,000 lamports; used only to make the comparison concrete. */
const LAMPORTS_PER_CALL = 5_000;
const SOL_USD = 190;

export function Economics({ ledger, agentTokens, mint }: Props) {
  const settled = ledger.filter((entry) => entry.decision === 'settled');
  const collected = settled.reduce((sum, entry) => sum + entry.price, 0);
  const cardTotal = settled.reduce((sum, entry) => sum + (entry.cardFee ?? 0), 0);
  const feeLamports = settled.length * LAMPORTS_PER_CALL;
  const solanaTotal = (feeLamports / 1e9) * SOL_USD;
  const ratio = solanaTotal > 0 ? cardTotal / solanaTotal : 0;

  const cell = (key: string, value: string, note: string, accent?: 'ok' | 'warn') => (
    <div className="econ__cell" key={key}>
      <span className="econ__k">{key}</span>
      <span className={`econ__v mono${accent ? ` econ__v--${accent}` : ''}`}>{value}</span>
      <span className="econ__note">{note}</span>
    </div>
  );

  return (
    <section className="econ">
      <div className="econ__head">
        <h2 className="econ__title">Why this only works here</h2>
        <p className="econ__lede">
          {settled.length > 0
            ? `Across ${settled.length} settled ${settled.length === 1 ? 'call' : 'calls'}, the payment rails cost the seller ${ratio > 0 ? `${Math.round(ratio).toLocaleString()}×` : 'far'} less than a card processor would have charged to collect the same money.`
            : 'A $0.04 sale collects $0.04 here. On card rails the fee alone is $0.30, so the sale is impossible before it starts.'}
        </p>
      </div>

      <div className="econ__grid">
        {cell('Collected', usd(collected), `${settled.length} paid calls`, 'ok')}
        {cell(
          'Solana fees',
          settled.length ? `$${solanaTotal.toFixed(6)}` : '—',
          `${LAMPORTS_PER_CALL.toLocaleString()} lamports a call at $${SOL_USD}/SOL`,
        )}
        {cell(
          'Card rails would take',
          settled.length ? usd(cardTotal) : '$0.30+',
          '2.9% + $0.30 per transaction',
          'warn',
        )}
        {cell('Agent runway', usd(agentTokens), 'stablecoin left in the agent wallet')}
      </div>

      {mint && (
        <p className="econ__foot">
          Settlement is the authorisation: the seller re-checks the payee&apos;s token balance on
          devnet before it returns a single byte. No accounts, no API keys, no billing database.
        </p>
      )}
    </section>
  );
}
