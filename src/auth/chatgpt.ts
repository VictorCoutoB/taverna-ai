/**
 * "Continuar com ChatGPT": usa a assinatura Plus/Pro da pessoa para gerar o texto.
 * Implementação própria do fluxo OAuth descrito em
 * https://developers.openai.com/siwc/token-sharing-open-source/sign-in
 *
 * A OpenAI só aceita retorno em http://127.0.0.1:<porta>/auth/callback. No celular
 * não há servidor ouvindo nesse endereço, então a página "não carrega" e a pessoa
 * cola o endereço dela no app, de onde lemos o código.
 */
import { bytesToBase64, getFetch } from '../providers/http';
import { ProviderError } from '../providers/types';

export const AUTH_ORIGIN = 'https://auth.openai.com';
export const AUTHORIZE_URL = `${AUTH_ORIGIN}/api/accounts/authorize`;
export const TOKEN_URL = `${AUTH_ORIGIN}/api/accounts/oauth/token`;
export const REDIRECT_URI = 'http://127.0.0.1:1455/auth/callback';
export const RESOURCE = 'https://api.openai.com/v1';
export const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
export const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
export const REGISTRATION_ENTRY = 'dynamic_agent_client';
export const APP_NAME = 'Taverna AI';
export const MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage';

export interface ChatGPTSession {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
  scope: string;
  email?: string;
}

export interface PendingSignIn {
  verifier: string;
  state: string;
  nonce: string;
  createdAt: number;
}

export interface AuthDeps {
  randomBytes(n: number): Uint8Array;
  sha256(data: Uint8Array): Promise<Uint8Array>;
  store: { get(name: string): Promise<string | null>; set(name: string, value: string | null): Promise<void> };
  now?: () => number;
}

const K = { host: 'chatgpt_host_id', client: 'chatgpt_client_id', pending: 'chatgpt_pending', session: 'chatgpt_session' };

export const base64url = (bytes: Uint8Array) => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function uuidV4(bytes: Uint8Array): string {
  const b = bytes.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Identificador opaco desta instalação (não identifica a pessoa). */
async function hostId(deps: AuthDeps): Promise<string> {
  const saved = await deps.store.get(K.host);
  if (saved) return saved;
  const id = `urn:uuid:${uuidV4(deps.randomBytes(16))}`;
  await deps.store.set(K.host, id);
  return id;
}

/** Monta o link de login e guarda o que precisamos para concluir depois. */
export async function startSignIn(deps: AuthDeps): Promise<string> {
  const verifier = base64url(deps.randomBytes(32));
  const pending: PendingSignIn = {
    verifier,
    state: base64url(deps.randomBytes(32)),
    nonce: base64url(deps.randomBytes(32)),
    createdAt: (deps.now ?? Date.now)(),
  };
  const challenge = base64url(await deps.sha256(new TextEncoder().encode(verifier)));
  const savedClient = await deps.store.get(K.client);
  const params = new URLSearchParams({
    client_id: savedClient ?? REGISTRATION_ENTRY,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    resource: RESOURCE,
    state: pending.state,
    nonce: pending.nonce,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    ext_agent_host_id: await hostId(deps),
  });
  if (!savedClient) params.set('agent_name_hint', APP_NAME);
  await deps.store.set(K.pending, JSON.stringify(pending));
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export class SignInError extends Error {
  constructor(
    public code: 'no_pending' | 'bad_url' | 'state_mismatch' | 'denied' | 'no_plan' | 'exchange_failed',
    message: string,
  ) {
    super(message);
    this.name = 'SignInError';
  }
}

/** Lê o endereço colado (ou só a parte ?code=...). */
export function parseCallback(pasted: string): { code?: string; state?: string; clientId?: string; scope?: string; error?: string } {
  const text = pasted.trim();
  const q = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text;
  const p = new URLSearchParams(q.split('#')[0]);
  return {
    code: p.get('code') ?? undefined,
    state: p.get('state') ?? undefined,
    clientId: p.get('client_id') ?? undefined,
    scope: p.get('scope') ?? undefined,
    error: p.get('error') ?? undefined,
  };
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { base64ToBytes } = require('../storage/images') as typeof import('../storage/images');
    return JSON.parse(new TextDecoder().decode(base64ToBytes(padded)));
  } catch {
    return null;
  }
}

async function tokenRequest(body: Record<string, string>): Promise<any> {
  let res: Response;
  try {
    res = await getFetch()(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams(body).toString(),
    });
  } catch (e) {
    throw new ProviderError('network', (e as Error)?.message ?? 'Falha de rede');
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok || !json?.access_token) {
    const err = json?.error ?? `HTTP ${res.status}`;
    throw new ProviderError(res.status === 400 || res.status === 401 ? 'invalid_key' : 'unknown', String(json?.error_description ?? err));
  }
  return json;
}

