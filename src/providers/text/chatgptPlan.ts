import { readSse, request, requestJson, safeJson } from '../http';
import type { ChatMessage, ChatOptions, ModelInfo, TextProvider } from '../types';
import { ProviderError } from '../types';

const BASE = 'https://api.openai.com/v1';

const PLAN_LIMIT_CODES = ['subscription_sharing_usage_limit_exceeded', 'subscription_sharing_usage_unavailable'];

function failure(err: any): ProviderError {
  const code = String(err?.code ?? err?.error?.code ?? '');
  const message = String(err?.message ?? err?.error?.message ?? code ?? 'Erro do ChatGPT');
  if (PLAN_LIMIT_CODES.includes(code)) return new ProviderError('plan_limit', message);
  return new ProviderError('unknown', message);
}

/**
 * Texto pela assinatura do ChatGPT (Responses API com token do login).
 * Regras da prévia: sempre stream, store=false, sem temperature/max_output_tokens,
 * sem mensagens "system" (vão em `instructions`).
 */
export function chatgptPlan(getToken: () => Promise<string>): TextProvider {
  const headers = async (accept: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await getToken()}`,
    Accept: accept,
  });

  async function listModels(): Promise<ModelInfo[]> {
    const json = await requestJson(`${BASE}/models`, { headers: await headers('application/json') });
    const list: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
    return list
      .filter((m) => m && (m.visibility === undefined || m.visibility === 'list'))
      .map((m) => ({ id: String(m.id ?? m.slug), name: String(m.display_name ?? m.name ?? m.id ?? m.slug) }))
      .filter((m) => m.id && m.id !== 'undefined');
  }

  /** Nunca envia modelo vazio: se faltar, usa o primeiro da conta. */
  async function resolveModel(model: string): Promise<string> {
    if (model.trim()) return model.trim();
    const first = (await listModels())[0]?.id;
    if (!first) throw new ProviderError('unavailable', 'Escolha um modelo em Configurações → Carregar lista de modelos.');
    return first;
  }

  async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    const instructions = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const input = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
    const model = await resolveModel(opts.model);
    const res = await request(`${BASE}/responses`, {
      method: 'POST',
      headers: await headers('text/event-stream'),
      signal: opts.signal,
      body: JSON.stringify({ model, instructions: instructions || undefined, input, store: false, stream: true }),
    });
    let out = '';
    let completed = false;
    await readSse(res, (data) => {
      const ev = safeJson(data);
      switch (ev?.type) {
        case 'response.output_text.delta':
          if (typeof ev.delta === 'string') {
            out += ev.delta;
            opts.onToken?.(ev.delta);
          }
          break;
        case 'response.completed':
          completed = true;
          break;
        case 'response.incomplete':
          // Resposta cortada: aproveitamos o que veio.
          completed = true;
          break;
        case 'response.failed':
          throw failure(ev.response?.error ?? ev.response);
        case 'error':
          throw failure(ev);
      }
    });
    if (!completed && !out) throw new ProviderError('bad_response', 'A conexão com o ChatGPT caiu. Tente de novo.');
    return out;
  }

  return { id: 'chatgpt', listModels, chat, testKey: async () => void (await listModels()) };
}
