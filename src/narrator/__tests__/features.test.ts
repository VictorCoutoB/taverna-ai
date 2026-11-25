import { applyJournal, validateJournalCommands, JOURNAL_LIMITS } from '../../engine/journal';
import { createSheet } from '../../engine/sheet';
import type { ChatMessage, TextProvider } from '../../providers/types';
import { branchAt, branchTitle, makeSave, restoreSave } from '../../storage/saves';
import { buildContext, storyToChat } from '../context';
import { displayText, parseNarratorResponse } from '../parser';
import { buildSystemPrompt, CONTINUE_NUDGE } from '../prompts';
import { runTurn } from '../turn';
import { emptyJournal, type Adventure } from '../types';

jest.mock('expo-sqlite', () => ({}));

const adv = (over: Partial<Adventure> = {}): Adventure => ({
  id: 'a1',
  title: 'Lia — Valdren',
  mode: 'roleplay',
  language: 'pt',
  scenario: { id: 's', title: 'Valdren', description: 'Reino', tone: 'épico', opening: 'Início', imageStyle: '', ageRating: '12' },
  characters: [{ id: 'c', name: 'Lia', appearance: 'ruiva', backstory: '', isPlayer: true }],
  sheet: null,
  summary: '',
  summarizedUpTo: 0,
  messages: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

function fake(replies: string[]): TextProvider & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  return { id: 'f', calls, listModels: async () => [], testKey: async () => {}, chat: async (m) => (calls.push(m), replies.shift() ?? '') };
}

describe('parser com escolhas', () => {
  it('extrai choices e commands em qualquer ordem', () => {
    const r = parseNarratorResponse('A porta range.\n<choices>["Entrar","Fugir","Gritar"]</choices>\n<commands>[{"type":"heal","amount":1}]</commands>');
    expect(r.narration).toBe('A porta range.');
    expect(r.choices).toEqual(['Entrar', 'Fugir', 'Gritar']);
    expect(r.commands).toEqual([{ type: 'heal', amount: 1 }]);
    const r2 = parseNarratorResponse('X <commands>[]</commands><choices>["a","b","c","d"]</choices>');
    expect(r2.choices).toEqual(['a', 'b', 'c']);
  });

  it('choices inválidos viram lista vazia sem perder a narração', () => {
    const r = parseNarratorResponse('Texto <choices>[oops</choices>');
    expect(r).toMatchObject({ narration: 'Texto', choices: [] });
  });

  it('displayText esconde blocos parciais', () => {
    expect(displayText('Olá <cho')).toBe('Olá');
    expect(displayText('Olá <choices>["a"')).toBe('Olá');
    expect(displayText('Olá mundo')).toBe('Olá mundo');
  });
});

describe('modos de ação e continuar', () => {
  it('formata Fazer, Dizer e História', () => {
    const a = adv();
    const m = (actionMode: 'do' | 'say' | 'story', content: string) => storyToChat(a, { id: 'x', role: 'player', content, actionMode, createdAt: 0 }).content;
    expect(m('do', 'abro a porta')).toBe('I try: abro a porta');
    expect(m('say', '"Olá!"')).toBe('I say: "Olá!"');
    expect(m('story', 'Um trovão ecoa.')).toBe('[Story] Um trovão ecoa.');
  });

  it('sem ação nova, o contexto termina pedindo para continuar', () => {
    const a = adv({ messages: [{ id: '1', role: 'narrator', content: 'Fim da cena.', createdAt: 0 }] });
    const { chat } = buildContext(a, 'S', 4000);
    expect(chat[chat.length - 1]).toEqual({ role: 'user', content: CONTINUE_NUDGE });
  });
});

describe('estilo do narrador', () => {
  it('prompt muda com tamanho e tom', () => {
    expect(buildSystemPrompt('roleplay', 'pt', { length: 'short', tone: 'funny' })).toMatch(/1 short paragraph[\s\S]*lighthearted/);
    expect(buildSystemPrompt('rpg', 'en', { length: 'long', tone: 'dark' })).toMatch(/4-5 rich paragraphs[\s\S]*dark and tense/);
  });
});

describe('diário', () => {
  it('valida, aplica e respeita limites', () => {
    const cmds = validateJournalCommands([
      { type: 'quest', action: 'add', title: 'Achar o dragão' },
      { type: 'npc', name: 'Bram', note: 'ferreiro desconfiado' },
      { type: 'quest', action: 'explode', title: 'x' },
      { type: 'npc' },
      'lixo',
      { type: 'damage', amount: 3 },
    ]);
    expect(cmds).toHaveLength(2);
    let j = applyJournal(emptyJournal(), cmds, () => 'q1');
    expect(j.quests).toEqual([{ id: 'q1', title: 'Achar o dragão', status: 'active' }]);
    j = applyJournal(j, validateJournalCommands([{ type: 'quest', action: 'done', title: 'achar o DRAGÃO' }, { type: 'npc', name: 'bram', note: 'agora aliado' }]), () => 'x');
    expect(j.quests[0].status).toBe('done');
    expect(j.npcs).toEqual([{ name: 'Bram', note: 'agora aliado' }]);
    let big = emptyJournal();
    for (let i = 0; i < 30; i++) big = applyJournal(big, [{ type: 'quest', action: 'add', title: `Q${i}` }], () => `id${i}`);
    expect(big.quests).toHaveLength(JOURNAL_LIMITS.quests);
  });

  it('o diário entra no contexto', () => {
    const a = adv({ journal: { quests: [{ id: '1', title: 'Salvar a vila', status: 'active' }], npcs: [{ name: 'Bram', note: 'ferreiro' }], facts: ['A lua é vermelha'] } });
    const sys = buildContext(a, 'S', 4000).chat[0].content;
    expect(sys).toContain('Salvar a vila');
    expect(sys).toContain('Bram: ferreiro');
    expect(sys).toContain('A lua é vermelha');
  });
});

describe('runTurn com escolhas, modos e diário', () => {
  it('roleplay: guarda escolhas, modo da ação e atualiza o diário', async () => {
    const p = fake(['O ferreiro sorri.\n<choices>["Pagar","Barganhar","Sair"]</choices>\n<commands>[{"type":"npc","name":"Bram","note":"ferreiro"},{"type":"quest","action":"add","title":"Forjar a espada"}]</commands>']);
    const r = await runTurn({ adventure: adv(), action: 'Bom dia!', actionMode: 'say', provider: p, model: 'm' });
    expect(r.newMessages[0]).toMatchObject({ role: 'player', actionMode: 'say' });
    expect(r.newMessages[1].choices).toEqual(['Pagar', 'Barganhar', 'Sair']);
    expect(r.journal.npcs[0].name).toBe('Bram');
    expect(r.journal.quests[0].title).toBe('Forjar a espada');
    expect(p.calls[0].at(-1)!.content).toBe('I say: "Bom dia!"');
    expect(r.newMessages[0].journalBefore).toEqual(emptyJournal());
  });

  it('rpg com teste: escolhas só na narração final', async () => {
    const p = fake([
      'Você salta.\n<choices>["x","y","z"]</choices>\n<commands>[{"type":"check","attr":"dex","dc":10}]</commands>',
      'Você consegue!\n<choices>["Seguir","Olhar","Descansar"]</choices>\n<commands>[{"type":"quest","action":"add","title":"Cruzar o rio"}]</commands>',
    ]);
    const r = await runTurn({
      adventure: adv({ mode: 'rpg', sheet: createSheet({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }) }),
      action: 'pulo',
      provider: p,
      model: 'm',
      rng: () => 0.9,
    });
    expect(r.newMessages[1].choices).toBeUndefined();
    expect(r.newMessages[3].choices).toEqual(['Seguir', 'Olhar', 'Descansar']);
    expect(r.journal.quests[0].title).toBe('Cruzar o rio');
    expect(r.rejected).toHaveLength(0);
  });
});

describe('saves e ramificações', () => {
  const base = adv({
    journal: { quests: [{ id: 'q', title: 'Nova', status: 'active' }], npcs: [], facts: [] },
    messages: [
      { id: '0', role: 'narrator', content: 'Início', createdAt: 0, sheetBefore: null, journalBefore: emptyJournal() },
      { id: '1', role: 'player', content: 'ando', createdAt: 0, sheetBefore: null, journalBefore: emptyJournal() },
      { id: '2', role: 'narrator', content: 'Você anda.', createdAt: 0 },
    ],
  });

  it('ramifica cortando no índice e voltando o diário', () => {
    const b = branchAt(base, 0, 'novo', branchTitle(base.title, []));
    expect(b.id).toBe('novo');
    expect(b.title).toBe('Lia — Valdren (ramo 2)');
    expect(b.messages.map((m) => m.id)).toEqual(['0']);
    expect(b.journal).toEqual(emptyJournal());
    expect(base.messages).toHaveLength(3);
    expect(branchTitle('Lia — Valdren (ramo 2)', ['Lia — Valdren (ramo 2)'])).toBe('Lia — Valdren (ramo 3)');
  });

  it('save é uma cópia independente e restaura no mesmo id', () => {
    const s = makeSave(base, 'Antes da ponte', 's1', 1000);
    base.messages[0].content = 'alterado';
    expect(s.data.messages[0].content).toBe('Início');
    const restored = restoreSave(s, { ...base, id: 'a1' });
    expect(restored.id).toBe('a1');
    expect(restored.messages).toHaveLength(3);
    base.messages[0].content = 'Início';
  });
});
