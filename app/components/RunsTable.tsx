'use client';

import type { RunSummary } from '../types';
import { clockOf, usd } from '../types';

const STATUS_CLASS: Record<RunSummary['status'], string> = {
  running: 'stamp--live',
  complete: 'stamp--settled',
  error: 'stamp--error',
};

/** Run history, derived from the ledger so it survives a server restart. */
export function RunsTable({ runs }: { runs: RunSummary[] }) {
  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Runs</h2>
        <span className="card__note">{runs.length} recorded</span>
      </div>

      {runs.length === 0 ? (
        <p className="empty-row">No runs recorded yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Started</th>
              <th scope="col">Services</th>
              <th scope="col" className="table__num">
                Paid
              </th>
              <th scope="col" className="table__num">
                Refused
              </th>
              <th scope="col" className="table__num">
                Spend
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 12).map((run) => (
              <tr key={run.id} className={run.status === 'running' ? 'is-active' : undefined}>
                <td className="mono">{clockOf(run.startedAt)}</td>
                <td className="table__truncate" title={run.services.join(', ')}>
                  {run.services.length > 0 ? run.services.join(' → ') : '—'}
                </td>
                <td className="table__num mono">{run.settled}</td>
                <td className="table__num mono">{run.refused}</td>
                <td className="table__num mono">{usd(run.spend)}</td>
                <td>
                  <span className={`stamp ${STATUS_CLASS[run.status]}`}>{run.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
