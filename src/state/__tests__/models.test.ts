import { addRecent, CACHE_TTL_MS, isFresh, MAX_RECENTS, parseRefKey, refKey, shortModelName } from '../models';

jest.mock('expo-sqlite', () => ({}));

describe('models helpers', () => {
  it('cache vale 24h', () => {
    expect(isFresh({ at: 0, models: [] }, CACHE_TTL_MS - 1)).toBe(true);
    expect(isFresh({ at: 0, models: [] }, CACHE_TTL_MS)).toBe(false);
    expect(isFresh(undefined, 0)).toBe(false);
  });

  it('recentes sem repetição e limitados', () => {
    let list = addRecent([], { kind: 'text', provider: 'a', model: '1' });
    for (let i = 2; i <= 8; i++) list = addRecent(list, { kind: 'text', provider: 'a', model: String(i) });
    list = addRecent(list, { kind: 'text', provider: 'a', model: '5' });
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0].model).toBe('5');
    expect(list.filter((r) => r.model === '5')).toHaveLength(1);
  });

  it('nome curto e chave reversível (inclusive modelos com ":")', () => {
    expect(shortModelName('anthropic/claude-x')).toBe('claude-x');
    expect(shortModelName('gpt-x', [{ id: 'gpt-x', name: 'OpenAI: GPT X' }])).toBe('GPT X');
    expect(shortModelName('')).toBe('—');
    const r = { kind: 'text' as const, provider: 'ollama', model: 'llama3:8b' };
    expect(parseRefKey(refKey(r))).toEqual(r);
  });
});
