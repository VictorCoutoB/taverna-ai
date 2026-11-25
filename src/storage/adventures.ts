import type { Adventure } from '../narrator/types';
import { deleteImages } from './images';
import { getKV } from './kv';

export const EXPORT_VERSION = 1;

export async function listAdventures(): Promise<Adventure[]> {
  const rows = await getKV().list('adventures');
  return rows
    .map((r) => {
      try {
        return JSON.parse(r.value) as Adventure;
      } catch {
        return null;
      }
    })
    .filter((a): a is Adventure => !!a)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAdventure(id: string): Promise<Adventure | null> {
  const v = await getKV().get('adventures', id);
  return v ? (JSON.parse(v) as Adventure) : null;
}

export async function saveAdventure(a: Adventure): Promise<void> {
  await getKV().set('adventures', a.id, JSON.stringify({ ...a, updatedAt: Date.now() }));
}

export async function deleteAdventure(a: Adventure): Promise<void> {
  await getKV().remove('adventures', a.id);
  for (const row of await getKV().list('saves')) {
    if (row.value.includes(`"adventureId":"${a.id}"`)) await getKV().remove('saves', row.id);
  }
  await deleteImages([...a.messages.map((m) => m.imageUri), ...a.characters.map((c) => c.portraitUri)]);
}

/** JSON de backup. Imagens não vão junto (ficam no aparelho). */
export function serializeForExport(a: Adventure): string {
  const strip = (uri?: string) => (uri && uri.startsWith('data:') ? uri : undefined);
  return JSON.stringify(
    {
      app: 'taverna-ai',
      version: EXPORT_VERSION,
      adventure: {
        ...a,
        characters: a.characters.map((c) => ({ ...c, portraitUri: strip(c.portraitUri) })),
        messages: a.messages.map((m) => ({ ...m, imageUri: strip(m.imageUri) })),
      },
    },
    null,
    1,
  );
}

export function parseImport(text: string, newId: () => string): Adventure {
  const json = JSON.parse(text);
  const a = json?.adventure as Adventure | undefined;
  if (json?.app !== 'taverna-ai' || !a || !Array.isArray(a.messages) || !a.scenario) {
    throw new Error('Arquivo não é uma aventura do Taverna AI');
  }
  return { ...a, id: newId(), title: a.title, updatedAt: Date.now() };
}
