import * as Speech from 'expo-speech';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { request, requestJson } from '../http';
import type { SpeechProvider, Voice } from '../types';

/** Remove marcações que soariam estranhas lidas em voz alta. */
export const cleanForSpeech = (text: string) => text.replace(/[*_#>`~]/g, '').replace(/\s+/g, ' ').trim();

export function deviceSpeech(language: string): SpeechProvider {
  return {
    id: 'device',
    async listVoices(): Promise<Voice[]> {
      const voices = await Speech.getAvailableVoicesAsync();
      const prefix = language.slice(0, 2);
      return voices
        .filter((v) => v.language?.toLowerCase().startsWith(prefix))
        .map((v) => ({ id: v.identifier, name: `${v.name} (${v.language})` }));
    },
    speak: (text, voiceId) =>
      new Promise<void>((resolve) => {
        Speech.speak(cleanForSpeech(text), {
          language,
          voice: voiceId || undefined,
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => resolve(),
        });
      }),
    stop: async () => {
      await Speech.stop();
    },
  };
}

/** Toca áudio (mp3) baixado de um serviço de voz. */
function makeCloudPlayer(id: string, fetchAudio: (text: string, voiceId?: string) => Promise<ArrayBuffer>, listVoices: () => Promise<Voice[]>): SpeechProvider {
  let player: AudioPlayer | null = null;
  const stop = async () => {
    player?.pause();
    player?.remove();
    player = null;
  };
  return {
    id,
    listVoices,
    stop,
    async speak(text, voiceId) {
      await stop();
      const audio = await fetchAudio(cleanForSpeech(text), voiceId);
      const file = new File(Paths.cache, `tts-${Date.now()}.mp3`);
      file.write(new Uint8Array(audio));
      player = createAudioPlayer({ uri: file.uri });
      player.play();
    },
  };
}

const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];

export function openAISpeech(apiKey: string): SpeechProvider {
  return makeCloudPlayer(
    'openai',
    async (text, voiceId) => {
      const res = await request('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: voiceId || 'fable', input: text.slice(0, 4000), response_format: 'mp3' }),
      });
      return res.arrayBuffer();
    },
    async () => OPENAI_VOICES.map((v) => ({ id: v, name: v })),
  );
}

export function elevenLabsSpeech(apiKey: string): SpeechProvider {
  const headers = { 'xi-api-key': apiKey, 'Content-Type': 'application/json' };
  return makeCloudPlayer(
    'elevenlabs',
    async (text, voiceId) => {
      const res = await request(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || 'JBFqnCBsd6RMkjVDRZzb'}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: text.slice(0, 5000), model_id: 'eleven_multilingual_v2' }),
      });
      return res.arrayBuffer();
    },
    async () => {
      const json = await requestJson('https://api.elevenlabs.io/v1/voices', { headers });
      return (json?.voices ?? []).map((v: any) => ({ id: v.voice_id, name: v.name }));
    },
  );
}
