import Link from 'next/link';
import { DOCS } from './content';
import { DocsNav } from './layout';

export default function DocsIndex() {
  return (
    <>
      <aside className="docs__side">
        <DocsNav active="introduction" />
      </aside>
      <article className="docs__main">
        <p className="docs__eyebrow">Stipend documentation</p>
        <h1 className="docs__h1">Everything you need to put a budget on an agent</h1>
        <p className="docs__lede">
          Start with the introduction, or jump straight to the part you came for.
        </p>

        <div className="docs__cards">
          {DOCS.map((page) => (
            <Link className="docs__card" href={`/docs/${page.slug}`} key={page.slug}>
              <span className="docs__cardtitle">{page.title}</span>
              <span className="docs__cardsummary">{page.summary}</span>
            </Link>
          ))}
        </div>
      </article>
    </>
  );
}
