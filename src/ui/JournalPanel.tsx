import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { JOURNAL_LIMITS } from '@/engine/journal';
import { dictionaries } from '@/i18n';
import type { Journal, Language } from '@/narrator/types';
import { BottomSheet } from './BottomSheet';
import { Button, ChipGroup } from './components';
import { colors, fonts, ui } from './theme';

type Tab = 'quests' | 'npcs' | 'facts';

export function JournalPanel({
  visible,
  onClose,
  journal,
  lang,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  journal: Journal;
  lang: Language;
  onChange: (j: Journal) => void;
}) {
  const t = dictionaries[lang];
  const [tab, setTab] = useState<Tab>('quests');
  const [fact, setFact] = useState('');

  const status = { active: `🟡 ${t.questActive}`, done: `✅ ${t.questDone}`, failed: `❌ ${t.questFailed}` };
  const quests = [...journal.quests].sort((a, b) => (a.status === 'active' ? -1 : 0) - (b.status === 'active' ? -1 : 0));

  const addFact = () => {
    const f = fact.trim().slice(0, JOURNAL_LIMITS.fact);
    if (!f || journal.facts.length >= JOURNAL_LIMITS.facts) return;
    onChange({ ...journal, facts: [...journal.facts, f] });
    setFact('');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`📖 ${t.journal}`}>
      <ChipGroup
        options={[
          { id: 'quests', label: `${t.quests} (${journal.quests.filter((q) => q.status === 'active').length})` },
          { id: 'npcs', label: `${t.characters} (${journal.npcs.length})` },
          { id: 'facts', label: `${t.facts} (${journal.facts.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'quests' &&
        (quests.length === 0 ? (
          <Text style={ui.muted}>{t.noQuests}</Text>
        ) : (
          quests.map((q) => (
            <View key={q.id} style={[ui.card, { opacity: q.status === 'active' ? 1 : 0.6 }]}>
              <Text style={{ fontFamily: fonts.serifSemi, color: colors.text, fontSize: 16 }}>{q.title}</Text>
              <Text style={ui.muted}>{status[q.status]}</Text>
            </View>
          ))
        ))}

      {tab === 'npcs' &&
        (journal.npcs.length === 0 ? (
          <Text style={ui.muted}>{t.noNpcs}</Text>
        ) : (
          journal.npcs.map((n) => (
            <View key={n.name} style={ui.card}>
              <Text style={{ fontFamily: fonts.serifSemi, color: colors.text, fontSize: 16 }}>{n.name}</Text>
              {!!n.note && <Text style={ui.muted}>{n.note}</Text>}
            </View>
          ))
        ))}

      {tab === 'facts' && (
        <View style={{ gap: 10 }}>
          <Text style={ui.muted}>{t.factsHelp}</Text>
          {journal.facts.length === 0 && <Text style={ui.muted}>{t.noFacts}</Text>}
          {journal.facts.map((f, i) => (
            <View key={`${i}-${f}`} style={[ui.card, ui.row]}>
              <Text style={[ui.text, { flex: 1 }]}>• {f}</Text>
              <Pressable onPress={() => onChange({ ...journal, facts: journal.facts.filter((_, j) => j !== i) })} hitSlop={10}>
                <Text style={{ color: colors.danger, fontSize: 18 }}>🗑</Text>
              </Pressable>
            </View>
          ))}
          <View style={ui.row}>
            <TextInput
              style={[ui.input, { flex: 1 }]}
              placeholder={t.factPlaceholder}
              placeholderTextColor={colors.muted}
              value={fact}
              onChangeText={setFact}
              maxLength={JOURNAL_LIMITS.fact}
              onSubmitEditing={addFact}
            />
            <Button small label={t.addFact} onPress={addFact} disabled={!fact.trim()} />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}
