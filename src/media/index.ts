import type { Adventure, Character } from '../narrator/types';
import { makeImageProvider, makeSpeechProvider } from '../providers/registry';
import type { SpeechProvider } from '../providers/types';
import type { Settings } from '../state/settings';
import type { Keys } from '../providers/registry';
import { imageAsDataUri, saveImage } from '../storage/images';

const SAFE_SUFFIX = 'safe for work, no nudity, no text, no watermark';

export function portraitPrompt(c: Character, style: string): string {
  return `Character portrait, head and shoulders, ${style}. ${c.name}: ${c.appearance}. Neutral background, ${SAFE_SUFFIX}.`;
}

export function scenePrompt(a: Adventure, style: string): string {
  const lastNarration = [...a.messages].reverse().find((m) => m.role === 'narrator')?.content ?? a.scenario.description;
  const people = a.characters.map((c) => `${c.name} (${c.appearance})`).join('; ');
  const sceneStyle = [style, a.scenario.imageStyle].filter(Boolean).join(', ');
  return `Illustration of a scene, ${sceneStyle}. Setting: ${a.scenario.title}. Scene: ${lastNarration.slice(0, 700)}. Characters: ${people}. ${SAFE_SUFFIX}.`;
}

export function shouldAutoGenerate(settings: Settings, narratorTurns: number): boolean {
  if (settings.image.frequency === 'every') return true;
  if (settings.image.frequency === 'every3') return narratorTurns % 3 === 0;
  return false;
}

export async function generatePortrait(c: Character, settings: Settings, keys: Keys): Promise<string> {
  const provider = makeImageProvider(settings.image.provider, keys, settings.local);
  const data = await provider.generate(portraitPrompt(c, settings.image.style), { model: settings.image.model, size: '1024x1024' });
  return saveImage(data, `portrait-${c.id}`);
}

export async function generateSceneImage(a: Adventure, settings: Settings, keys: Keys, messageId: string): Promise<string> {
  const provider = makeImageProvider(settings.image.provider, keys, settings.local);
  const player = a.characters.find((c) => c.isPlayer);
  const reference = provider.supportsReference && player?.portraitUri ? await imageAsDataUri(player.portraitUri) : undefined;
  const data = await provider.generate(scenePrompt(a, settings.image.style), {
    model: settings.image.model,
    size: '1536x1024',
    referenceImage: reference,
  });
  return saveImage(data, `scene-${messageId}`);
}

let current: SpeechProvider | null = null;

export async function speak(text: string, settings: Settings, keys: Keys) {
  await stopSpeaking();
  current = makeSpeechProvider(settings.speech.provider, keys, settings.language === 'pt' ? 'pt-BR' : 'en-US');
  await current.speak(text, settings.speech.voice || undefined);
}

export async function stopSpeaking() {
  await current?.stop().catch(() => {});
}
