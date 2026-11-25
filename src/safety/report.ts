import * as Linking from 'expo-linking';
import { getKV } from '../storage/kv';
import { SUPPORT_EMAIL } from '../config';

/** Registra a denúncia no aparelho e abre o e-mail do desenvolvedor (se configurado). */
export async function reportMessage(info: { adventureId: string; messageId: string; content: string; model: string }) {
  const id = `${Date.now()}`;
  await getKV().set('reports', id, JSON.stringify({ ...info, at: new Date().toISOString() }));
  if (!SUPPORT_EMAIL) return;
  const subject = encodeURIComponent('Denúncia de conteúdo - Taverna AI');
  const body = encodeURIComponent(`Modelo: ${info.model}\n\nTrecho:\n${info.content.slice(0, 1500)}\n\nMotivo:\n`);
  await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
}
