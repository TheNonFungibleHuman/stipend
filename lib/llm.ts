/**
 * One provider-agnostic call. The product does not care which model is behind
 * it; the demo does care that a missing key degrades to a deterministic engine
 * instead of a stack trace.
 */
export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  ms: number;
}

interface ProviderConfig {
  name: string;
  key: string;
  model: string;
  call: (args: { system: string; user: string; maxTokens: number; model: string; key: string }) => Promise<string>;
}

function provider(): ProviderConfig | null {
  const override = process.env.LLM_MODEL?.trim();
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseek) {
    return {
      name: 'deepseek',
      key: deepseek,
      // The current Flash model. `deepseek-chat` is an alias that resolves here
      // anyway; naming it explicitly stops the label lying about the model.
      model: override || 'deepseek-flash',
      call: async ({ system, user, maxTokens, model, key }) => {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            // DeepSeek V4.1 Flash is a reasoning model: the reasoning tokens are
            // drawn from max_tokens, so a small budget comes back with empty
            // content and finish_reason "length". Floor it, and ask for low
            // effort on these short extraction tasks.
            max_tokens: Math.max(maxTokens, 800),
            // These vendors do short, structured extraction. Left in thinking
            // mode, flash spends the whole token budget on reasoning and can
            // return empty content (finish_reason "length"); with thinking off
            // it answers the same questions in about a third of the time.
            thinking: { type: 'disabled' },
            temperature: 0.3,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
          signal: AbortSignal.timeout(90_000),
        });
        if (!response.ok) throw new Error(`deepseek ${response.status}`);
        const json = (await response.json()) as {
          choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        };
        const choice = json.choices?.[0];
        const content = choice?.message?.content ?? '';
        if (!content.trim() && choice?.finish_reason === 'length') {
          throw new Error('model hit the token ceiling before answering');
        }
        return content;
      },
    };
  }

  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      name: 'openai',
      key: openai,
      model: override || 'gpt-4o-mini',
      call: async ({ system, user, maxTokens, model, key }) => {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0.3,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) throw new Error(`openai ${response.status}`);
        const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return json.choices?.[0]?.message?.content ?? '';
      },
    };
  }

  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) {
    return {
      name: 'anthropic',
      key: anthropic,
      model: override || 'claude-3-5-sonnet-latest',
      call: async ({ system, user, maxTokens, model, key }) => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: user }],
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) throw new Error(`anthropic ${response.status}`);
        const json = (await response.json()) as { content?: Array<{ text?: string }> };
        return json.content?.map((part) => part.text ?? '').join('') ?? '';
      },
    };
  }

  return null;
}

/** Human names for the ids the API actually returns. */
const MODEL_NAMES: Record<string, string> = {
  'deepseek-flash': 'DeepSeek V4.1 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
};

export const prettyModel = (id: string): string => MODEL_NAMES[id] ?? id;

export function llmConfigured(): boolean {
  return provider() !== null;
}

export function llmLabel(): string {
  const config = provider();
  return config ? prettyModel(config.model) : 'deterministic';
}

export function llmProvider(): string {
  return provider()?.name ?? 'none';
}

/** Returns null instead of throwing: every caller has a deterministic fallback. */
let lastError: string | null = null;

/** Why the last model call fell back, so the UI can say it instead of hiding it. */
export function llmLastError(): string | null {
  return lastError;
}

export async function complete(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<LlmResult | null> {
  const config = provider();
  if (!config) {
    lastError = 'no model key configured';
    return null;
  }
  const started = Date.now();

  // A dropped connection should not silently downgrade a paid step. One retry
  // covers the transient case; anything persistent is reported in the note.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const text = await config.call({
        system: args.system,
        user: args.user,
        maxTokens: args.maxTokens ?? 700,
        model: config.model,
        key: config.key,
      });
      const trimmed = text.trim();
      if (!trimmed) {
        lastError = 'model returned an empty response';
        return null;
      }
      // The vendor rule tells the model to answer REFUSE when a request is out
      // of scope. Record that as the reason so the caller is told "declined",
      // not "no key" — those are different problems with different fixes.
      if (/^REFUSE\.?$/i.test(trimmed)) {
        lastError = 'the vendor declined this request as out of scope';
      } else {
        lastError = null;
      }
      return {
        text: trimmed,
        provider: config.name,
        model: prettyModel(config.model),
        ms: Date.now() - started,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const transient = /fetch failed|ECONNRESET|timeout|aborted|socket/i.test(lastError);
      if (!transient || attempt === 2) return null;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  return null;
}
