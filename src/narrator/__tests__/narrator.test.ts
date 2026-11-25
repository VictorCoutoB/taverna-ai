import { parseNarratorResponse, displayText } from '../parser';
import { buildContext, estimateTokens } from '../context';
import { runTurn } from '../turn';
import { createSheet } from '../../engine/sheet';
import type { Adventure } from '../types';
import type { ChatMessage, TextProvider } from '../../providers/types';

describe('parseNarratorResponse', () => {
  it('separa narração e comandos', () => {
    const r = parseNarratorResponse('Você pula o abismo.\n<commands>[{"type":"check","attr":"dex","dc":14}]</commands>');
    expect(r.narration).toBe('Você pula o abismo.');
    expect(r.commands).toEqual([{ type: 'check', attr: 'dex', dc: 14 }]);
  });

  it('JSON inválido: mantém a narração e ignora comandos', () => {
    const r = parseNarratorResponse('Texto.\n<commands>[{type: oops</commands>');
    expect(r.narration).toBe('Texto.');
    expect(r.commands).toEqual([]);
  });

  it('aceita objeto único e bloco sem fechamento', () => {
    expect(parseNarratorResponse('A <commands>{"type":"heal","amount":2}</commands>').commands).toEqual([{ type: 'heal', amount: 2 }]);
    expect(parseNarratorResponse('B <commands>[{"type":"heal"').narration).toBe('B');
  });

  it('displayText esconde o bloco durante o streaming', () => {
    expect(displayText('Olá <comm')).toBe('Olá');
    expect(displayText('Olá <commands>[{"t')).toBe('Olá');
  });
});

const baseAdventure = (over: Partial<Adventure> = {}): Adventure => ({
  id: 'a1',
  title: 'Teste',
  mode: 'rpg',
  language: 'pt',
  scenario: { id: 's', title: 'Fantasia', description: 'Reino', tone: 'épico', opening: 'Início', imageStyle: 'pintura', ageRating: '12' },
  characters: [{ id: 'c1', name: 'Lia', appearance: 'ruiva', backstory: 'ladra', isPlayer: true }],
  sheet: createSheet({ str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }),
  summary: '',
  summarizedUpTo: 0,
  messages: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('buildContext', () => {
  it('respeita o orçamento mantendo as mensagens mais recentes', () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({ id: String(i), role: 'player' as const, content: 'x'.repeat(400) + i, createdAt: i }));
    const { chat, oldestIncluded } = buildContext(baseAdventure({ messages }), 'sistema', 2000);
    const total = chat.reduce((s, m) => s + estimateTokens(m.content), 0);
    expect(total).toBeLessThanOrEqual(2000);
    expect(chat[chat.length - 1].content).toContain('49');
    expect(oldestIncluded).toBeGreaterThan(0);
  });

  it('inclui ficha no modo RPG e resumo quando existe', () => {
    const { chat } = buildContext(baseAdventure({ summary: 'Lia roubou o rei.' }), 'sistema', 4000);
    const sys = chat[0].content;
    expect(sys).toContain('Lia roubou o rei.');
    expect(sys).toContain('dex');
  });
});

function fakeProvider(replies: string[]): TextProvider & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  return {
    id: 'fake',
    calls,
    listModels: async () => [],
    testKey: async () => {},
    chat: async (messages) => {
      calls.push(messages);
      return replies.shift() ?? '';
    },
  };
}

describe('runTurn', () => {
  const fixed = (n: number) => () => (n - 1) / 20;

  it('modo RPG com teste: rola o dado e faz segunda chamada', async () => {
    const provider = fakeProvider([
      'Você corre e salta.\n<commands>[{"type":"check","attr":"dex","dc":14}]</commands>',
      'Você aterrissa, mas rala o joelho.\n<commands>[{"type":"damage","amount":2},{"type":"giveItem","name":"Pena","qty":1}]</commands>',
    ]);
    const adv = baseAdventure();
    const r = await runTurn({ adventure: adv, action: 'pulo o abismo', provider, model: 'm', rng: fixed(15) });
    expect(provider.calls).toHaveLength(2);
    expect(r.newMessages.map((m) => m.role)).toEqual(['player', 'narrator', 'dice', 'narrator']);
    expect(r.newMessages[2].check).toMatchObject({ roll: 15, total: 18, success: true });
    expect(r.sheet?.hp).toBe(adv.sheet!.hp - 2);
    expect(r.sheet?.inventory).toEqual([{ name: 'Pena', qty: 1 }]);
    expect(provider.calls[1].at(-1)!.content).toContain('18');
  });

  it('modo Roleplay ignora comandos e faz uma chamada só', async () => {
    const provider = fakeProvider(['A taverna silencia.\n<commands>[{"type":"damage","amount":5}]</commands>']);
    const r = await runTurn({ adventure: baseAdventure({ mode: 'roleplay', sheet: null }), action: 'entro', provider, model: 'm' });
    expect(provider.calls).toHaveLength(1);
    expect(r.newMessages.map((m) => m.role)).toEqual(['player', 'narrator']);
    expect(r.newMessages[1].content).toBe('A taverna silencia.');
    expect(r.sheet).toBeNull();
  });

  it('registra comandos rejeitados sem quebrar o turno', async () => {
    const provider = fakeProvider(['Nada.\n<commands>[{"type":"removeItem","name":"Coroa"}]</commands>']);
    const r = await runTurn({ adventure: baseAdventure(), action: 'olho', provider, model: 'm' });
    expect(r.rejected).toHaveLength(1);
    expect(r.newMessages).toHaveLength(2);
  });
});
