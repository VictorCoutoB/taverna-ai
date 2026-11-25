import * as Crypto from 'expo-crypto';
import { getSecret, setSecret } from '../storage/secrets';
import type { AuthDeps } from './chatgpt';

/** Dependências reais do app (no celular e na web). */
export const appAuthDeps: AuthDeps = {
  randomBytes: (n) => Crypto.getRandomBytes(n),
  sha256: async (data) => new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data as Uint8Array<ArrayBuffer>)),
  store: { get: getSecret, set: setSecret },
};
