import type { ChatMessage } from '../providers/types';
import { checkResultNote, CONTINUE_NUDGE, formatPlayerAction } from './prompts';
import type { Adventure, Journal, StoryMessage } from './types';

/** Estimativa barata (~4 caracteres por token). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function storyToChat(adventure: Adventure, m: StoryMessage): ChatMessage {
  if (m.role === 'narrator') return { role: 'assistant', content: m.content };
  if (m.role === 'dice' && m.check) return { role: 'user', content: checkResultNote(adventure.language, m.check) };
  return { role: 'user', content: formatPlayerAction(m.actionMode, m.content) };
}

function journalBlock(j: Journal | undefined): string | null {
  if (!j) return null;
  const parts: string[] = [];
  const active = j.quests.filter((q) => q.status === 'active');
  if (active.length) parts.push(`Active quests:\n${active.map((q) => `- ${q.title}`).join('\n')}`);
  const ended = j.quests.filter((q) => q.status !== 'active').slice(-5);
  if (ended.length) parts.push(`Finished quests: ${ended.map((q) => `${q.title} (${q.status})`).join('; ')}`);
  if (j.npcs.length) parts.push(`Known characters:\n${j.npcs.map((n) => `- ${n.name}: ${n.note}`).join('\n')}`);
  if (j.facts.length) parts.push(`World facts (always true, never contradict):\n${j.facts.map((f) => `- ${f}`).join('\n')}`);
  return parts.length ? `## Journal\n${parts.join('\n')}` : null;
}

function worldBlock(a: Adventure): string {
  const parts = [
    `## Scenario: ${a.scenario.title}\n${a.scenario.description}\nTone: ${a.scenario.tone}`,
    `## Characters\n${a.characters.map((c) => `- ${c.name}${c.isPlayer ? ' (player character)' : ''}: ${c.appearance}. ${c.backstory}`).join('\n')}`,
  ];
  if (a.mode === 'rpg' && a.sheet) {
    const s = a.sheet;
    const attrs = Object.entries(s.attributes).map(([k, v]) => `${k} ${v}`).join(', ');
    const inv = s.inventory.length ? s.inventory.map((i) => `${i.name} x${i.qty}`).join(', ') : 'empty';
    parts.push(`## Player sheet\nHP ${s.hp}/${s.maxHp}, level ${s.level}, gold ${s.gold}\nAttributes: ${attrs}\nInventory: ${inv}`);
  }
  const journal = journalBlock(a.journal);
  if (journal) parts.push(journal);
  if (a.summary) parts.push(`## Story so far\n${a.summary}`);
  return parts.join('\n\n');
}

/**
 * Monta as mensagens para o modelo dentro do orçamento de tokens,
 * mantendo sempre as mensagens mais recentes.
 */
export function buildContext(adventure: Adventure, systemPrompt: string, budgetTokens: number): { chat: ChatMessage[]; oldestIncluded: number } {
  const system: ChatMessage = { role: 'system', content: `${systemPrompt}\n\n${worldBlock(adventure)}` };
  let used = estimateTokens(system.content);
  const history: ChatMessage[] = [];
  let i = adventure.messages.length - 1;
  for (; i >= 0; i--) {
    const msg = storyToChat(adventure, adventure.messages[i]);
    const cost = estimateTokens(msg.content);
    if (used + cost > budgetTokens && history.length > 0) break;
    used += cost;
    history.unshift(msg);
  }
  if (history.length === 0 || history[0].role === 'assistant') {
    // Alguns provedores exigem que a conversa comece pelo usuário.
    history.unshift({ role: 'user', content: adventure.scenario.opening });
  }
  if (history[history.length - 1].role === 'assistant') {
    // Sem ação nova: pedir para a IA continuar (botão "Continuar" / refazer).
    history.push({ role: 'user', content: CONTINUE_NUDGE });
  }
  return { chat: [system, ...history], oldestIncluded: i + 1 };
}
