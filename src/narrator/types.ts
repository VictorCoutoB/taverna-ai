import type { CheckResult } from '../engine/commands';
import type { Attributes, Sheet } from '../engine/sheet';

export type GameMode = 'rpg' | 'roleplay';
export type Language = 'pt' | 'en';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  tone: string;
  opening: string;
  imageStyle: string;
  ageRating: 'L' | '12' | '14' | '16';
}

export interface Character {
  id: string;
  name: string;
  /** Descrição visual fixa, reaproveitada em todas as imagens. */
  appearance: string;
  backstory: string;
  portraitUri?: string;
  isPlayer: boolean;
}

export type StoryMessageRole = 'player' | 'narrator' | 'dice';
/** Fazer (ação), Dizer (fala) ou História (o jogador escreve a narração). */
export type ActionMode = 'do' | 'say' | 'story';

export interface StoryMessage {
  id: string;
  role: StoryMessageRole;
  content: string;
  check?: CheckResult;
  imageUri?: string;
  /** Opções de ação sugeridas pela IA (narração). */
  choices?: string[];
  /** Como a ação do jogador deve ser lida (jogador). */
  actionMode?: ActionMode;
  /** Ficha antes deste turno (para desfazer). Fica na primeira mensagem do turno. */
  sheetBefore?: Sheet | null;
  /** Diário antes deste turno (para desfazer). */
  journalBefore?: Journal;
  createdAt: number;
}

export type StoryLength = 'short' | 'medium' | 'long';
export type StoryTone = 'scenario' | 'epic' | 'dark' | 'funny' | 'romantic';

export interface NarratorStyle {
  length: StoryLength;
  tone: StoryTone;
}

export const DEFAULT_STYLE: NarratorStyle = { length: 'medium', tone: 'scenario' };

export type QuestStatus = 'active' | 'done' | 'failed';

export interface Quest {
  id: string;
  title: string;
  status: QuestStatus;
}

export interface Npc {
  name: string;
  note: string;
}

/** Memória da aventura: missões e personagens (IA) e fatos do mundo (jogador). */
export interface Journal {
  quests: Quest[];
  npcs: Npc[];
  facts: string[];
}

export const emptyJournal = (): Journal => ({ quests: [], npcs: [], facts: [] });

export interface Adventure {
  id: string;
  title: string;
  mode: GameMode;
  language: Language;
  scenario: Scenario;
  characters: Character[];
  sheet: Sheet | null;
  /** Resumo da história até `summarizedUpTo` (índice exclusivo em messages). */
  summary: string;
  summarizedUpTo: number;
  messages: StoryMessage[];
  /** Opcional para aventuras antigas: usar DEFAULT_STYLE. */
  style?: NarratorStyle;
  /** Opcional para aventuras antigas: usar emptyJournal(). */
  journal?: Journal;
  createdAt: number;
  updatedAt: number;
}

export type { Attributes };
