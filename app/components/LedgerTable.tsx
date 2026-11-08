'use client';

import type { LedgerEntry } from '../types';
import { clockOf, explorerTx, shortAddress, usd } from '../types';

/** Every payment and every refusal, newest first. This is the audit trail. */
export function LedgerTable({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <section className="card card--ledger">
      <div className="card__head">
        <h2 className="card__title">Ledger</h2>
        <span className="card__note">{ledger.length} records</span>
      </div>

      {ledger.length === 0 ? (
        <p className="empty-row">Nothing recorded yet.</p>
      ) : (
        <div className="slip slip--table">
          <table className="table table--slip">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Service</th>
                <th scope="col" className="table__num">
                  Amount
                </th>
                <th scope="col">Decision</th>
                <th scope="col" className="table__num">
                  Settle
                </th>
                <th scope="col" className="table__num">
                  Balance after
                </th>
                <th scope="col">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {ledger.slice(0, 40).map((entry) => (
                <tr key={entry.id} className={entry.decision === 'settled' || entry.decision === 'funded' ? undefined : 'is-refused'}>
                  <td className="mono">{clockOf(entry.at)}</td>
                  <td>{entry.serviceName}</td>
                  <td className="table__num mono">
                    {entry.decision === 'settled'
                      ? `−${usd(entry.price)}`
                      : entry.decision === 'funded'
                        ? `+${usd(entry.price)}`
                        : usd(entry.price)}
                  </td>
                  <td>
                    <span
                      className={`stamp stamp--${
                        entry.decision === 'settled'
                          ? 'settled'
                          : entry.decision === 'funded'
                            ? 'live'
                            : entry.decision === 'refused'
                              ? 'denied'
                              : 'error'
                      }`}
                    >
                      {entry.decision}
                    </span>
                    {entry.reason && <span className="table__reason">{entry.reason}</span>}
                  </td>
                  <td className="table__num mono">
                    {entry.settleMs === undefined ? '—' : `${entry.settleMs}ms`}
                  </td>
                  <td className="table__num mono">
                    {entry.agentBalanceAfter === undefined ? '—' : usd(entry.agentBalanceAfter)}
                  </td>
                  <td className="mono">
                    {entry.signature ? (
                      <a
                        href={explorerTx(entry.signature)}
                        target="_blank"
                        rel="noreferrer"
                        title={entry.signature}
                      >
                        {shortAddress(entry.signature, 5)} ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
