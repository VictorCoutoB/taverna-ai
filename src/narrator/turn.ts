import { applyCommands, resolveCheck, validateCommands, type Command, type Rejected } from '../engine/commands';
import { defaultRng, type Rng } from '../engine/dice';
import type { Sheet } from '../engine/sheet';
import type { ChatMessage, TextProvider } from '../providers/types';
import { buildContext, storyToChat } from './context';
import { displayText, parseNarratorResponse } from './parser';
import { buildSystemPrompt, CHECK_FOLLOWUP, suggestionsPrompt, summaryPrompt } from './prompts';
import type { Adventure, StoryMessage } from './types';

export const DEFAULT_CONTEXT_BUDGET = 6000;

let counter = 0;
export const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const message = (role: StoryMessage['role'], content: string, extra: Partial<StoryMessage> = {}): StoryMessage => ({
  id: newId(),
  role,
  content,
  createdAt: Date.now(),
  ...extra,
});

export interface TurnInput {
  adventure: Adventure;
  /** Ação do jogador. Vazio = só continuar a narração (ex.: refazer). */
  action: string;
  provider: TextProvider;
  model: string;
  rng?: Rng;
  budgetTokens?: number;
  signal?: AbortSignal;
  /** Texto parcial da narração, para mostrar enquanto chega. */
  onPartial?: (text: string) => void;
}

export interface TurnResult {
  newMessages: StoryMessage[];
  sheet: Sheet | null;
  rejected: Rejected[];
}

async function ask(provider: TextProvider, chat: ChatMessage[], input: TurnInput): Promise<string> {
  let acc = '';
  return provider.chat(chat, {
    model: input.model,
    temperature: 0.9,
    maxTokens: 800,
    signal: input.signal,
    onToken: input.onPartial
      ? (chunk) => {
          acc += chunk;
          input.onPartial!(displayText(acc));
        }
      : undefined,
  });
}

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const { adventure, provider } = input;
  const rng = input.rng ?? defaultRng;
  const budget = input.budgetTokens ?? DEFAULT_CONTEXT_BUDGET;
  const system = buildSystemPrompt(adventure.mode, adventure.language);

  const newMessages: StoryMessage[] = [];
  if (input.action.trim()) newMessages.push(message('player', input.action.trim()));

  const working = (): Adventure => ({ ...adventure, messages: [...adventure.messages, ...newMessages] });

  const first = parseNarratorResponse(await ask(provider, buildContext(working(), system, budget).chat, input));
  newMessages.push(message('narrator', first.narration || '…'));
  newMessages[0].sheetBefore = adventure.sheet;

  if (adventure.mode !== 'rpg' || !adventure.sheet) {
    return { newMessages, sheet: adventure.sheet, rejected: [] };
  }

  const rejected: Rejected[] = [];
  const firstValid = validateCommands(first.commands, adventure.sheet);
  rejected.push(...firstValid.rejected);
  const check = firstValid.valid.find((c): c is Extract<Command, { type: 'check' }> => c.type === 'check');

  if (!check) {
    return { newMessages, sheet: applyCommands(adventure.sheet, firstValid.valid), rejected };
  }

  const result = resolveCheck(adventure.sheet, check.attr, check.dc, rng, check.reason);
  const dice = message('dice', '', { check: result });
  newMessages.push(dice);

  const { chat } = buildContext(working(), system, budget);
  // A última mensagem é o resultado do dado; anexamos a instrução de continuação a ela.
  chat[chat.length - 1] = { role: 'user', content: `${storyToChat(adventure, dice).content}\n${CHECK_FOLLOWUP}` };
  const second = parseNarratorResponse(await ask(provider, chat, input));
  newMessages.push(message('narrator', second.narration || '…'));

  const secondValid = validateCommands(second.commands, adventure.sheet);
  rejected.push(...secondValid.rejected);
  const stateCommands = secondValid.valid.filter((c) => c.type !== 'check');
  return { newMessages, sheet: applyCommands(adventure.sheet, stateCommands), rejected };
}

/** Três sugestões de ação para quando o jogador fica sem ideia. */
export async function suggestActions(adventure: Adventure, provider: TextProvider, model: string): Promise<string[]> {
  const { chat } = buildContext(adventure, buildSystemPrompt(adventure.mode, adventure.language), 3000);
  chat.push({ role: 'user', content: suggestionsPrompt(adventure.language) });
  const text = await provider.chat(chat, { model, temperature: 0.8, maxTokens: 200 });
  const match = text.match(/\[[\s\S]*\]/);
  try {
    const arr: unknown = JSON.parse(match ? match[0] : text);
    if (Array.isArray(arr)) return arr.filter((s): s is string => typeof s === 'string').slice(0, 3);
  } catch {}
  return text.split('\n').map((l) => l.replace(/^[-*\d.\s"]+|"$/g, '').trim()).filter(Boolean).slice(0, 3);
}

/** Atualiza a memória de longo prazo quando há mensagens fora da janela de contexto. */
export async function maybeSummarize(
  adventure: Adventure,
  provider: TextProvider,
  model: string,
  budgetTokens = DEFAULT_CONTEXT_BUDGET,
): Promise<{ summary: string; summarizedUpTo: number } | null> {
  const { oldestIncluded } = buildContext(adventure, buildSystemPrompt(adventure.mode, adventure.language), budgetTokens);
  // Resume com folga: tudo que vai sair da janela em breve.
  const target = Math.max(oldestIncluded, adventure.messages.length - 12);
  if (target - adventure.summarizedUpTo < 6) return null;
  const events = adventure.messages
    .slice(adventure.summarizedUpTo, target)
    .map((m) => `${m.role}: ${storyToChat(adventure, m).content}`)
    .join('\n');
  const summary = await provider.chat(
    [
      { role: 'system', content: summaryPrompt(adventure.language) },
      { role: 'user', content: `Previous summary:\n${adventure.summary || '(none)'}\n\nNew events:\n${events}` },
    ],
    { model, temperature: 0.3, maxTokens: 500 },
  );
  return { summary: summary.trim(), summarizedUpTo: target };
}
