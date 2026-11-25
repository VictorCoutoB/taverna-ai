import { create } from 'zustand';
import type { Language } from '../narrator/types';
import type { ImageProviderId, KeyId, Keys, LocalUrls, SpeechProviderId, TextProviderId } from '../providers/registry';
import { IMAGE_PROVIDERS, TEXT_PROVIDERS } from '../providers/registry';
import { getKV } from '../storage/kv';
import { loadKeys, saveKey } from '../storage/secrets';

export type ImageFrequency = 'manual' | 'every' | 'every3';
export type FilterLevel = 'moderate' | 'strict';

export interface Settings {
  language: Language;
  text: { provider: TextProviderId; model: string };
  image: { provider: ImageProviderId; model: string; style: string; frequency: ImageFrequency };
  speech: { provider: SpeechProviderId; voice: string; auto: boolean };
  local: LocalUrls;
  filter: FilterLevel;
  onboarded: boolean;
}

export const IMAGE_STYLES = ['digital painting', 'anime', 'realistic photo', 'pixel art', 'watercolor', 'dark fantasy oil painting'];

export const defaultSettings = (): Settings => ({
  language: 'pt',
  text: { provider: 'openrouter', model: TEXT_PROVIDERS.openrouter.defaultModel },
  image: { provider: 'openrouter', model: IMAGE_PROVIDERS.openrouter.defaultModel, style: IMAGE_STYLES[0], frequency: 'manual' },
  speech: { provider: 'device', voice: '', auto: false },
  local: { ollama: 'http://192.168.0.10:11434', sd: 'http://192.168.0.10:7860' },
  filter: 'moderate',
  onboarded: false,
});

interface SettingsState {
  loaded: boolean;
  settings: Settings;
  keys: Keys;
  load(): Promise<void>;
  update(patch: Partial<Settings>): Promise<void>;
  setKey(id: KeyId, value: string): Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  loaded: false,
  settings: defaultSettings(),
  keys: {},
  async load() {
    const raw = await getKV().get('settings', 'main');
    const d = defaultSettings();
    let settings = d;
    if (raw) {
      try {
        const s = JSON.parse(raw) as Partial<Settings>;
        settings = {
          ...d,
          ...s,
          text: { ...d.text, ...s.text },
          image: { ...d.image, ...s.image },
          speech: { ...d.speech, ...s.speech },
          local: { ...d.local, ...s.local },
        };
      } catch {}
    }
    set({ settings, keys: await loadKeys(), loaded: true });
  },
  async update(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await getKV().set('settings', 'main', JSON.stringify(settings));
  },
  async setKey(id, value) {
    await saveKey(id, value);
    set({ keys: { ...get().keys, [id]: value.trim() || undefined } });
  },
}));
