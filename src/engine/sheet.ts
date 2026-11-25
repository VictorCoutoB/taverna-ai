export const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type Attributes = Record<Attribute, number>;

export interface Item {
  name: string;
  qty: number;
}

export interface Sheet {
  attributes: Attributes;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  gold: number;
  inventory: Item[];
  dead: boolean;
}

export const XP_PER_LEVEL = 100;
/** Pontos para distribuir na criação (cada atributo entre 8 e 18). */
export const POINT_BUY_TOTAL = 72;
export const ATTR_MIN = 8;
export const ATTR_MAX = 18;

export function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function maxHpFor(attributes: Attributes, level: number): number {
  return Math.max(1, 10 + modifier(attributes.con) + (level - 1) * Math.max(1, 5 + modifier(attributes.con)));
}

export function levelForXp(xp: number): number {
  return 1 + Math.floor(xp / XP_PER_LEVEL);
}

export function createSheet(attributes: Attributes): Sheet {
  const maxHp = maxHpFor(attributes, 1);
  return { attributes, hp: maxHp, maxHp, level: 1, xp: 0, gold: 10, inventory: [], dead: false };
}

export function isValidAttributeSpread(attributes: Attributes): boolean {
  const values = ATTRIBUTES.map((a) => attributes[a]);
  return (
    values.every((v) => Number.isInteger(v) && v >= ATTR_MIN && v <= ATTR_MAX) &&
    values.reduce((s, v) => s + v, 0) <= POINT_BUY_TOTAL
  );
}
