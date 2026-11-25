import { ProviderError } from './types';

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

let fetchImpl: FetchFn | null = null;

/** No app usa `expo/fetch` (suporta streaming); nos testes pode ser trocado. */
export function getFetch(): FetchFn {
  if (fetchImpl) return fetchImpl;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo/fetch');
    fetchImpl = mod.fetch as FetchFn;
  } catch {
    fetchImpl = globalThis.fetch.bind(globalThis) as FetchFn;
  }
  return fetchImpl;
}

export function setFetch(fn: FetchFn | null) {
  fetchImpl = fn;
}

export function errorFromStatus(status: number, body: string): ProviderError {
  const detail = body.slice(0, 300);
  if (status === 401 || status === 403) return new ProviderError('invalid_key', detail || 'Chave inválida', status);
  if (status === 402) return new ProviderError('no_credit', detail || 'Sem saldo', status);
  if (status === 429) return new ProviderError(/quota|credit|billing|insufficient/i.test(body) ? 'no_credit' : 'rate_limit', detail, status);
  if (status === 404) return new ProviderError('unavailable', detail || 'Modelo ou endereço não encontrado', status);
  if (status >= 500) return new ProviderError('unavailable', detail || 'Serviço indisponível', status);
  return new ProviderError('unknown', detail || `HTTP ${status}`, status);
}

export async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await getFetch()(url, init);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ProviderError('network', (e as Error)?.message ?? 'Falha de rede');
  }
  if (!res.ok) throw errorFromStatus(res.status, await res.text().catch(() => ''));
  return res;
}

export async function requestJson<T = any>(url: string, init: RequestInit): Promise<T> {
  const res = await request(url, init);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ProviderError('bad_response', 'Resposta inválida do provedor');
  }
}

/** Lê um corpo SSE e chama onData para cada linha `data:`. */
export async function readSse(res: Response, onData: (data: string) => void): Promise<void> {
  const body = res.body as ReadableStream<Uint8Array> | null;
  const handleLines = (text: string) => {
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('data:')) {
        const data = t.slice(5).trim();
        if (data && data !== '[DONE]') onData(data);
      }
    }
  };
  if (!body || typeof body.getReader !== 'function') {
    handleLines(await res.text());
    return;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lastBreak = buffer.lastIndexOf('\n');
    if (lastBreak !== -1) {
      handleLines(buffer.slice(0, lastBreak));
      buffer = buffer.slice(lastBreak + 1);
    }
  }
  handleLines(buffer + decoder.decode());
}

export function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[n & 63] : '=';
  }
  return out;
}

export function dataUriToBlobParts(dataUri: string): { mime: string; base64: string } {
  const m = dataUri.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { mime: m[1], base64: m[2] } : { mime: 'image/png', base64: dataUri };
}
