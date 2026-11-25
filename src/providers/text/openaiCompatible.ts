import { readSse, request, requestJson, safeJson } from '../http';
import type { ChatMessage, ChatOptions, ModelInfo, TextProvider } from '../types';
import { ProviderError } from '../types';

export interface OpenAICompatibleConfig {
  id: string;
  baseUrl: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
  /** Filtra a lista de modelos (ex.: só modelos de chat na OpenAI). */
  modelFilter?: (id: string) => boolean;
}

/** Serve para OpenRouter, OpenAI e Ollama (endpoint /v1 compatível). */
export function openAICompatible(cfg: OpenAICompatibleConfig): TextProvider {
  const headers = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    ...cfg.extraHeaders,
  });

  async function listModels(): Promise<ModelInfo[]> {
    const json = await requestJson(`${cfg.baseUrl}/models`, { headers: headers() });
    const data: any[] = json?.data ?? json?.models ?? [];
    return data
      .map((m) => ({ id: String(m.id ?? m.name), name: String(m.name ?? m.id) }))
      .filter((m) => !cfg.modelFilter || cfg.modelFilter(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    const stream = !!opts.onToken;
    const res = await request(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: headers(),
      signal: opts.signal,
      body: JSON.stringify({
        model: opts.model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream,
      }),
    });
    if (!stream) {
      const json = safeJson(await res.text());
      const text = json?.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new ProviderError('bad_response', json?.error?.message ?? 'Resposta vazia');
      return text;
    }
    let out = '';
    await readSse(res, (data) => {
      const json = safeJson(data);
      if (json?.error) throw new ProviderError('unknown', json.error.message ?? 'Erro do provedor');
      const delta: string | undefined = json?.choices?.[0]?.delta?.content;
      if (delta) {
        out += delta;
        opts.onToken!(delta);
      }
    });
    return out;
  }

  return {
    id: cfg.id,
    listModels,
    chat,
    testKey: async () => {
      await listModels();
    },
  };
}
