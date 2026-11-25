import { createHash, randomBytes } from 'crypto';
import { setFetch } from '../../providers/http';
import {
  completeSignIn,
  getAccessToken,
  loadSession,
  parseCallback,
  REDIRECT_URI,
  startSignIn,
  TOKEN_URL,
  type AuthDeps,
} from '../chatgpt';

jest.mock('expo-sqlite', () => ({}));

function makeDeps(now = 1_000_000) {
  const mem = new Map<string, string>();
  const deps: AuthDeps = {
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
    sha256: async (d) => new Uint8Array(createHash('sha256').update(d).digest()),
    store: {
      get: async (k) => mem.get(k) ?? null,
      set: async (k, v) => void (v === null ? mem.delete(k) : mem.set(k, v)),
    },
    now: () => now,
  };
  return { deps, mem };
}

const b64url = (s: string) => Buffer.from(s).toString('base64url');
const fakeIdToken = (claims: object) => `${b64url('{"alg":"none"}')}.${b64url(JSON.stringify(claims))}.sig`;

afterEach(() => setFetch(null));

describe('startSignIn', () => {
  it('primeiro login usa registro dinâmico, PKCE S256 e host id', async () => {
    const { deps, mem } = makeDeps();
    const url = new URL(await startSignIn(deps));
    const p = url.searchParams;
    expect(url.origin + url.pathname).toBe('https://auth.openai.com/api/accounts/authorize');
    expect(p.get('client_id')).toBe('dynamic_agent_client');
    expect(p.get('agent_name_hint')).toBe('Taverna AI');
    expect(p.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(p.get('scope')).toBe('openid profile email offline_access resource.invoke chatgpt.tokens.use.direct');
    expect(p.get('resource')).toBe('https://api.openai.com/v1');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('ext_agent_host_id')).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    const pending = JSON.parse(mem.get('chatgpt_pending')!);
    const expected = createHash('sha256').update(pending.verifier).digest('base64url');
    expect(p.get('code_challenge')).toBe(expected);
    expect(p.get('state')).toBe(pending.state);
  });

  it('logins seguintes reutilizam o client id salvo e o mesmo host id', async () => {
    const { deps, mem } = makeDeps();
    const first = new URL(await startSignIn(deps)).searchParams.get('ext_agent_host_id');
    mem.set('chatgpt_client_id', 'oaiapp_123');
    const p = new URL(await startSignIn(deps)).searchParams;
    expect(p.get('client_id')).toBe('oaiapp_123');
    expect(p.has('agent_name_hint')).toBe(false);
    expect(p.get('ext_agent_host_id')).toBe(first);
  });
});

describe('parseCallback', () => {
  it('aceita o endereço inteiro ou só a query', () => {
    const full = parseCallback('http://127.0.0.1:1455/auth/callback?code=C&state=S&client_id=oaiapp_1&scope=a+b');
    expect(full).toMatchObject({ code: 'C', state: 'S', clientId: 'oaiapp_1', scope: 'a b' });
    expect(parseCallback('  code=X&state=Y ').code).toBe('X');
  });
});

describe('completeSignIn', () => {
  async function setup() {
    const { deps, mem } = makeDeps();
    await startSignIn(deps);
    const pending = JSON.parse(mem.get('chatgpt_pending')!);
    return { deps, mem, pending };
  }

  it('troca o código pelo token e salva a sessão', async () => {
    const { deps, mem, pending } = await setup();
    const calls: { url: string; body: string }[] = [];
    setFetch(async (url, init) => {
      calls.push({ url, body: String(init?.body) });
      return new Response(
        JSON.stringify({
          access_token: 'AT',
          refresh_token: 'RT',
          expires_in: 3600,
          token_type: 'bearer',
          scope: 'openid offline_access resource.invoke chatgpt.tokens.use.direct',
          id_token: fakeIdToken({ nonce: pending.nonce, aud: 'oaiapp_9', email: 'a@b.c' }),
        }),
        { status: 200 },
      );
    });
    const s = await completeSignIn(deps, `${REDIRECT_URI}?code=CODE&state=${pending.state}&client_id=oaiapp_9`);
    expect(s).toMatchObject({ clientId: 'oaiapp_9', accessToken: 'AT', refreshToken: 'RT', expiresAt: 1_000_000 + 3_600_000 });
    expect(calls[0].url).toBe(TOKEN_URL);
    const body = new URLSearchParams(calls[0].body);
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'oaiapp_9',
      code: 'CODE',
      code_verifier: pending.verifier,
      redirect_uri: REDIRECT_URI,
      resource: 'https://api.openai.com/v1',
    });
    expect(mem.get('chatgpt_client_id')).toBe('oaiapp_9');
    expect(mem.has('chatgpt_pending')).toBe(false);
  });

  it('rejeita state diferente', async () => {
    const { deps } = await setup();
    await expect(completeSignIn(deps, `${REDIRECT_URI}?code=C&state=outro&client_id=oaiapp_9`)).rejects.toMatchObject({ code: 'state_mismatch' });
  });

  it('rejeita quando o plano não foi liberado', async () => {
    const { deps, pending } = await setup();
    setFetch(async () => new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'openid email' }), { status: 200 }));
    await expect(completeSignIn(deps, `${REDIRECT_URI}?code=C&state=${pending.state}&client_id=oaiapp_9`)).rejects.toMatchObject({ code: 'no_plan' });
  });
});

describe('getAccessToken', () => {
  it('renova quando está perto de expirar', async () => {
    const { deps, mem } = makeDeps(5_000_000);
    mem.set('chatgpt_session', JSON.stringify({ clientId: 'oaiapp_9', accessToken: 'OLD', refreshToken: 'RT', expiresAt: 5_000_000 + 60_000, scope: 'x' }));
    let body = '';
    setFetch(async (_u, init) => {
      body = String(init?.body);
      return new Response(JSON.stringify({ access_token: 'NEW', refresh_token: 'RT2', expires_in: 3600 }), { status: 200 });
    });
    expect(await getAccessToken(deps)).toBe('NEW');
    expect(Object.fromEntries(new URLSearchParams(body))).toEqual({
      grant_type: 'refresh_token',
      client_id: 'oaiapp_9',
      refresh_token: 'RT',
      resource: 'https://api.openai.com/v1',
    });
    expect((await loadSession(deps))?.refreshToken).toBe('RT2');
  });

  it('sessão inválida na renovação apaga e pede novo login', async () => {
    const { deps } = makeDeps(5_000_000);
    await deps.store.set('chatgpt_session', JSON.stringify({ clientId: 'c', accessToken: 'A', refreshToken: 'R', expiresAt: 0, scope: '' }));
    setFetch(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    await expect(getAccessToken(deps)).rejects.toMatchObject({ kind: 'invalid_key' });
    expect(await loadSession(deps)).toBeNull();
  });
});