/** Conclui o login a partir do endereço colado pela pessoa. */
export async function completeSignIn(deps: AuthDeps, pasted: string): Promise<ChatGPTSession> {
  const rawPending = await deps.store.get(K.pending);
  if (!rawPending) throw new SignInError('no_pending', 'Comece o login de novo.');
  const pending = JSON.parse(rawPending) as PendingSignIn;
  const cb = parseCallback(pasted);
  if (cb.error) throw new SignInError('denied', cb.error);
  if (!cb.code || !cb.state) throw new SignInError('bad_url', 'Endereço incompleto: copie o endereço inteiro da página que abriu.');
  if (cb.state !== pending.state) throw new SignInError('state_mismatch', 'Esse endereço é de outro login. Comece de novo.');

  const savedClient = await deps.store.get(K.client);
  const clientId = cb.clientId ?? savedClient;
  if (!clientId || clientId === REGISTRATION_ENTRY) throw new SignInError('bad_url', 'O endereço não tem o client_id. Comece de novo.');
  if (savedClient && clientId !== savedClient) throw new SignInError('state_mismatch', 'Registro diferente do salvo. Comece de novo.');
  await deps.store.set(K.client, clientId);

  let json: any;
  try {
    json = await tokenRequest({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: cb.code,
      code_verifier: pending.verifier,
      redirect_uri: REDIRECT_URI,
      resource: RESOURCE,
    });
  } catch (e) {
    throw new SignInError('exchange_failed', (e as Error).message);
  }
  await deps.store.set(K.pending, null);

  const scope = typeof json.scope === 'string' ? json.scope : (cb.scope ?? '');
  const id = typeof json.id_token === 'string' ? decodeJwtPayload(json.id_token) : null;
  if (id && (id.nonce !== pending.nonce || (id.aud !== clientId && !(Array.isArray(id.aud) && id.aud.includes(clientId))))) {
    throw new SignInError('state_mismatch', 'Resposta de login inválida. Comece de novo.');
  }
  if (!scope.split(/\s+/).includes(PLAN_SCOPE)) {
    throw new SignInError('no_plan', 'Sua conta não liberou o uso do plano (precisa de ChatGPT Plus ou Pro).');
  }
  const session: ChatGPTSession = {
    clientId,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: (deps.now ?? Date.now)() + Number(json.expires_in ?? 3600) * 1000,
    scope,
    email: typeof id?.email === 'string' ? id.email : undefined,
  };
  await deps.store.set(K.session, JSON.stringify(session));
  return session;
}

export async function loadSession(deps: AuthDeps): Promise<ChatGPTSession | null> {
  const raw = await deps.store.get(K.session);
  try {
    return raw ? (JSON.parse(raw) as ChatGPTSession) : null;
  } catch {
    return null;
  }
}

/** Token válido, renovando se faltar menos de 2 minutos. */
export async function getAccessToken(deps: AuthDeps): Promise<string> {
  const s = await loadSession(deps);
  if (!s) throw new ProviderError('invalid_key', 'Entre com sua conta do ChatGPT nas Configurações.');
  const now = (deps.now ?? Date.now)();
  if (s.expiresAt - now > 120_000) return s.accessToken;
  let json: any;
  try {
    json = await tokenRequest({ grant_type: 'refresh_token', client_id: s.clientId, refresh_token: s.refreshToken, resource: RESOURCE });
  } catch (e) {
    if ((e as ProviderError).kind === 'invalid_key') {
      await deps.store.set(K.session, null);
      throw new ProviderError('invalid_key', 'Sua sessão do ChatGPT expirou. Entre de novo nas Configurações.');
    }
    throw e;
  }
  const next: ChatGPTSession = {
    ...s,
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? s.refreshToken,
    expiresAt: now + Number(json.expires_in ?? 3600) * 1000,
    scope: typeof json.scope === 'string' ? json.scope : s.scope,
  };
  await deps.store.set(K.session, JSON.stringify(next));
  return next.accessToken;
}

export async function signOut(deps: AuthDeps): Promise<void> {
  await deps.store.set(K.session, null);
  await deps.store.set(K.pending, null);
}
