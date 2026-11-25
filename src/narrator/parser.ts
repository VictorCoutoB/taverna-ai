export interface ParsedResponse {
  narration: string;
  commands: unknown[];
}

const OPEN = '<commands>';
const CLOSE = '</commands>';

/** Separa o texto narrado do bloco <commands>[...]</commands>. Nunca lança erro. */
export function parseNarratorResponse(text: string): ParsedResponse {
  const start = text.indexOf(OPEN);
  if (start === -1) return { narration: text.trim(), commands: [] };
  const end = text.indexOf(CLOSE, start);
  const narration = (text.slice(0, start) + (end === -1 ? '' : text.slice(end + CLOSE.length))).trim();
  const raw = text
    .slice(start + OPEN.length, end === -1 ? undefined : end)
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    const parsed: unknown = JSON.parse(raw);
    return { narration, commands: Array.isArray(parsed) ? parsed : [parsed] };
  } catch {
    return { narration, commands: [] };
  }
}

/** Texto seguro para mostrar enquanto a resposta chega aos pedaços. */
export function displayText(partial: string): string {
  const start = partial.indexOf(OPEN);
  if (start !== -1) return partial.slice(0, start).trimEnd();
  // Esconde um "<comm" incompleto no final.
  const lt = partial.lastIndexOf('<');
  if (lt !== -1 && OPEN.startsWith(partial.slice(lt))) return partial.slice(0, lt).trimEnd();
  return partial;
}
