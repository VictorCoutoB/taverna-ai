export interface ParsedResponse {
  narration: string;
  commands: unknown[];
  choices: string[];
}

const TAGS = ['commands', 'choices'] as const;
type Tag = (typeof TAGS)[number];

export const MAX_CHOICES = 3;
export const MAX_CHOICE_LENGTH = 80;

function parseJsonBlock(raw: string): unknown {
  const body = raw
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/** Remove um bloco <tag>…</tag> (fechado ou não) e devolve o conteúdo dele. */
function extract(text: string, tag: Tag): { rest: string; inner: string | null } {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = text.indexOf(open);
  if (start === -1) return { rest: text, inner: null };
  const end = text.indexOf(close, start);
  const inner = text.slice(start + open.length, end === -1 ? undefined : end);
  const rest = text.slice(0, start) + (end === -1 ? '' : text.slice(end + close.length));
  return { rest, inner };
}

/** Separa a narração dos blocos <commands> e <choices>. Nunca lança erro. */
export function parseNarratorResponse(text: string): ParsedResponse {
  let rest = text;
  const blocks: Partial<Record<Tag, string>> = {};
  for (const tag of TAGS) {
    const r = extract(rest, tag);
    rest = r.rest;
    if (r.inner !== null) blocks[tag] = r.inner;
  }
  const cmd = blocks.commands !== undefined ? parseJsonBlock(blocks.commands) : undefined;
  const commands = cmd === undefined || cmd === null ? [] : Array.isArray(cmd) ? cmd : [cmd];
  const ch = blocks.choices !== undefined ? parseJsonBlock(blocks.choices) : undefined;
  const choices = Array.isArray(ch)
    ? ch
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.replace(/\s+/g, ' ').trim().slice(0, MAX_CHOICE_LENGTH))
        .filter(Boolean)
        .slice(0, MAX_CHOICES)
    : [];
  return { narration: rest.trim(), commands, choices };
}

/** Texto seguro para mostrar enquanto a resposta chega aos pedaços. */
export function displayText(partial: string): string {
  let cut = partial.length;
  for (const tag of TAGS) {
    const i = partial.indexOf(`<${tag}>`);
    if (i !== -1) cut = Math.min(cut, i);
  }
  let shown = partial.slice(0, cut);
  // Esconde um "<comm" / "<cho" incompleto no final.
  const lt = shown.lastIndexOf('<');
  if (lt !== -1 && TAGS.some((tag) => `<${tag}>`.startsWith(shown.slice(lt)))) shown = shown.slice(0, lt);
  return cut < partial.length || shown.length < partial.length ? shown.trimEnd() : shown;
}
