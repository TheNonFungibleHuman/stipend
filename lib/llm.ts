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
      model: override || 'deepseek-chat',
      call: async ({ system, user, maxTokens, model, key }) => {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
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
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`deepseek ${response.status}`);
        const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        return json.choices?.[0]?.message?.content ?? '';
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
          signal: AbortSignal.timeout(30_000),
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
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`anthropic ${response.status}`);
        const json = (await response.json()) as { content?: Array<{ text?: string }> };
        return json.content?.map((part) => part.text ?? '').join('') ?? '';
      },
    };
  }

  return null;
}

export function llmConfigured(): boolean {
  return provider() !== null;
}

export function llmLabel(): string {
  const config = provider();
  return config ? `${config.name}/${config.model}` : 'deterministic';
}

/** Returns null instead of throwing: every caller has a deterministic fallback. */
export async function complete(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<LlmResult | null> {
  const config = provider();
  if (!config) return null;
  const started = Date.now();
  try {
    const text = await config.call({
      system: args.system,
      user: args.user,
      maxTokens: args.maxTokens ?? 700,
      model: config.model,
      key: config.key,
    });
    const trimmed = text.trim();
    if (!trimmed) return null;
    return { text: trimmed, provider: config.name, model: config.model, ms: Date.now() - started };
  } catch {
    return null;
  }
}
