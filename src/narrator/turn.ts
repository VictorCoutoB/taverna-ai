import { applyCommands, resolveCheck, validateCommands, type Command, type Rejected } from '../engine/commands';
import { defaultRng, type Rng } from '../engine/dice';
import { applyJournal, isJournalCommand, validateJournalCommands } from '../engine/journal';
import type { Sheet } from '../engine/sheet';
import type { ChatMessage, TextProvider } from '../providers/types';
import { buildContext, storyToChat } from './context';
import { displayText, parseNarratorResponse, type ParsedResponse } from './parser';
import { buildSystemPrompt, CHECK_FOLLOWUP, summaryPrompt } from './prompts';
import { DEFAULT_STYLE, emptyJournal, type ActionMode, type Adventure, type Journal, type StoryMessage } from './types';

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
  /** Ação do jogador. Vazio = só continuar a narração (botão Continuar / refazer). */
  action: string;
  actionMode?: ActionMode;
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
  journal: Journal;
  rejected: Rejected[];
}

async function ask(provider: TextProvider, chat: ChatMessage[], input: TurnInput): Promise<string> {
  let acc = '';
  return provider.chat(chat, {
    model: input.model,
    temperature: 0.9,
    maxTokens: 1200,
    signal: input.signal,
    onToken: input.onPartial
      ? (chunk) => {
          acc += chunk;
          input.onPartial!(displayText(acc));
        }
      : undefined,
  });
}

const narratorMessage = (p: ParsedResponse) => message('narrator', p.narration || '…', p.choices.length ? { choices: p.choices } : {});

const gameCommands = (raws: unknown[]) => raws.filter((r) => !isJournalCommand(r));

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const { adventure, provider } = input;
  const rng = input.rng ?? defaultRng;
  const budget = input.budgetTokens ?? DEFAULT_CONTEXT_BUDGET;
  const system = buildSystemPrompt(adventure.mode, adventure.language, adventure.style ?? DEFAULT_STYLE);
  const journalBefore = adventure.journal ?? emptyJournal();
  let journal = journalBefore;

  const newMessages: StoryMessage[] = [];
  if (input.action.trim()) newMessages.push(message('player', input.action.trim(), { actionMode: input.actionMode ?? 'do' }));

  const working = (): Adventure => ({ ...adventure, messages: [...adventure.messages, ...newMessages] });

  const first = parseNarratorResponse(await ask(provider, buildContext(working(), system, budget).chat, input));
  newMessages.push(narratorMessage(first));
  newMessages[0].sheetBefore = adventure.sheet;
  newMessages[0].journalBefore = journalBefore;

  if (adventure.mode !== 'rpg' || !adventure.sheet) {
    journal = applyJournal(journal, validateJournalCommands(first.commands), newId);
    return { newMessages, sheet: adventure.sheet, journal, rejected: [] };
  }

  const rejected: Rejected[] = [];
  const firstValid = validateCommands(gameCommands(first.commands), adventure.sheet);
  rejected.push(...firstValid.rejected);
  const check = firstValid.valid.find((c): c is Extract<Command, { type: 'check' }> => c.type === 'check');

  if (!check) {
    journal = applyJournal(journal, validateJournalCommands(first.commands), newId);
    return { newMessages, sheet: applyCommands(adventure.sheet, firstValid.valid), journal, rejected };
  }

  // Com teste pedido, a primeira resposta só narra a tentativa: escolhas e comandos dela são ignorados.
  delete newMessages[newMessages.length - 1].choices;
  const result = resolveCheck(adventure.sheet, check.attr, check.dc, rng, check.reason);
  const dice = message('dice', '', { check: result });
  newMessages.push(dice);

  const { chat } = buildContext(working(), system, budget);
  // A última mensagem é o resultado do dado; anexamos a instrução de continuação a ela.
  chat[chat.length - 1] = { role: 'user', content: `${storyToChat(adventure, dice).content}\n${CHECK_FOLLOWUP}` };
  const second = parseNarratorResponse(await ask(provider, chat, input));
  newMessages.push(narratorMessage(second));

  const secondValid = validateCommands(gameCommands(second.commands), adventure.sheet);
  rejected.push(...secondValid.rejected);
  const stateCommands = secondValid.valid.filter((c) => c.type !== 'check');
  journal = applyJournal(journal, validateJournalCommands(second.commands), newId);
  return { newMessages, sheet: applyCommands(adventure.sheet, stateCommands), journal, rejected };
}

/** Atualiza a memória de longo prazo quando há mensagens fora da janela de contexto. */
export async function maybeSummarize(
  adventure: Adventure,
  provider: TextProvider,
  model: string,
  budgetTokens = DEFAULT_CONTEXT_BUDGET,
): Promise<{ summary: string; summarizedUpTo: number } | null> {
  const { oldestIncluded } = buildContext(adventure, buildSystemPrompt(adventure.mode, adventure.language, adventure.style), budgetTokens);
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
