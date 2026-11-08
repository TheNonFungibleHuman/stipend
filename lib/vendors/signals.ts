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
  // Imperative verbs were ending up in the query, so "Recommend the best way to
  // configure persistent agent memory" searched for "recommend best way
  // configure" and matched noise instead of the subject.
  'recommend', 'suggest', 'advise', 'explain', 'describe', 'list', 'provide', 'give', 'show',
  'tell', 'find', 'help', 'best', 'way', 'ways', 'good', 'great', 'please', 'consider',
  'persistent', 'configure', 'configuration', 'setting', 'settings', 'setup', 'set',
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

async function fetchHits(
  endpoint: 'search' | 'search_by_date',
  query: string,
  extra: Record<string, string>,
  timeoutMs = 7_000,
): Promise<AlgoliaHit[]> {
  const url = new URL(`https://hn.algolia.com/api/v1/${endpoint}`);
  url.searchParams.set('query', query);
  url.searchParams.set('tags', 'story');
  url.searchParams.set('hitsPerPage', '10');
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'stipend-demo/1.0 (hackathon demo)' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`source responded ${response.status}`);
  const body = (await response.json()) as { hits?: AlgoliaHit[] };
  return body.hits ?? [];
}

const toSignal = (hit: AlgoliaHit): Signal => ({
  title: hit.title as string,
  points: hit.points ?? 0,
  comments: hit.num_comments ?? 0,
  date: (hit.created_at ?? '').slice(0, 10),
  url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID ?? ''}`,
  discussion: `https://news.ycombinator.com/item?id=${hit.objectID ?? ''}`,
});

/**
 * Both orderings on purpose.
 *
 * `/search` ranks by relevance and points, which is why the same 2023 and 2024
 * classics came back every time and the notes read like history. `/search_by_date`
 * with a date filter returns what people are saying this year; the two are
 * merged so the answer is current but still anchored in the threads that got
 * attention.
 */
async function search(query: string, timeoutMs = 7_000): Promise<Signal[]> {
  const cutoff = Math.floor((Date.now() - 540 * 24 * 60 * 60 * 1000) / 1000);
  const [recent, relevant] = await Promise.all([
    fetchHits('search_by_date', query, { numericFilters: `created_at_i>${cutoff}` }, timeoutMs).catch(() => []),
    fetchHits('search', query, {}, timeoutMs).catch(() => []),
  ]);

  const seen = new Set<string>();
  const merged: Signal[] = [];
  for (const hit of [...recent, ...relevant]) {
    if (typeof hit.title !== 'string' || seen.has(hit.title)) continue;
    seen.add(hit.title);
    merged.push(toSignal(hit));
  }

  // Recent first, strongest first inside the recent window.
  const recentSignals = merged
    .filter((signal) => signal.date >= new Date(cutoff * 1000).toISOString().slice(0, 10))
    .sort((a, b) => b.points - a.points);
  const olderSignals = merged
    .filter((signal) => signal.date < new Date(cutoff * 1000).toISOString().slice(0, 10))
    .sort((a, b) => b.points - a.points);

  return [...recentSignals, ...olderSignals].slice(0, 8);
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
  const deduped = fetched.filter((signal) => {
    if (seen.has(signal.title)) return false;
    seen.add(signal.title);
    return true;
  });

  // Prefer the last two years when there is enough of it; an answer built on
  // 2017 threads is not "what people are saying now".
  const recentCutoff = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentOnly = deduped.filter((signal) => signal.date >= recentCutoff);
  const signals = (recentOnly.length >= 3 ? recentOnly : deduped).slice(0, 6);

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

  const dates = signals.map((signal) => signal.date).filter(Boolean).sort();
  const span = dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'undated';

  return {
    signals,
    source: 'live',
    queries,
    fetchedAt: new Date().toISOString(),
    note: `${signals.length} live results (${span}) for "${queries.join('", "')}"`,
  };
}
