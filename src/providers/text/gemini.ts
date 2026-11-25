import { readSse, request, requestJson, safeJson } from '../http';
import type { ChatMessage, ChatOptions, ModelInfo, TextProvider } from '../types';
import { ProviderError } from '../types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function gemini(apiKey: string): TextProvider {
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };

  async function listModels(): Promise<ModelInfo[]> {
    const json = await requestJson(`${BASE}/models?pageSize=200`, { headers });
    return (json?.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: any) => ({ id: String(m.name).replace(/^models\//, ''), name: m.displayName ?? m.name }));
  }

  const textOf = (json: any) => (json?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');

  async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const stream = !!opts.onToken;
    const url = `${BASE}/models/${encodeURIComponent(opts.model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
    const res = await request(url, {
      method: 'POST',
      headers,
      signal: opts.signal,
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { temperature: opts.temperature, maxOutputTokens: opts.maxTokens },
      }),
    });
    if (!stream) {
      const text = textOf(safeJson(await res.text()));
      if (!text) throw new ProviderError('bad_response', 'Resposta vazia (talvez bloqueada pelo filtro do Gemini)');
      return text;
    }
    let out = '';
    await readSse(res, (data) => {
      const chunk = textOf(safeJson(data));
      if (chunk) {
        out += chunk;
        opts.onToken!(chunk);
      }
    });
    return out;
  }

  return { id: 'gemini', listModels, chat, testKey: async () => void (await listModels()) };
}
