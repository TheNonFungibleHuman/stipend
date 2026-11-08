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
    return output.competitors.map(
      (competitor) => `${competitor.name} — $${competitor.monthly}/mo`,
    );
  }
  return [];
}

const LABEL: Record<RunStep['status'], string> = {
  quoting: 'quoting',
  settling: 'settling',
  settled: 'settled',
  denied: 'refused',
  error: 'error',
};

export function RunLedger({ run }: { run: Run | null }) {
  if (!run) {
    return (
      <div className="steps steps--empty">
        <p className="empty">
          Press <strong>Run a research task</strong>. The agent will buy three services it does not
          control, one 402 at a time, and stop where the policy says stop.
        </p>
      </div>
    );
  }

  return (
    <ol className="steps">
      {run.steps.map((step) => (
        <li key={step.index} className={`step step--${step.status}`}>
          <div className="step__head">
            <span className="step__index mono">{String(step.index + 1).padStart(2, '0')}</span>
            <span className="step__name">{step.serviceName}</span>
            <span className="step__price mono">{usd(step.price)}</span>
            <span className={`step__badge step__badge--${step.status}`}>
              {LABEL[step.status]}
              {step.settleMs !== undefined && step.status === 'settled' && (
                <span className="step__ms mono"> {step.settleMs}ms</span>
              )}
            </span>
          </div>

          <div className="step__body">
            {step.status === 'denied' && (
              <p className="step__denied">
                <strong>402 quoted {usd(step.price)}.</strong> {step.reason}. No signature was
                produced, so no SOL and no tokens moved.
              </p>
            )}

            {(step.status === 'quoting' || step.status === 'settling') && (
              <p className="step__pending">
                <span className="spin" aria-hidden="true" />
                {step.status === 'quoting'
                  ? 'asking the vendor for a price…'
                  : 'paying, then re-checking devnet…'}
              </p>
            )}

            {step.status === 'error' && <p className="step__denied">{step.reason}</p>}

            {step.status === 'settled' && (
              <>
                <div className="step__flow mono">
                  <span className="flow flow--402">402</span>
                  <span className="flow__arrow">→</span>
                  <span className="flow flow--sign">sign</span>
                  <span className="flow__arrow">→</span>
                  <span className="flow flow--ok">confirmed</span>
                  <span className="flow__arrow">→</span>
                  <span className="flow flow--200">200</span>
                  {step.signature && (
                    <a
                      className="step__link"
                      href={explorerTx(step.signature)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddress(step.signature, 5)} ↗
                    </a>
                  )}
                </div>
                <ul className="step__output">
                  {outputLines(step).map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
                <p className="step__meta">
                  paid from the agent wallet ·{' '}
                  {step.engine === 'model' ? `computed by ${step.model}` : 'computed deterministically'}
                  {step.verifyMs !== undefined && ` · seller verified in ${step.verifyMs}ms`}
                </p>
              </>
            )}
          </div>
        </li>
      ))}
      {run.status === 'running' && run.steps.length === 0 && (
        <li className="step step--quoting">
          <p className="step__pending">
            <span className="spin" aria-hidden="true" /> reading the policy…
          </p>
        </li>
      )}
    </ol>
  );
}
