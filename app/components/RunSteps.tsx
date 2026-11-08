'use client';

import type { Run, RunStep } from '../types';
import { explorerTx, shortAddress, usd } from '../types';

function outputLines(step: RunStep): string[] {
  const output = step.output as
    | { notes?: string[]; memo?: string; competitors?: Array<{ name: string; monthly: number }> }
    | undefined;
  if (!output) return [];
  if (Array.isArray(output.notes)) return output.notes;
  if (typeof output.memo === 'string') return [output.memo];
  if (Array.isArray(output.competitors)) {
    return output.competitors.map((competitor) => `${competitor.name} — $${competitor.monthly}/mo`);
  }
  return [];
}

const STAMP: Record<RunStep['status'], { label: string; className: string }> = {
  quoting: { label: 'Quoting', className: 'stamp--live' },
  settling: { label: 'Signing', className: 'stamp--live' },
  settled: { label: 'Paid', className: 'stamp--settled' },
  denied: { label: 'Refused', className: 'stamp--denied' },
  error: { label: 'Error', className: 'stamp--error' },
};

/** Steps of the run in view. Operational detail only. */
export function RunSteps({ run }: { run: Run | null }) {
  if (!run) {
    return <p className="empty-row">No active run.</p>;
  }

  return (
    <ol className="jobs">
      {run.steps.map((step) => {
        const stamp = STAMP[step.status];
        return (
          <li key={step.index} className={`job job--${step.status}`}>
            <div className="job__head">
              <span className="job__id">{String(step.index + 1).padStart(2, '0')}</span>
              <span className="job__name">{step.serviceName}</span>
              <span className="job__price">{usd(step.price)}</span>
              <span className={`stamp ${stamp.className}`}>
                {stamp.label}
                {step.settleMs !== undefined && step.status === 'settled' && (
                  <span className="job__ms"> {step.settleMs}ms</span>
                )}
              </span>
            </div>

            <div className="job__body">
              {step.status === 'denied' && (
                <p className="job__denied">
                  <strong>402 quoted {usd(step.price)}.</strong> {step.reason}. No signature
                  produced.
                </p>
              )}

              {(step.status === 'quoting' || step.status === 'settling') && (
                <p className="job__pending">
                  <span className="spin" aria-hidden="true" />
                  {step.status === 'quoting' ? 'quoting' : 'signing, then re-checking devnet'}
                </p>
              )}

              {step.status === 'error' && <p className="job__denied">{step.reason}</p>}

              {step.status === 'settled' && (
                <>
                  <div className="job__flow">
                    <span className="leg leg--402">402</span>
                    <span className="leg leg--arrow">→</span>
                    <span className="leg">policy ok</span>
                    <span className="leg leg--arrow">→</span>
                    <span className="leg leg--ok">confirmed</span>
                    <span className="leg leg--arrow">→</span>
                    <span className="leg">200</span>
                    {step.signature && (
                      <a
                        className="job__link"
                        href={explorerTx(step.signature)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortAddress(step.signature, 5)} ↗
                      </a>
                    )}
                  </div>
                  <ul className="job__out">
                    {outputLines(step).map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                  <p className="job__meta">
                    {step.engine === 'model'
                      ? `computed by ${step.model}`
                      : 'computed deterministically'}
                    {step.verifyMs !== undefined && ` · vendor verified in ${step.verifyMs}ms`}
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
