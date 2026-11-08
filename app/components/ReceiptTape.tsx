'use client';

import type { LedgerEntry } from '../types';
import { clockOf, explorerTx, shortAddress, usd } from '../types';

export function ReceiptTape({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Service record</h2>
        <span className="card__note">{ledger.length} entries</span>
      </div>

      <div className="slip">
        <div className="slip__head">
          <h3 className="slip__title">Settlement tape</h3>
          <span className="slip__note">devnet</span>
        </div>

        {ledger.length === 0 ? (
          <p className="slip__empty">
            Nothing printed yet. Run a task — each line here is a transaction you can open.
          </p>
        ) : (
          <ol className="slip__list">
            {ledger.slice(0, 14).map((entry) => {
              const settled = entry.decision === 'settled';
              return (
                <li
                  key={entry.id}
                  className={`slip__row${settled ? '' : ` slip__row--${entry.decision}`}`}
                >
                  <span className="slip__time">{clockOf(entry.at)}</span>
                  <span className="slip__svc">{entry.serviceName}</span>
                  <span className={`slip__amt${settled ? '' : ' slip__amt--stop'}`}>
                    {settled ? `−${usd(entry.price)}` : entry.decision === 'refused' ? 'refused' : 'error'}
                  </span>
                  {settled && entry.signature ? (
                    <a
                      className="slip__sig"
                      href={explorerTx(entry.signature)}
                      target="_blank"
                      rel="noreferrer"
                      title={entry.signature}
                    >
                      {shortAddress(entry.signature, 4)} ↗
                    </a>
                  ) : (
                    <span className="slip__reason" title={entry.reason}>
                      {entry.reason ?? '—'}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
