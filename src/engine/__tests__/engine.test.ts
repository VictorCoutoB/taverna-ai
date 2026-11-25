import { createRng, rollD20 } from '../dice';
import { createSheet, modifier } from '../sheet';
import { applyCommands, resolveCheck, validateCommands, LIMITS } from '../commands';

describe('dice', () => {
  it('é determinístico com a mesma semente', () => {
    const a = createRng(42);
    const b = createRng(42);
    const ra = [1, 2, 3, 4, 5].map(() => rollD20(a));
    const rb = [1, 2, 3, 4, 5].map(() => rollD20(b));
    expect(ra).toEqual(rb);
  });

  it('sempre fica entre 1 e 20', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const r = rollD20(rng);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
    }
  });
});

describe('sheet', () => {
  it('calcula modificadores estilo d20', () => {
    expect(modifier(10)).toBe(0);
    expect(modifier(8)).toBe(-1);
    expect(modifier(15)).toBe(2);
    expect(modifier(20)).toBe(5);
  });

  it('cria ficha com vida baseada em Constituição', () => {
    const s = createSheet({ str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 });
    expect(s.maxHp).toBe(12);
    expect(s.hp).toBe(12);
    expect(s.inventory).toEqual([]);
  });
});

describe('resolveCheck', () => {
  const sheet = createSheet({ str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 });
  const fixed = (n: number) => () => (n - 1) / 20;

  it('soma modificador e compara com a CD', () => {
    const r = resolveCheck(sheet, 'dex', 14, fixed(11));
    expect(r).toMatchObject({ roll: 11, mod: 3, total: 14, success: true, critical: null });
  });

  it('20 natural sempre passa, 1 natural sempre falha', () => {
    expect(resolveCheck(sheet, 'dex', 30, fixed(20))).toMatchObject({ success: true, critical: 'success' });
    expect(resolveCheck(sheet, 'dex', 2, fixed(1))).toMatchObject({ success: false, critical: 'failure' });
  });
});

describe('validateCommands', () => {
  const sheet = { ...createSheet({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }), inventory: [{ name: 'Tocha', qty: 1 }] };

  it('aceita comandos válidos', () => {
    const { valid, rejected } = validateCommands(
      [{ type: 'damage', amount: 3 }, { type: 'giveItem', name: 'Espada', qty: 1 }, { type: 'check', attr: 'str', dc: 12 }],
      sheet,
    );
    expect(valid).toHaveLength(3);
    expect(rejected).toHaveLength(0);
  });

  it('rejeita lixo, atributos inexistentes e itens que o jogador não tem', () => {
    const { valid, rejected } = validateCommands(
      [null, 'oi', { type: 'fly' }, { type: 'check', attr: 'luck', dc: 10 }, { type: 'removeItem', name: 'Diamante', qty: 1 }, { type: 'damage', amount: -5 }],
      sheet,
    );
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(6);
  });

  it('limita dano, cura e ouro por turno', () => {
    const { valid } = validateCommands(
      [{ type: 'damage', amount: 999 }, { type: 'heal', amount: 999 }, { type: 'gold', amount: 99999 }],
      sheet,
    );
    expect(valid).toEqual([
      { type: 'damage', amount: LIMITS.damage },
      { type: 'heal', amount: LIMITS.heal },
      { type: 'gold', amount: LIMITS.gold },
    ]);
  });
});

describe('applyCommands', () => {
  const base = createSheet({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

  it('vida fica entre 0 e o máximo e marca morte', () => {
    const hurt = applyCommands(base, [{ type: 'damage', amount: 50 }]);
    expect(hurt.hp).toBe(0);
    expect(hurt.dead).toBe(true);
    const healed = applyCommands({ ...base, hp: 5 }, [{ type: 'heal', amount: 50 }]);
    expect(healed.hp).toBe(base.maxHp);
  });

  it('empilha e remove itens sem mutar a ficha original', () => {
    const s1 = applyCommands(base, [{ type: 'giveItem', name: 'Poção', qty: 2 }, { type: 'giveItem', name: 'poção', qty: 1 }]);
    expect(s1.inventory).toEqual([{ name: 'Poção', qty: 3 }]);
    const s2 = applyCommands(s1, [{ type: 'removeItem', name: 'Poção', qty: 3 }]);
    expect(s2.inventory).toEqual([]);
    expect(base.inventory).toEqual([]);
  });

  it('ouro não fica negativo e XP sobe de nível', () => {
    const s = applyCommands(base, [{ type: 'gold', amount: -100 }, { type: 'xp', amount: 100 }]);
    expect(s.gold).toBe(0);
    expect(s.level).toBe(2);
  });
});
