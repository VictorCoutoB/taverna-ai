import { request, requestJson, safeJson } from '../http';
import type { ImageOptions, ImageProvider, ModelInfo } from '../types';
import { ProviderError } from '../types';

const sizeOf = (size: ImageOptions['size'] = '1024x1024') => {
  const [w, h] = size.split('x').map(Number);
  return { w, h };
};

/** OpenRouter: modelos de imagem via chat completions (aceita imagem de referência). */
export function openRouterImage(apiKey: string): ImageProvider {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'X-Title': 'Taverna AI' };
  async function listModels(): Promise<ModelInfo[]> {
    const json = await requestJson('https://openrouter.ai/api/v1/models?output_modalities=image', { headers });
    return (json?.data ?? []).map((m: any) => ({ id: m.id, name: m.name ?? m.id }));
  }
  return {
    id: 'openrouter',
    supportsReference: true,
    listModels,
    testKey: async () => void (await requestJson('https://openrouter.ai/api/v1/key', { headers })),
    async generate(prompt, opts) {
      const content: any[] = [{ type: 'text', text: prompt }];
      if (opts.referenceImage) {
        content.unshift({ type: 'image_url', image_url: { url: opts.referenceImage } });
        content[1].text = `Keep the character from the reference image identical (face, hair, clothes). ${prompt}`;
      }
      const call = (modalities: string[]) =>
        requestJson('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers,
          signal: opts.signal,
          body: JSON.stringify({ model: opts.model, modalities, messages: [{ role: 'user', content }] }),
        });
      let json: any;
      try {
        // Modelos que escrevem e desenham (Gemini, GPT) aceitam image+text.
        json = await call(['image', 'text']);
      } catch (e) {
        // Modelos só de imagem (FLUX, Seedream, Recraft…) exigem só "image".
        if (e instanceof ProviderError && (e.status === 400 || e.kind === 'unavailable')) json = await call(['image']);
        else throw e;
      }
      const url = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (typeof url !== 'string') throw new ProviderError('bad_response', 'O modelo não retornou imagem');
      return url;
    },
  };
}

export function openAIImage(apiKey: string): ImageProvider {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  return {
    id: 'openai',
    supportsReference: false,
    listModels: async () => [
      { id: 'gpt-image-1', name: 'GPT Image 1' },
      { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini' },
      { id: 'dall-e-3', name: 'DALL·E 3' },
    ],
    testKey: async () => void (await requestJson('https://api.openai.com/v1/models', { headers })),
    async generate(prompt, opts) {
      const isDalle = opts.model.startsWith('dall-e');
      const json = await requestJson('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers,
        signal: opts.signal,
        body: JSON.stringify({
          model: opts.model,
          prompt,
          size: isDalle ? '1024x1024' : opts.size ?? '1024x1024',
          n: 1,
          ...(isDalle ? { response_format: 'b64_json' } : {}),
        }),
      });
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new ProviderError('bad_response', 'O modelo não retornou imagem');
      return `data:image/png;base64,${b64}`;
    },
  };
}

export function stabilityImage(apiKey: string): ImageProvider {
  return {
    id: 'stability',
    supportsReference: false,
    listModels: async () => [
      { id: 'core', name: 'Stable Image Core' },
      { id: 'ultra', name: 'Stable Image Ultra' },
    ],
    testKey: async () =>
      void (await requestJson('https://api.stability.ai/v1/user/balance', { headers: { Authorization: `Bearer ${apiKey}` } })),
    async generate(prompt, opts) {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('output_format', 'png');
      const { w, h } = sizeOf(opts.size);
      form.append('aspect_ratio', w === h ? '1:1' : w > h ? '3:2' : '2:3');
      const res = await request(`https://api.stability.ai/v2beta/stable-image/generate/${opts.model}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: opts.signal,
        body: form,
      });
      const json = safeJson(await res.text());
      if (!json?.image) throw new ProviderError('bad_response', 'O modelo não retornou imagem');
      return `data:image/png;base64,${json.image}`;
    },
  };
}

/** Stable Diffusion rodando no PC da pessoa (API do AUTOMATIC1111 / Forge, iniciado com --api --listen). */
export function localSdImage(baseUrl: string): ImageProvider {
  const base = baseUrl.replace(/\/$/, '');
  async function listModels(): Promise<ModelInfo[]> {
    const json = await requestJson(`${base}/sdapi/v1/sd-models`, {});
    return (json ?? []).map((m: any) => ({ id: m.title, name: m.model_name ?? m.title }));
  }
  return {
    id: 'sdlocal',
    supportsReference: false,
    listModels,
    testKey: async () => void (await listModels()),
    async generate(prompt, opts) {
      const { w, h } = sizeOf(opts.size);
      const scale = 768 / Math.max(w, h);
      const json = await requestJson(`${base}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal,
        body: JSON.stringify({
          prompt,
          negative_prompt: 'nsfw, nude, lowres, bad anatomy, text, watermark',
          width: Math.round((w * scale) / 8) * 8,
          height: Math.round((h * scale) / 8) * 8,
          steps: 25,
          override_settings: opts.model ? { sd_model_checkpoint: opts.model } : undefined,
        }),
      });
      const b64 = json?.images?.[0];
      if (!b64) throw new ProviderError('bad_response', 'O Stable Diffusion não retornou imagem');
      return `data:image/png;base64,${b64}`;
    },
  };
}
