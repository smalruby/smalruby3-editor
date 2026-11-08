// Claude の client を作る部分（WIF / API キーの切り替え・エラーの対応付け）。
// 期限前の更新や 401 の取り直しは SDK の責任なのでここではテストしない。
import Anthropic from '@anthropic-ai/sdk';
import {
  resolveAnthropicAuthMode,
  createAnthropicClient,
  classifyAnthropicError,
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
  test('フェデレーションの値がそろえば federation（キーがあっても）', () => {
    expect(resolveAnthropicAuthMode({ ...FEDERATION_ENV, ANTHROPIC_API_KEY: 'sk-test' })).toBe('federation');
  });

  test('workspace は任意', () => {
    expect(resolveAnthropicAuthMode({ ...FEDERATION_ENV, ANTHROPIC_WORKSPACE_ID: 'wrkspc_test' })).toBe('federation');
  });

  test('値が一部だけならキーの経路', () => {
    expect(resolveAnthropicAuthMode({
      ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
      ANTHROPIC_ORGANIZATION_ID: 'org',
      ANTHROPIC_API_KEY: 'sk-test',
    })).toBe('api-key');
  });

  test('何も無ければ none', () => {
    expect(resolveAnthropicAuthMode({ ANTHROPIC_FEDERATION_RULE_ID: '', ANTHROPIC_API_KEY: '' })).toBe('none');
  });
});

describe('createAnthropicClient', () => {
  test('フェデレーション: JWT を交換したアクセストークンで Messages を呼ぶ', async () => {
    const { fn, calls } = mockFetch({
      token: () => jsonResponse(200, { access_token: 'sk-ant-oat-test', expires_in: 3600 }),
    });
    const identityTokenProvider = jest.fn(async () => 'aws-jwt');
    const { client, mode } = createAnthropicClient({
      env: { ...FEDERATION_ENV, ANTHROPIC_WORKSPACE_ID: 'wrkspc_test', ANTHROPIC_API_KEY: 'sk-ant-api-should-not-be-used' },
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

  test('キーの経路: API キーで Messages を呼ぶ（交換しない）', async () => {
    const { fn, calls } = mockFetch({});
    const identityTokenProvider = jest.fn(async () => 'aws-jwt');
    const { client, mode } = createAnthropicClient({
      env: { ANTHROPIC_API_KEY: 'sk-ant-api-test', ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_only' },
      timeout: 1000,
      fetch: fn,
      identityTokenProvider,
      logLabel: 'test',
    });
    expect(mode).toBe('api-key');
    await createMessage(client!);
    expect(identityTokenProvider).not.toHaveBeenCalled();
    expect(calls.some(c => c.url.includes('/v1/oauth/token'))).toBe(false);
    const api = calls.find(c => c.url.includes('/v1/messages'));
    const auth = `${api?.headers.get('x-api-key') ?? ''}${api?.headers.get('authorization') ?? ''}`;
    expect(auth).toContain('sk-ant-api-test');
  });

  test('値が無ければ client を作らない', () => {
    const { client, mode } = createAnthropicClient({ env: {}, timeout: 1000, logLabel: 'test' });
    expect(mode).toBe('none');
    expect(client).toBeNull();
  });

  test('どちらの経路かをログに残す（値は出さない）', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    createAnthropicClient({ env: { ANTHROPIC_API_KEY: 'sk-ant-api-secret' }, timeout: 1000, logLabel: 'test' });
    const line = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(line).toContain('api-key');
    expect(line).not.toContain('sk-ant-api-secret');
  });

  test('交換の失敗は federation として分類され、キーに戻らない', async () => {
    const { fn, calls } = mockFetch({ token: () => jsonResponse(401, { error: 'invalid_grant' }) });
    const { client } = createAnthropicClient({
      env: { ...FEDERATION_ENV, ANTHROPIC_API_KEY: 'sk-ant-api-should-not-be-used' },
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
  const keyClient = (fn: typeof fetch, timeout = 1000) => createAnthropicClient({
    env: { ANTHROPIC_API_KEY: 'sk-ant-api-test' }, timeout, fetch: fn, logLabel: 'test',
  }).client!;

  test('Messages のエラーは status 付きの api', async () => {
    const { fn } = mockFetch({ messages: () => jsonResponse(529, { type: 'error', error: { type: 'overloaded_error', message: 'x' } }) });
    const err = await createMessage(keyClient(fn)).catch(e => e);
    expect(classifyAnthropicError(err)).toEqual({ kind: 'api', status: 529 });
  });

  test('タイムアウトは timeout（再送しない）', async () => {
    const fn = jest.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    }));
    const err = await createMessage(keyClient(fn as unknown as typeof fetch, 20)).catch(e => e);
    expect(classifyAnthropicError(err)).toEqual({ kind: 'timeout' });
    expect(fn).toHaveBeenCalledTimes(1);
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

  test('トークンが空なら例外', async () => {
    const provider = awsWebIdentityTokenProvider({ send: async () => ({}) } as never);
    await expect(provider()).rejects.toThrow();
  });
});
