'use client';

import Link from 'next/link';
import { Reveal } from './Reveal';

const ITEMS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'Is this a router that finds the cheapest vendor?',
    a: (
      <>
        No. Nothing here picks a vendor for you — your agent, or your own code, decides what to buy.
        Stipend does the two things that decision cannot do for itself: it pays a vendor that has no
        account for you, and it refuses anything outside your caps before a signature exists. A
        router optimises price across models you already have access to; this is the layer that
        gives an agent access at all.
      </>
    ),
  },
  {
    q: 'DeepSeek already bills me per call. What does this add?',
    a: (
      <>
        Different layer, and your model invoice is untouched. Your provider already bills per token
        and already lets you set a usage limit, so there is nothing to fix there. Stipend is for
        everything else the agent needs: the search API, the headless browser, the OCR pass, the
        dataset vendor. Each of those normally wants an account, a card on file and a monthly plan,
        and none of them will sell you one page for three cents. That gap is the product.
      </>
    ),
  },
  {
    q: 'When would I not need Stipend?',
    a: (
      <>
        If your agent only ever calls one vendor, that vendor already bills per call, and you are
        happy with its own spend limit — you do not need this, and you should keep what you have.
        Stipend earns its place when the vendor count goes up, when a vendor will not sell you a
        single call, or when you want one budget and one audit trail across all of them.
      </>
    ),
  },
  {
    q: 'How does my agent actually use the API token?',
    a: (
      <>
        It is not an LLM key and it never touches your model provider. It identifies your agent to
        the vendors, and it is the only thing that can ask the wallet service to sign a payment.
        Your agent does three steps: ask the vendor and get a <span className="mono">402</span>,
        call <span className="mono">/api/agents/&lt;id&gt;/authorize</span> with the token to have the
        payment approved and signed against your caps, then retry with the returned{' '}
        <span className="mono">x-payment</span> header. The console prints that exact snippet under
        your agent — drop it into your harness next to your model call.
      </>
    ),
  },
  {
    q: 'So who holds the agent’s private key?',
    a: (
      <>
        In this demo, the server does, so the flow works in a browser with no extension and the
        caps cannot be bypassed by editing client code. In production the key lives where your agent
        runs, and the same token gates a policy program or a signing service. The enforcement point
        moves; the guarantee does not.
      </>
    ),
  },
  {
    q: 'What stops it from overspending?',
    a: (
      <>
        Three checks run between the price quote and the signature: the per-call cap, the rolling
        24-hour budget, and the payee allowlist. If any of them says no, no transaction is built.
        The ledger records the refusal with the reason, so you can see what was stopped, not just
        what was spent.
      </>
    ),
  },
  {
    q: 'What is dUSD?',
    a: (
      <>
        A devnet SPL token with six decimals that this project mints, so an agent has something
        stable to spend while you try it. It is not real money and it is not redeemable. The treasury
        mints it to your agent when you press top up.
      </>
    ),
  },
  {
    q: 'Does the vendor need an account, an API key or a billing integration?',
    a: (
      <>
        No. The vendor publishes a price on the <span className="mono">402</span>, then reads the
        payee&apos;s token balance straight off devnet before it returns a byte. Payment and proof
        are the same object, so there is nothing to reconcile later.
      </>
    ),
  },
  {
    q: 'Can a vendor overcharge me?',
    a: (
      <>
        It can quote anything it likes. What it cannot do is get paid above your per-call cap: the
        quote is checked before signing, so an inflated price becomes a refusal with a line in the
        ledger. The console&apos;s <strong>Test refusal</strong> button runs exactly this against a
        vendor quoting $5.00.
      </>
    ),
  },
  {
    q: 'What is real here, and what is not?',
    a: (
      <>
        Real: the signals vendor fetches public discussion live at call time and the step names the
        query it ran; the summariser and the memo are written by the model, and the console prints
        which model; every settlement, signature, balance change and refusal is a devnet transaction
        you can open in an explorer. Not real: the demo stablecoin (dUSD), minted by the treasury so
        you can try this with nothing at stake. If the live source is unreachable the vendor serves a
        cached snapshot and the step says <span className="mono">cached</span> instead of{' '}
        <span className="mono">live</span> — it never claims a fetch it did not make.
      </>
    ),
  },
  {
    q: 'What happens when devnet is slow or down?',
    a: (
      <>
        Nothing pretends to settle. A failed call is recorded as an error with the reason, the
        console shows it, and the retry logic uses backoff instead of hammering the RPC. The
        interface never shows a receipt that the chain does not have.
      </>
    ),
  },
];

export function Faq() {
  return (
    <Reveal className="faq">
      <h2 className="faq__title">Questions, answered plainly</h2>
      <p className="faq__lede">
        Including the one everybody asks: what do I actually paste into my agent?
      </p>
      <div className="faq__list">
        {ITEMS.map((item) => (
          <details className="faq__item" key={item.q}>
            <summary className="faq__q">{item.q}</summary>
            <div className="faq__a">{item.a}</div>
          </details>
        ))}
      </div>
      <p className="faq__foot">
        Still unclear? The console prints the handshake for your own agent, with your own token,{' '}
        <Link href="/start">under your agent</Link>.
      </p>
    </Reveal>
  );
}
