import { readSse, request, requestJson, safeJson } from '../http';
import type { ChatMessage, ChatOptions, ModelInfo, TextProvider } from '../types';
import { ProviderError } from '../types';

const BASE = 'https://api.anthropic.com/v1';

export function anthropic(apiKey: string): TextProvider {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };

  async function listModels(): Promise<ModelInfo[]> {
    const json = await requestJson(`${BASE}/models?limit=100`, { headers });
    return (json?.data ?? []).map((m: any) => ({ id: m.id, name: m.display_name ?? m.id }));
  }

  async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    // A API exige alternância user/assistant: junta mensagens seguidas do mesmo papel.
    const turns: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      const last = turns[turns.length - 1];
      if (last && last.role === m.role) last.content += `\n\n${m.content}`;
      else turns.push({ role: m.role, content: m.content });
    }
    const stream = !!opts.onToken;
    const res = await request(`${BASE}/messages`, {
      method: 'POST',
      headers,
      signal: opts.signal,
      body: JSON.stringify({
        model: opts.model,
        system: system || undefined,
        messages: turns,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature,
        stream,
      }),
    });
    if (!stream) {
      const json = safeJson(await res.text());
      const text = (json?.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      if (!text) throw new ProviderError('bad_response', 'Resposta vazia');
      return text;
    }
    let out = '';
    await readSse(res, (data) => {
      const json = safeJson(data);
      if (json?.type === 'error') throw new ProviderError('unknown', json.error?.message ?? 'Erro');
      if (json?.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
        out += json.delta.text;
        opts.onToken!(json.delta.text);
      }
    });
    return out;
  }

  return { id: 'anthropic', listModels, chat, testKey: async () => void (await listModels()) };
}
