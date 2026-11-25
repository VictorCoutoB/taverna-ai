import { Platform } from 'react-native';
import type { KeyId, Keys } from '../providers/registry';
import { KEY_HELP } from '../providers/registry';

/** Chaves de API: cofre seguro do Android/iOS. Nunca vão para exportações. */
const storeKey = (id: KeyId) => `apikey_${id}`;

async function secure() {
  if (Platform.OS === 'web') return null;
  return import('expo-secure-store');
}

export async function loadKeys(): Promise<Keys> {
  const ss = await secure();
  const keys: Keys = {};
  for (const id of Object.keys(KEY_HELP) as KeyId[]) {
    const v = ss ? await ss.getItemAsync(storeKey(id)) : globalThis.localStorage?.getItem(storeKey(id));
    if (v) keys[id] = v;
  }
  return keys;
}

export async function saveKey(id: KeyId, value: string): Promise<void> {
  const ss = await secure();
  const v = value.trim();
  if (ss) {
    if (v) await ss.setItemAsync(storeKey(id), v);
    else await ss.deleteItemAsync(storeKey(id));
  } else if (v) globalThis.localStorage?.setItem(storeKey(id), v);
  else globalThis.localStorage?.removeItem(storeKey(id));
}
