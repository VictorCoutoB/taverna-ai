import { base64ToBytes } from '../images';
import { parseImport, serializeForExport } from '../adventures';
import { bytesToBase64 } from '../../providers/http';
import type { Adventure } from '../../narrator/types';

jest.mock('expo-sqlite', () => ({}));

describe('base64', () => {
  it('ida e volta', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'Olá, aventura!']) {
      const bytes = new TextEncoder().encode(s);
      expect(new TextDecoder().decode(base64ToBytes(bytesToBase64(bytes)))).toBe(s);
    }
  });
});

describe('exportar/importar', () => {
  const adv: Adventure = {
    id: 'a',
    title: 'T',
    mode: 'roleplay',
    language: 'pt',
    scenario: { id: 's', title: 'S', description: '', tone: '', opening: '', imageStyle: '', ageRating: 'L' },
    characters: [{ id: 'c', name: 'N', appearance: '', backstory: '', isPlayer: true, portraitUri: 'file:///x.png' }],
    sheet: null,
    summary: '',
    summarizedUpTo: 0,
    messages: [{ id: 'm', role: 'narrator', content: 'oi', imageUri: 'file:///y.png', createdAt: 0 }],
    createdAt: 0,
    updatedAt: 0,
  };

  it('remove caminhos locais e gera novo id ao importar', () => {
    const text = serializeForExport(adv);
    expect(text).not.toContain('file:///');
    const back = parseImport(text, () => 'novo');
    expect(back.id).toBe('novo');
    expect(back.messages[0].content).toBe('oi');
  });

  it('rejeita arquivos estranhos', () => {
    expect(() => parseImport('{"foo":1}', () => 'x')).toThrow();
  });
});
