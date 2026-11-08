import Link from 'next/link';
import { Faq } from './components/Faq';
import { HeroDial } from './components/HeroDial';
import { HowItWorks } from './components/HowItWorks';
import { Proof } from './components/Proof';
import { Reveal } from './components/Reveal';
import { Scenario } from './components/Scenario';

export const metadata = {
  title: 'Stipend — give your agent a budget, not your keys',
  description:
    'An AI agent with its own wallet and a spending policy enforced before every signature. It buys what it needs one call at a time, and the receipts settle on Solana in about half a second.',
};

const CONSOLE_PANELS = [
  {
    k: 'Status',
    v: 'Spent today, budget left, balance, paid calls, median settle time, errors.',
  },
  {
    k: 'Job',
    v: 'The goal, the pipeline, and every step as it quotes, signs, settles or refuses.',
  },
  {
    k: 'Limits',
    v: 'Per-call cap and daily budget, editable while a run is in flight.',
  },
  {
    k: 'Ledger',
    v: 'Every payment and refusal with settle time, balance after, and the explorer link.',
  },
];

export default function Landing() {
  return (
    <main className="cabinet">
      <header className="plate">
        <Link className="plate__brand" href="/">
          <span className="plate__serial">S-402</span>
          <span className="plate__name">Stipend</span>
        </Link>
        <div className="plate__right">
          <span className="lamp lamp--live">devnet</span>
          <nav className="nav" aria-label="Main">
            <a className="nav__link" href="https://stipend.docs7.io" target="_blank" rel="noreferrer">
              Docs
            </a>
            <Link className="nav__link" href="#how-it-works">
              How it works
            </Link>
            <Link className="nav__link" href="#faq">
              FAQ
            </Link>
            <Link className="nav__cta" href="/app">
              Console →
            </Link>
          </nav>
        </div>
      </header>

      <section className="bay bay--landing">
        <div>
          <p className="kicker">For anyone about to hand an agent a payment method</p>
          <h1 className="thesis">
            Your agent gets a <em>budget</em>.
            <br />
            Not your keys.
          </h1>
          <p className="gloss">
            An agent that buys data with your card is an agent you cannot audit. Stipend gives it its
            own wallet, a spending policy checked <strong>before every signature</strong>, and a
            receipt for each purchase that settles on Solana in about half a second.
          </p>

          <div className="controls">
            <Link className="key key--go" href="/start">
              Create your agent
              <span className="key__price">2 minutes</span>
            </Link>
            <Link className="key key--stop" href="/app">
              Open the demo console
              <span className="key__price">no signup</span>
            </Link>
          </div>

          <ul className="legend">
            <li className="legend__item">
              Real devnet settlement<span className="legend__price">0.4s</span>
            </li>
            <li className="legend__item">
              Policy before signature<span className="legend__price">enforced</span>
            </li>
            <li className="legend__item">
              Every receipt<span className="legend__price">on explorer</span>
            </li>
          </ul>
        </div>

        <HeroDial />
      </section>

      <Reveal className="problem">
        <div className="problem__cell">
          <span className="problem__k">Card rails</span>
          <span className="problem__v problem__v--warn">$0.30 + 2.9%</span>
          <span className="problem__note">
            charged on every transaction, so a four-cent sale loses twenty-six cents
          </span>
        </div>
        <div className="problem__cell">
          <span className="problem__k">Solana</span>
          <span className="problem__v problem__v--ok">5,000 lamports</span>
          <span className="problem__note">
            about a hundred-thousandth of a cent, which is the only reason per-call pricing exists
          </span>
        </div>
        <div className="problem__cell">
          <span className="problem__k">What changes</span>
          <span className="problem__v">Per-call buying</span>
          <span className="problem__note">
            an agent can pay two cents for one answer, from a vendor that would otherwise want a
            plan and a card on file
          </span>
        </div>
      </Reveal>

      <Reveal delay={40}>
        <Scenario />
      </Reveal>

      <Reveal delay={60}>
        <div id="how-it-works">
          <HowItWorks />
        </div>
      </Reveal>

      <Proof />

      <Reveal className="panels">
        <div className="panels__head">
          <h2 className="panels__title">What you get when you sign in</h2>
          <p className="panels__lede">
            The console is not a pitch. It is the four panels you use every day once an agent is
            spending.
          </p>
        </div>
        <div className="panels__grid">
          {CONSOLE_PANELS.map((panel) => (
            <div className="panels__cell" key={panel.k}>
              <span className="panels__k">{panel.k}</span>
              <span className="panels__v">{panel.v}</span>
            </div>
          ))}
        </div>
      </Reveal>

      <div id="faq">
        <Faq />
      </div>

      <Reveal className="closing">
        <div>
          <h2 className="closing__title">Set the caps once. Then let it buy.</h2>
          <p className="closing__body">
            You will name the agent, choose a per-call cap and a daily budget, and get back a wallet,
            an API token and a console. It takes about two minutes, and nothing is signed until you
            run a job.
          </p>
        </div>
        <div className="closing__actions">
          <Link className="key key--go" href="/start">
            Create your agent
          </Link>
          <Link className="key key--stop" href="/app">
            See it working first
          </Link>
        </div>
      </Reveal>

      <footer className="foot">
        <span>Solana devnet · demo stablecoin · signals fetched live at call time</span>
        <span>built for the MLH × Solana hackathon</span>
      </footer>
    </main>
  );
}
