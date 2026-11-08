'use client';

import type { LedgerEntry } from '../types';
import { clockOf, explorerTx, shortAddress, usd } from '../types';

export function ReceiptTape({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <section className="panel tape">
      <div className="panel__head">
        <h2 className="panel__title">Settlement tape</h2>
        <span className="panel__note">{ledger.length} records</span>
      </div>

      {ledger.length === 0 ? (
        <p className="empty">
          Nothing settled yet. Run a task — each row here is a devnet transaction you can open.
        </p>
      ) : (
        <ol className="tape__list">
          {ledger.slice(0, 14).map((entry) => {
            const settled = entry.decision === 'settled';
            return (
              <li
                key={entry.id}
                className={`tape__row${settled ? '' : ` tape__row--${entry.decision}`}`}
              >
                <span className="tape__time mono">{clockOf(entry.at)}</span>
                <span className="tape__svc">{entry.serviceName}</span>
                <span className={`tape__amt mono ${settled ? 'tape__amt--out' : 'tape__amt--stop'}`}>
                  {settled ? `−${usd(entry.price)}` : entry.decision === 'refused' ? 'refused' : 'error'}
                </span>
                {settled && entry.signature ? (
                  <a
                    className="tape__sig mono"
                    href={explorerTx(entry.signature)}
                    target="_blank"
                    rel="noreferrer"
                    title={entry.signature}
                  >
                    {shortAddress(entry.signature, 4)} ↗
                  </a>
                ) : (
                  <span className="tape__reason" title={entry.reason}>
                    {entry.reason ?? '—'}
                  </span>
                )}
                {settled && entry.settleMs !== undefined && (
                  <span className="tape__ms mono">{entry.settleMs}ms</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
