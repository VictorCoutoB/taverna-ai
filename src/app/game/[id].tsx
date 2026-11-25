import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, useT } from '@/i18n';
import { generateSceneImage, shouldAutoGenerate, speak, stopSpeaking } from '@/media';
import { makeTextProvider } from '@/providers/registry';
import { maybeSummarize, runTurn, suggestActions } from '@/narrator/turn';
import type { Adventure, StoryMessage } from '@/narrator/types';
import { checkText } from '@/safety/filter';
import { reportMessage } from '@/safety/report';
import { getAdventure, saveAdventure } from '@/storage/adventures';
import { useSettings } from '@/state/settings';
import { Button } from '@/ui/components';
import { DiceCard } from '@/ui/DiceCard';
import { ModelPicker, useCurrentModelLabel } from '@/ui/ModelPicker';
import { SheetPanel } from '@/ui/SheetPanel';
import { colors, ui } from '@/ui/theme';

/** Índice da primeira mensagem do último turno (marcada com sheetBefore). */
function lastTurnStart(messages: StoryMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) if ('sheetBefore' in messages[i]) return i;
  return -1;
}

function rewind(a: Adventure): { base: Adventure; action: string } | null {
  const i = lastTurnStart(a.messages);
  if (i < 0) return null;
  const first = a.messages[i];
  return {
    base: { ...a, messages: a.messages.slice(0, i), sheet: first.sheetBefore ?? a.sheet, summarizedUpTo: Math.min(a.summarizedUpTo, i) },
    action: first.role === 'player' ? first.content : '',
  };
}

