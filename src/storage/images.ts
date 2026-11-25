import { Platform } from 'react-native';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.slice(0, o);
}

/** Salva uma imagem (data URI) no aparelho e retorna a URI do arquivo. Na web mantém o data URI. */
export async function saveImage(dataUri: string, name: string): Promise<string> {
  if (Platform.OS === 'web' || !dataUri.startsWith('data:')) return dataUri;
  const { Directory, File, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.document, 'images');
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = dataUri.startsWith('data:image/jpeg') ? 'jpg' : dataUri.startsWith('data:image/webp') ? 'webp' : 'png';
  const file = new File(dir, `${name}.${ext}`);
  file.write(base64ToBytes(dataUri.slice(dataUri.indexOf(',') + 1)));
  return file.uri;
}

/** Lê uma imagem salva como data URI (para enviar como referência). */
export async function imageAsDataUri(uri: string): Promise<string | undefined> {
  if (uri.startsWith('data:')) return uri;
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    const mime = uri.endsWith('.jpg') ? 'image/jpeg' : uri.endsWith('.webp') ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${await file.base64()}`;
  } catch {
    return undefined;
  }
}

export async function deleteImages(uris: (string | undefined)[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const { File } = await import('expo-file-system');
  for (const uri of uris) {
    if (!uri || uri.startsWith('data:')) continue;
    try {
      new File(uri).delete();
    } catch {}
  }
}
