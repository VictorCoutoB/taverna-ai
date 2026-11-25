import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, useT } from '@/i18n';
import { generateSceneImage, shouldAutoGenerate, speak, stopSpeaking } from '@/media';
import { makeTextProvider } from '@/providers/registry';
import { maybeSummarize, newId, runTurn } from '@/narrator/turn';
import { DEFAULT_STYLE, emptyJournal, type ActionMode, type Adventure, type StoryMessage } from '@/narrator/types';
import { checkText } from '@/safety/filter';
import { reportMessage } from '@/safety/report';
import { getAdventure, listAdventures, saveAdventure } from '@/storage/adventures';
import { branchAt, branchTitle } from '@/storage/saves';
import { useSettings } from '@/state/settings';
import { ActionList, BottomSheet } from '@/ui/BottomSheet';
import { Button, ChipGroup } from '@/ui/components';
import { DiceCard } from '@/ui/DiceCard';
import { JournalPanel } from '@/ui/JournalPanel';
import { ModelPicker, useCurrentModelLabel } from '@/ui/ModelPicker';
import { SavesPanel } from '@/ui/SavesPanel';
import { SheetPanel } from '@/ui/SheetPanel';
import { NarratorBlock, Narration, PlayerLine } from '@/ui/Story';
import { StylePicker } from '@/ui/StylePicker';
import { colors, ui } from '@/ui/theme';

/** Índice da primeira mensagem do último turno (marcada com sheetBefore). */
function lastTurnStart(messages: StoryMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) if ('sheetBefore' in messages[i]) return i;
  return -1;
}

function rewind(a: Adventure): { base: Adventure; action: string; mode: ActionMode } | null {
  const i = lastTurnStart(a.messages);
  if (i < 0) return null;
  const first = a.messages[i];
  return {
    base: {
      ...a,
      messages: a.messages.slice(0, i),
      sheet: first.sheetBefore ?? a.sheet,
      journal: first.journalBefore ?? a.journal,
      summarizedUpTo: Math.min(a.summarizedUpTo, i),
    },
    action: first.role === 'player' ? first.content : '',
    mode: first.actionMode ?? 'do',
  };
}

