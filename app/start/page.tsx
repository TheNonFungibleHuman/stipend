import Link from 'next/link';
import { Onboard } from '../components/Onboard';

export const metadata = {
  title: 'Create an agent — Stipend',
};

export default function StartPage() {
  return (
    <main className="cabinet">
      <header className="plate">
        <Link className="plate__brand" href="/">
          <span className="plate__serial">S-402</span>
          <span className="plate__name">Stipend</span>
        </Link>
        <div className="plate__right">
          <span className="lamp lamp--live">devnet</span>
          <Link className="plate__meta plate__link" href="/app">
            skip — use the demo agent →
          </Link>
        </div>
      </header>

      <Onboard />
    </main>
  );
}
