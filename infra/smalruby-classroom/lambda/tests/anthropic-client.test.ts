// Claude の client を作る部分（WIF の値の判定・エラーの対応付け）。API キーの経路は無い（#1438）。
// 期限前の更新や 401 の取り直しは SDK の責任なのでここではテストしない。
import Anthropic from '@anthropic-ai/sdk';
import {
  resolveAnthropicAuthMode,
  createAnthropicClient,
  classifyAnthropicError,
  describeAnthropicError,
  awsWebIdentityTokenProvider,
} from '../anthropic-client';

const FEDERATION_ENV = {
  ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
  ANTHROPIC_ORGANIZATION_ID: '00000000-0000-4000-8000-000000000001',
  ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test',
};

const MESSAGE_BODY = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-test',
  content: [{ type: 'text', text: 'こんにちは' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** URL ごとに応答を返す fetch のモック。呼ばれた要求を記録する。 */
function mockFetch(routes: { token?: () => Response; messages?: () => Response }) {
  const calls: Array<{ url: string; headers: Headers; body: string }> = [];
  const fn = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, headers: new Headers(init?.headers), body: String(init?.body ?? '') });
    if (url.includes('/v1/oauth/token')) {
      return routes.token ? routes.token() : jsonResponse(500, {});
    }
    return routes.messages ? routes.messages() : jsonResponse(200, MESSAGE_BODY);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const createMessage = (client: Anthropic) => client.messages.create({
  model: 'claude-test',
  max_tokens: 16,
  messages: [{ role: 'user', content: 'hi' }],
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resolveAnthropicAuthMode', () => {
  test('フェデレーションの値がそろえば federation', () => {
    expect(resolveAnthropicAuthMode(FEDERATION_ENV)).toBe('federation');
  });

  test('workspace は任意', () => {
    expect(resolveAnthropicAuthMode({ ...FEDERATION_ENV, ANTHROPIC_WORKSPACE_ID: 'wrkspc_test' })).toBe('federation');
  });

  test('値が一部だけなら none（API キーがあっても使わない）', () => {
    const env: Record<string, string> = {
      ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
      ANTHROPIC_ORGANIZATION_ID: 'org',
      ANTHROPIC_API_KEY: 'sk-test',
    };
    expect(resolveAnthropicAuthMode(env)).toBe('none');
  });

  test('何も無ければ none', () => {
    expect(resolveAnthropicAuthMode({ ANTHROPIC_FEDERATION_RULE_ID: '' })).toBe('none');
  });
});

describe('createAnthropicClient', () => {
  test('フェデレーション: JWT を交換したアクセストークンで Messages を呼ぶ', async () => {
    const { fn, calls } = mockFetch({
      token: () => jsonResponse(200, { access_token: 'sk-ant-oat-test', expires_in: 3600 }),
    });
    const identityTokenProvider = jest.fn(async () => 'aws-jwt');
    const { client, mode } = createAnthropicClient({
      env: { ...FEDERATION_ENV, ANTHROPIC_WORKSPACE_ID: 'wrkspc_test' },
      timeout: 1000,
      fetch: fn,
      identityTokenProvider,
      logLabel: 'test',
    });
    expect(mode).toBe('federation');
    const message = await createMessage(client!);
    expect(message.content[0]).toMatchObject({ type: 'text', text: 'こんにちは' });

    expect(identityTokenProvider).toHaveBeenCalled();
    const exchange = calls.find(c => c.url.endsWith('/v1/oauth/token'));
    expect(exchange?.url).toBe('https://api.anthropic.com/v1/oauth/token');
    const exchangeBody = JSON.parse(exchange!.body);
    expect(exchangeBody).toMatchObject({
      assertion: 'aws-jwt',
      federation_rule_id: 'fdrl_test',
      organization_id: FEDERATION_ENV.ANTHROPIC_ORGANIZATION_ID,
      service_account_id: 'svac_test',
      workspace_id: 'wrkspc_test',
    });

    const api = calls.find(c => c.url.includes('/v1/messages'));
    expect(api?.headers.get('authorization')).toBe('Bearer sk-ant-oat-test');
    expect(api?.headers.get('x-api-key')).toBeNull();
  });

  test('API キーだけでは client を作らない（キーの経路は無い）', () => {
    const env: Record<string, string> = { ANTHROPIC_API_KEY: 'sk-ant-api-test' };
    const { client, mode } = createAnthropicClient({ env, timeout: 1000, logLabel: 'test' });
    expect(mode).toBe('none');
    expect(client).toBeNull();
  });

  test('値が無ければ client を作らない', () => {
    const { client, mode } = createAnthropicClient({ env: {}, timeout: 1000, logLabel: 'test' });
    expect(mode).toBe('none');
    expect(client).toBeNull();
  });

  test('どちらの経路かをログに残す（値は出さない）', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    createAnthropicClient({ env: FEDERATION_ENV, timeout: 1000, logLabel: 'test' });
    const line = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(line).toContain('federation');
    expect(line).not.toContain('svac_test');
  });

  test('交換の失敗は federation として分類され、Messages を呼ばない', async () => {
    const { fn, calls } = mockFetch({ token: () => jsonResponse(401, { error: 'invalid_grant' }) });
    const { client } = createAnthropicClient({
      env: FEDERATION_ENV,
      timeout: 1000,
      fetch: fn,
      identityTokenProvider: async () => 'aws-jwt',
      logLabel: 'test',
    });
    const err = await createMessage(client!).catch(e => e);
    expect(classifyAnthropicError(err)).toEqual({ kind: 'federation', status: 401 });
    expect(calls.some(c => c.url.includes('/v1/messages'))).toBe(false);
  });
});

