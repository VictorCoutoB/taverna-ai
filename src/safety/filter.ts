import type { FilterLevel } from '../state/settings';

/**
 * Filtro local simples — segunda camada além das regras no prompt.
 * Bloqueia conteúdo sexual (sempre), e qualquer combinação de menores com conteúdo sexual.
 */
const SEXUAL = /\b(sexo|sexual|transar|nud[ae]s?|pelad[ao]s?|pornô?|porn|estupr\w*|orgasm\w*|genit\w*|pênis|penis|vagina|sex|nude|naked|rape|erotic\w*|nsfw|blowjob|boquete)\b/i;
const MINOR = /\b(criança|crianças|menor de idade|menina de \d+|menino de \d+|\d{1,2} anos|child|children|kid|minor|underage|loli|shota)\b/i;
const STRICT_EXTRA = /\b(tortur\w*|desmembr\w*|decapit\w*|dismember\w*|gore|suic[ií]d\w*|self[- ]harm|automutila\w*)\b/i;

export interface FilterResult {
  blocked: boolean;
  reason?: 'sexual' | 'minor' | 'violence';
}

export function checkText(text: string, level: FilterLevel): FilterResult {
  const sexual = SEXUAL.test(text);
  if (sexual && MINOR.test(text)) return { blocked: true, reason: 'minor' };
  if (sexual) return { blocked: true, reason: 'sexual' };
  if (level === 'strict' && STRICT_EXTRA.test(text)) return { blocked: true, reason: 'violence' };
  return { blocked: false };
}
