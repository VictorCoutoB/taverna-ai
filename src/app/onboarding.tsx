import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { errorMessage, useT } from '@/i18n';
import { KEY_HELP, makeTextProvider, TEXT_PROVIDERS, type TextProviderId } from '@/providers/registry';
import { useSettings } from '@/state/settings';
import { autoSelectChatGPTModel, ChatGPTSignIn } from '@/ui/ChatGPTSignIn';
import { Button, ChipGroup, Label } from '@/ui/components';
import { colors, ui } from '@/ui/theme';

export default function Onboarding() {
  const t = useT();
  const { settings, keys, update, setKey } = useSettings();
  const [agreed, setAgreed] = useState(false);
  const [provider, setProvider] = useState<TextProviderId>(settings.text.provider);
  const meta = TEXT_PROVIDERS[provider];
  const [key, setKeyValue] = useState(meta.key ? keys[meta.key] ?? '' : '');
  const [ollamaUrl, setOllamaUrl] = useState(settings.local.ollama);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const choose = (p: TextProviderId) => {
    setProvider(p);
    const k = TEXT_PROVIDERS[p].key;
    setKeyValue(k ? keys[k] ?? '' : '');
    setStatus(null);
  };

  const finish = async (test: boolean) => {
    const local = { ...settings.local, ollama: ollamaUrl.trim() };
    if (test) {
      setTesting(true);
      setStatus(null);
      try {
        const k = meta.key ? { ...keys, [meta.key]: key.trim() } : keys;
        await makeTextProvider(provider, k, local).testKey();
      } catch (e) {
        setStatus({ ok: false, msg: errorMessage(settings.language, e) });
        setTesting(false);
        return;
      }
      setTesting(false);
    }
    if (meta.key && key.trim()) await setKey(meta.key, key);
    await update({ onboarded: true, local, text: { provider, model: settings.text.provider === provider ? settings.text.model : meta.defaultModel } });
    if (provider === 'chatgpt') await autoSelectChatGPTModel();
    router.replace('/');
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.pad, { paddingTop: 56, paddingBottom: 40 }]}>
      <Text style={{ fontSize: 48, textAlign: 'center' }}>🏰</Text>
      <Text style={[ui.title, { textAlign: 'center' }]}>{t('welcome')}</Text>
      <Text style={[ui.text, { textAlign: 'center' }]}>{t('welcomeText')}</Text>

      <View style={ui.card}>
        <Label>{t('language')}</Label>
        <ChipGroup
          options={[
            { id: 'pt', label: 'Português' },
            { id: 'en', label: 'English' },
          ]}
          value={settings.language}
          onChange={(language) => update({ language })}
        />
      </View>

      <View style={[ui.card, { borderColor: colors.accent }]}>
        <Text style={ui.text}>⚠️ {t('aiNotice')}</Text>
        <Pressable onPress={() => setAgreed(!agreed)} style={[ui.row, { marginTop: 4 }]} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
          <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.accent, backgroundColor: agreed ? colors.accent : 'transparent' }} />
          <Text style={[ui.text, { flex: 1 }]}>{t('ageConfirm')}</Text>
        </Pressable>
      </View>

      <View style={ui.card}>
        <Label>{t('chooseProvider')}</Label>
        <ChipGroup options={(Object.keys(TEXT_PROVIDERS) as TextProviderId[]).map((id) => ({ id, label: TEXT_PROVIDERS[id].label }))} value={provider} onChange={choose} />
        {meta.signIn ? (
          <ChatGPTSignIn onChange={(s) => setSignedIn(!!s)} />
        ) : meta.key ? (
          <>
            <Text style={ui.muted}>{KEY_HELP[meta.key].steps}</Text>
            <Button small kind="ghost" label={`${t('howToGetKey')} ↗`} onPress={() => Linking.openURL(KEY_HELP[meta.key!].url)} />
            <TextInput
              style={ui.input}
              placeholder={t('pasteKey')}
              placeholderTextColor={colors.muted}
              value={key}
              onChangeText={setKeyValue}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </>
        ) : (
          <>
            <Text style={ui.muted}>{t('localHelp')}</Text>
            <TextInput style={ui.input} value={ollamaUrl} onChangeText={setOllamaUrl} autoCapitalize="none" autoCorrect={false} />
          </>
        )}
        {status && <Text style={{ color: status.ok ? colors.success : colors.danger }}>{status.msg}</Text>}
      </View>

      <Button label={t('continue')} disabled={!agreed || (!!meta.key && !key.trim()) || (!!meta.signIn && !signedIn)} loading={testing} onPress={() => finish(true)} />
      <Button label={t('skip')} kind="ghost" disabled={!agreed} onPress={() => finish(false)} />
    </ScrollView>
  );
}
