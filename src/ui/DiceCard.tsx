import { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import type { CheckResult } from '@/engine/commands';
import { dictionaries } from '@/i18n';
import { attrLabel } from '@/narrator/prompts';
import type { Language } from '@/narrator/types';
import { colors, ui } from './theme';

export function DiceCard({ check, lang }: { check: CheckResult; lang: Language }) {
  const t = dictionaries[lang];
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(spin, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [spin]);

  const color = check.success ? colors.success : colors.danger;
  const label = check.critical === 'success' ? t.critSuccess : check.critical === 'failure' ? t.critFailure : check.success ? t.success : t.failure;
  const sign = check.mod >= 0 ? '+' : '−';

  return (
    <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 14, borderColor: color, alignSelf: 'center' }]}>
      <Animated.View
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-540deg', '0deg'] }) },
            { scale: spin.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          ],
        }}
      >
        <Text style={{ color: '#111', fontSize: 24, fontWeight: '800' }}>{check.roll}</Text>
      </Animated.View>
      <View style={{ gap: 2 }}>
        <Text style={ui.muted}>
          {t.roll}: {attrLabel(lang, check.attr)}
          {check.reason ? ` · ${check.reason}` : ''}
        </Text>
        <Text style={ui.text}>
          {check.roll} {sign} {Math.abs(check.mod)} = <Text style={{ fontWeight: '800' }}>{check.total}</Text> vs {check.dc}
        </Text>
        <Text style={{ color, fontWeight: '800' }}>{label}</Text>
      </View>
    </View>
  );
}
