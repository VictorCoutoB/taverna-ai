import type { Adventure } from '../narrator/types';
import { getKV } from './kv';

/** Ponto salvo de uma aventura (snapshot completo). */
export interface SavePoint {
  id: string;
  adventureId: string;
  name: string;
  createdAt: number;
  /** Quantas mensagens havia no momento (para mostrar). */
  messageCount: number;
  data: Adventure;
}

export function makeSave(a: Adventure, name: string, id: string, now = Date.now()): SavePoint {
  return {
    id,
    adventureId: a.id,
    name: name.trim() || new Date(now).toLocaleString(),
    createdAt: now,
    messageCount: a.messages.length,
    data: JSON.parse(JSON.stringify(a)) as Adventure,
  };
}

/** Restaura um save mantendo o id da aventura atual. */
export function restoreSave(save: SavePoint, current: Adventure): Adventure {
  return { ...JSON.parse(JSON.stringify(save.data)), id: current.id, updatedAt: Date.now() };
}

/** Nome do próximo ramo: "Título (ramo 2)", "(ramo 3)"... */
export function branchTitle(title: string, existingTitles: string[]): string {
  const base = title.replace(/\s*\((ramo|branch) \d+\)$/i, '');
  let n = 2;
  while (existingTitles.includes(`${base} (ramo ${n})`)) n++;
  return `${base} (ramo ${n})`;
}

/**
 * Cria uma nova aventura igual à atual até a mensagem `messageIndex` (inclusiva).
 * Ficha e diário voltam ao estado do turno seguinte àquela mensagem, se conhecido.
 */
export function branchAt(a: Adventure, messageIndex: number, newAdventureId: string, title: string, now = Date.now()): Adventure {
  const messages = a.messages.slice(0, messageIndex + 1).map((m) => ({ ...m }));
  // O estado "antes" do primeiro turno cortado é o estado logo depois da mensagem escolhida.
  const next = a.messages.slice(messageIndex + 1).find((m) => 'sheetBefore' in m || 'journalBefore' in m);
  return {
    ...JSON.parse(JSON.stringify(a)),
    id: newAdventureId,
    title,
    messages,
    sheet: next && 'sheetBefore' in next ? (next.sheetBefore ?? a.sheet) : a.sheet,
    journal: next?.journalBefore ?? a.journal,
    summarizedUpTo: Math.min(a.summarizedUpTo, messages.length),
    summary: a.summarizedUpTo > messages.length ? '' : a.summary,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listSaves(adventureId: string): Promise<SavePoint[]> {
  const rows = await getKV().list('saves');
  return rows
    .map((r) => {
      try {
        return JSON.parse(r.value) as SavePoint;
      } catch {
        return null;
      }
    })
    .filter((s): s is SavePoint => !!s && s.adventureId === adventureId)
    .sort((x, y) => y.createdAt - x.createdAt);
}

export async function writeSave(save: SavePoint): Promise<void> {
  await getKV().set('saves', save.id, JSON.stringify(save));
}

export async function deleteSave(id: string): Promise<void> {
  await getKV().remove('saves', id);
}
