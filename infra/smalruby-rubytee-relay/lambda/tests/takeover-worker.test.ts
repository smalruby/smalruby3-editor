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
const { handler } = require('../takeover-worker');

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
