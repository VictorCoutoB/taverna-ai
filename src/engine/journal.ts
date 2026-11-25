import type { Journal, Quest } from '../narrator/types';

/** Comandos de diário que a IA pode enviar (nos dois modos de jogo). */
export type JournalCommand =
  | { type: 'quest'; action: 'add' | 'done' | 'fail'; title: string }
  | { type: 'npc'; name: string; note: string };

export const JOURNAL_LIMITS = { quests: 20, npcs: 30, title: 80, name: 40, note: 140, facts: 30, fact: 200 };

const JOURNAL_TYPES = ['quest', 'npc'];

export const isJournalCommand = (raw: unknown): boolean =>
  !!raw && typeof raw === 'object' && JOURNAL_TYPES.includes((raw as { type?: string }).type ?? '');

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function validateJournalCommands(raws: unknown[]): JournalCommand[] {
  const out: JournalCommand[] = [];
  for (const raw of raws) {
    if (!isJournalCommand(raw)) continue;
    const c = raw as Record<string, unknown>;
    if (c.type === 'quest') {
      const title = clean(c.title, JOURNAL_LIMITS.title);
      const action = c.action === 'done' || c.action === 'fail' ? c.action : c.action === 'add' || c.action === undefined ? 'add' : null;
      if (title && action) out.push({ type: 'quest', action, title });
    } else {
      const name = clean(c.name, JOURNAL_LIMITS.name);
      const note = clean(c.note, JOURNAL_LIMITS.note);
      if (name) out.push({ type: 'npc', name, note });
    }
  }
  return out;
}

export function applyJournal(journal: Journal, cmds: JournalCommand[], newId: () => string): Journal {
  const quests: Quest[] = journal.quests.map((q) => ({ ...q }));
  const npcs = journal.npcs.map((n) => ({ ...n }));
  for (const c of cmds) {
    if (c.type === 'quest') {
      const found = quests.find((q) => same(q.title, c.title));
      if (c.action === 'add') {
        if (!found && quests.length < JOURNAL_LIMITS.quests) quests.push({ id: newId(), title: c.title, status: 'active' });
      } else if (found) {
        found.status = c.action === 'done' ? 'done' : 'failed';
      }
    } else {
      const found = npcs.find((n) => same(n.name, c.name));
      if (found) found.note = c.note || found.note;
      else if (npcs.length < JOURNAL_LIMITS.npcs) npcs.push({ name: c.name, note: c.note });
    }
  }
  return { ...journal, quests, npcs };
}
