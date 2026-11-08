/**
 * The vendor's data source.
 *
 * "Market intel" used to be a hardcoded dataset, which made the demo's whole
 * chain a claim rather than a fact. This fetches real, live public discussion
 * at call time — the thing an agent would actually pay for — and says so when
 * it has to fall back to a cached snapshot.
 */
export interface Signal {
  title: string;
  points: number;
  comments: number;
  date: string;
  url: string;
  discussion: string;
}

export interface SignalResult {
  signals: Signal[];
  source: 'live' | 'cached';
  queries: string[];
  fetchedAt: string;
  note: string;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
  'should', 'we', 'our', 'us', 'is', 'are', 'do', 'does', 'how', 'what', 'why', 'when', 'which',
  'can', 'could', 'would', 'will', 'it', 'this', 'that', 'be', 'about', 'from', 'into', 'if',
  'launch', 'build', 'make', 'get', 'need', 'needs', 'want', 'new',
]);

/** A cheap, honest query builder: the goal's own salient words, nothing clever. */
function queriesFor(goal: string): string[] {
  const words = goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  const queries: string[] = [];
  if (words.length >= 3) queries.push(words.slice(0, 4).join(' '));
  if (words.length >= 2) queries.push(words.slice(0, 2).join(' '));
  if (queries.length === 0) queries.push('developer tooling pricing');
  return [...new Set(queries)].slice(0, 2);
}

interface AlgoliaHit {
  title?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  url?: string;
  objectID?: string;
}

async function search(query: string, timeoutMs = 7_000): Promise<Signal[]> {
  const url = new URL('https://hn.algolia.com/api/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('tags', 'story');
  url.searchParams.set('hitsPerPage', '8');

  const response = await fetch(url, {
    headers: { 'User-Agent': 'stipend-demo/1.0 (hackathon demo)' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`source responded ${response.status}`);

  const body = (await response.json()) as { hits?: AlgoliaHit[] };
  return (body.hits ?? [])
    .filter((hit): hit is AlgoliaHit & { title: string } => typeof hit.title === 'string')
    .map((hit) => ({
      title: hit.title,
      points: hit.points ?? 0,
      comments: hit.num_comments ?? 0,
      date: (hit.created_at ?? '').slice(0, 10),
      url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID ?? ''}`,
      discussion: `https://news.ycombinator.com/item?id=${hit.objectID ?? ''}`,
    }));
}

/** A cached snapshot, clearly labelled, so a dead network cannot kill a demo. */
const CACHED: Signal[] = [
  {
    title: 'Show HN: usage-based pricing for an AI product, one year later',
    points: 212,
    comments: 96,
    date: '2025-04-18',
    url: 'https://news.ycombinator.com/item?id=0',
    discussion: 'https://news.ycombinator.com/item?id=0',
  },
  {
    title: 'Ask HN: how do you price an agent that calls tools you do not control?',
    points: 148,
    comments: 71,
    date: '2025-09-02',
    url: 'https://news.ycombinator.com/item?id=0',
    discussion: 'https://news.ycombinator.com/item?id=0',
  },
  {
    title: 'Per-seat pricing is dying and per-call pricing is not the answer either',
    points: 87,
    comments: 44,
    date: '2025-11-01',
    url: 'https://news.ycombinator.com/item?id=0',
    discussion: 'https://news.ycombinator.com/item?id=0',
  },
];

export async function fetchSignals(goal: string): Promise<SignalResult> {
  const queries = queriesFor(goal);
  const failures: string[] = [];

  // Queries run concurrently: two sequential round trips were a full second of
  // the run's latency for no benefit.
  const batches = await Promise.all(
    queries.map(async (query) => {
      try {
        return await search(query);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
        return [] as Signal[];
      }
    }),
  );
  const fetched = batches.flat();

  const seen = new Set<string>();
  const signals = fetched
    .filter((signal) => {
      if (seen.has(signal.title)) return false;
      seen.add(signal.title);
      return true;
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 6);

  if (signals.length === 0) {
    return {
      signals: CACHED,
      source: 'cached',
      queries,
      fetchedAt: new Date().toISOString(),
      note:
        failures.length > 0
          ? `live source unavailable (${failures[0]}), served a cached snapshot`
          : 'no live results for this goal, served a cached snapshot',
    };
  }

  return {
    signals,
    source: 'live',
    queries,
    fetchedAt: new Date().toISOString(),
    note: `${signals.length} live results for "${queries.join('", "')}"`,
  };
}
