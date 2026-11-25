import { useEffect, useState } from 'react';
import { Alert, Platform, Text, TextInput, View } from 'react-native';
import { dictionaries } from '@/i18n';
import { newId } from '@/narrator/turn';
import type { Adventure } from '@/narrator/types';
import { deleteSave, listSaves, makeSave, restoreSave, writeSave, type SavePoint } from '@/storage/saves';
import { BottomSheet } from './BottomSheet';
import { Button } from './components';
import { colors, ui } from './theme';

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'OK', onPress: onYes },
  ]);
}

export function SavesPanel({
  visible,
  onClose,
  adventure,
  onRestore,
}: {
  visible: boolean;
  onClose: () => void;
  adventure: Adventure;
  onRestore: (a: Adventure) => void;
}) {
  const t = dictionaries[adventure.language];
  const [saves, setSaves] = useState<SavePoint[]>([]);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) listSaves(adventure.id).then(setSaves);
  }, [visible, adventure.id]);

  const save = async () => {
    await writeSave(makeSave(adventure, name, newId()));
    setName('');
    setNote(t.saved);
    setSaves(await listSaves(adventure.id));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`💾 ${t.saves}`}>
      <View style={ui.row}>
        <TextInput style={[ui.input, { flex: 1 }]} placeholder={t.saveName} placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={50} />
        <Button small label={t.savePoint} onPress={save} />
      </View>
      {!!note && <Text style={{ color: colors.success }}>{note}</Text>}
      {saves.length === 0 && <Text style={ui.muted}>{t.noSaves}</Text>}
      {saves.map((s) => (
        <View key={s.id} style={[ui.card, ui.row]}>
          <View style={{ flex: 1 }}>
            <Text style={[ui.text, { fontWeight: '700' }]} numberOfLines={1}>
              {s.name}
            </Text>
            <Text style={ui.muted}>
              {new Date(s.createdAt).toLocaleString()} · {s.messageCount} {t.messages}
            </Text>
          </View>
          <Button
            small
            kind="secondary"
            label={t.loadSave}
            onPress={() =>
              confirm(s.name, t.confirmLoad, () => {
                onRestore(restoreSave(s, adventure));
                onClose();
              })
            }
          />
          <Button
            small
            kind="ghost"
            label="🗑"
            onPress={() =>
              confirm(s.name, t.delete, async () => {
                await deleteSave(s.id);
                setSaves(await listSaves(adventure.id));
              })
            }
          />
        </View>
      ))}
    </BottomSheet>
  );
}
