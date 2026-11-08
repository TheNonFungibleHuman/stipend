import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DOCS } from '../content';
import { DocsNav } from '../layout';

export function generateStaticParams() {
  return DOCS.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = DOCS.find((entry) => entry.slug === slug);
  return { title: page ? `${page.title} — Stipend docs` : 'Docs — Stipend' };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = DOCS.find((entry) => entry.slug === slug);
  if (!page) notFound();

  const index = DOCS.findIndex((entry) => entry.slug === slug);
  const next = DOCS[index + 1];

  return (
    <>
      <aside className="docs__side">
        <DocsNav active={page.slug} />
      </aside>
      <article className="docs__main">
        <p className="docs__eyebrow">
          Doc {String(index + 1).padStart(2, '0')} of {String(DOCS.length).padStart(2, '0')}
        </p>
        <h1 className="docs__h1">{page.title}</h1>
        <p className="docs__lede">{page.summary}</p>
        {page.body}
        <nav className="docs__pager">
          {next ? (
            <Link href={`/docs/${next.slug}`} className="docs__next">
              Next — {next.title} →
            </Link>
          ) : (
            <Link href="/docs" className="docs__next">
              ← Back to the index
            </Link>
          )}
        </nav>
      </article>
    </>
  );
}