describe('classifyAnthropicError', () => {
  const federationClient = (fn: typeof fetch, timeout = 1000) => createAnthropicClient({
    env: FEDERATION_ENV, timeout, fetch: fn, identityTokenProvider: async () => 'aws-jwt', logLabel: 'test',
  }).client!;
  const TOKEN_OK = () => jsonResponse(200, { access_token: 'sk-ant-oat-test', expires_in: 3600 });

  test('Messages のエラーは status 付きの api', async () => {
    const { fn } = mockFetch({ token: TOKEN_OK, messages: () => jsonResponse(529, { type: 'error', error: { type: 'overloaded_error', message: 'x' } }) });
    const err = await createMessage(federationClient(fn)).catch(e => e);
    expect(classifyAnthropicError(err)).toEqual({ kind: 'api', status: 529 });
  });

  test('タイムアウトは timeout（再送しない）', async () => {
    const fn = jest.fn((input: unknown, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
      if (String(typeof input === 'string' ? input : (input as Request).url).includes('/v1/oauth/token')) {
        resolve(TOKEN_OK());
        return;
      }
      init?.signal?.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    }));
    const err = await createMessage(federationClient(fn as unknown as typeof fetch, 20)).catch(e => e);
    expect(classifyAnthropicError(err)).toEqual({ kind: 'timeout' });
    // 交換 1 回 + Messages 1 回（Messages は再送しない）
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('API のエラーのログには種類と request-id だけを出す（本文は出さない）', async () => {
    const { fn } = mockFetch({
      token: TOKEN_OK,
      messages: () => new Response(
        JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'secret-ish detail' } }),
        { status: 400, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } },
      ),
    });
    const err = await createMessage(federationClient(fn)).catch(e => e);
    const text = describeAnthropicError(err);
    expect(text).toBe('api status 400 invalid_request_error (request-id req_test)');
    expect(text).not.toContain('secret-ish detail');
  });

  test('それ以外は other', () => {
    expect(classifyAnthropicError(new Error('boom'))).toEqual({ kind: 'other' });
  });
});

describe('awsWebIdentityTokenProvider', () => {
  test('STS の GetWebIdentityToken を Anthropic 向けに毎回呼ぶ', async () => {
    const send = jest.fn(async () => ({ WebIdentityToken: 'aws-jwt' }));
    const provider = awsWebIdentityTokenProvider({ send } as never);
    expect(await provider()).toBe('aws-jwt');
    expect(await provider()).toBe('aws-jwt');
    expect(send).toHaveBeenCalledTimes(2);
    const input = (send.mock.calls[0] as unknown as [{ input: Record<string, unknown> }])[0].input;
    expect(input).toEqual({
      Audience: ['https://api.anthropic.com'],
      SigningAlgorithm: 'RS256',
      DurationSeconds: 300,
    });
  });

  test('トークンが空なら federation の例外', async () => {
    const provider = awsWebIdentityTokenProvider({ send: async () => ({}) } as never);
    const err = await provider().catch(e => e);
    expect(classifyAnthropicError(err)).toEqual({ kind: 'federation', status: null });
  });

  test('STS の失敗は federation として分類し、理由をログに残す', async () => {
    const stsError = new Error('Outbound web identity federation is disabled');
    stsError.name = 'OutboundWebIdentityFederationDisabledException';
    const provider = awsWebIdentityTokenProvider({ send: async () => { throw stsError; } } as never);
    const err = await provider().catch(e => e);
    expect(classifyAnthropicError(err)).toEqual({ kind: 'federation', status: null });
    expect(describeAnthropicError(err)).toContain('OutboundWebIdentityFederationDisabledException');
  });

  test('STS の失敗は Messages を呼ばない', async () => {
    const { fn, calls } = mockFetch({});
    const provider = awsWebIdentityTokenProvider({ send: async () => { throw new Error('AccessDenied'); } } as never);
    const { client } = createAnthropicClient({
      env: FEDERATION_ENV,
      timeout: 1000,
      fetch: fn,
      identityTokenProvider: provider,
      logLabel: 'test',
    });
    const err = await createMessage(client!).catch(e => e);
    expect(classifyAnthropicError(err)).toEqual({ kind: 'federation', status: null });
    expect(calls).toHaveLength(0);
  });
});
