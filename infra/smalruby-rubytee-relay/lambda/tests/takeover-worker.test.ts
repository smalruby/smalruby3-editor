// worker の handler: 組み立てで落ちる入力でも、ジョブを pending のまま残さずエラーを書く。
// 他のテストファイルと識別子を共有しないよう、モジュールとして扱わせる（ts-jest の TS2451 対策）。
export {};
const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: (...a: unknown[]) => mockSend(...a) })) },
  UpdateCommand: jest.fn(input => ({ kind: 'Update', input })),
}));
jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn(() => ({})) }));

process.env.JOBS_TABLE_NAME = 'Jobs';
process.env.USAGE_TABLE_NAME = 'Usage';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler, callClaudeForTakeover } = require('../takeover-worker');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createAnthropicClient, awsWebIdentityTokenProvider } = require('../anthropic-client');

type Cmd = { kind: string; input: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any

const jobId = '00000000-0000-4000-8000-000000000000';

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('takeover worker handler', () => {
  test('history のターンに parts が無くても、ジョブに INVALID_INPUT を書いて終わる', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await handler({
      jobId,
      userMessage: '音が鳴らないので直して',
      history: [{ role: 'user', parts: [] }],
      usageContext: { purpose: 'genai-takeover' },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    const jobWrite = mockSend.mock.calls.map(c => c[0] as Cmd)
      .find(c => c.input.TableName === 'Jobs');
    expect(jobWrite?.input.Key).toEqual({ jobId });
    expect(jobWrite?.input.ExpressionAttributeValues).toMatchObject({
      ':status': 'error',
      ':error': 'INVALID_INPUT',
    });
  });

  test('jobId が UUID でなければ何も書かない', async () => {
    await handler({ jobId: 'x', userMessage: 'a', usageContext: {} });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('callClaudeForTakeover', () => {
  const body = {
    model: 'claude-test',
    max_tokens: 16,
    system: [{ type: 'text', text: 'fixed', cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content: 'hi' }],
  };
  const json = (status: number, b: unknown) =>
    new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  const clientWith = (fn: (init?: RequestInit) => Promise<Response>, timeout = 1000) => createAnthropicClient({
    env: { ANTHROPIC_API_KEY: 'sk-ant-api-test' },
    timeout,
    logLabel: 'test',
    fetch: (async (_input: unknown, init?: RequestInit) => fn(init)) as typeof fetch,
  }).client;

  test('答えと usage 4 項目を返す。system の cache_control はそのまま、beta ヘッダは付けない', async () => {
    let sent: RequestInit | undefined;
    const client = clientWith(async init => {
      sent = init;
      return json(200, {
        id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-test', stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'こん' }, { type: 'text', text: 'にちは' }],
        usage: { input_tokens: 3, output_tokens: 4, cache_creation_input_tokens: 5, cache_read_input_tokens: 6 },
      });
    });
    const result = await callClaudeForTakeover(body, client);
    expect(result).toEqual({
      status: 'done',
      text: 'こんにちは',
      outputTokens: 4,
      tokens: { inputTokens: 3, outputTokens: 4, cacheCreationTokens: 5, cacheReadTokens: 6 },
    });
    expect(JSON.parse(String(sent?.body)).system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(new Headers(sent?.headers).get('anthropic-beta')).toBeNull();
  });

  test.each([[529, 'AI_OVERLOADED'], [500, 'AI_API_ERROR'], [400, 'AI_API_ERROR']])(
    'Claude の %i は %s', async (status, code) => {
      const client = clientWith(async () => json(status, { type: 'error', error: { type: 'x', message: 'x' } }));
      expect(await callClaudeForTakeover(body, client)).toEqual({ status: 'error', error: code });
    });

  test('タイムアウトは AI_TIMEOUT', async () => {
    const client = clientWith(init => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    }), 20);
    expect(await callClaudeForTakeover(body, client)).toEqual({ status: 'error', error: 'AI_TIMEOUT' });
  });

  test('フェデレーションの交換に失敗したら AI_API_ERROR', async () => {
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
    expect(await callClaudeForTakeover(body, client)).toEqual({ status: 'error', error: 'AI_API_ERROR' });
  });

  test('STS で JWT を取れなかったら AI_API_ERROR（INTERNAL_ERROR にしない）', async () => {
    const { client } = createAnthropicClient({
      env: {
        ANTHROPIC_FEDERATION_RULE_ID: 'fdrl_test',
        ANTHROPIC_ORGANIZATION_ID: 'org',
        ANTHROPIC_SERVICE_ACCOUNT_ID: 'svac_test',
      },
      timeout: 1000,
      logLabel: 'test',
      identityTokenProvider: awsWebIdentityTokenProvider({
        send: async () => { throw new Error('AccessDenied'); },
      } as never),
      fetch: (async () => json(200, {})) as typeof fetch,
    });
    expect(await callClaudeForTakeover(body, client)).toEqual({ status: 'error', error: 'AI_API_ERROR' });
  });

  test('認証の値が無ければ AI_API_ERROR', async () => {
    expect(await callClaudeForTakeover(body, null)).toEqual({ status: 'error', error: 'AI_API_ERROR' });
  });
});
