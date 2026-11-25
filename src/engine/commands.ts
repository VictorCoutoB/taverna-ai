import { defaultRng, rollD20, type Rng } from './dice';
import { ATTRIBUTES, levelForXp, maxHpFor, modifier, type Attribute, type Sheet } from './sheet';

/** Comandos que a IA pode pedir ao motor. O motor é quem decide e aplica. */
export type Command =
  | { type: 'check'; attr: Attribute; dc: number; reason?: string }
  | { type: 'damage'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'giveItem'; name: string; qty: number }
  | { type: 'removeItem'; name: string; qty: number }
  | { type: 'gold'; amount: number }
  | { type: 'xp'; amount: number };

export type StateCommand = Exclude<Command, { type: 'check' }>;

/** Tetos por turno — impedem a IA de "trapacear" com valores absurdos. */
export const LIMITS = { damage: 20, heal: 20, gold: 500, xp: 100, itemQty: 10, dcMin: 5, dcMax: 30, nameLength: 40 };

export interface Rejected {
  raw: unknown;
  reason: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isPosInt = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

function validateOne(raw: unknown, sheet: Sheet): Command | string {
  if (!raw || typeof raw !== 'object') return 'não é objeto';
  const c = raw as Record<string, unknown>;
  switch (c.type) {
    case 'check': {
      if (!ATTRIBUTES.includes(c.attr as Attribute)) return 'atributo inválido';
      if (typeof c.dc !== 'number' || !Number.isFinite(c.dc)) return 'CD inválida';
      const reason = typeof c.reason === 'string' ? c.reason.slice(0, 120) : undefined;
      return { type: 'check', attr: c.attr as Attribute, dc: clamp(Math.round(c.dc), LIMITS.dcMin, LIMITS.dcMax), reason };
    }
    case 'damage':
    case 'heal':
    case 'xp': {
      if (!isPosInt(c.amount)) return 'quantidade inválida';
      return { type: c.type, amount: Math.min(Math.round(c.amount), LIMITS[c.type]) };
    }
    case 'gold': {
      if (typeof c.amount !== 'number' || !Number.isFinite(c.amount) || c.amount === 0) return 'quantidade inválida';
      return { type: 'gold', amount: clamp(Math.round(c.amount), -LIMITS.gold, LIMITS.gold) };
    }
    case 'giveItem':
    case 'removeItem': {
      if (typeof c.name !== 'string' || !c.name.trim()) return 'nome inválido';
      const qty = c.qty === undefined ? 1 : c.qty;
      if (!isPosInt(qty)) return 'quantidade inválida';
      const name = c.name.trim().slice(0, LIMITS.nameLength);
      if (c.type === 'removeItem') {
        const owned = sheet.inventory.find((i) => sameName(i.name, name));
        if (!owned) return 'jogador não possui o item';
        return { type: 'removeItem', name: owned.name, qty: Math.min(Math.round(qty), owned.qty) };
      }
      return { type: 'giveItem', name, qty: Math.min(Math.round(qty), LIMITS.itemQty) };
    }
    default:
      return 'tipo desconhecido';
  }
}

export function validateCommands(raws: unknown[], sheet: Sheet): { valid: Command[]; rejected: Rejected[] } {
  const valid: Command[] = [];
  const rejected: Rejected[] = [];
  for (const raw of raws) {
    const r = validateOne(raw, sheet);
    if (typeof r === 'string') rejected.push({ raw, reason: r });
    else valid.push(r);
  }
  return { valid, rejected };
}

export function applyCommands(sheet: Sheet, commands: Command[]): Sheet {
  let s: Sheet = { ...sheet, attributes: { ...sheet.attributes }, inventory: sheet.inventory.map((i) => ({ ...i })) };
  for (const c of commands) {
    switch (c.type) {
      case 'damage':
        s.hp = Math.max(0, s.hp - c.amount);
        break;
      case 'heal':
        s.hp = Math.min(s.maxHp, s.hp + c.amount);
        break;
      case 'gold':
        s.gold = Math.max(0, s.gold + c.amount);
        break;
      case 'xp': {
        s.xp += c.amount;
        const level = levelForXp(s.xp);
        if (level > s.level) {
          const maxHp = maxHpFor(s.attributes, level);
          s = { ...s, level, hp: s.hp + (maxHp - s.maxHp), maxHp };
        }
        break;
      }
      case 'giveItem': {
        const owned = s.inventory.find((i) => sameName(i.name, c.name));
        if (owned) owned.qty += c.qty;
        else s.inventory.push({ name: c.name, qty: c.qty });
        break;
      }
      case 'removeItem': {
        const owned = s.inventory.find((i) => sameName(i.name, c.name));
        if (owned) owned.qty -= c.qty;
        s.inventory = s.inventory.filter((i) => i.qty > 0);
        break;
      }
      case 'check':
        break;
    }
  }
  s.dead = s.hp <= 0;
  return s;
}

export interface CheckResult {
  attr: Attribute;
  dc: number;
  roll: number;
  mod: number;
  total: number;
  success: boolean;
  critical: 'success' | 'failure' | null;
  reason?: string;
}

export function resolveCheck(sheet: Sheet, attr: Attribute, dc: number, rng: Rng = defaultRng, reason?: string): CheckResult {
  const roll = rollD20(rng);
  const mod = modifier(sheet.attributes[attr]);
  const total = roll + mod;
  const critical = roll === 20 ? 'success' : roll === 1 ? 'failure' : null;
  const success = critical === 'success' ? true : critical === 'failure' ? false : total >= dc;
  return { attr, dc, roll, mod, total, success, critical, reason };
}
