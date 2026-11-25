import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#14110f',
  surface: '#1f1a17',
  surface2: '#2a231f',
  border: '#3b322c',
  text: '#efe6da',
  muted: '#a8998a',
  accent: '#d9a441',
  accentText: '#1b140a',
  danger: '#d2604f',
  success: '#6fb37a',
  player: '#2e3a4a',
};

/** Fontes de leitura (carregadas em _layout.tsx). */
export const fonts = {
  serif: 'Literata_400Regular',
  serifItalic: 'Literata_400Regular_Italic',
  serifBold: 'Literata_700Bold',
  serifSemi: 'Literata_600SemiBold',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 8 },
  text: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: colors.surface2,
    color: colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