export default function Game() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings, keys } = useSettings();
  const [adventure, setAdventure] = useState<Adventure | null>(null);
  const advRef = useRef<Adventure | null>(null);
  const [busy, setBusy] = useState(false);
  const [partial, setPartial] = useState('');
  /** Erro mostrado no fim da história; `turn` permite tentar o mesmo turno de novo. */
  const [error, setError] = useState<{ msg: string; turn?: { action: string; base: Adventure } } | null>(null);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const modelLabel = useCurrentModelLabel('text');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const listRef = useRef<FlatList<StoryMessage>>(null);
  const started = useRef(false);

  const persist = useCallback(async (a: Adventure) => {
    advRef.current = a;
    setAdventure(a);
    await saveAdventure(a);
  }, []);

  useEffect(() => {
    getAdventure(id).then((a) => {
      advRef.current = a;
      setAdventure(a);
    });
    return () => {
      stopSpeaking();
    };
  }, [id]);

  const doSpeak = useCallback(
    async (m: StoryMessage) => {
      setSpeaking(m.id);
      try {
        await speak(m.content, settings, keys);
      } catch (e) {
        Alert.alert(t('listen'), errorMessage(settings.language, e));
      } finally {
        setSpeaking(null);
      }
    },
    [settings, keys, t],
  );

  const doImage = useCallback(
    async (messageId: string) => {
      const a = advRef.current;
      if (!a) return;
      setImageBusy(messageId);
      try {
        const upTo = a.messages.findIndex((m) => m.id === messageId);
        const uri = await generateSceneImage({ ...a, messages: a.messages.slice(0, upTo + 1) }, settings, keys, messageId);
        const latest = advRef.current!;
        await persist({ ...latest, messages: latest.messages.map((m) => (m.id === messageId ? { ...m, imageUri: uri } : m)) });
      } catch (e) {
        Alert.alert(t('image'), errorMessage(settings.language, e));
      } finally {
        setImageBusy(null);
      }
    },
    [settings, keys, persist, t],
  );

  const play = useCallback(
    async (action: string, base: Adventure) => {
      if (action && checkText(action, settings.filter).blocked) {
        Alert.alert('', t('blocked'));
        return;
      }
      setBusy(true);
      setError(null);
      setPartial('');
      setSuggestions([]);
      setInput('');
      try {
        const provider = makeTextProvider(settings.text.provider, keys, settings.local);
        const result = await runTurn({ adventure: base, action, provider, model: settings.text.model, onPartial: setPartial });
        const filtered = result.newMessages.map((m) =>
          m.role === 'narrator' && checkText(m.content, settings.filter).blocked ? { ...m, content: t('blockedOutput') } : m,
        );
        const next: Adventure = { ...base, messages: [...base.messages, ...filtered], sheet: result.sheet };
        await persist(next);
        if (result.rejected.length) console.warn('Comandos rejeitados:', result.rejected);

        const lastNarrator = [...filtered].reverse().find((m) => m.role === 'narrator');
        const narratorTurns = next.messages.filter((m) => 'sheetBefore' in m).length;
        if (lastNarrator && shouldAutoGenerate(settings, narratorTurns)) doImage(lastNarrator.id);
        if (lastNarrator && settings.speech.auto) doSpeak(lastNarrator);

        // Memória de longo prazo em segundo plano.
        maybeSummarize(next, provider, settings.text.model)
          .then((s) => {
            const latest = advRef.current;
            if (s && latest && latest.messages.length >= s.summarizedUpTo) return persist({ ...latest, ...s });
          })
          .catch(() => {});
      } catch (e) {
        setInput(action);
        setError({ msg: errorMessage(settings.language, e), turn: { action, base } });
      } finally {
        setBusy(false);
        setPartial('');
      }
    },
    [settings, keys, persist, doImage, doSpeak, t],
  );

  // Primeira narração ao abrir uma aventura nova.
  useEffect(() => {
    if (adventure && adventure.messages.length === 0 && !started.current) {
      started.current = true;
      play('', adventure);
    }
  }, [adventure, play]);

  if (!adventure) {
    return (
      <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const send = () => {
    if (!input.trim() || busy) return;
    play(input.trim(), adventure);
  };

  const redo = () => {
    const r = rewind(adventure);
    if (r && !busy) play(r.action, r.base);
  };

  const undo = async () => {
    const r = rewind(adventure);
    if (!r || busy) return;
    await persist(r.base);
    setInput(r.action);
  };

  const ideas = async () => {
    setBusy(true);
    try {
      const provider = makeTextProvider(settings.text.provider, keys, settings.local);
      setSuggestions(await suggestActions(adventure, provider, settings.text.model));
    } catch (e) {
      setError({ msg: errorMessage(settings.language, e) });
    } finally {
      setBusy(false);
    }
  };

  const report = async (m: StoryMessage) => {
    await reportMessage({ adventureId: adventure.id, messageId: m.id, content: m.content, model: `${settings.text.provider}/${settings.text.model}` });
    Alert.alert(t('report'), t('reportDone'));
  };

  const lastNarratorId = [...adventure.messages].reverse().find((m) => m.role === 'narrator')?.id;
  const dead = adventure.mode === 'rpg' && adventure.sheet?.dead;

  const renderItem = ({ item }: { item: StoryMessage }) => {
    if (item.role === 'dice' && item.check) return <DiceCard check={item.check} lang={adventure.language} />;
    if (item.role === 'player') {
      return (
        <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.player, borderRadius: 14, padding: 12 }}>
          <Text style={ui.text}>{item.content}</Text>
        </View>
      );
    }
    return (
      <View style={{ gap: 8 }}>
        {item.imageUri && <Image source={{ uri: item.imageUri }} style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: 12 }} contentFit="cover" />}
        {imageBusy === item.id && (
          <View style={[ui.card, { alignItems: 'center' }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
        <Text style={[ui.text, { fontSize: 16, lineHeight: 25 }]}>{item.content}</Text>
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          <Button small kind="ghost" label={speaking === item.id ? `⏹ ${t('stop')}` : `🔊 ${t('listen')}`} onPress={() => (speaking === item.id ? stopSpeaking() : doSpeak(item))} />
          <Button small kind="ghost" label={`🖼️ ${t('image')}`} onPress={() => doImage(item.id)} disabled={!!imageBusy} />
          <Button small kind="ghost" label={`✏️ ${t('edit')}`} onPress={() => setEditing({ id: item.id, text: item.content })} />
          {item.id === lastNarratorId && <Button small kind="ghost" label={`🔄 ${t('redo')}`} onPress={redo} disabled={busy} />}
          <Button small kind="ghost" label={`🚩 ${t('report')}`} onPress={() => report(item)} />
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: adventure.scenario.title,
          headerRight: () =>
            adventure.mode === 'rpg' && adventure.sheet ? (
              <Pressable onPress={() => setSheetOpen(true)} hitSlop={12} accessibilityLabel={t('sheet')} style={{ paddingHorizontal: 8 }}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>
                  ❤️ {adventure.sheet.hp}/{adventure.sheet.maxHp} 📜
                </Text>
              </Pressable>
            ) : undefined,
        }}
      />

      <FlatList
        ref={listRef}
        data={adventure.messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={[ui.pad, { gap: 16, paddingBottom: 24 }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          busy ? (
            <View style={{ gap: 8 }}>
              {partial ? <Text style={[ui.text, { fontSize: 16, lineHeight: 25 }]}>{partial}</Text> : null}
              <View style={ui.row}>
                <ActivityIndicator color={colors.accent} />
                <Text style={ui.muted}>{t('thinking')}</Text>
              </View>
            </View>
          ) : error ? (
            <View style={[ui.card, { borderColor: colors.danger }]}>
              <Text style={{ color: colors.danger }}>{error.msg}</Text>
              <Button small label={t('retry')} onPress={() => (error.turn ? play(error.turn.action, error.turn.base) : ideas())} />
            </View>
          ) : undefined
        }
      />

      {suggestions.length > 0 && (
        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          {suggestions.map((s) => (
            <Pressable key={s} onPress={() => setInput(s)} style={[ui.card, { padding: 10 }]}>
              <Text style={ui.text}>💡 {s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ padding: 12, paddingBottom: 12 + insets.bottom, gap: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={ui.row}>
          <Button small kind="secondary" label={`🧠 ${modelLabel}`} onPress={() => setModelOpen(true)} style={{ flexShrink: 1 }} />
          <Button small kind="secondary" label={`💡 ${t('suggestions')}`} onPress={ideas} disabled={busy || !!dead} />
          <Button small kind="secondary" label={`↩️ ${t('undo')}`} onPress={undo} disabled={busy || adventure.messages.length === 0} />
        </View>
        <View style={ui.row}>
          <TextInput
            style={[ui.input, { flex: 1, maxHeight: 120 }]}
            placeholder={t('yourAction')}
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!dead}
            maxLength={800}
          />
          <Button label="➤" onPress={send} disabled={busy || !input.trim() || !!dead} />
        </View>
      </View>

      <ModelPicker kind="text" visible={modelOpen} onClose={() => setModelOpen(false)} />

      {adventure.sheet && <SheetPanel visible={sheetOpen} onClose={() => setSheetOpen(false)} sheet={adventure.sheet} lang={adventure.language} />}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 16 }}>
          <View style={ui.card}>
            <TextInput
              style={[ui.input, { minHeight: 200, textAlignVertical: 'top' }]}
              value={editing?.text}
              onChangeText={(text) => setEditing((e) => (e ? { ...e, text } : e))}
              multiline
            />
            <View style={[ui.row, { justifyContent: 'flex-end' }]}>
              <Button small kind="ghost" label={t('cancel')} onPress={() => setEditing(null)} />
              <Button
                small
                label={t('save')}
                onPress={async () => {
                  const e = editing!;
                  setEditing(null);
                  await persist({ ...adventure, messages: adventure.messages.map((m) => (m.id === e.id ? { ...m, content: e.text } : m)) });
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!dead && !busy} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000c', justifyContent: 'center', padding: 24 }}>
          <View style={[ui.card, { alignItems: 'center', gap: 12, borderColor: colors.danger }]}>
            <Text style={{ fontSize: 48 }}>💀</Text>
            <Text style={ui.title}>{t('gameOver')}</Text>
            <Text style={[ui.text, { textAlign: 'center' }]}>{t('gameOverHelp')}</Text>
            <Button label={t('backOneTurn')} onPress={undo} style={{ alignSelf: 'stretch' }} />
            <Button label={t('newGame')} kind="secondary" onPress={() => router.replace('/new')} style={{ alignSelf: 'stretch' }} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
