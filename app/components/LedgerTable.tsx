'use client';

import type { LedgerEntry } from '../types';
import { clockOf, explorerTx, shortAddress, usd } from '../types';

const DECISION_CLASS: Record<LedgerEntry['decision'], string> = {
  settled: 'stamp--settled',
  refused: 'stamp--denied',
  error: 'stamp--error',
  funded: 'stamp--live',
};

/**
 * Every payment, refusal and top-up. Five columns so the receipt link is never
 * pushed off the edge — a record you cannot open is not evidence.
 */
export function LedgerTable({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <section className="card card--ledger">
      <div className="card__head">
        <h2 className="card__title">Ledger</h2>
        <span className="card__note">
          {ledger.length} records · {ledger.filter((entry) => entry.signature).length} on chain
        </span>
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
                <th scope="col">Decision</th>
                <th scope="col" className="table__num">
                  Balance after
                </th>
                <th scope="col">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {ledger.slice(0, 40).map((entry) => {
                const out = entry.decision === 'settled';
                const funded = entry.decision === 'funded';
                return (
                  <tr key={entry.id} className={out || funded ? undefined : 'is-refused'}>
                    <td className="mono slip__time">{clockOf(entry.at)}</td>
                    <td>
                      <span className="table__svc">{entry.serviceName}</span>
                      <span className="table__amt mono">
                        {out ? `−${usd(entry.price)}` : funded ? `+${usd(entry.price)}` : usd(entry.price)}
                      </span>
                    </td>
                    <td>
                      <span className={`stamp ${DECISION_CLASS[entry.decision]}`}>
                        {entry.decision}
                      </span>
                      {entry.settleMs !== undefined && (
                        <span className="table__settle mono">{entry.settleMs}ms</span>
                      )}
                      {entry.reason && <span className="table__reason">{entry.reason}</span>}
                    </td>
                    <td className="table__num mono">
                      {entry.agentBalanceAfter === undefined ? '—' : usd(entry.agentBalanceAfter)}
                    </td>
                    <td>
                      {entry.signature ? (
                        <a
                          className="table__receipt"
                          href={explorerTx(entry.signature)}
                          target="_blank"
                          rel="noreferrer"
                          title={entry.signature}
                        >
                          {shortAddress(entry.signature, 4)} ↗
                        </a>
                      ) : (
                        <span className="table__noreceipt">not signed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
