'use client';

import type { Run, RunStep, ServiceDef } from '../types';
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

interface Props {
  run: Run | null;
  services?: ServiceDef[];
  hostilePrice?: number;
}

export function RunLedger({ run, services = [], hostilePrice }: Props) {
  if (!run) {
    return (
      <div className="queue">
        <p className="queue__lead">
          Nothing has run yet. Press <strong>Run a research task</strong> and the agent will make
          three purchases it cannot control:
        </p>
        <ol className="queue__list">
          {services.map((service, index) => (
            <li className="queue__row" key={service.id}>
              <span className="job__id">{String(index + 1).padStart(2, '0')}</span>
              <span className="queue__name">{service.name}</span>
              <span className="queue__price">{usd(service.price)}</span>
              <span className="stamp">queued</span>
            </li>
          ))}
        </ol>
        <p className="queue__note">
          Then one more vendor quoting {usd(hostilePrice ?? 5_000_000)} a call. The policy refuses it
          before a signature exists, and the coin return fills up.
        </p>

        <details className="wire">
          <summary className="wire__summary">What actually goes over the wire</summary>
          <pre className="wire__body">{`POST /api/paid/market-intel
← 402 Payment Required
  { "accepts": { "scheme": "exact", "price": 40000,
                 "payee": "4Nd1…4T", "mint": "9xQe…mU" } }

POST /api/paid/market-intel
  x-payment: eyJ2IjoxLCJzZXJ2aWNlSWQiOiJtYXJrZXQtaW50ZWwi…
← 200 OK
  { "output": { … }, "receipt": { "signature": "5j7s…rP", "slot": 412889 } }`}</pre>
          <p className="wire__note">
            The seller verifies the transfer against the payee&apos;s token balance before it
            returns anything. No API key, no account, no billing table.
          </p>
        </details>
      </div>
    );
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
                  <strong>402 quoted {usd(step.price)}.</strong> {step.reason}. No signature was
                  produced, so nothing moved and the vendor was told no.
                </p>
              )}

              {(step.status === 'quoting' || step.status === 'settling') && (
                <p className="job__pending">
                  <span className="spin" aria-hidden="true" />
                  {step.status === 'quoting'
                    ? 'asking the vendor for a price'
                    : 'signing, then re-checking devnet'}
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
                    paid from the agent wallet ·{' '}
                    {step.engine === 'model'
                      ? `computed by ${step.model}`
                      : 'computed deterministically'}
                    {step.verifyMs !== undefined && ` · seller verified in ${step.verifyMs}ms`}
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
      {run.status === 'running' && run.steps.length === 0 && (
        <li className="job">
          <p className="job__pending">
            <span className="spin" aria-hidden="true" /> reading the policy
          </p>
        </li>
      )}
    </ol>
  );
}
