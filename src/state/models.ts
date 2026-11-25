import { create } from 'zustand';
import type { ModelInfo } from '../providers/types';
import { getKV } from '../storage/kv';

export type ModelKind = 'text' | 'image';

export interface ModelRef {
  kind: ModelKind;
  provider: string;
  model: string;
}

interface CacheEntry {
  at: number;
  models: ModelInfo[];
}

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_RECENTS = 5;

export const isFresh = (entry: CacheEntry | undefined, now: number) => !!entry && now - entry.at < CACHE_TTL_MS;

export const refKey = (r: ModelRef) => `${r.kind}:${r.provider}:${r.model}`;

/** Coloca no topo, sem repetir, limitado a MAX_RECENTS. */
export function addRecent(list: ModelRef[], item: ModelRef): ModelRef[] {
  return [item, ...list.filter((r) => refKey(r) !== refKey(item))].slice(0, MAX_RECENTS);
}

/** Nome curto para mostrar: tira o prefixo do fornecedor ("anthropic/claude-x" → "claude-x"). */
export function shortModelName(id: string, models?: ModelInfo[]): string {
  const known = models?.find((m) => m.id === id);
  if (known && known.name !== known.id) return known.name.replace(/^[^:]+:\s*/, '');
  return id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id || '—';
}

interface ModelsState {
  loaded: boolean;
  cache: Record<string, CacheEntry>;
  recents: ModelRef[];
  favorites: string[];
  load(): Promise<void>;
  cached(kind: ModelKind, provider: string): ModelInfo[] | undefined;
  fetch(kind: ModelKind, provider: string, list: () => Promise<ModelInfo[]>, force?: boolean): Promise<ModelInfo[]>;
  touch(ref: ModelRef): Promise<void>;
  toggleFavorite(ref: ModelRef): Promise<void>;
}

const persist = (s: Pick<ModelsState, 'cache' | 'recents' | 'favorites'>) =>
  getKV()
    .set('settings', 'models', JSON.stringify({ cache: s.cache, recents: s.recents, favorites: s.favorites }))
    .catch(() => {});

export const useModels = create<ModelsState>((set, get) => ({
  loaded: false,
  cache: {},
  recents: [],
  favorites: [],
  async load() {
    if (get().loaded) return;
    try {
      const raw = await getKV().get('settings', 'models');
      if (raw) {
        const s = JSON.parse(raw);
        set({ cache: s.cache ?? {}, recents: s.recents ?? [], favorites: s.favorites ?? [] });
      }
    } catch {}
    set({ loaded: true });
  },
  cached(kind, provider) {
    return get().cache[`${kind}:${provider}`]?.models;
  },
  async fetch(kind, provider, list, force) {
    const key = `${kind}:${provider}`;
    const entry = get().cache[key];
    if (!force && isFresh(entry, Date.now())) return entry.models;
    const models = await list();
    const cache = { ...get().cache, [key]: { at: Date.now(), models } };
    set({ cache });
    persist({ ...get(), cache });
    return models;
  },
  async touch(ref) {
    const recents = addRecent(get().recents, ref);
    set({ recents });
    persist({ ...get(), recents });
  },
  async toggleFavorite(ref) {
    const k = refKey(ref);
    const favorites = get().favorites.includes(k) ? get().favorites.filter((f) => f !== k) : [...get().favorites, k];
    set({ favorites });
    persist({ ...get(), favorites });
  },
}));

export function parseRefKey(k: string): ModelRef {
  const [kind, provider, ...rest] = k.split(':');
  return { kind: kind as ModelKind, provider, model: rest.join(':') };
}
