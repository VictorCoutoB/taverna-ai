import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native';
import { dictionaries } from '@/i18n';
import type { Language, StoryMessage } from '@/narrator/types';
import { colors, fonts, ui } from './theme';

const PARAGRAPH = { fontFamily: fonts.serif, color: colors.text, fontSize: 17, lineHeight: 28 };

function FadeIn({ children }: { children: React.ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [v]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}

/** Narração em formato de livro: parágrafos, letra capitular opcional. */
export function Narration({ text, dropCap, muted }: { text: string; dropCap?: boolean; muted?: boolean }) {
  const paragraphs = text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <View style={{ gap: 14 }}>
      {paragraphs.map((p, i) =>
        i === 0 && dropCap && p.length > 1 ? (
          <Text key={i} style={[PARAGRAPH, muted && { color: colors.muted }]}>
            <Text style={{ fontFamily: fonts.serifBold, fontSize: 40, lineHeight: 40, color: colors.accent }}>{p[0]}</Text>
            {p.slice(1)}
          </Text>
        ) : (
          <Text key={i} style={[PARAGRAPH, muted && { color: colors.muted }]}>
            {p}
          </Text>
        ),
      )}
    </View>
  );
}

/** Linha discreta com a ação do jogador. */
export function PlayerLine({ m, lang }: { m: StoryMessage; lang: Language }) {
  const t = dictionaries[lang];
  if (m.actionMode === 'story') {
    return (
      <View style={{ borderLeftWidth: 3, borderColor: colors.accent, paddingLeft: 12 }}>
        <Narration text={m.content} />
      </View>
    );
  }
  // As ações já vêm em primeira pessoa ("Falo com o ferreiro"), então mostramos como estão.
  const text = m.actionMode === 'say' ? `${t.youSay}: “${m.content.replace(/^["“]|["”]$/g, '')}”` : m.content;
  return <Text style={{ fontFamily: fonts.serifItalic, color: colors.accent, fontSize: 15, lineHeight: 22, opacity: 0.9 }}>› {text}</Text>;
}

/** Bloco de narração com imagem, toque longo para o menu e escolhas. */
export function NarratorBlock({
  m,
  dropCap,
  imageLoading,
  speaking,
  onMenu,
  onSpeak,
  choices,
  onChoice,
  disabled,
}: {
  m: StoryMessage;
  dropCap?: boolean;
  imageLoading?: boolean;
  speaking?: boolean;
  onMenu: () => void;
  onSpeak: () => void;
  choices?: string[];
  onChoice?: (c: string) => void;
  disabled?: boolean;
}) {
  return (
    <FadeIn>
      <View style={{ gap: 12 }}>
        {m.imageUri && <Image source={{ uri: m.imageUri }} style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: 14 }} contentFit="cover" transition={400} />}
        {imageLoading && (
          <View style={[ui.card, { aspectRatio: 3 / 2, alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
        <Pressable onLongPress={onMenu} delayLongPress={350}>
          <Narration text={m.content} dropCap={dropCap} />
        </Pressable>
        <View style={[ui.row, { justifyContent: 'flex-end', gap: 18 }]}>
          <Pressable onPress={onSpeak} hitSlop={10} accessibilityLabel="ouvir">
            <Text style={{ fontSize: 16, color: speaking ? colors.accent : colors.muted }}>{speaking ? '⏹' : '🔊'}</Text>
          </Pressable>
          <Pressable onPress={onMenu} hitSlop={10} accessibilityLabel="mais ações">
            <Text style={{ fontSize: 18, color: colors.muted, fontWeight: '700' }}>⋯</Text>
          </Pressable>
        </View>
        {!!choices?.length && (
          <View style={{ gap: 8 }}>
            {choices.map((c) => (
              <Pressable
                key={c}
                disabled={disabled}
                onPress={() => onChoice?.(c)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: colors.accent,
                  borderRadius: 12,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  backgroundColor: pressed ? colors.surface2 : 'transparent',
                  opacity: disabled ? 0.5 : 1,
                })}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>➜ {c}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </FadeIn>
  );
}
