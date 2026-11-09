// AI 評価の Claude 呼び出し（SDK 経由・#1437）: 応答・usage・エラーコードの対応付け。
import { callClaudeForEvaluation } from '../handler';
import { createAnthropicClient } from '../anthropic-client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const clientWith = (fn: (init?: RequestInit) => Promise<Response>, timeout = 1000) => createAnthropicClient({
  env: {
    ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
    ANTHROPIC_ORGANIZATION_ID: '00000000-0000-4000-8000-000000000001',
    ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test',
  },
  identityTokenProvider: async () => 'aws-jwt',
  timeout,
  logLabel: 'test',
  // WIF のトークン交換には固定の応答を返し、Messages の呼び出しだけを fn に渡す
  fetch: (async (input: unknown, init?: RequestInit) => (String(input).includes('/v1/oauth/token')
    ? json(200, { access_token: 'sk-ant-oat-test', expires_in: 3600 })
    : fn(init))) as typeof fetch,
}).client!;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('callClaudeForEvaluation', () => {
  test('テキストと usage を返す。system は cache_control 付き、beta ヘッダは付けない', async () => {
    let sent: RequestInit | undefined;
    const client = clientWith(async init => {
      sent = init;
      return json(200, {
        id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-test', stop_reason: 'end_turn',
        content: [{ type: 'text', text: '[{"seatNumber":1}]' }],
        usage: { input_tokens: 3, output_tokens: 4, cache_creation_input_tokens: 5, cache_read_input_tokens: 6 },
      });
    });
    const result = await callClaudeForEvaluation('SYSTEM', 'USER', client);
    expect(result).toEqual({
      ok: true,
      text: '[{"seatNumber":1}]',
      usage: { input_tokens: 3, output_tokens: 4, cache_creation_input_tokens: 5, cache_read_input_tokens: 6 },
    });
    const body = JSON.parse(String(sent?.body));
    expect(body.system).toEqual([{ type: 'text', text: 'SYSTEM', cache_control: { type: 'ephemeral' } }]);
    expect(body.messages).toEqual([{ role: 'user', content: 'USER' }]);
    expect(body.max_tokens).toBe(4096);
    // WIF では SDK が oauth の beta を付ける。prompt caching の beta は付けない
    expect(new Headers(sent?.headers).get('anthropic-beta') ?? '').not.toContain('prompt-caching');
  });

  test.each([529, 500, 400])('Claude の %i は 502 AI_API_ERROR', async status => {
    const client = clientWith(async () => json(status, { type: 'error', error: { type: 'x', message: 'x' } }));
    expect(await callClaudeForEvaluation('S', 'U', client)).toEqual({
      ok: false, statusCode: 502, error: 'AI_API_ERROR',
    });
  });

  test('タイムアウトは 504 AI_TIMEOUT', async () => {
    const client = clientWith(init => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    }), 20);
    expect(await callClaudeForEvaluation('S', 'U', client)).toEqual({
      ok: false, statusCode: 504, error: 'AI_TIMEOUT',
    });
  });

  test('フェデレーションの交換に失敗したら 502 AI_API_ERROR', async () => {
    const { client } = createAnthropicClient({
      env: {
        ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
        ANTHROPIC_ORGANIZATION_ID: 'org',
        ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test',
      },
      timeout: 1000,
      logLabel: 'test',
      identityTokenProvider: async () => 'aws-jwt',
      fetch: (async () => json(401, { error: 'invalid_grant' })) as typeof fetch,
    });
    expect(await callClaudeForEvaluation('S', 'U', client!)).toEqual({
      ok: false, statusCode: 502, error: 'AI_API_ERROR',
    });
  });
});
