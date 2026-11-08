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
  source: 'live' | 'none';
  queries: string[];
  fetchedAt: string;
  note: string;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
  'should', 'we', 'our', 'us', 'is', 'are', 'do', 'does', 'how', 'what', 'why', 'when', 'which',
  'can', 'could', 'would', 'will', 'it', 'this', 'that', 'be', 'about', 'from', 'into', 'if',
  'launch', 'build', 'make', 'get', 'need', 'needs', 'want', 'new',
  'practice', 'practices', 'approach', 'approaches', 'strategy', 'example', 'examples',
  // Imperative verbs were ending up in the query, so "Recommend the best way to
  // configure persistent agent memory" searched for "recommend best way
  // configure" and matched noise instead of the subject.
  'recommend', 'suggest', 'advise', 'explain', 'describe', 'list', 'provide', 'give', 'show',
  'tell', 'find', 'help', 'best', 'way', 'ways', 'good', 'great', 'please', 'consider',
  'persistent', 'configure', 'configuration', 'setting', 'settings', 'setup', 'set',
]);

/** A cheap, honest query builder: the goal's own salient words, nothing clever. */
function queriesFor(goal: string): { keywords: string[]; phrase: string; primary: string } {
  const words = goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  const head = words.slice(0, 4).join(' ');
  // The subject usually trails the verb in a question: "what are competitors
  // charging for AI coding assistants" is about coding assistants, not charging.
  const tail = words.slice(-3).join(' ');
  const phrase = words.slice(-2).join(' ');

  const keywords = [...new Set([head, tail].filter((query) => query.length > 0))].slice(0, 2);
  if (keywords.length === 0) keywords.push('developer tooling pricing');
  // The single most specific word, used as a last resort when the full question
  // finds nothing: "whatsapp dispatcher" is empty, "whatsapp" is not.
  const primary = words[0] ?? '';
  return { keywords, phrase, primary };
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
  // Always the real discussion page, built from the real id.
  url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
  discussion: `https://news.ycombinator.com/item?id=${hit.objectID}`,
});

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    // Hyphens stay: "usage-based" is one word, and splitting it meant the
    // subject term never matched a title that used it.
    .split(/[^a-z0-9-]+/)
    .map((word) => word.replace(/^-+|-+$/g, ''))
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));


/** How many of the question's own terms appear in a thread title. */
function overlap(title: string, goalTokens: Set<string>): number {
  return tokens(title).filter((token) => goalTokens.has(token)).length;
}

/**
 * Both orderings on purpose.
 *
 * `/search` ranks by relevance and points, which is why the same 2023 and 2024
 * classics came back every time and the notes read like history. `/search_by_date`
 * with a date filter returns what people are saying this year; the two are
 * merged so the answer is current but still anchored in the threads that got
 * attention.
 */
async function search(
  keywords: string[],
  phrase: string,
  primary: string,
  goal: string,
  timeoutMs = 7_000,
): Promise<Signal[]> {
  const cutoff = Math.floor((Date.now() - 540 * 24 * 60 * 60 * 1000) / 1000);
  const runs = [
    ...keywords.map((query) => fetchHits('search', query, {}, timeoutMs).catch(() => [])),
    // A quoted phrase forces proximity, which is what stops "charging" matching
    // electric vehicles when the question is about coding assistants.
    phrase ? fetchHits('search', `"${phrase}"`, {}, timeoutMs).catch(() => []) : Promise.resolve([]),
    fetchHits('search', goal.slice(0, 120), {}, timeoutMs).catch(() => []),
    fetchHits('search_by_date', keywords[0] ?? phrase, { numericFilters: `created_at_i>${cutoff}` }, timeoutMs).catch(() => []),
    // Last resort: the most specific single word.
    primary ? fetchHits('search', primary, {}, timeoutMs).catch(() => []) : Promise.resolve([]),
  ];

  const hits = (await Promise.all(runs)).flat();

  const goalTokens = new Set(tokens(goal));
  const phraseWords = tokens(phrase);
  const seen = new Set<string>();
  const ordered: Signal[] = [];

  // Keep the order the source returned, which is its own relevance ranking.
  // Re-ranking here by date or points is what put electric-vehicle charging
  // above coding assistants; the search engine already knows better.
  for (const hit of hits) {
    // A hit without an id cannot be linked, and a dead link is worse than no link.
    if (typeof hit.title !== 'string' || !hit.objectID || seen.has(hit.objectID)) continue;
    seen.add(hit.objectID);
    ordered.push(toSignal(hit));
  }

  // Tier 1: the title carries every word of the phrase ("coding assistants").
  const strict = ordered.filter((signal) => {
    const titleTokens = new Set(tokens(signal.title));
    return phraseWords.length > 0 && phraseWords.every((word) => titleTokens.has(word));
  });

  // Tier 2: the subject word plus real overlap with the question. One shared
  // word is not evidence — "dispatcher" alone pulls in camera networks.
  const subject = ordered.filter((signal) => {
    const titleTokens = new Set(tokens(signal.title));
    return titleTokens.has(primary) && overlap(signal.title, goalTokens) >= 2;
  });

  const merged: Signal[] = [];
  const picked = new Set<string>();
  for (const signal of [...strict, ...subject]) {
    if (picked.has(signal.discussion)) continue;
    picked.add(signal.discussion);
    merged.push(signal);
    if (merged.length >= 6) break;
  }

  return merged;
}

/** A fixed snapshot used to be served here when the search failed. It held
 *  invented ids (`item?id=0`) and unrelated pricing threads, so a failed search
 *  quietly turned into a confident answer about the wrong subject. Nothing
 *  replaces it: when there is no relevant source, say so. */

export async function fetchSignals(goal: string): Promise<SignalResult> {
  const { keywords, phrase, primary } = queriesFor(goal);
  const queries = [...keywords, phrase].filter(Boolean);
  const failures: string[] = [];

  let fetched: Signal[] = [];
  try {
    fetched = await search(keywords, phrase, primary, goal);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

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
  const signals = (recentOnly.length >= 2 ? recentOnly : deduped).slice(0, 6);

  if (signals.length === 0) {
    return {
      signals: [],
      source: 'none',
      queries,
      fetchedAt: new Date().toISOString(),
      note:
        failures.length > 0
          ? `the source could not be reached (${failures[0]}), so nothing was returned`
          : `nothing relevant found for "${queries.join('", "')}" — no data was returned rather than unrelated data`,
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
