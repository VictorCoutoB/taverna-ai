import { Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { errorMessage, useT } from '@/i18n';
import {
  IMAGE_PROVIDERS,
  KEY_HELP,
  makeImageProvider,
  makeSpeechProvider,
  makeTextProvider,
  SPEECH_PROVIDERS,
  TEXT_PROVIDERS,
  type ImageProviderId,
  type KeyId,
  type SpeechProviderId,
  type TextProviderId,
} from '@/providers/registry';
import type { ModelInfo } from '@/providers/types';
import { IMAGE_STYLES, useSettings } from '@/state/settings';
import { Button, ChipGroup, Label } from '@/ui/components';
import { colors, ui } from '@/ui/theme';

function Picker({ visible, items, onPick, onClose }: { visible: boolean; items: ModelInfo[]; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const filtered = items.filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[ui.screen, ui.pad, { paddingTop: 48 }]}>
        <TextInput style={ui.input} placeholder="🔎" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} autoCapitalize="none" />
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item.id)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}>
              <Text style={ui.text}>{item.name}</Text>
              <Text style={ui.muted}>{item.id}</Text>
            </Pressable>
          )}
        />
        <Button label="OK" kind="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const { settings, keys, update, setKey } = useSettings();
  const lang = settings.language;
  const [picker, setPicker] = useState<{ kind: 'text' | 'image' | 'voice'; items: ModelInfo[] } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});

  const note = (k: string, ok: boolean, text: string) => setMsg((m) => ({ ...m, [k]: { ok, text } }));

  const load = async (kind: 'text' | 'image' | 'voice') => {
    setLoading(kind);
    try {
      const items =
        kind === 'text'
          ? await makeTextProvider(settings.text.provider, keys, settings.local).listModels()
          : kind === 'image'
            ? await makeImageProvider(settings.image.provider, keys, settings.local).listModels()
            : (await makeSpeechProvider(settings.speech.provider, keys, lang === 'pt' ? 'pt-BR' : 'en-US').listVoices()).map((v) => ({ id: v.id, name: v.name }));
      setPicker({ kind, items });
      note(kind, true, '');
    } catch (e) {
      note(kind, false, errorMessage(lang, e));
    } finally {
      setLoading(null);
    }
  };

  const testKey = async (id: KeyId) => {
    const value = (draftKeys[id] ?? keys[id] ?? '').trim();
    await setKey(id, value);
    setLoading(id);
    try {
      const k = { ...keys, [id]: value };
      if (id === 'stability') await makeImageProvider('stability', k, settings.local).testKey();
      else if (id === 'elevenlabs') await makeSpeechProvider('elevenlabs', k, 'en').listVoices();
      else await makeTextProvider(id as TextProviderId, k, settings.local).testKey();
      note(id, true, t('keyOk'));
    } catch (e) {
      note(id, false, errorMessage(lang, e));
    } finally {
      setLoading(null);
    }
  };

  const renderMsg = (k: string) => (msg[k]?.text ? <Text style={{ color: msg[k].ok ? colors.success : colors.danger }}>{msg[k].text}</Text> : null);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { paddingBottom: 48 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('settings') }} />

      <View style={ui.card}>
        <Label>{t('textModel')}</Label>
        <ChipGroup
          options={(Object.keys(TEXT_PROVIDERS) as TextProviderId[]).map((id) => ({ id, label: TEXT_PROVIDERS[id].label }))}
          value={settings.text.provider}
          onChange={(provider) => update({ text: { provider, model: TEXT_PROVIDERS[provider].defaultModel } })}
        />
        <Text style={ui.muted}>{t('model')}</Text>
        <TextInput
          style={ui.input}
          value={settings.text.model}
          onChangeText={(model) => update({ text: { ...settings.text, model } })}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button small kind="secondary" label={t('loadModels')} loading={loading === 'text'} onPress={() => load('text')} />
        {renderMsg("text")}
      </View>

      <View style={ui.card}>
        <Label>{t('imageModel')}</Label>
        <ChipGroup
          options={(Object.keys(IMAGE_PROVIDERS) as ImageProviderId[]).map((id) => ({ id, label: IMAGE_PROVIDERS[id].label }))}
          value={settings.image.provider}
          onChange={(provider) => update({ image: { ...settings.image, provider, model: IMAGE_PROVIDERS[provider].defaultModel } })}
        />
        <Text style={ui.muted}>{t('model')}</Text>
        <TextInput
          style={ui.input}
          value={settings.image.model}
          onChangeText={(model) => update({ image: { ...settings.image, model } })}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button small kind="secondary" label={t('loadModels')} loading={loading === 'image'} onPress={() => load('image')} />
        {renderMsg("image")}
        <Text style={ui.muted}>{t('imageStyle')}</Text>
        <ChipGroup options={IMAGE_STYLES.map((s) => ({ id: s, label: s }))} value={settings.image.style} onChange={(style) => update({ image: { ...settings.image, style } })} />
        <Text style={ui.muted}>{t('imageWhen')}</Text>
        <ChipGroup
          options={[
            { id: 'manual', label: t('imageManual') },
            { id: 'every3', label: t('imageEvery3') },
            { id: 'every', label: t('imageEvery') },
          ]}
          value={settings.image.frequency}
          onChange={(frequency) => update({ image: { ...settings.image, frequency } })}
        />
      </View>

      <View style={ui.card}>
        <Label>{t('voice')}</Label>
        <ChipGroup
          options={(Object.keys(SPEECH_PROVIDERS) as SpeechProviderId[]).map((id) => ({ id, label: SPEECH_PROVIDERS[id].label }))}
          value={settings.speech.provider}
          onChange={(provider) => update({ speech: { ...settings.speech, provider, voice: SPEECH_PROVIDERS[provider].defaultModel } })}
        />
        <Text style={ui.muted}>
          {t('voice')}: {settings.speech.voice || '—'}
        </Text>
        <Button small kind="secondary" label={t('loadModels')} loading={loading === 'voice'} onPress={() => load('voice')} />
        {renderMsg("voice")}
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text style={[ui.text, { flex: 1 }]}>{t('autoRead')}</Text>
          <Switch value={settings.speech.auto} onValueChange={(auto) => update({ speech: { ...settings.speech, auto } })} trackColor={{ true: colors.accent }} />
        </View>
      </View>

      <View style={ui.card}>
        <Label>{t('apiKeys')}</Label>
        {(Object.keys(KEY_HELP) as KeyId[]).map((id) => (
          <View key={id} style={{ gap: 6, paddingVertical: 6 }}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={[ui.text, { fontWeight: '700' }]}>
                {KEY_HELP[id].label} {keys[id] ? '✅' : ''}
              </Text>
              <Pressable onPress={() => Linking.openURL(KEY_HELP[id].url)}>
                <Text style={{ color: colors.accent }}>{t('howToGetKey')} ↗</Text>
              </Pressable>
            </View>
            <View style={ui.row}>
              <TextInput
                style={[ui.input, { flex: 1 }]}
                value={draftKeys[id] ?? keys[id] ?? ''}
                onChangeText={(v) => setDraftKeys((d) => ({ ...d, [id]: v }))}
                onEndEditing={() => draftKeys[id] !== undefined && setKey(id, draftKeys[id])}
                placeholder={t('pasteKey')}
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button small kind="secondary" label={t('testKey')} loading={loading === id} onPress={() => testKey(id)} />
            </View>
            {renderMsg(id)}
          </View>
        ))}
      </View>

      <View style={ui.card}>
        <Label>{t('localServers')}</Label>
        <Text style={ui.muted}>{t('localHelp')}</Text>
        <Text style={ui.muted}>Ollama</Text>
        <TextInput style={ui.input} value={settings.local.ollama} onChangeText={(ollama) => update({ local: { ...settings.local, ollama } })} autoCapitalize="none" autoCorrect={false} />
        <Text style={ui.muted}>Stable Diffusion (AUTOMATIC1111 / Forge, --api --listen)</Text>
        <TextInput style={ui.input} value={settings.local.sd} onChangeText={(sd) => update({ local: { ...settings.local, sd } })} autoCapitalize="none" autoCorrect={false} />
      </View>

      <View style={ui.card}>
        <Label>{t('language')}</Label>
        <ChipGroup
          options={[
            { id: 'pt', label: 'Português' },
            { id: 'en', label: 'English' },
          ]}
          value={lang}
          onChange={(language) => update({ language })}
        />
        <Label>{t('contentFilter')}</Label>
        <ChipGroup
          options={[
            { id: 'moderate', label: t('filterModerate') },
            { id: 'strict', label: t('filterStrict') },
          ]}
          value={settings.filter}
          onChange={(filter) => update({ filter })}
        />
      </View>

      <Picker
        visible={!!picker}
        items={picker?.items ?? []}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          if (picker?.kind === 'text') update({ text: { ...settings.text, model: id } });
          if (picker?.kind === 'image') update({ image: { ...settings.image, model: id } });
          if (picker?.kind === 'voice') update({ speech: { ...settings.speech, voice: id } });
          setPicker(null);
        }}
      />
    </ScrollView>
  );
}
