import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ATTRIBUTES, modifier, type Sheet } from '@/engine/sheet';
import { dictionaries } from '@/i18n';
import { attrLabel } from '@/narrator/prompts';
import type { Language } from '@/narrator/types';
import { Button, Label } from './components';
import { colors, ui } from './theme';

export function SheetPanel({ visible, onClose, sheet, lang }: { visible: boolean; onClose: () => void; sheet: Sheet; lang: Language }) {
  const t = dictionaries[lang];
  const hpPct = Math.max(0, Math.min(1, sheet.hp / sheet.maxHp));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={onClose} />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' }}>
        <ScrollView contentContainerStyle={ui.pad}>
          <Text style={ui.title}>{t.sheet}</Text>

          <Label>{t.hp}</Label>
          <View style={{ height: 14, borderRadius: 7, backgroundColor: colors.surface2, overflow: 'hidden' }}>
            <View style={{ width: `${hpPct * 100}%`, height: '100%', backgroundColor: hpPct > 0.3 ? colors.success : colors.danger }} />
          </View>
          <Text style={ui.text}>
            ❤️ {sheet.hp}/{sheet.maxHp} · ⭐ {t.level} {sheet.level} ({sheet.xp} XP) · 🪙 {sheet.gold} {t.gold}
          </Text>

          <Label>{t.attributes}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ATTRIBUTES.map((a) => {
              const m = modifier(sheet.attributes[a]);
              return (
                <View key={a} style={[ui.card, { width: '31%', alignItems: 'center', padding: 10 }]}>
                  <Text style={ui.muted}>{attrLabel(lang, a)}</Text>
                  <Text style={[ui.text, { fontSize: 20, fontWeight: '800' }]}>{sheet.attributes[a]}</Text>
                  <Text style={{ color: colors.accent }}>{m >= 0 ? `+${m}` : m}</Text>
                </View>
              );
            })}
          </View>

          <Label>{t.inventory}</Label>
          {sheet.inventory.length === 0 ? (
            <Text style={ui.muted}>{t.empty}</Text>
          ) : (
            sheet.inventory.map((i) => (
              <Text key={i.name} style={ui.text}>
                • {i.name} ×{i.qty}
              </Text>
            ))
          )}
          <Button label="OK" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}
