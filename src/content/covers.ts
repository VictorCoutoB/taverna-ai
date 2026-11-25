export interface CoverArt {
  emoji: string;
  /** Cor de fundo e cor de destaque do cartão (usadas quando não há imagem). */
  bg: string;
  tint: string;
  /** Imagem empacotada no app (resultado de require('…jpg')). */
  image?: number;
}

/** Arte dos cenários prontos. `image` é preenchido quando as capas existem em assets/. */
export const SCENARIO_ART: Record<string, CoverArt> = {
  fantasy: { emoji: '🐉', bg: '#2b1d12', tint: '#d9a441' },
  cyberpunk: { emoji: '🌆', bg: '#140f2b', tint: '#c04bd6' },
  horror: { emoji: '🕯️', bg: '#161414', tint: '#a33a3a' },
  space: { emoji: '🚀', bg: '#0d1a2b', tint: '#4fa3d9' },
  apocalypse: { emoji: '☢️', bg: '#231d12', tint: '#b8963e' },
  'magic-school': { emoji: '🪄', bg: '#1a1530', tint: '#8f7ce0' },
  custom: { emoji: '✏️', bg: '#1f1a17', tint: '#d9a441' },
};

export const coverFor = (scenarioId: string): CoverArt => SCENARIO_ART[scenarioId] ?? SCENARIO_ART.custom;
