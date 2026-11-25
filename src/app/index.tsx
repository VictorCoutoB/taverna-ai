import { Image } from 'expo-image';
import { Redirect, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useT } from '@/i18n';
import type { Adventure } from '@/narrator/types';
import { newId } from '@/narrator/turn';
import { deleteAdventure, listAdventures, parseImport, saveAdventure, serializeForExport } from '@/storage/adventures';
import { useSettings } from '@/state/settings';
import { Button } from '@/ui/components';
import { colors, ui } from '@/ui/theme';

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
  const t = useT();
  const onboarded = useSettings((s) => s.settings.onboarded);
  const [items, setItems] = useState<Adventure[]>([]);

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

  return (
    <View style={ui.screen}>
      <Stack.Screen
        options={{
          title: t('appName'),
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel={t('settings')} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: colors.text, fontSize: 22 }}>⚙</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        contentContainerStyle={ui.pad}
        data={items}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <Button label={`+  ${t('newAdventure')}`} onPress={() => router.push('/new')} />
            <Button
              label={t('import')}
              kind="secondary"
              onPress={() =>
                importAdventure()
                  .then((ok) => ok && refresh())
                  .catch((e) => Alert.alert(t('import'), String(e?.message ?? e)))
              }
            />
            <Text style={ui.h2}>{t('myAdventures')}</Text>
          </View>
        }
        ListEmptyComponent={<Text style={ui.muted}>{t('noAdventures')}</Text>}
        renderItem={({ item }) => {
          const portrait = item.characters.find((c) => c.isPlayer)?.portraitUri;
          return (
            <Pressable onPress={() => router.push(`/game/${item.id}`)} style={[ui.card, { flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
              {portrait ? (
                <Image source={{ uri: portrait }} style={{ width: 56, height: 56, borderRadius: 10 }} />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 26 }}>{item.mode === 'rpg' ? '🎲' : '📜'}</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[ui.text, { fontWeight: '700' }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={ui.muted} numberOfLines={1}>
                  {item.scenario.title} · {item.mode === 'rpg' ? t('modeRpg') : t('modeRoleplay')}
                </Text>
                <Text style={ui.muted}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <Button small kind="secondary" label={t('export')} onPress={() => exportAdventure(item).catch(() => {})} />
                <Button small kind="ghost" label={t('delete')} onPress={() => confirmDelete(item)} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
