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
  error: { label: 'Failed', className: 'stamp--error' },
};

const isWorking = (step: RunStep) => step.status === 'quoting' || step.status === 'settling';
const isDone = (step: RunStep) => !isWorking(step);

/** Its own component so the clock ticks without re-rendering finished rows. */
function Clock({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  // The timestamp comes from the server, so a small clock difference can make
  // this negative for a moment. Never show a person "-0.1s".
  const elapsed = Math.max(0, (now - Date.parse(since)) / 1000);
  return <span className="runprogress__clock mono">{elapsed.toFixed(1)}s</span>;
}

/**
 * Steps appear when they finish, in order, and the progress line shrinks as they
 * land. Rendering every queued step at once made the list jump around while the
 * run was working; a person watching should see results arrive, not boxes flicker.
 */
export function RunSteps({ run }: { run: Run | null }) {
  if (!run) {
    return <p className="empty-row">No run yet.</p>;
  }

  const steps = run.steps ?? [];
  const done = steps.filter(isDone);
  const working = steps.filter(isWorking);
  const total = run.mode === 'rogue' ? 2 : 3;
  const current = working[0];

  return (
    <>
      {current && (
        <div className="runprogress" role="status" aria-live="polite">
          <span className="runprogress__pulse" aria-hidden="true" />
          <span className="runprogress__label">
            {current.status === 'quoting'
              ? `asking ${current.serviceName} for a price`
              : `${current.serviceName}: paying, then checking the chain`}
          </span>
          <Clock since={current.startedAt} />
          <span className="runprogress__rail" aria-hidden="true">
            <span className="runprogress__shimmer" />
          </span>
        </div>
      )}

      {done.length === 0 && !current && (
        <p className="empty-row">
          {run.status === 'running' ? 'starting the run…' : 'Nothing was bought.'}
        </p>
      )}

      <ol className="jobs">
        {done.map((step) => {
          const stamp = STAMP[step.status];
          return (
            <li key={step.index} className={`job job--${step.status}`}>
              <div className="job__head">
                <span className={`job__dot job__dot--${step.status}`} aria-hidden="true" />
                <span className="job__id">{String(step.index + 1).padStart(2, '0')}</span>
                <span className="job__name">{step.serviceName}</span>
                <span className="job__price">{usd(step.status === 'denied' ? step.price : step.price)}</span>
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
                    <strong>The vendor wanted {usd(step.price)}.</strong> {step.reason}. Nothing was
                    signed, so nothing was paid.
                  </p>
                )}

                {step.status === 'error' && <p className="job__denied">{step.reason}</p>}

                {step.status === 'settled' && (
                  <>
                    <div className="job__flow">
                      <span className="leg leg--402">priced</span>
                      <span className="leg leg--arrow">→</span>
                      <span className="leg">within policy</span>
                      <span className="leg leg--arrow">→</span>
                      <span className="leg leg--ok">paid</span>
                      {step.signature && (
                        <a
                          className="job__link"
                          href={explorerTx(step.signature)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          receipt {shortAddress(step.signature, 5)} ↗
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
                        ? `written by ${step.model}`
                        : step.engine === 'fetch'
                          ? 'read from the live source'
                          : 'written from a fixed template'}
                      {step.computeMs !== undefined && ` in ${Math.round(step.computeMs / 100) / 10}s`}
                      {step.source === 'cached' && ' · saved copy, source was unreachable'}
                    </p>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {run.status === 'complete' && done.length > 0 && (
        <p className="runprogress__foot">
          {done.filter((step) => step.status === 'settled').length} of {total} bought ·{' '}
          {usd(run.spend)}
          {run.refused > 0 && ` · ${run.refused} refused`}
        </p>
      )}
    </>
  );
}
