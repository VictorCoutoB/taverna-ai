import type { CheckResult } from '../engine/commands';
import type { GameMode, Language } from './types';

const LANGUAGE_NAME: Record<Language, string> = { pt: 'Brazilian Portuguese', en: 'English' };

const ATTR_LABEL: Record<Language, Record<string, string>> = {
  pt: { str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma' },
  en: { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' },
};

export const attrLabel = (lang: Language, attr: string) => ATTR_LABEL[lang][attr] ?? attr;

const SAFETY = `Content rules (mandatory): no sexual content, no sexual content involving minors under any circumstance, no graphic gore beyond a PG-13 adventure film, no real-world hate speech, no instructions for real-world weapons, drugs or crimes. If the player pushes for forbidden content, steer the story elsewhere in-character.`;

const STYLE = `You are the narrator (game master) of an interactive text adventure. Write vivid, second-person narration ("you..."), 1-3 short paragraphs per turn. Never decide the player's actions, thoughts or dialogue for them. Play every other character. End each turn at a moment that invites the player to act. Keep continuity with the story so far.`;

const RPG_RULES = `This is an RPG with game mechanics controlled by a game engine. You may NOT change numbers yourself; instead, after the narration, output a block exactly like:
<commands>[ ...JSON array... ]</commands>
Available commands:
- {"type":"check","attr":"str|dex|con|int|wis|cha","dc":5-30,"reason":"short"} — ask for a d20 roll when the outcome of a risky action is uncertain. When you ask for a check, narrate only the attempt (not the result) and output NO other commands; the engine will roll and tell you the result.
- {"type":"damage","amount":N} / {"type":"heal","amount":N}
- {"type":"giveItem","name":"...","qty":N} / {"type":"removeItem","name":"...","qty":N} — only remove items the player has.
- {"type":"gold","amount":±N} / {"type":"xp","amount":N}
Use difficulty 10 easy, 15 medium, 20 hard. Be fair: failure must have real consequences. If nothing changes, output <commands>[]</commands>.`;

const ROLEPLAY_RULES = `This is free-form roleplay: there are no dice, stats or inventory. Do not output any commands or game mechanics.`;

export function buildSystemPrompt(mode: GameMode, lang: Language): string {
  return [STYLE, mode === 'rpg' ? RPG_RULES : ROLEPLAY_RULES, SAFETY, `Always write the story in ${LANGUAGE_NAME[lang]}.`].join('\n\n');
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

export const CHECK_FOLLOWUP = 'The engine rolled the check above. Now narrate the outcome according to that result, then output the <commands> block for its consequences (no new check in this response).';

export function suggestionsPrompt(lang: Language): string {
  return `Suggest 3 short, distinct actions the player could take next (max 10 words each), written in ${LANGUAGE_NAME[lang]} in first person. Reply with only a JSON array of 3 strings.`;
}

export function summaryPrompt(lang: Language): string {
  return `Update the story summary. Merge the previous summary with the new events into a concise summary (max 250 words) in ${LANGUAGE_NAME[lang]}. Keep names, places, open plot threads, promises, relationships and important items. Reply with only the summary.`;
}
