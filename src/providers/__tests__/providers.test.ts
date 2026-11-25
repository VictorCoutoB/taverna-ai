import { setFetch } from '../http';
import { anthropic } from '../text/anthropic';
import { gemini } from '../text/gemini';
import { openAICompatible } from '../text/openaiCompatible';
import { localSdImage, openRouterImage } from '../image';
import { ProviderError } from '../types';

jest.mock('expo-speech', () => ({}));
jest.mock('expo-audio', () => ({}));
jest.mock('expo-file-system', () => ({}));

type Call = { url: string; init?: RequestInit };

function mockFetch(responder: (call: Call) => Response) {
  const calls: Call[] = [];
  setFetch(async (url, init) => {
    const call = { url, init };
    calls.push(call);
    return responder(call);
  });
  return calls;
}

const sse = (events: unknown[]) =>
  new Response(events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join(''), { status: 200 });

afterEach(() => setFetch(null));

describe('openAICompatible', () => {
  it('faz streaming e junta os pedaços', async () => {
    const calls = mockFetch(() =>
      sse([{ choices: [{ delta: { content: 'Olá, ' } }] }, { choices: [{ delta: { content: 'aventureiro.' } }] }, '[DONE]']),
    );
    const p = openAICompatible({ id: 'openrouter', baseUrl: 'https://x/api/v1', apiKey: 'k' });
    const chunks: string[] = [];
    const text = await p.chat([{ role: 'user', content: 'oi' }], { model: 'm', onToken: (c) => chunks.push(c) });
    expect(text).toBe('Olá, aventureiro.');
    expect(chunks).toEqual(['Olá, ', 'aventureiro.']);
    expect(calls[0].url).toBe('https://x/api/v1/chat/completions');
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer k');
  });

  it('mapeia 401 para chave inválida e 402 para sem saldo', async () => {
    mockFetch(() => new Response('bad key', { status: 401 }));
    const p = openAICompatible({ id: 'x', baseUrl: 'https://x', apiKey: 'k' });
    await expect(p.testKey()).rejects.toMatchObject({ kind: 'invalid_key' });
    mockFetch(() => new Response('pay', { status: 402 }));
    await expect(p.chat([], { model: 'm' })).rejects.toBeInstanceOf(ProviderError);
  });

  it('erro de rede vira kind=network', async () => {
    setFetch(async () => {
      throw new TypeError('Network request failed');
    });
    const p = openAICompatible({ id: 'ollama', baseUrl: 'http://192.168.0.2:11434/v1' });
    await expect(p.listModels()).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('anthropic', () => {
  it('separa system e junta mensagens seguidas do mesmo papel', async () => {
    const calls = mockFetch(() => new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 }));
    const text = await anthropic('k').chat(
      [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'a' },
        { role: 'user', content: 'b' },
      ],
      { model: 'claude' },
    );
    expect(text).toBe('ok');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.system).toBe('S');
    expect(body.messages).toEqual([{ role: 'user', content: 'a\n\nb' }]);
  });

  it('faz streaming de content_block_delta', async () => {
    mockFetch(() =>
      sse([
        { type: 'message_start' },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Era ' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'uma vez' } },
      ]),
    );
    expect(await anthropic('k').chat([{ role: 'user', content: 'x' }], { model: 'c', onToken: () => {} })).toBe('Era uma vez');
  });
});

describe('gemini', () => {
  it('converte papéis e lê o texto', async () => {
    const calls = mockFetch(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'oi' }] } }] }), { status: 200 }));
    await gemini('k').chat(
      [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'u' },
        { role: 'assistant', content: 'a' },
      ],
      { model: 'gemini-x' },
    );
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('S');
    expect(body.contents.map((c: any) => c.role)).toEqual(['user', 'model']);
    expect(calls[0].url).toContain('/models/gemini-x:generateContent');
  });
});

describe('imagens', () => {
  it('OpenRouter envia referência e retorna data URI', async () => {
    const calls = mockFetch(() =>
      new Response(JSON.stringify({ choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,AAA' } }] } }] }), { status: 200 }),
    );
    const uri = await openRouterImage('k').generate('castelo', { model: 'img', referenceImage: 'data:image/png;base64,REF' });
    expect(uri).toBe('data:image/png;base64,AAA');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.messages[0].content[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,REF' } });
  });

  it('Stable Diffusion local usa txt2img', async () => {
    const calls = mockFetch(() => new Response(JSON.stringify({ images: ['BBB'] }), { status: 200 }));
    expect(await localSdImage('http://pc:7860/').generate('floresta', { model: '' })).toBe('data:image/png;base64,BBB');
    expect(calls[0].url).toBe('http://pc:7860/sdapi/v1/txt2img');
  });
});
