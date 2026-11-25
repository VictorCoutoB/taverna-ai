import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useT } from '@/i18n';
import type { Adventure } from '@/narrator/types';
import { newId } from '@/narrator/turn';
import { deleteAdventure, listAdventures, parseImport, saveAdventure, serializeForExport } from '@/storage/adventures';
import { useSettings } from '@/state/settings';
import { ActionList, BottomSheet } from '@/ui/BottomSheet';
import { Cover } from '@/ui/Cover';
import { colors, fonts, ui } from '@/ui/theme';

async function exportAdventure(a: Adventure) {
  const json = serializeForExport(a);
  const fileName = `${a.title.replace(/[^\w-]+/g, '_')}.taverna.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, fileName);
  file.write(json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
}

async function importAdventure(): Promise<boolean> {
  const DocumentPicker = await import('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return false;
  const asset = res.assets[0];
  let text: string;
  if (asset.file) text = await asset.file.text();
  else {
    const { File } = await import('expo-file-system');
    text = await new File(asset.uri).text();
  }
  await saveAdventure(parseImport(text, newId));
  return true;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const onboarded = useSettings((s) => s.settings.onboarded);
  const [items, setItems] = useState<Adventure[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemMenu, setItemMenu] = useState<Adventure | null>(null);

  const refresh = useCallback(() => {
    listAdventures().then(setItems).catch(() => setItems([]));
  }, []);
  useFocusEffect(refresh);

  if (!onboarded) return <Redirect href="/onboarding" />;

  const confirmDelete = (a: Adventure) => {
    const run = () => deleteAdventure(a).then(refresh);
    if (Platform.OS === 'web') {
      if (window.confirm(t('confirmDelete'))) run();
      return;
    }
    Alert.alert(a.title, t('confirmDelete'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: run },
    ]);
  };

  const coverUri = (a: Adventure) =>
    [...a.messages].reverse().find((m) => m.imageUri)?.imageUri ?? a.characters.find((c) => c.isPlayer)?.portraitUri;
  const lastNarration = (a: Adventure) => [...a.messages].reverse().find((m) => m.role === 'narrator')?.content ?? a.scenario.description;

  return (
    <View style={ui.screen}>
      <Stack.Screen
        options={{
          title: t('appName'),
          headerTitleStyle: { fontFamily: fonts.serifBold, fontSize: 22 },
          headerRight: () => (
            <View style={[ui.row, { gap: 16, paddingHorizontal: 8 }]}>
              <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} accessibilityLabel={t('actions')}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>⋯</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel={t('settings')}>
                <Text style={{ color: colors.text, fontSize: 22 }}>⚙</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <FlatList
        contentContainerStyle={[ui.pad, { gap: 16, paddingBottom: 40 + insets.bottom }]}
        data={items}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Pressable onPress={() => router.push('/new')}>
              <Cover scenarioId="fantasy" style={{ height: 130 }}>
                <Text style={{ fontFamily: fonts.serifBold, color: '#fff', fontSize: 24 }}>+ {t('newAdventure')}</Text>
                <Text style={{ color: '#eee', fontSize: 13 }}>{t('welcomeText').split('.')[0]}.</Text>
              </Cover>
            </Pressable>
            <Text style={[ui.h2, { fontFamily: fonts.serifBold, fontSize: 20 }]}>{t('myAdventures')}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={ui.muted}>{t('noAdventures')}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/game/${item.id}`)} onLongPress={() => setItemMenu(item)}>
            <Cover scenarioId={item.scenario.id} uri={coverUri(item)} style={{ height: 220 }}>
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: '#ddd', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                  {item.mode === 'rpg' ? '🎲 RPG' : '📜 ROLEPLAY'} · {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
                <Pressable onPress={() => setItemMenu(item)} hitSlop={12} accessibilityLabel={t('actions')}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>⋯</Text>
                </Pressable>
              </View>
              <Text style={{ fontFamily: fonts.serifBold, color: '#fff', fontSize: 20 }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ fontFamily: fonts.serif, color: '#e6ddd0', fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
                {lastNarration(item)}
              </Text>
              <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 }}>
                <Text style={{ color: colors.accentText, fontWeight: '700' }}>{t('continueStory')} ›</Text>
              </View>
            </Cover>
          </Pressable>
        )}
      />

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('actions')}>
        <ActionList
          items={[
            { icon: '✨', label: t('newAdventure'), onPress: () => (setMenuOpen(false), router.push('/new')) },
            {
              icon: '📥',
              label: t('import'),
              onPress: () => {
                setMenuOpen(false);
                importAdventure()
                  .then((ok) => ok && refresh())
                  .catch((e) => Alert.alert(t('import'), String(e?.message ?? e)));
              },
            },
            { icon: '⚙️', label: t('settings'), onPress: () => (setMenuOpen(false), router.push('/settings')) },
          ]}
        />
      </BottomSheet>

      <BottomSheet visible={!!itemMenu} onClose={() => setItemMenu(null)} title={itemMenu?.title}>
        {itemMenu && (
          <ActionList
            items={[
              { icon: '▶️', label: t('continueStory'), onPress: () => (setItemMenu(null), router.push(`/game/${itemMenu.id}`)) },
              { icon: '📤', label: t('export'), onPress: () => (setItemMenu(null), exportAdventure(itemMenu).catch(() => {})) },
              { icon: '🗑️', label: t('delete'), danger: true, onPress: () => (setItemMenu(null), confirmDelete(itemMenu)) },
            ]}
          />
        )}
      </BottomSheet>
    </View>
  );
}
