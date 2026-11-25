import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, ui } from './theme';

/** Painel que sobe de baixo, com título e botão de fechar. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: '#0009' }} onPress={onClose} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%' }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          {!!title && (
            <View style={[ui.row, { justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 }]}>
              <Text style={ui.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="fechar">
                <Text style={{ color: colors.muted, fontSize: 22 }}>✕</Text>
              </Pressable>
            </View>
          )}
          {scroll ? (
            <ScrollView contentContainerStyle={[ui.pad, { paddingBottom: 32 }]} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={[ui.pad, { paddingBottom: 32 }]}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Lista de opções num BottomSheet (menu de ações). */
export function ActionList({ items }: { items: { icon: string; label: string; onPress: () => void; danger?: boolean; hidden?: boolean }[] }) {
  return (
    <View>
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <Pressable
            key={i.label}
            onPress={i.onPress}
            style={({ pressed }) => [ui.row, { paddingVertical: 14, gap: 14, opacity: pressed ? 0.6 : 1, borderBottomWidth: 1, borderColor: colors.border }]}
          >
            <Text style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{i.icon}</Text>
            <Text style={[ui.text, { fontSize: 16 }, i.danger && { color: colors.danger }]}>{i.label}</Text>
          </Pressable>
        ))}
    </View>
  );
}
