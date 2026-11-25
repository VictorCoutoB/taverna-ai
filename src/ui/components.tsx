import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';
import { colors, ui } from './theme';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
}) {
  const bg = { primary: colors.accent, secondary: colors.surface2, danger: colors.danger, ghost: 'transparent' }[kind];
  const fg = kind === 'primary' ? colors.accentText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 10,
          paddingVertical: small ? 6 : 12,
          paddingHorizontal: small ? 10 : 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: kind === 'ghost' || kind === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13 : 15 }}>{label}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.accent : colors.surface2,
      }}
    >
      <Text style={{ color: selected ? colors.accentText : colors.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Chip key={o.id} label={o.label} selected={o.id === value} onPress={() => onChange(o.id)} />
      ))}
    </View>
  );
}

export function Label({ children }: { children: string }) {
  return <Text style={[ui.muted, { fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 }]}>{children}</Text>;
}
