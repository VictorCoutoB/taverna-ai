import { View } from 'react-native';
import { dictionaries } from '@/i18n';
import type { Language, NarratorStyle, StoryLength, StoryTone } from '@/narrator/types';
import { ChipGroup, Label } from './components';

/** Escolha de tamanho e tom do narrador. */
export function StylePicker({ value, onChange, lang }: { value: NarratorStyle; onChange: (s: NarratorStyle) => void; lang: Language }) {
  const t = dictionaries[lang];
  return (
    <View style={{ gap: 10 }}>
      <Label>{t.length}</Label>
      <ChipGroup<StoryLength>
        options={[
          { id: 'short', label: t.lengthShort },
          { id: 'medium', label: t.lengthMedium },
          { id: 'long', label: t.lengthLong },
        ]}
        value={value.length}
        onChange={(length) => onChange({ ...value, length })}
      />
      <Label>{t.tone}</Label>
      <ChipGroup<StoryTone>
        options={[
          { id: 'scenario', label: t.toneScenario },
          { id: 'epic', label: `⚔️ ${t.toneEpic}` },
          { id: 'dark', label: `🌑 ${t.toneDark}` },
          { id: 'funny', label: `😄 ${t.toneFunny}` },
          { id: 'romantic', label: `💕 ${t.toneRomantic}` },
        ]}
        value={value.tone}
        onChange={(tone) => onChange({ ...value, tone })}
      />
    </View>
  );
}
