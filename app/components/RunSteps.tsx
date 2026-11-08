'use client';

import { useEffect, useState } from 'react';
import type { Run, RunStep } from '../types';
import { explorerTx, shortAddress, usd } from '../types';

function outputLines(step: RunStep): string[] {
  const output = step.output as
    | {
        notes?: string[];
        memo?: string;
        signals?: Array<{ title: string; points: number; comments?: number; date?: string; url?: string }>;
      }
    | undefined;
  if (!output) return [];
  if (Array.isArray(output.signals)) {
    return output.signals.map(
      (signal) =>
        `${signal.title} — ${signal.points} pts${signal.comments ? `, ${signal.comments} comments` : ''}${
          signal.date ? ` (${signal.date})` : ''
        }`,
    );
  }
  if (Array.isArray(output.notes)) return output.notes;
  if (typeof output.memo === 'string') return [output.memo];
  return [];
}

const STAMP: Record<RunStep['status'], { label: string; className: string }> = {
  quoting: { label: 'Quoting', className: 'stamp--live' },
  settling: { label: 'Signing', className: 'stamp--live' },
  settled: { label: 'Paid', className: 'stamp--settled' },
  denied: { label: 'Refused', className: 'stamp--denied' },
  error: { label: 'Error', className: 'stamp--error' },
};

const isWorking = (step: RunStep) => step.status === 'quoting' || step.status === 'settling';

/** Steps of the run in view, with a live clock so a wait looks like work. */
export function RunSteps({ run }: { run: Run | null }) {
  const [now, setNow] = useState(() => Date.now());
  const working = run?.status === 'running' || Boolean(run?.steps.some(isWorking));

  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [working]);

  if (!run) {
    return <p className="empty-row">No active run.</p>;
  }

  const settled = run.steps.filter((step) => step.status === 'settled').length;
  const elapsed = ((run.endedAt ? Date.parse(run.endedAt) : now) - Date.parse(run.startedAt)) / 1000;

  return (
    <>
      {working && (
        <div className="runprogress" role="status" aria-live="polite">
          <span className="runprogress__pulse" aria-hidden="true" />
          <span className="runprogress__label">
            working · {settled} of {run.steps.length || 3} settled
          </span>
          <span className="runprogress__clock mono">{elapsed.toFixed(1)}s</span>
          <span className="runprogress__rail" aria-hidden="true">
            <span className="runprogress__shimmer" />
          </span>
        </div>
      )}

      <ol className="jobs">
        {run.steps.map((step) => {
          const stamp = STAMP[step.status];
          const stepElapsed =
            (step.endedAt ? Date.parse(step.endedAt) : now) - Date.parse(step.startedAt);
          return (
            <li key={step.index} className={`job job--${step.status}`}>
              <div className="job__head">
                <span className={`job__dot job__dot--${step.status}`} aria-hidden="true" />
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

                {isWorking(step) && (
                  <div className="job__pending">
                    <span className="spin" aria-hidden="true" />
                    <span>
                      {step.status === 'quoting'
                        ? 'asking the vendor for a price'
                        : 'paying, then the vendor checks the chain'}
                    </span>
                    <span className="job__elapsed mono">{(stepElapsed / 1000).toFixed(1)}s</span>
                  </div>
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
                        : step.engine === 'fetch'
                          ? 'fetched from the live source'
                          : 'computed deterministically'}
                      {step.computeMs !== undefined &&
                        ` in ${Math.round(step.computeMs / 100) / 10}s`}
                      {step.source === 'cached' && ' · cached snapshot'}
                    </p>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
