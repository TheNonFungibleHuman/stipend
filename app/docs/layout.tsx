import Link from 'next/link';
import { DOCS } from './content';

export const metadata = {
  title: 'Docs — Stipend',
  description: 'How Stipend works, how to install it, how the policy is enforced, and what to do when something breaks.',
};

export function DocsNav({ active }: { active: string }) {
  return (
    <nav className="docs__nav" aria-label="Documentation">
      <span className="docs__navlabel">Documentation</span>
      {DOCS.map((page) => (
        <Link
          key={page.slug}
          href={`/docs/${page.slug}`}
          className={`docs__link${active === page.slug ? ' is-active' : ''}`}
        >
          {page.title}
        </Link>
      ))}
      <span className="docs__navlabel docs__navlabel--second">Elsewhere</span>
      <Link className="docs__link" href="/">
        Landing page
      </Link>
      <Link className="docs__link" href="/app">
        Console
      </Link>
      <Link className="docs__link" href="/start">
        Create an agent
      </Link>
    </nav>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="cabinet">
      <header className="plate">
        <Link className="plate__brand" href="/">
          <span className="plate__serial">S-402</span>
          <span className="plate__name">Stipend</span>
        </Link>
        <div className="plate__right">
          <span className="lamp lamp--live">docs</span>
          <Link className="plate__meta plate__link" href="/app">
            open the console →
          </Link>
        </div>
      </header>
      <div className="docs">{children}</div>
    </main>
  );
}
