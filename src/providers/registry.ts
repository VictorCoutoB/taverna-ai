import { localSdImage, openAIImage, openRouterImage, stabilityImage } from './image';
import { deviceSpeech, elevenLabsSpeech, openAISpeech } from './speech';
import { anthropic } from './text/anthropic';
import { gemini } from './text/gemini';
import { openAICompatible } from './text/openaiCompatible';
import type { ImageProvider, SpeechProvider, TextProvider } from './types';
import { ProviderError } from './types';

export type TextProviderId = 'openrouter' | 'anthropic' | 'openai' | 'gemini' | 'ollama';
export type ImageProviderId = 'openrouter' | 'openai' | 'stability' | 'sdlocal';
export type SpeechProviderId = 'device' | 'openai' | 'elevenlabs';
/** Serviços que precisam de chave (cada pessoa usa a sua). */
export type KeyId = 'openrouter' | 'anthropic' | 'openai' | 'gemini' | 'stability' | 'elevenlabs';

export interface ProviderMeta {
  label: string;
  key?: KeyId;
  local?: boolean;
  defaultModel: string;
}

export const TEXT_PROVIDERS: Record<TextProviderId, ProviderMeta> = {
  openrouter: { label: 'OpenRouter (vários modelos)', key: 'openrouter', defaultModel: 'anthropic/claude-sonnet-4.5' },
  anthropic: { label: 'Anthropic (Claude)', key: 'anthropic', defaultModel: 'claude-sonnet-5-5' },
  openai: { label: 'OpenAI (GPT)', key: 'openai', defaultModel: 'gpt-4.1-mini' },
  gemini: { label: 'Google (Gemini)', key: 'gemini', defaultModel: 'gemini-2.5-flash' },
  ollama: { label: 'Ollama (no seu PC)', local: true, defaultModel: 'llama3.1' },
};

export const IMAGE_PROVIDERS: Record<ImageProviderId, ProviderMeta> = {
  openrouter: { label: 'OpenRouter', key: 'openrouter', defaultModel: 'google/gemini-2.5-flash-image' },
  openai: { label: 'OpenAI', key: 'openai', defaultModel: 'gpt-image-1-mini' },
  stability: { label: 'Stability AI', key: 'stability', defaultModel: 'core' },
  sdlocal: { label: 'Stable Diffusion (no seu PC)', local: true, defaultModel: '' },
};

export const SPEECH_PROVIDERS: Record<SpeechProviderId, ProviderMeta> = {
  device: { label: 'Voz do celular (grátis)', defaultModel: '' },
  openai: { label: 'OpenAI', key: 'openai', defaultModel: 'fable' },
  elevenlabs: { label: 'ElevenLabs', key: 'elevenlabs', defaultModel: '' },
};

export const KEY_HELP: Record<KeyId, { label: string; url: string; steps: string }> = {
  openrouter: { label: 'OpenRouter', url: 'https://openrouter.ai/keys', steps: 'Crie uma conta, adicione créditos em "Credits" e gere uma chave em "Keys".' },
  anthropic: { label: 'Anthropic', url: 'https://console.anthropic.com/settings/keys', steps: 'Crie uma conta no Console, adicione créditos em "Billing" e crie uma chave em "API Keys".' },
  openai: { label: 'OpenAI', url: 'https://platform.openai.com/api-keys', steps: 'Crie uma conta na plataforma, adicione créditos em "Billing" e crie uma chave secreta.' },
  gemini: { label: 'Google Gemini', url: 'https://aistudio.google.com/apikey', steps: 'Entre com sua conta Google no AI Studio e clique em "Create API key". Há uso gratuito limitado.' },
  stability: { label: 'Stability AI', url: 'https://platform.stability.ai/account/keys', steps: 'Crie uma conta, compre créditos e copie sua chave em "API Keys".' },
  elevenlabs: { label: 'ElevenLabs', url: 'https://elevenlabs.io/app/settings/api-keys', steps: 'Crie uma conta e gere uma chave em "API Keys". Há uso gratuito limitado.' },
};

export type Keys = Partial<Record<KeyId, string>>;

export interface LocalUrls {
  ollama: string;
  sd: string;
}

function needKey(keys: Keys, id: KeyId): string {
  const k = keys[id]?.trim();
  if (!k) throw new ProviderError('invalid_key', `Falta a chave de ${KEY_HELP[id].label}. Adicione nas Configurações.`);
  return k;
}

export function makeTextProvider(id: TextProviderId, keys: Keys, local: LocalUrls): TextProvider {
  switch (id) {
    case 'openrouter':
      return openAICompatible({
        id,
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: needKey(keys, 'openrouter'),
        extraHeaders: { 'X-Title': 'Taverna AI' },
      });
    case 'openai':
      return openAICompatible({
        id,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: needKey(keys, 'openai'),
        modelFilter: (m) => /^(gpt|o\d|chatgpt)/.test(m) && !/(audio|realtime|transcribe|tts|image|search|embedding)/.test(m),
      });
    case 'ollama':
      return openAICompatible({ id, baseUrl: `${local.ollama.replace(/\/$/, '')}/v1` });
    case 'anthropic':
      return anthropic(needKey(keys, 'anthropic'));
    case 'gemini':
      return gemini(needKey(keys, 'gemini'));
  }
}

export function makeImageProvider(id: ImageProviderId, keys: Keys, local: LocalUrls): ImageProvider {
  switch (id) {
    case 'openrouter':
      return openRouterImage(needKey(keys, 'openrouter'));
    case 'openai':
      return openAIImage(needKey(keys, 'openai'));
    case 'stability':
      return stabilityImage(needKey(keys, 'stability'));
    case 'sdlocal':
      return localSdImage(local.sd);
  }
}

export function makeSpeechProvider(id: SpeechProviderId, keys: Keys, language: string): SpeechProvider {
  switch (id) {
    case 'device':
      return deviceSpeech(language);
    case 'openai':
      return openAISpeech(needKey(keys, 'openai'));
    case 'elevenlabs':
      return elevenLabsSpeech(needKey(keys, 'elevenlabs'));
  }
}
