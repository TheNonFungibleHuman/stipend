/**
 * The plain-language layer. The mechanism is unusual, so the page states it in
 * three sentences before anyone has to read a header key.
 */
export function HowItWorks() {
  return (
    <section className="howto" aria-label="How a payment works">
      <div className="howto__step">
        <span className="howto__n">Step 01</span>
        <h2 className="howto__t">The agent asks for data</h2>
        <p className="howto__d">
          It calls a paid endpoint and gets back <span className="mono">402 Payment Required</span>{' '}
          with a price: four cents.
        </p>
      </div>
      <div className="howto__step">
        <span className="howto__n">Step 02</span>
        <h2 className="howto__t">The machine checks the budget</h2>
        <p className="howto__d">
          Under the per-call cap? Under today&apos;s limit? If either answer is no, nothing is
          signed and the purchase goes in the coin return.
        </p>
      </div>
      <div className="howto__step">
        <span className="howto__n">Step 03</span>
        <h2 className="howto__t">Money moves, then the seller checks</h2>
        <p className="howto__d">
          One Solana transfer settles in about half a second. The seller re-reads the chain before
          it hands over the data — the receipt is the payment.
        </p>
      </div>
    </section>
  );
}
