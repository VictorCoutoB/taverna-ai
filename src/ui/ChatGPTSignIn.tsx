import { useEffect, useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { completeSignIn, loadSession, MANAGE_USAGE_URL, signOut, startSignIn, type ChatGPTSession } from '@/auth/chatgpt';
import { appAuthDeps } from '@/auth/deps';
import { useT } from '@/i18n';
import { makeTextProvider } from '@/providers/registry';
import { useSettings } from '@/state/settings';
import { Button } from './components';
import { colors, ui } from './theme';

/** Depois do login, escolhe um modelo da conta se nenhum estiver definido. */
export async function autoSelectChatGPTModel(): Promise<void> {
  const { settings, keys, update } = useSettings.getState();
  if (settings.text.provider !== 'chatgpt' || settings.text.model) return;
  try {
    const models = await makeTextProvider('chatgpt', keys, settings.local).listModels();
    const pick = models.find((m) => /^gpt-/.test(m.id)) ?? models[0];
    if (pick) await update({ text: { provider: 'chatgpt', model: pick.id } });
  } catch {
    // A pessoa pode escolher manualmente em "Carregar lista de modelos".
  }
}

/** Login "Continuar com ChatGPT" com o passo de colar o endereço de retorno. */
export function ChatGPTSignIn({ onChange }: { onChange?: (session: ChatGPTSession | null) => void }) {
  const t = useT();
  const [session, setSession] = useState<ChatGPTSession | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSession(appAuthDeps).then((s) => {
      setSession(s);
      onChange?.(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = async () => {
    setError('');
    try {
      const url = await startSignIn(appAuthDeps);
      setWaiting(true);
      await Linking.openURL(url);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      const s = await completeSignIn(appAuthDeps, pasted);
      setSession(s);
      setWaiting(false);
      setPasted('');
      onChange?.(s);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    await signOut(appAuthDeps);
    setSession(null);
    onChange?.(null);
  };

  if (session) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.success, fontWeight: '700' }}>
          ✅ {t('chatgptConnected')}
          {session.email ? ` · ${session.email}` : ''}
        </Text>
        <View style={ui.row}>
          <Button small kind="secondary" label={`${t('manageUsage')} ↗`} onPress={() => Linking.openURL(MANAGE_USAGE_URL)} />
          <Button small kind="ghost" label={t('signOut')} onPress={leave} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.muted}>{t('chatgptHelp')}</Text>
      <Button label={t('chatgptButton')} onPress={begin} />
      {waiting && (
        <>
          <Text style={ui.text}>{t('chatgptSteps')}</Text>
          <TextInput
            style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder={t('chatgptPaste')}
            placeholderTextColor={colors.muted}
            value={pasted}
            onChangeText={setPasted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          <Button label={t('chatgptFinish')} onPress={finish} loading={busy} disabled={!pasted.trim()} />
        </>
      )}
      {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
    </View>
  );
}
