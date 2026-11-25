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

export interface StoryMessage {
  id: string;
  role: StoryMessageRole;
  content: string;
  check?: CheckResult;
  imageUri?: string;
  createdAt: number;
}

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
  createdAt: number;
  updatedAt: number;
}

export type { Attributes };
