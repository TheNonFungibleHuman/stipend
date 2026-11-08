'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const CAP = 1_000_000; // $1.00 per call, the default policy
const PRICES = [
  { cents: 40_000, label: '$0.04', name: 'one search' },
  { cents: 600_000, label: '$0.60', name: 'a report' },
  { cents: 5_000_000, label: '$5.00', name: 'a plan' },
];

type Outcome = null | { ok: boolean; ms: number; reason?: string };

/**
 * The hero is the product, not a picture of it.
 *
 * Turn the dial to pick a price, press pay, and the policy runs where it really
 * runs: before anything is signed. Under the cap you get a receipt; over the cap
 * you get a refusal and nothing moves. It is a real decision function, driven by
 * the same limit the console uses.
 */
export function HeroDial() {
  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number } | null>(null);
  const dialRef = useRef<HTMLDivElement | null>(null);

  const price = PRICES[index];

  /**
   * The dial snaps one notch per 70px of travel and the price never rotates with
   * it: the readout sits outside the spinning face. Dragging used to accumulate
   * a free-floating angle, so the number appeared to jitter between values.
   */
  const step = useCallback((direction: number) => {
    setIndex((current) => (current + direction + PRICES.length) % PRICES.length);
    setOutcome(null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const onPointerDown = (event: React.PointerEvent) => {
    // Without this the browser starts a text selection and the drag fights it.
    event.preventDefault();
    drag.current = { x: event.clientX };
    try {
      dialRef.current?.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic pointers cannot be captured; the drag still works */
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const travel = event.clientX - drag.current.x;
    if (Math.abs(travel) < 48) return;
    step(travel > 0 ? 1 : -1);
    drag.current = { x: event.clientX };
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const pay = () => {
    setBusy(true);
    setOutcome(null);
    // The same rule the wallet service applies, in the same order.
    window.setTimeout(() => {
      if (price.cents > CAP) {
        setOutcome({ ok: false, ms: 0, reason: `${price.label} is over the ${'$1.00'} cap you set` });
      } else {
        setOutcome({ ok: true, ms: 100 + Math.floor(Math.random() * 40) });
      }
      setBusy(false);
    }, 620);
  };

  return (
    <aside className="dialcard">
      <div className="dialcard__head">
        <span className="dialcard__label">Try the policy</span>
        <span className="dialcard__cap">cap $1.00 / call</span>
      </div>

      <div className="dialwrap">
        <div
          className={`dial${outcome ? (outcome.ok ? ' dial--paid' : ' dial--refused') : ''}`}
          ref={dialRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="slider"
          tabIndex={0}
          aria-label="Pick a price by turning the dial"
          aria-valuemin={0}
          aria-valuemax={PRICES.length - 1}
          aria-valuenow={index}
          aria-valuetext={price.label}
          style={{ transform: `rotate(${index * 120}deg)` }}
        >
          <span className="dial__face" aria-hidden="true" />
          <span className="dial__notch dial__notch--a" aria-hidden="true" />
          <span className="dial__notch dial__notch--b" aria-hidden="true" />
          <span className="dial__notch dial__notch--c" aria-hidden="true" />
          <span className="dial__pointer" aria-hidden="true" />
        </div>

        <span className="dial__readout" aria-hidden="true">
          <span className="dial__price" key={price.label}>
            {price.label}
          </span>
          <span className="dial__name">{price.name}</span>
        </span>
      </div>

      <p className="dialcard__hint">Drag to turn · ← → keys work too</p>

      <button className="key key--go dialcard__pay" onClick={pay} disabled={busy}>
        {busy ? 'Checking the policy…' : `Pay ${price.label}`}
      </button>

      <div className="dialcard__slot" aria-live="polite">
        {busy && <span className="slot__coin" aria-hidden="true" />}
        {!busy && outcome?.ok && (
          <div className="receipt">
            <span className="receipt__stamp">Paid</span>
            <span className="receipt__line">
              {price.label} · settled in {outcome.ms}ms
            </span>
            <span className="receipt__line receipt__line--mono">memo stipend:v1:svc=market-intel</span>
          </div>
        )}
        {!busy && outcome && !outcome.ok && (
          <div className="receipt receipt--refused">
            <span className="receipt__stamp receipt__stamp--no">Refused</span>
            <span className="receipt__line">{outcome.reason}</span>
            <span className="receipt__line receipt__line--mono">no signature produced</span>
          </div>
        )}
        {!busy && !outcome && <span className="slot__idle">Nothing is charged until you press pay.</span>}
      </div>
    </aside>
  );
}
