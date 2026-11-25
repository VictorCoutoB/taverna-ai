import { errorFromStatus, setFetch } from '../http';
import { anthropic } from '../text/anthropic';
import { gemini } from '../text/gemini';
import { openAICompatible } from '../text/openaiCompatible';
import { chatgptPlan } from '../text/chatgptPlan';
import { geminiImage, localSdImage, openRouterImage } from '../image';
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

describe('chatgptPlan', () => {
  it('usa Responses API com regras da prévia e lê os deltas', async () => {
    const calls = mockFetch(() =>
      sse([
        { type: 'response.created' },
        { type: 'response.output_text.delta', delta: 'A porta ' },
        { type: 'response.output_text.delta', delta: 'range.' },
        { type: 'response.completed' },
      ]),
    );
    const chunks: string[] = [];
    const text = await chatgptPlan(async () => 'TOKEN').chat(
      [
        { role: 'system', content: 'S' },
        { role: 'user', content: 'u' },
      ],
      { model: 'gpt-x', temperature: 0.9, maxTokens: 500, onToken: (c) => chunks.push(c) },
    );
    expect(text).toBe('A porta range.');
    expect(calls[0].url).toBe('https://api.openai.com/v1/responses');
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body).toEqual({ model: 'gpt-x', instructions: 'S', input: [{ role: 'user', content: 'u' }], store: false, stream: true });
  });

  it('lista modelos com Accept JSON e filtra visibility', async () => {
    const calls = mockFetch(() =>
      new Response(JSON.stringify({ data: [{ id: 'gpt-a', visibility: 'list' }, { id: 'gpt-hidden', visibility: 'hide' }, { id: 'gpt-b' }] }), { status: 200 }),
    );
    const models = await chatgptPlan(async () => 't').listModels();
    expect(models.map((m) => m.id)).toEqual(['gpt-a', 'gpt-b']);
    expect((calls[0].init!.headers as Record<string, string>).Accept).toBe('application/json');
  });

  it('modelo vazio: usa o primeiro modelo da conta', async () => {
    const calls = mockFetch(({ url }) =>
      url.endsWith('/models')
        ? new Response(JSON.stringify({ data: [{ id: 'gpt-conta', visibility: 'list' }] }), { status: 200 })
        : sse([{ type: 'response.output_text.delta', delta: 'ok' }, { type: 'response.completed' }]),
    );
    await chatgptPlan(async () => 't').chat([{ role: 'user', content: 'x' }], { model: '' });
    expect(JSON.parse(calls[1].init!.body as string).model).toBe('gpt-conta');
  });

  it('erro 400 de modelo não suportado vira kind=unavailable', () => {
    expect(errorFromStatus(400, `{"detail":"The '' model is not supported when using Codex with a ChatGPT account."}`).kind).toBe('unavailable');
  });

  it('limite do plano vira kind=plan_limit', async () => {
    mockFetch(() => sse([{ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'limit' } } }]));
    await expect(chatgptPlan(async () => 't').chat([{ role: 'user', content: 'x' }], { model: 'm' })).rejects.toMatchObject({ kind: 'plan_limit' });
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

  it('Gemini gera imagem com referência e devolve data URI', async () => {
    const calls = mockFetch(() =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: 'GGG' } }] } }] }), {
        status: 200,
      }),
    );
    const uri = await geminiImage('k').generate('castelo', { model: 'gemini-x-image', referenceImage: 'data:image/jpeg;base64,REF' });
    expect(uri).toBe('data:image/png;base64,GGG');
    expect(calls[0].url).toContain('/models/gemini-x-image:generateContent');
    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'REF' } });
    expect(body.generationConfig.responseModalities).toContain('IMAGE');
  });

  it('Gemini sem imagem explica o motivo', async () => {
    mockFetch(() => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    await expect(geminiImage('k').generate('x', { model: 'm' })).rejects.toThrow(/SAFETY/);
  });

  it('Stable Diffusion local usa txt2img', async () => {
    const calls = mockFetch(() => new Response(JSON.stringify({ images: ['BBB'] }), { status: 200 }));
    expect(await localSdImage('http://pc:7860/').generate('floresta', { model: '' })).toBe('data:image/png;base64,BBB');
    expect(calls[0].url).toBe('http://pc:7860/sdapi/v1/txt2img');
  });
});
