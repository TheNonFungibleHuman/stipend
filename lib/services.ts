import { complete, llmConfigured, llmLastError } from './llm';
import { fetchSignals, type Signal } from './vendors/signals';

/**
 * What the agent buys.
 *
 * The signal vendor fetches real public discussion at call time; the summariser
 * and brief writer are the model's work. When no LLM key is configured both fall
 * back to deterministic text and say so — the console prints which engine ran.
 */
export type Engine = 'fetch' | 'model' | 'deterministic';

export interface ServiceResult {
  serviceId: string;
  output: unknown;
  engine: Engine;
  model?: string;
  source?: 'live' | 'cached';
  note?: string;
  computeMs: number;
}

function signalsFrom(value: unknown): Signal[] | null {
  const candidate = value as { signals?: unknown } | null | undefined;
  if (candidate && Array.isArray(candidate.signals) && candidate.signals.length > 0) {
    return candidate.signals
      .filter((signal): signal is Signal => typeof (signal as Signal)?.title === 'string')
      .slice(0, 8);
  }
  return null;
}

function notesFrom(value: unknown): string[] {
  const candidate = value as { notes?: unknown } | null | undefined;
  if (candidate && Array.isArray(candidate.notes)) {
    return candidate.notes.filter((note): note is string => typeof note === 'string').slice(0, 6);
  }
  return [];
}

/** A fallback is a fact about the run, so it gets said out loud. */
function fallbackNote(sourceNote: string): string {
  const reason = llmLastError();
  return reason ? `${sourceNote} · model call failed: ${reason}` : `${sourceNote} · no model key`;
}

const bulletise = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((line) => line.length > 12)
    .slice(0, 5);

function deterministicNotes(signals: Signal[]): string[] {
  const top = [...signals].sort((a, b) => b.points - a.points);
  const totalComments = signals.reduce((sum, signal) => sum + signal.comments, 0);
  const years = [...new Set(signals.map((signal) => signal.date.slice(0, 4)))].sort();
  return [
    `${signals.length} live signals, ${top[0]?.points ?? 0} points at the top, ${totalComments} comments in total.`,
    `The loudest thread is “${top[0]?.title ?? 'none'}” (${top[0]?.date ?? 'unknown date'}).`,
    `Coverage spans ${years[0] ?? '—'} to ${years[years.length - 1] ?? '—'}, so some of this is settled opinion and some is not.`,
    `Nobody in the results is selling the thing you are priced for; that is the gap to argue.`,
  ];
}

function deterministicMemo(goal: string, signals: Signal[]): string {
  const top = [...signals].sort((a, b) => b.points - a.points)[0];
  return (
    `Recommendation: price per call and publish the ceiling, because the loudest live signal — ` +
    `“${top?.title ?? 'no signal'}” with ${top?.points ?? 0} points — is a market arguing about ` +
    `commitment, not about price levels. Charge for the unit the buyer can stop, keep the floor ` +
    `low enough that a single call is defensible, and make the daily cap the thing you sell ` +
    `against a seat. Risk: with ${signals.reduce((sum, signal) => sum + signal.comments, 0)} ` +
    `comments behind these threads, expectations are already set by people who have been burned ` +
    `by usage bills; a surprise invoice costs more trust than the revenue it adds. ` +
    `Original ask: “${goal}”.`
  );
}

export async function runService(
  serviceId: string,
  context: { query: string; intel?: unknown },
): Promise<ServiceResult> {
  const started = Date.now();

  if (serviceId === 'market-intel') {
    const result = await fetchSignals(context.query);
    return {
      serviceId,
      output: result,
      engine: 'fetch',
      source: result.source,
      note: result.note,
      computeMs: Date.now() - started,
    };
  }

  const signals = signalsFrom(context.intel) ?? (await fetchSignals(context.query)).signals;
  const sourceNote =
    (context.intel as { source?: 'live' | 'cached' } | null | undefined)?.source === 'cached'
      ? 'cached snapshot'
      : 'live signals';

  if (serviceId === 'summarize') {
    if (llmConfigured()) {
      const result = await complete({
        system:
          'You are a research analyst. Given real discussion threads, return 3-4 short bullets of ' +
          'decision-grade insight for a founder. No preamble, no headings, no markdown bold. ' +
          'Each bullet under 22 words. Reference the strongest evidence by name.',
        user: `Goal: ${context.query}\n\nLive threads:\n${signals
          .map((signal) => `- "${signal.title}" (${signal.points} pts, ${signal.comments} comments, ${signal.date})`)
          .join('\n')}\n\nWrite the bullets.`,
        maxTokens: 400,
      });
      if (result) {
        return {
          serviceId,
          output: { notes: bulletise(result.text), signalCount: signals.length },
          engine: 'model',
          model: result.model,
          note: sourceNote,
          computeMs: Date.now() - started,
        };
      }
    }
    return {
      serviceId,
      output: { notes: deterministicNotes(signals), signalCount: signals.length },
      engine: 'deterministic',
      note: fallbackNote(sourceNote),
      computeMs: Date.now() - started,
    };
  }

  if (serviceId === 'brief-writer') {
    const notes = notesFrom(context.intel);
    if (llmConfigured()) {
      const result = await complete({
        system:
          'You write one-page memos for operators. Plain prose, 120 words max, no markdown, no ' +
          'preamble. Open with the recommendation, then the reasoning, then the risk.',
        user:
          `Goal: ${context.query}\n\nThreads:\n${signals
            .map((signal) => `- "${signal.title}" (${signal.points} pts, ${signal.date})`)
            .join('\n')}\n\n` +
          (notes.length > 0 ? `Notes already bought:\n${notes.join('\n')}\n\n` : '') +
          'Write the memo.',
        maxTokens: 500,
      });
      if (result) {
        return {
          serviceId,
          output: { memo: result.text },
          engine: 'model',
          model: result.model,
          note: sourceNote,
          computeMs: Date.now() - started,
        };
      }
    }
    return {
      serviceId,
      output: { memo: deterministicMemo(context.query, signals) },
      engine: 'deterministic',
      note: fallbackNote(sourceNote),
      computeMs: Date.now() - started,
    };
  }

  return {
    serviceId,
    output: { text: `no implementation for ${serviceId}` },
    engine: 'deterministic',
    computeMs: Date.now() - started,
  };
}
