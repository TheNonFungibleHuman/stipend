'use client';

import { CountUp } from './CountUp';
import { Reveal } from './Reveal';

/** One example basket, priced three ways. Every figure below is arithmetic. */
const BASKET = [40_000, 60_000, 80_000]; // base units: $0.04, $0.06, $0.08
const LAMPORTS_PER_CALL = 5_000;
const SOL_USD = 190;

const cardFee = (price: number) => Math.round(price * 0.029) + 300_000; // 2.9% + $0.30

export function Proof() {
  const collected = BASKET.reduce((sum, price) => sum + price, 0) / 1_000_000;
  const cardTotal = BASKET.reduce((sum, price) => sum + cardFee(price), 0) / 1_000_000;
  const solanaTotal = ((BASKET.length * LAMPORTS_PER_CALL) / 1e9) * SOL_USD;
  const ratio = Math.round(cardTotal / solanaTotal);

  return (
    <Reveal className="proof">
      <div className="proof__head">
        <h2 className="proof__title">Why this needs Solana</h2>
        <p className="proof__lede">
          A card processor charges $0.30 plus 2.9% on every charge, so selling four cents of data
          loses about twenty-six cents before anyone ships anything. Take the same three purchases
          an agent makes in this demo and price them on each rail:
        </p>
      </div>

      <div className="proof__grid">
        <div className="proof__cell">
          <span className="proof__k">Collected</span>
          <span className="proof__v">${collected.toFixed(2)}</span>
          <span className="proof__note">{BASKET.length} paid calls, one cent each way</span>
        </div>
        <div className="proof__cell">
          <span className="proof__k">Solana fees</span>
          <span className="proof__v proof__v--ok">${solanaTotal.toFixed(6)}</span>
          <span className="proof__note">
            {LAMPORTS_PER_CALL.toLocaleString()} lamports a call at ${SOL_USD}/SOL
          </span>
        </div>
        <div className="proof__cell">
          <span className="proof__k">Card rails</span>
          <span className="proof__v proof__v--warn">${cardTotal.toFixed(2)}</span>
          <span className="proof__note">2.9% + $0.30 on every single charge</span>
        </div>
        <div className="proof__cell">
          <span className="proof__k">Difference</span>
          <span className="proof__v proof__v--ok">
            <CountUp to={ratio} suffix="×" />
          </span>
          <span className="proof__note">what the seller keeps by not using cards</span>
        </div>
      </div>

      <p className="proof__foot">
        This is the whole reason per-call pricing exists. A monthly seat is the only shape that
        survives a thirty-cent floor; an agent buying one answer for four cents is not.
      </p>
    </Reveal>
  );
}
