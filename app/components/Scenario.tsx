const PURCHASES = [
  {
    what: 'Live search for what people said this week',
    price: '$0.02',
    normally: 'an account, a key on file, and a monthly plan',
    ours: true,
  },
  {
    what: 'One rendered page from a JS-heavy pricing site',
    price: '$0.03',
    normally: 'a headless-browser subscription with a seat minimum',
    ours: true,
  },
  {
    what: 'A vision pass over a competitor’s PDF price sheet',
    price: '$0.05',
    normally: 'a per-seat plan, usually with a floor',
    ours: true,
  },
  {
    what: 'The memo itself, written by your own model',
    price: 'your provider',
    normally: 'billed to you exactly as it is today — Stipend does not touch it',
    ours: false,
  },
];

/**
 * The question this answers: what is the agent actually buying? Not one big API
 * — four small ones, each from a different vendor, none of which will sell you a
 * single call.
 */
export function Scenario() {
  return (
    <section className="scenario">
      <div className="scenario__head">
        <h2 className="scenario__title">A real task, bought piece by piece</h2>
        <p className="scenario__lede">
          Your agent is asked to write a launch memo. It does not need one big API. It needs four
          small things from four different vendors — and three of them would normally require an
          account, a card on file, and a plan you cannot cancel per call.
        </p>
      </div>

      <ol className="scenario__list">
        {PURCHASES.map((purchase, index) => (
          <li className="scenario__row" key={purchase.what}>
            <span className="scenario__n">{String(index + 1).padStart(2, '0')}</span>
            <span className="scenario__body">
              <span className="scenario__what">{purchase.what}</span>
              <span className="scenario__normally">
                {purchase.ours ? 'normally ' : ''}
                {purchase.normally}
              </span>
            </span>
            <span className={`scenario__price${purchase.ours ? '' : ' scenario__price--yours'}`}>
              {purchase.price}
            </span>
          </li>
        ))}
      </ol>

      <div className="scenario__notes">
        <p className="scenario__note">
          <strong>Stipend covers 1–3.</strong> Those vendors get paid in a tenth of a second and
          never need to know who your agent is. That is the part cards cannot do: at two-cent
          tickets, the $0.30 interchange fee is larger than the sale.
        </p>
        <p className="scenario__note">
          <strong>Your model invoice is untouched.</strong> DeepSeek, OpenAI and Anthropic already
          bill you per call and already let you set a usage limit, so Stipend is not trying to sit
          between you and them. It sits below them: the vendors that will not sell you a single
          call, and the one budget you want across all of them.
        </p>
      </div>
    </section>
  );
}
