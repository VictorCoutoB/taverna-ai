import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { coverFor } from '@/content/covers';

/**
 * Capa: imagem (cena gerada, retrato ou capa do cenário) ou, sem imagem,
 * fundo colorido com emoji grande. `children` fica por cima, na parte de baixo.
 */
export function Cover({ scenarioId, uri, style, children }: { scenarioId: string; uri?: string; style?: ViewStyle; children?: ReactNode }) {
  const art = coverFor(scenarioId);
  const source = uri ? { uri } : art.image;
  return (
    <View style={[{ overflow: 'hidden', borderRadius: 16, backgroundColor: art.bg }, style]}>
      {source ? (
        <Image source={source} style={{ position: 'absolute', inset: 0 }} contentFit="cover" transition={300} />
      ) : (
        <>
          <View style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: art.tint, opacity: 0.18 }} />
          <Text style={{ position: 'absolute', right: 16, top: 10, fontSize: 64 }}>{art.emoji}</Text>
        </>
      )}
      {/* Escurece a base para o texto ficar legível. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%', backgroundColor: '#000', opacity: 0.45 }} />
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 14 }}>{children}</View>
    </View>
  );
}
