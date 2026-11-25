import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { customScenario, getScenarios } from '@/content/scenarios';
import { ATTR_MAX, ATTR_MIN, ATTRIBUTES, createSheet, POINT_BUY_TOTAL, type Attribute, type Attributes } from '@/engine/sheet';
import { errorMessage, useT } from '@/i18n';
import { generatePortrait } from '@/media';
import { attrLabel } from '@/narrator/prompts';
import { newId } from '@/narrator/turn';
import { DEFAULT_STYLE, emptyJournal, type Adventure, type Character, type GameMode, type NarratorStyle } from '@/narrator/types';
import { StylePicker } from '@/ui/StylePicker';
import { checkText } from '@/safety/filter';
import { saveAdventure } from '@/storage/adventures';
import { useSettings } from '@/state/settings';
import { Button, ChipGroup, Label } from '@/ui/components';
import { colors, ui } from '@/ui/theme';

const START_ATTRS: Attributes = { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 };

export default function NewAdventure() {
  const t = useT();
  const { settings, keys } = useSettings();
  const lang = settings.language;
  const scenarios = useMemo(() => getScenarios(lang), [lang]);

  const [mode, setMode] = useState<GameMode>('rpg');
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState('');
  const [backstory, setBackstory] = useState('');
  const [attrs, setAttrs] = useState<Attributes>(START_ATTRS);
  const [portrait, setPortrait] = useState(true);
  const [style, setStyle] = useState<NarratorStyle>(DEFAULT_STYLE);
  const [busy, setBusy] = useState(false);

  const used = ATTRIBUTES.reduce((s, a) => s + attrs[a], 0);
  const left = POINT_BUY_TOTAL - used;
  const bump = (a: Attribute, d: number) => {
    const v = attrs[a] + d;
    if (v < ATTR_MIN || v > ATTR_MAX || (d > 0 && left <= 0)) return;
    setAttrs({ ...attrs, [a]: v });
  };

  const isCustom = scenarioId === 'custom';
  const canStart = name.trim() && (!isCustom || customDesc.trim()) && !busy;

  const start = async () => {
    const allText = [name, appearance, backstory, customTitle, customDesc].join(' ');
    if (checkText(allText, settings.filter).blocked) {
      Alert.alert(t('newAdventure'), t('blocked'));
      return;
    }
    setBusy(true);
    const scenario = isCustom ? customScenario(lang, customTitle, customDesc) : scenarios.find((s) => s.id === scenarioId)!;
    const player: Character = {
      id: newId(),
      name: name.trim(),
      appearance: appearance.trim() || (lang === 'pt' ? 'aventureiro comum' : 'ordinary adventurer'),
      backstory: backstory.trim(),
      isPlayer: true,
    };
    if (portrait) {
      try {
        player.portraitUri = await generatePortrait(player, settings, keys);
      } catch (e) {
        // O retrato é opcional: avisa e segue sem ele.
        Alert.alert(t('generatePortrait'), errorMessage(lang, e));
      }
    }
    const now = Date.now();
    const adventure: Adventure = {
      id: newId(),
      title: `${player.name} — ${scenario.title}`,
      mode,
      language: lang,
      scenario,
      characters: [player],
      sheet: mode === 'rpg' ? createSheet(attrs) : null,
      summary: '',
      summarizedUpTo: 0,
      messages: [],
      style,
      journal: emptyJournal(),
      createdAt: now,
      updatedAt: now,
    };
    await saveAdventure(adventure);
    setBusy(false);
    router.replace(`/game/${adventure.id}`);
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { paddingBottom: 48 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('newAdventure') }} />

      <Label>{t('mode')}</Label>
      <ChipGroup
        options={[
          { id: 'rpg', label: `🎲 ${t('modeRpg')}` },
          { id: 'roleplay', label: `📜 ${t('modeRoleplay')}` },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Text style={ui.muted}>{mode === 'rpg' ? t('modeRpgHelp') : t('modeRoleplayHelp')}</Text>

      <Label>{t('scenario')}</Label>
      {[...scenarios, { id: 'custom', title: `✏️ ${t('customScenario')}`, description: '', ageRating: '' }].map((s) => (
        <Pressable
          key={s.id}
          onPress={() => setScenarioId(s.id)}
          style={[ui.card, { borderColor: s.id === scenarioId ? colors.accent : colors.border }]}
        >
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={[ui.text, { fontWeight: '700', flex: 1 }]}>{s.title}</Text>
            {!!s.ageRating && <Text style={ui.muted}>{s.ageRating === 'L' ? 'L' : `${s.ageRating}+`}</Text>}
          </View>
          {!!s.description && <Text style={ui.muted}>{s.description}</Text>}
        </Pressable>
      ))}
      {isCustom && (
        <View style={{ gap: 8 }}>
          <TextInput style={ui.input} placeholder={t('scenarioTitle')} placeholderTextColor={colors.muted} value={customTitle} onChangeText={setCustomTitle} />
          <TextInput
            style={[ui.input, { minHeight: 90, textAlignVertical: 'top' }]}
            placeholder={t('scenarioDescription')}
            placeholderTextColor={colors.muted}
            value={customDesc}
            onChangeText={setCustomDesc}
            multiline
          />
        </View>
      )}

      <Label>{t('character')}</Label>
      <TextInput style={ui.input} placeholder={t('name')} placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={40} />
      <TextInput
        style={[ui.input, { minHeight: 60, textAlignVertical: 'top' }]}
        placeholder={t('appearance')}
        placeholderTextColor={colors.muted}
        value={appearance}
        onChangeText={setAppearance}
        multiline
        maxLength={300}
      />
      <TextInput
        style={[ui.input, { minHeight: 60, textAlignVertical: 'top' }]}
        placeholder={t('backstory')}
        placeholderTextColor={colors.muted}
        value={backstory}
        onChangeText={setBackstory}
        multiline
        maxLength={600}
      />

      {mode === 'rpg' && (
        <View style={ui.card}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Label>{t('attributes')}</Label>
            <Text style={{ color: left > 0 ? colors.accent : colors.muted, fontWeight: '700' }}>
              {t('pointsLeft')}: {left}
            </Text>
          </View>
          {ATTRIBUTES.map((a) => (
            <View key={a} style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={[ui.text, { flex: 1 }]}>{attrLabel(lang, a)}</Text>
              <Button small kind="secondary" label="−" onPress={() => bump(a, -1)} disabled={attrs[a] <= ATTR_MIN} />
              <Text style={[ui.text, { width: 32, textAlign: 'center', fontWeight: '700' }]}>{attrs[a]}</Text>
              <Button small kind="secondary" label="+" onPress={() => bump(a, 1)} disabled={attrs[a] >= ATTR_MAX || left <= 0} />
            </View>
          ))}
        </View>
      )}

      <View style={ui.card}>
        <Label>{`🎭 ${t('narratorStyle')}`}</Label>
        <StylePicker value={style} onChange={setStyle} lang={lang} />
      </View>

      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.text}>🖼️ {t('generatePortrait')}</Text>
        <Switch value={portrait} onValueChange={setPortrait} trackColor={{ true: colors.accent }} />
      </View>

      <Button label={busy ? t('starting') : t('start')} onPress={start} disabled={!canStart} loading={busy} />
    </ScrollView>
  );
}
