/**
 * Class (group) seat-count propagation to existing assignments.
 *
 * Changing a class's studentCount must flow down to its active assignments
 * (classrooms) — growing adds seats, shrinking drops them (the teacher UI
 * warns before shrinking). Regression for "既存の課題の人数が増えない".
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn() })) };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed.example/get'),
}));

const DEV_TOKEN = 'test-dev-bypass';

const makeEvent = (method: string, path: string, pathParameters: Record<string, string>, body: unknown) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
  pathParameters,
  body: JSON.stringify(body),
});

describe('class seat-count propagation (PATCH /classroom-groups/{id})', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number }>;

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:8601';
    mockSend.mockReset();
    handler = require('../handler').handler;
  });

  const drive = async (newCount: number, classroomIds: string[]) => {
    const classroomUpdates: { classroomId: string; studentCount: number }[] = [];
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      const name = command.constructor.name;
      const table = String(command.input?.TableName || '');
      if (name === 'GetCommand') {
        // getOwnedGroup → the owning class
        return { Item: { groupId: 'g1', teacherSub: 'dev-test-teacher', name: '2年1組', year: 2026, studentCount: 30, schemaVersion: 2 } };
      }
      if (name === 'UpdateCommand' && table.includes('Group')) {
        return { Attributes: { groupId: 'g1', teacherSub: 'dev-test-teacher', name: '2年1組', year: 2026, studentCount: newCount, schemaVersion: 2 } };
      }
      if (name === 'ScanCommand') {
        // propagation enumerates the class's assignments by groupId (#1145)
        return {
          Items: classroomIds.map(classroomId => ({ classroomId, groupId: 'g1', status: 'active' })),
        };
      }
      if (name === 'UpdateCommand') {
        const values = command.input?.ExpressionAttributeValues as Record<string, unknown>;
        classroomUpdates.push({
          classroomId: String((command.input?.Key as Record<string, unknown>).classroomId),
          studentCount: values[':sc'] as number,
        });
        return {};
      }
      return {};
    });

    const res = await handler(makeEvent('PATCH', '/classroom-groups/g1', { groupId: 'g1' }, { studentCount: newCount }));
    return { res, classroomUpdates };
  };

  test('increasing the class count raises every active assignment (no warning needed server-side)', async () => {
    const { res, classroomUpdates } = await drive(35, ['c1', 'c2']);
    expect(res.statusCode).toBe(200);
    expect(classroomUpdates).toEqual([
      { classroomId: 'c1', studentCount: 35 },
      { classroomId: 'c2', studentCount: 35 },
    ]);
  });

  test('decreasing the class count lowers every active assignment too', async () => {
    const { res, classroomUpdates } = await drive(20, ['c1']);
    expect(res.statusCode).toBe(200);
    expect(classroomUpdates).toEqual([{ classroomId: 'c1', studentCount: 20 }]);
  });

  test('only the class\'s active assignments are propagated to', async () => {
    // The table holds an assignment in another class and an archived one; both
    // must be left alone. Mocking the table contents (not the query shape)
    // keeps this test independent of how the enumeration is implemented.
    const rows = [
      { classroomId: 'c1', groupId: 'g1', status: 'active' },
      { classroomId: 'c-other-class', groupId: 'g2', status: 'active' },
      { classroomId: 'c-archived', groupId: 'g1', status: 'archived' },
    ];
    const touched: string[] = [];
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand') {
        return { Item: { groupId: 'g1', teacherSub: 'dev-test-teacher', studentCount: 30, schemaVersion: 2 } };
      }
      if (name === 'UpdateCommand' && String(command.input?.TableName).includes('Group')) {
        return { Attributes: { groupId: 'g1', teacherSub: 'dev-test-teacher', studentCount: 40 } };
      }
      if (name === 'ScanCommand') {
        const values = (command.input?.ExpressionAttributeValues || {}) as Record<string, unknown>;
        const wanted = Object.entries(values)
          .filter(([key]) => key.startsWith(':g'))
          .map(([, value]) => value);
        return { Items: rows.filter(row => wanted.includes(row.groupId)) };
      }
      if (name === 'UpdateCommand') {
        touched.push(String((command.input?.Key as Record<string, unknown>).classroomId));
        return {};
      }
      return {};
    });

    await handler(makeEvent('PATCH', '/classroom-groups/g1', { groupId: 'g1' }, { studentCount: 40 }));
    expect(touched).toEqual(['c1']);
  });
});