type Panel = null | 'menu' | 'journal' | 'style' | 'saves' | 'sheet' | 'model' | { message: StoryMessage; index: number };

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
  const [error, setError] = useState<{ msg: string; turn?: { action: string; mode: ActionMode; base: Adventure } } | null>(null);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ActionMode>('do');
  const [panel, setPanel] = useState<Panel>(null);
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
    started.current = false;
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
    async (action: string, actionMode: ActionMode, base: Adventure) => {
      if (action && checkText(action, settings.filter).blocked) {
        Alert.alert('', t('blocked'));
        return;
      }
      setBusy(true);
      setError(null);
      setPartial('');
      setInput('');
      try {
        const provider = makeTextProvider(settings.text.provider, keys, settings.local);
        const result = await runTurn({ adventure: base, action, actionMode, provider, model: settings.text.model, onPartial: setPartial });
        const filtered = result.newMessages.map((m) =>
          m.role === 'narrator' && checkText(m.content, settings.filter).blocked ? { ...m, content: t('blockedOutput'), choices: undefined } : m,
        );
        const next: Adventure = { ...base, messages: [...base.messages, ...filtered], sheet: result.sheet, journal: result.journal };
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
        setMode(actionMode);
        setError({ msg: errorMessage(settings.language, e), turn: { action, mode: actionMode, base } });
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
      play('', 'do', adventure);
    }
  }, [adventure, play]);

  if (!adventure) {
    return (
      <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const journal = adventure.journal ?? emptyJournal();
  const style = adventure.style ?? DEFAULT_STYLE;
  const dead = adventure.mode === 'rpg' && !!adventure.sheet?.dead;
  const lastNarratorId = [...adventure.messages].reverse().find((m) => m.role === 'narrator')?.id;
  const firstNarratorId = adventure.messages.find((m) => m.role === 'narrator')?.id;

  const send = (text = input) => {
    if (!text.trim() || busy || dead) return;
    play(text.trim(), mode, adventure);
  };

  const continueStory = () => {
    if (!busy && !dead) play('', 'do', adventure);
  };

  const redo = () => {
    const r = rewind(adventure);
    if (r && !busy) play(r.action, r.mode, r.base);
  };

  const undo = async () => {
    const r = rewind(adventure);
    if (!r || busy) return;
    await persist(r.base);
    setInput(r.action);
    setMode(r.mode);
  };

  const report = async (m: StoryMessage) => {
    await reportMessage({ adventureId: adventure.id, messageId: m.id, content: m.content, model: `${settings.text.provider}/${settings.text.model}` });
    Alert.alert(t('report'), t('reportDone'));
  };

  const branch = async (index: number) => {
    const titles = (await listAdventures()).map((a) => a.title);
    const copy = branchAt(adventure, index, newId(), branchTitle(adventure.title, titles));
    await saveAdventure(copy);
    router.push(`/game/${copy.id}`);
  };

  const placeholder = mode === 'say' ? t('phSay') : mode === 'story' ? t('phStory') : t('phDo');
  const messagePanel = panel && typeof panel === 'object' ? panel : null;

  const renderItem = ({ item }: { item: StoryMessage }) => {
    if (item.role === 'dice' && item.check) return <DiceCard check={item.check} lang={adventure.language} />;
    if (item.role === 'player') return <PlayerLine m={item} lang={adventure.language} />;
    const isLast = item.id === lastNarratorId;
    return (
      <NarratorBlock
        m={item}
        dropCap={item.id === firstNarratorId}
        imageLoading={imageBusy === item.id}
        speaking={speaking === item.id}
        onSpeak={() => (speaking === item.id ? stopSpeaking() : doSpeak(item))}
        onMenu={() => setPanel({ message: item, index: adventure.messages.findIndex((m) => m.id === item.id) })}
        choices={isLast && !busy && !dead ? item.choices : undefined}
        onChoice={(c) => send(c)}
        disabled={busy}
      />
    );
  };

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: adventure.scenario.title,
          headerRight: () => (
            <View style={[ui.row, { gap: 14, paddingHorizontal: 8 }]}>
              {adventure.mode === 'rpg' && adventure.sheet && (
                <Pressable onPress={() => setPanel('sheet')} hitSlop={10} accessibilityLabel={t('sheet')}>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>
                    ❤️ {adventure.sheet.hp}/{adventure.sheet.maxHp}
                  </Text>
                </Pressable>
              )}
              <Pressable onPress={() => setPanel('journal')} hitSlop={10} accessibilityLabel={t('journal')}>
                <Text style={{ fontSize: 18 }}>📖</Text>
              </Pressable>
              <Pressable onPress={() => setPanel('menu')} hitSlop={10} accessibilityLabel={t('actions')}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>⋯</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <FlatList
        ref={listRef}
        data={adventure.messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 28 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          busy ? (
            <View style={{ gap: 10 }}>
              {partial ? <Narration text={partial} /> : null}
              <View style={ui.row}>
                <ActivityIndicator color={colors.accent} />
                <Text style={ui.muted}>{t('thinking')}</Text>
              </View>
            </View>
          ) : error ? (
            <View style={[ui.card, { borderColor: colors.danger }]}>
              <Text style={{ color: colors.danger }}>{error.msg}</Text>
              <View style={ui.row}>
                {error.turn && <Button small label={t('retry')} onPress={() => play(error.turn!.action, error.turn!.mode, error.turn!.base)} />}
                <Button small kind="secondary" label={`🧠 ${t('change')}`} onPress={() => setPanel('model')} />
              </View>
            </View>
          ) : undefined
        }
      />

      <View style={{ padding: 12, paddingBottom: 12 + insets.bottom, gap: 10, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <ChipGroup<ActionMode>
            options={[
              { id: 'do', label: `✋ ${t('actDo')}` },
              { id: 'say', label: `💬 ${t('actSay')}` },
              { id: 'story', label: `✒️ ${t('actStory')}` },
            ]}
            value={mode}
            onChange={setMode}
          />
        </View>
        <View style={ui.row}>
          <TextInput
            style={[ui.input, { flex: 1, maxHeight: 120 }]}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!dead}
            maxLength={800}
          />
          {input.trim() ? (
            <Button label="➤" onPress={() => send()} disabled={busy || dead} />
          ) : (
            <Button label={`${t('continueBtn')} ⏵`} kind="secondary" onPress={continueStory} disabled={busy || dead || adventure.messages.length === 0} />
          )}
        </View>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Pressable onPress={() => setPanel('model')} hitSlop={8} style={{ flexShrink: 1 }}>
            <Text style={ui.muted} numberOfLines={1}>
              🧠 {t('narrator')}: <Text style={{ color: colors.accent, fontWeight: '700' }}>{modelLabel}</Text> ›
            </Text>
          </Pressable>
          <Pressable onPress={undo} disabled={busy || adventure.messages.length === 0} hitSlop={8}>
            <Text style={[ui.muted, { opacity: busy ? 0.4 : 1 }]}>↩️ {t('undo')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Menu geral */}
      <BottomSheet visible={panel === 'menu'} onClose={() => setPanel(null)} title={t('actions')}>
        <ActionList
          items={[
            { icon: '📖', label: t('journal'), onPress: () => setPanel('journal') },
            { icon: '📜', label: t('sheet'), onPress: () => setPanel('sheet'), hidden: !adventure.sheet },
            { icon: '🎭', label: t('narratorStyle'), onPress: () => setPanel('style') },
            { icon: '🧠', label: `${t('textModel')}: ${modelLabel}`, onPress: () => setPanel('model') },
            { icon: '💾', label: t('saves'), onPress: () => setPanel('saves') },
            { icon: '⚙️', label: t('settings'), onPress: () => (setPanel(null), router.push('/settings')) },
          ]}
        />
      </BottomSheet>

      {/* Menu de uma narração */}
      <BottomSheet visible={!!messagePanel} onClose={() => setPanel(null)} title={t('actions')}>
        {messagePanel && (
          <ActionList
            items={[
              { icon: '🔊', label: t('listen'), onPress: () => (setPanel(null), doSpeak(messagePanel.message)) },
              { icon: '🖼️', label: t('image'), onPress: () => (setPanel(null), doImage(messagePanel.message.id)) },
              { icon: '✏️', label: t('edit'), onPress: () => (setPanel(null), setEditing({ id: messagePanel.message.id, text: messagePanel.message.content })) },
              { icon: '🔄', label: t('redo'), onPress: () => (setPanel(null), redo()), hidden: messagePanel.message.id !== lastNarratorId || busy },
              { icon: '🌿', label: t('branchHere'), onPress: () => (setPanel(null), branch(messagePanel.index)) },
              { icon: '🚩', label: t('report'), onPress: () => (setPanel(null), report(messagePanel.message)), danger: true },
            ]}
          />
        )}
      </BottomSheet>

      <BottomSheet visible={panel === 'style'} onClose={() => setPanel(null)} title={`🎭 ${t('narratorStyle')}`}>
        <StylePicker value={style} lang={adventure.language} onChange={(s) => persist({ ...adventure, style: s })} />
      </BottomSheet>

      <JournalPanel visible={panel === 'journal'} onClose={() => setPanel(null)} journal={journal} lang={adventure.language} onChange={(j) => persist({ ...adventure, journal: j })} />
      <SavesPanel visible={panel === 'saves'} onClose={() => setPanel(null)} adventure={adventure} onRestore={(a) => persist(a)} />
      <ModelPicker kind="text" visible={panel === 'model'} onClose={() => setPanel(null)} />
      {adventure.sheet && <SheetPanel visible={panel === 'sheet'} onClose={() => setPanel(null)} sheet={adventure.sheet} lang={adventure.language} />}

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

      <Modal visible={dead && !busy} transparent animationType="fade">
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
