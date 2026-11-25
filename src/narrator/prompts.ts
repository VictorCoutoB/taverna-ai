import type { CheckResult } from '../engine/commands';
import { DEFAULT_STYLE, type ActionMode, type GameMode, type Language, type NarratorStyle, type StoryLength, type StoryTone } from './types';

const LANGUAGE_NAME: Record<Language, string> = { pt: 'Brazilian Portuguese', en: 'English' };

const ATTR_LABEL: Record<Language, Record<string, string>> = {
  pt: { str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma' },
  en: { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' },
};

export const attrLabel = (lang: Language, attr: string) => ATTR_LABEL[lang][attr] ?? attr;

const SAFETY = `Content rules (mandatory): no sexual content, no sexual content involving minors under any circumstance, no graphic gore beyond a PG-13 adventure film, no real-world hate speech, no instructions for real-world weapons, drugs or crimes. If the player pushes for forbidden content, steer the story elsewhere in-character.`;

const BASE = `You are the narrator (game master) of an interactive text adventure. Write vivid, second-person narration ("you..."). Never decide the player's actions, thoughts or dialogue for them. Play every other character with distinct voices. End each turn at a moment that invites the player to act. Keep continuity with the story so far, the world facts and the journal.
Player input formats:
- "I try: X" = an action the player attempts.
- 'I say: "X"' = words the player's character speaks aloud.
- "[Story] X" = the player wrote this part of the narration; treat it as canon and continue from it.
- "(Continue the story.)" = keep narrating naturally from where it stopped, without the player acting.`;

const LENGTH_RULES: Record<StoryLength, string> = {
  short: 'Length: 1 short paragraph (max ~80 words).',
  medium: 'Length: 2-3 paragraphs (~120-200 words).',
  long: 'Length: 4-5 rich paragraphs (~250-400 words) with sensory detail and dialogue.',
};

const TONE_RULES: Record<StoryTone, string> = {
  scenario: 'Tone: follow the tone described in the scenario.',
  epic: 'Tone: epic and heroic, grand stakes, vivid action.',
  dark: 'Tone: dark and tense, dread and moral weight (still within the content rules).',
  funny: 'Tone: lighthearted and funny, witty characters and comic situations.',
  romantic: 'Tone: emotional and romantic, focus on relationships and feelings (no sexual content).',
};

const OUTPUT_FORMAT = `After the narration, ALWAYS output these blocks, in this order, with valid JSON:
<choices>["...","...","..."]</choices>
— exactly 3 short, distinct next actions the player could take (max 10 words each, first person, in the story language). Make them interesting and different (e.g. bold, careful, social).
<commands>[ ...JSON array... ]</commands>
— the game commands for this turn (or [] if nothing changes).
Journal commands (allowed in every game mode):
- {"type":"quest","action":"add","title":"..."} when a new goal/mission appears; {"type":"quest","action":"done"|"fail","title":"same title"} when it ends.
- {"type":"npc","name":"...","note":"who they are / relation to the player, max 20 words"} when an important character is met or changes.`;

const RPG_RULES = `This is an RPG with game mechanics controlled by a game engine. You may NOT change numbers yourself; use commands instead.
Game commands:
- {"type":"check","attr":"str|dex|con|int|wis|cha","dc":5-30,"reason":"short"} — ask for a d20 roll when the outcome of a risky action is uncertain. When you ask for a check, narrate only the attempt (not the result), output NO other commands and NO choices; the engine will roll and tell you the result.
- {"type":"damage","amount":N} / {"type":"heal","amount":N}
- {"type":"giveItem","name":"...","qty":N} / {"type":"removeItem","name":"...","qty":N} — only remove items the player has.
- {"type":"gold","amount":±N} / {"type":"xp","amount":N}
Use difficulty 10 easy, 15 medium, 20 hard. Be fair: failure must have real consequences.`;

const ROLEPLAY_RULES = `This is free-form roleplay: there are no dice, stats or inventory. Only journal commands are allowed.`;

export function buildSystemPrompt(mode: GameMode, lang: Language, style: NarratorStyle = DEFAULT_STYLE): string {
  return [
    BASE,
    LENGTH_RULES[style.length],
    TONE_RULES[style.tone],
    mode === 'rpg' ? RPG_RULES : ROLEPLAY_RULES,
    OUTPUT_FORMAT,
    SAFETY,
    `Always write the story, choices and journal entries in ${LANGUAGE_NAME[lang]}.`,
  ].join('\n\n');
}

export const CONTINUE_NUDGE = '(Continue the story.)';

/** Como a ação do jogador é enviada para a IA, conforme o modo. */
export function formatPlayerAction(mode: ActionMode | undefined, text: string): string {
  if (mode === 'say') return `I say: "${text.replace(/^["“]|["”]$/g, '')}"`;
  if (mode === 'story') return `[Story] ${text}`;
  return `I try: ${text}`;
}

export function checkResultNote(lang: Language, c: CheckResult): string {
  const outcome =
    c.critical === 'success'
      ? lang === 'pt' ? 'SUCESSO CRÍTICO' : 'CRITICAL SUCCESS'
      : c.critical === 'failure'
        ? lang === 'pt' ? 'FALHA CRÍTICA' : 'CRITICAL FAILURE'
        : c.success
          ? lang === 'pt' ? 'SUCESSO' : 'SUCCESS'
          : lang === 'pt' ? 'FALHA' : 'FAILURE';
  const sign = c.mod >= 0 ? '+' : '';
  return `[${attrLabel(lang, c.attr)}: ${c.roll}${sign}${c.mod} = ${c.total} vs ${c.dc} — ${outcome}]`;
}

export const CHECK_FOLLOWUP =
  'The engine rolled the check above. Now narrate the outcome according to that result, then output the <choices> and <commands> blocks (no new check in this response).';

export function summaryPrompt(lang: Language): string {
  return `Update the story summary. Merge the previous summary with the new events into a concise summary (max 250 words) in ${LANGUAGE_NAME[lang]}. Keep names, places, open plot threads, promises, relationships and important items. Reply with only the summary.`;
}
