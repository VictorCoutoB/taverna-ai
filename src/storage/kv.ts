import { Platform } from 'react-native';

/**
 * Armazenamento chave/valor simples.
 * Android/iOS: SQLite. Web (só para pré-visualização no desenvolvimento): localStorage.
 */
export interface KV {
  get(table: string, id: string): Promise<string | null>;
  set(table: string, id: string, value: string): Promise<void>;
  remove(table: string, id: string): Promise<void>;
  list(table: string): Promise<{ id: string; value: string }[]>;
}

const TABLES = ['adventures', 'settings', 'reports'];

function sqliteKV(): KV {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = SQLite.openDatabaseSync('taverna.db');
  db.execSync(
    TABLES.map((t) => `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);`).join('\n'),
  );
  const safe = (t: string) => {
    if (!TABLES.includes(t)) throw new Error(`tabela desconhecida: ${t}`);
    return t;
  };
  return {
    async get(t, id) {
      const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM ${safe(t)} WHERE id = ?`, id);
      return row?.value ?? null;
    },
    async set(t, id, value) {
      await db.runAsync(`INSERT OR REPLACE INTO ${safe(t)} (id, value, updated_at) VALUES (?, ?, ?)`, id, value, Date.now());
    },
    async remove(t, id) {
      await db.runAsync(`DELETE FROM ${safe(t)} WHERE id = ?`, id);
    },
    async list(t) {
      return db.getAllAsync<{ id: string; value: string }>(`SELECT id, value FROM ${safe(t)} ORDER BY updated_at DESC`);
    },
  };
}

function webKV(): KV {
  const k = (t: string, id: string) => `taverna:${t}:${id}`;
  return {
    async get(t, id) {
      return globalThis.localStorage?.getItem(k(t, id)) ?? null;
    },
    async set(t, id, v) {
      globalThis.localStorage?.setItem(k(t, id), v);
    },
    async remove(t, id) {
      globalThis.localStorage?.removeItem(k(t, id));
    },
    async list(t) {
      const out: { id: string; value: string }[] = [];
      const ls = globalThis.localStorage;
      if (!ls) return out;
      const prefix = `taverna:${t}:`;
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i)!;
        if (key.startsWith(prefix)) out.push({ id: key.slice(prefix.length), value: ls.getItem(key)! });
      }
      return out;
    },
  };
}

let instance: KV | null = null;
export function getKV(): KV {
  if (!instance) instance = Platform.OS === 'web' ? webKV() : sqliteKV();
  return instance;
}
