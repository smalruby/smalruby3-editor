// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * みんなの課題 (shared assignment library) tests — issue #1068 / EPIC #1066.
 *
 * Exercises the full request path (router → auth → handlers) with the
 * DynamoDB document client and S3 mocked, plus the pure validators.
 * Design canon: spike #1067 (D1-D12).
 */


const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: mockS3Send })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed.example/get'),
}));

const DEV_TOKEN = 'test-dev-bypass';

interface MakeEventOptions {
  body?: unknown;
  token?: string;
  query?: Record<string, string>;
}

const makeEvent = (
  method: string,
  path: string,
  pathParameters: Record<string, string>,
  { body, token, query }: MakeEventOptions = {},
) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    origin: 'http://localhost:8601',
  },
  pathParameters,
  queryStringParameters: query,
  body: body === undefined ? undefined : JSON.stringify(body),
});

const ownClassroom = {
  classroomId: 'c1',
  status: 'active',
  teacherSub: 'dev-test-teacher',
  className: '技術',
  assignmentName: 'ねこあつめ',
  studentCount: 30,
  assignment: {
    pages: [
      { text: 'ページ1', imageKey: 'c1/assignment/image-abc.png' },
      { text: 'ページ2' },
    ],
    starterKey: 'c1/assignment/starter-xyz.sb3',
  },
};

const shareBody = {
  classroomId: 'c1',
  title: 'ねこあつめ入門',
  summary: 'はじめてのゲームづくり',
  schoolLevel: 'junior-high',
  grades: [1, 2],
  subject: '技術・家庭（技術分野）',
  tags: ['甲子園', '入門'],
  lessonCount: 3,
  supplementUrl: 'https://docs.google.com/document/d/abc/view',
  authorName: 'すもう るびお',
  authorAffiliation: '島根県 公立中学校',
  licenseConsent: true,
};

const publishedItem = {
  sharedId: 's1',
  title: 'ねこあつめ入門',
  summary: 'はじめてのゲームづくり',
  content: {
    pages: [{ text: 'ページ1', imageKey: 'shared/s1/image-abc.png' }, { text: 'ページ2' }],
    starterKey: 'shared/s1/starter-xyz.sb3',
  },
  supplementUrl: 'https://docs.google.com/document/d/abc/view',
  schoolLevel: 'junior-high',
  grades: [1, 2],
  subject: '技術・家庭（技術分野）',
  tags: ['甲子園'],
  lessonCount: 3,
  authorName: 'すもう るびお',
  authorAffiliation: '島根県 公立中学校',
  authorSub: 'someone-else',
  status: 'published',
  reuseCount: 4,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

// 合言葉限定公開の項目（#1109）。他人の限定公開を合言葉で内輪取り込みする想定。
const limitedItem = {
  ...publishedItem,
  visibility: 'limited',
  passcode: 'abc234',
  status: 'published',
};

describe('みんなの課題 (issue #1068)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;
  let validateSharedAttributes: (body: Record<string, unknown>) => Record<string, unknown>;
  let validateSupplementUrl: (value: unknown) => string | null;
  let buildSharedSnapshot: (
    assignment: Record<string, unknown> | undefined, sharedId: string,
  ) => { pages: unknown[]; starterKey?: string; copies: { from: string; to: string }[] };

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    mockSend.mockReset();
    mockS3Send.mockReset();
    mockS3Send.mockResolvedValue({ ContentLength: 1024 });
    const mod = require('../handler');
    handler = mod.handler;
    validateSharedAttributes = mod.validateSharedAttributes;
    validateSupplementUrl = mod.validateSupplementUrl;
    buildSharedSnapshot = mod.buildSharedSnapshot;
  });

  const commandNames = () => mockSend.mock.calls.map((c) => c[0]?.constructor?.name);

  describe('validators (pure)', () => {
    test('validateSharedAttributes accepts the controlled vocabulary', () => {
      expect(validateSharedAttributes({
        schoolLevel: 'high',
        subject: '情報Ⅰ',
        grades: [2, 1],
        tags: [' AI '],
        lessonCount: 5,
      })).toEqual({
        schoolLevel: 'high',
        subject: '情報Ⅰ',
        grades: [1, 2],
        tags: ['AI'],
        lessonCount: 5,
      });
    });

    test('validateSharedAttributes rejects out-of-vocabulary and out-of-range values', () => {
      expect(() => validateSharedAttributes({ schoolLevel: 'university', subject: 'x' })).toThrow('schoolLevel');
      expect(() => validateSharedAttributes({ schoolLevel: 'high', subject: '体育' })).toThrow('subject');
      expect(() => validateSharedAttributes({ schoolLevel: 'high', subject: '情報Ⅰ', grades: [4] })).toThrow('grades');
      expect(() => validateSharedAttributes({
        schoolLevel: 'high', subject: '情報Ⅰ', tags: ['a', 'b', 'c', 'd', 'e', 'f'],
      })).toThrow('tags');
      expect(() => validateSharedAttributes({
        schoolLevel: 'high', subject: '情報Ⅰ', lessonCount: 0,
      })).toThrow('lessonCount');
    });

    test('validateSharedAttributes lets the "other" school level use free-text subjects', () => {
      expect(validateSharedAttributes({ schoolLevel: 'other', subject: '高専 情報工学' }).subject)
        .toBe('高専 情報工学');
    });

    test('validateSupplementUrl enforces https and length', () => {
      expect(validateSupplementUrl('https://example.com/plan')).toBe('https://example.com/plan');
      expect(validateSupplementUrl(undefined)).toBeNull();
      expect(validateSupplementUrl('')).toBeNull();
      expect(() => validateSupplementUrl('http://example.com')).toThrow('https');
      expect(() => validateSupplementUrl('not a url')).toThrow('valid URL');
      expect(() => validateSupplementUrl(`https://example.com/${'a'.repeat(500)}`)).toThrow('500');
    });

    test('buildSharedSnapshot rewrites keys into the shared prefix', () => {
      const { pages, starterKey, copies } = buildSharedSnapshot(ownClassroom.assignment, 's1');
      expect(pages).toEqual([
        { text: 'ページ1', imageKey: 'shared/s1/image-abc.png' },
        { text: 'ページ2' },
      ]);
      expect(starterKey).toBe('shared/s1/starter-xyz.sb3');
      expect(copies).toEqual([
        { from: 'c1/assignment/image-abc.png', to: 'shared/s1/image-abc.png' },
        { from: 'c1/assignment/starter-xyz.sb3', to: 'shared/s1/starter-xyz.sb3' },
      ]);
    });
  });

  describe('POST /shared-assignments (share)', () => {
    const shareMocks = (classroom: Record<string, unknown> | null = ownClassroom) => {
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        const name = command.constructor.name;
        if (name === 'GetCommand') return { Item: classroom };
        if (name === 'UpdateCommand') return { Attributes: { count: 1 } };
        return {};
      });
    };

    test('publishes a snapshot: S3 copies + Put, response has no authorSub', async () => {
      shareMocks();
      const res = await handler(makeEvent('POST', '/shared-assignments', {}, {
        token: DEV_TOKEN, body: shareBody,
      }));

      expect(res.statusCode).toBe(201);
      const published = JSON.parse(res.body as string);
      expect(published.title).toBe('ねこあつめ入門');
      expect(published.hasStarter).toBe(true);
      expect(published.pageCount).toBe(2);
      expect(published.authorSub).toBeUndefined();

      // 1 HeadObject (size cap) + 2 CopyObject (image + starter).
      const s3Names = mockS3Send.mock.calls.map((c) => c[0]?.constructor?.name);
      expect(s3Names.filter((n) => n === 'CopyObjectCommand')).toHaveLength(2);
      expect(s3Names).toContain('HeadObjectCommand');
      expect(commandNames()).toContain('PutCommand');
    });

    test('rejects a share without license consent, before touching anything', async () => {
      shareMocks();
      const res = await handler(makeEvent('POST', '/shared-assignments', {}, {
        token: DEV_TOKEN, body: { ...shareBody, licenseConsent: false },
      }));
      expect(res.statusCode).toBe(400);
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('rejects an http supplement URL', async () => {
      shareMocks();
      const res = await handler(makeEvent('POST', '/shared-assignments', {}, {
        token: DEV_TOKEN, body: { ...shareBody, supplementUrl: 'http://example.com' },
      }));
      expect(res.statusCode).toBe(400);
    });

    test('rejects sharing someone else\'s classroom (401)', async () => {
      shareMocks({ ...ownClassroom, teacherSub: 'owner-A' });
      const res = await handler(makeEvent('POST', '/shared-assignments', {}, {
        token: DEV_TOKEN, body: shareBody,
      }));
      expect(res.statusCode).toBe(401);
      expect(commandNames()).not.toContain('PutCommand');
    });

    test('rejects a classroom without content (400)', async () => {
      shareMocks({ ...ownClassroom, assignment: { pages: [] } });
      const res = await handler(makeEvent('POST', '/shared-assignments', {}, {
        token: DEV_TOKEN, body: shareBody,
      }));
      expect(res.statusCode).toBe(400);
    });

    test('rejects an oversized starter project (D11)', async () => {
      shareMocks();
      mockS3Send.mockResolvedValue({ ContentLength: 51 * 1024 * 1024 });
      const res = await handler(makeEvent('POST', '/shared-assignments', {}, {
        token: DEV_TOKEN, body: shareBody,
      }));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body as string).error).toContain('50MB');
    });

    test('enforces the daily share quota (D12)', async () => {
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        const name = command.constructor.name;
        if (name === 'GetCommand') return { Item: ownClassroom };
        if (name === 'UpdateCommand') return { Attributes: { count: 11 } };
        return {};
      });
      const res = await handler(makeEvent('POST', '/shared-assignments', {}, {
        token: DEV_TOKEN, body: shareBody,
      }));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body as string).error).toContain('Daily limit');
      expect(commandNames()).not.toContain('PutCommand');
    });
  });

  describe('GET /shared-assignments (catalog)', () => {
    test('lists published items newest-first without exposing authorSub', async () => {
      mockSend.mockImplementation(async (command: {
        constructor: { name: string }; input?: Record<string, unknown>;
      }) => {
        expect(command.input?.IndexName).toBe('status-createdAt-index');
        expect(command.input?.ScanIndexForward).toBe(false);
        return { Items: [publishedItem] };
      });

      const res = await handler(makeEvent('GET', '/shared-assignments', {}, { token: DEV_TOKEN }));
      expect(res.statusCode).toBe(200);
      const { items, cursor } = JSON.parse(res.body as string);
      expect(items).toHaveLength(1);
      expect(items[0].authorName).toBe('すもう るびお');
      expect(items[0].authorSub).toBeUndefined();
      expect(items[0].hasStarter).toBe(true);
      expect(cursor).toBeNull();
    });

    test('builds a FilterExpression from the attribute filters', async () => {
      let captured: Record<string, unknown> | undefined;
      mockSend.mockImplementation(async (command: { input?: Record<string, unknown> }) => {
        captured = command.input;
        return { Items: [] };
      });

      await handler(makeEvent('GET', '/shared-assignments', {}, {
        token: DEV_TOKEN,
        query: { schoolLevel: 'junior-high', subject: '技術・家庭（技術分野）', grade: '2', tag: '甲子園' },
      }));

      // 公開カタログは限定公開（合言葉）を除外する句が末尾に付く（#1109）。
      expect(captured?.FilterExpression).toBe(
        '#sl = :sl AND #sub = :sub AND contains(#gr, :gr) AND contains(#tg, :tg) AND ' +
        '(attribute_not_exists(#vis) OR #vis = :pub)',
      );
      expect((captured?.ExpressionAttributeValues as Record<string, unknown>)[':gr']).toBe(2);
    });

    test('mine=1 lists the caller\'s own items via the author GSI', async () => {
      let captured: Record<string, unknown> | undefined;
      mockSend.mockImplementation(async (command: { input?: Record<string, unknown> }) => {
        captured = command.input;
        return { Items: [{ ...publishedItem, authorSub: 'dev-test-teacher', status: 'unlisted' }] };
      });

      const res = await handler(makeEvent('GET', '/shared-assignments', {}, {
        token: DEV_TOKEN, query: { mine: '1' },
      }));
      expect(captured?.IndexName).toBe('authorSub-createdAt-index');
      expect((captured?.ExpressionAttributeValues as Record<string, unknown>)[':pk']).toBe('dev-test-teacher');
      // DynamoDB rejects an EMPTY ExpressionAttributeNames map — with no
      // filters and no #status alias, the key must be omitted entirely
      // (prod 500 on 自分の投稿, 2026-07-18).
      expect(captured?.ExpressionAttributeNames).toBeUndefined();
      expect(JSON.parse(res.body as string).items[0].status).toBe('unlisted');
    });
  });

  describe('GET /shared-assignments/{id} (detail)', () => {
    test('returns pages with presigned URLs for a published item', async () => {
      mockSend.mockResolvedValue({ Item: publishedItem });
      const res = await handler(makeEvent('GET', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN,
      }));
      expect(res.statusCode).toBe(200);
      const detail = JSON.parse(res.body as string);
      expect(detail.pages).toEqual([
        { text: 'ページ1', imageUrl: 'https://signed.example/get' },
        { text: 'ページ2', imageUrl: null },
      ]);
      expect(detail.starterUrl).toBe('https://signed.example/get');
      expect(detail.isMine).toBe(false);
      expect(detail.authorSub).toBeUndefined();
    });

    test('hides an unlisted item from strangers (404) but not from its author', async () => {
      mockSend.mockResolvedValue({ Item: { ...publishedItem, status: 'unlisted' } });
      const strangers = await handler(makeEvent('GET', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN,
      }));
      expect(strangers.statusCode).toBe(404);

      mockSend.mockResolvedValue({
        Item: { ...publishedItem, status: 'unlisted', authorSub: 'dev-test-teacher' },
      });
      const author = await handler(makeEvent('GET', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN,
      }));
      expect(author.statusCode).toBe(200);
      expect(JSON.parse(author.body as string).isMine).toBe(true);
    });
  });

  describe('POST /shared-assignments/{id}/import', () => {
    const importMocks = () => {
      mockSend.mockImplementation(async (command: {
        constructor: { name: string }; input?: Record<string, unknown>;
      }) => {
        const name = command.constructor.name;
        if (name === 'GetCommand' && command.input?.TableName?.toString().includes('SharedAssignments')) {
          return { Item: publishedItem };
        }
        if (name === 'GetCommand') {
          return { Item: { groupId: 'g1', teacherSub: 'dev-test-teacher', name: '2年1組', studentCount: 32 } };
        }
        if (name === 'QueryCommand') return { Items: [] }; // joinCode uniqueness
        return {};
      });
    };

    test('creates a classroom in the caller\'s group and bumps reuseCount', async () => {
      importMocks();
      const res = await handler(makeEvent('POST', '/shared-assignments/s1/import', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { groupId: 'g1' },
      }));

      expect(res.statusCode).toBe(201);
      const created = JSON.parse(res.body as string);
      expect(created.className).toBe('2年1組');
      expect(created.assignmentName).toBe('ねこあつめ入門');
      expect(created.studentCount).toBe(32);
      expect(created.hasAssignment).toBe(true);

      // Copies flow from the shared bucket into the classroom bucket.
      const copyCalls = mockS3Send.mock.calls.filter((c) => c[0]?.constructor?.name === 'CopyObjectCommand');
      expect(copyCalls).toHaveLength(2);
      expect(copyCalls[0][0].input.CopySource).toContain('shared%2Fs1%2F');
      expect(commandNames()).toContain('PutCommand');
      expect(commandNames()).toContain('UpdateCommand'); // reuseCount ADD
    });

    test('rejects importing into someone else\'s group (404)', async () => {
      mockSend.mockImplementation(async (command: {
        constructor: { name: string }; input?: Record<string, unknown>;
      }) => {
        if (command.constructor.name === 'GetCommand' &&
            command.input?.TableName?.toString().includes('SharedAssignments')) {
          return { Item: publishedItem };
        }
        return { Item: { groupId: 'g1', teacherSub: 'owner-A' } };
      });
      const res = await handler(makeEvent('POST', '/shared-assignments/s1/import', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { groupId: 'g1' },
      }));
      expect(res.statusCode).toBe(404);
      expect(commandNames()).not.toContain('PutCommand');
    });

    test('rejects importing an unlisted item (404)', async () => {
      mockSend.mockResolvedValue({ Item: { ...publishedItem, status: 'unlisted' } });
      const res = await handler(makeEvent('POST', '/shared-assignments/s1/import', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { groupId: 'g1' },
      }));
      expect(res.statusCode).toBe(404);
    });
  });

  describe('限定公開・合言葉 (#1109)', () => {
    test('限定公開は同意なしで発行され、passcode と visibility を返す', async () => {
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        const name = command.constructor.name;
        if (name === 'GetCommand') return { Item: ownClassroom };
        if (name === 'UpdateCommand') return { Attributes: { count: 1 } };
        if (name === 'QueryCommand') return { Items: [] }; // passcode uniqueness
        return {};
      });
      const res = await handler(makeEvent('POST', '/shared-assignments', {}, {
        token: DEV_TOKEN, body: { classroomId: 'c1', title: 'ためし課題', visibility: 'limited' },
      }));
      expect(res.statusCode).toBe(201);
      const pub = JSON.parse(res.body as string);
      expect(pub.visibility).toBe('limited');
      expect(typeof pub.passcode).toBe('string');
      expect(pub.passcode).toHaveLength(6);
      const put = mockSend.mock.calls.find((c) => c[0]?.constructor?.name === 'PutCommand');
      expect((put?.[0].input.Item as Record<string, unknown>).visibility).toBe('limited');
      expect((put?.[0].input.Item as Record<string, unknown>).passcode).toBe(pub.passcode);
    });

    test('公開カタログは限定公開を除外する FilterExpression を持つ', async () => {
      let captured: Record<string, unknown> | undefined;
      mockSend.mockImplementation(async (command: { input?: Record<string, unknown> }) => {
        captured = command.input;
        return { Items: [] };
      });
      await handler(makeEvent('GET', '/shared-assignments', {}, { token: DEV_TOKEN }));
      expect(captured?.FilterExpression).toContain('attribute_not_exists(#vis) OR #vis = :pub');
      expect((captured?.ExpressionAttributeValues as Record<string, unknown>)[':pub']).toBe('public');
    });

    test('mine=1 は自分の限定公開の合言葉を含める', async () => {
      mockSend.mockImplementation(async () => ({
        Items: [{ ...limitedItem, authorSub: 'dev-test-teacher' }],
      }));
      const res = await handler(makeEvent('GET', '/shared-assignments', {}, {
        token: DEV_TOKEN, query: { mine: '1' },
      }));
      const { items } = JSON.parse(res.body as string);
      expect(items[0].visibility).toBe('limited');
      expect(items[0].passcode).toBe('abc234');
    });

    test('合言葉ルックアップは summary を返し sharedId / passcode は出さない', async () => {
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'QueryCommand') return { Items: [limitedItem] };
        return {};
      });
      const res = await handler(makeEvent('POST', '/shared-assignments/lookup', {}, {
        token: DEV_TOKEN, body: { passcode: 'abc234' },
      }));
      expect(res.statusCode).toBe(200);
      const s = JSON.parse(res.body as string);
      expect(s.title).toBe(limitedItem.title);
      expect(s.sharedId).toBeUndefined();
      expect(s.passcode).toBeUndefined();
    });

    test('合言葉取り込みはクラスを作成し reuseCount を増やす', async () => {
      mockSend.mockImplementation(async (command: {
        constructor: { name: string }; input?: Record<string, unknown>;
      }) => {
        const name = command.constructor.name;
        const idx = command.input?.IndexName;
        if (name === 'QueryCommand' && idx === 'passcode-index') return { Items: [limitedItem] };
        if (name === 'QueryCommand' && idx === 'joinCode-index') return { Items: [] };
        if (name === 'GetCommand') {
          return { Item: { groupId: 'g1', teacherSub: 'dev-test-teacher', name: '2年1組', studentCount: 32 } };
        }
        return {};
      });
      const res = await handler(makeEvent('POST', '/shared-assignments/import-by-passcode', {}, {
        token: DEV_TOKEN, body: { passcode: 'abc234', groupId: 'g1' },
      }));
      expect(res.statusCode).toBe(201);
      const created = JSON.parse(res.body as string);
      expect(created.className).toBe('2年1組');
      expect(commandNames()).toContain('PutCommand');
      expect(commandNames()).toContain('UpdateCommand');
    });

    test('不明な合言葉は 404', async () => {
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'QueryCommand') return { Items: [] };
        return {};
      });
      const res = await handler(makeEvent('POST', '/shared-assignments/import-by-passcode', {}, {
        token: DEV_TOKEN, body: { passcode: 'zzz999', groupId: 'g1' },
      }));
      expect(res.statusCode).toBe(404);
    });

    test('限定公開は sharedId を知っていても非著者には 404', async () => {
      mockSend.mockResolvedValue({ Item: limitedItem }); // authorSub 'someone-else'
      const res = await handler(makeEvent('GET', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN,
      }));
      expect(res.statusCode).toBe(404);
    });

    test('限定公開→全体公開は同意が無ければ 400、あれば 200', async () => {
      const mine = { ...limitedItem, authorSub: 'dev-test-teacher' };
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        const name = command.constructor.name;
        if (name === 'GetCommand') return { Item: mine };
        if (name === 'UpdateCommand') return { Attributes: { ...mine, visibility: 'public' } };
        if (name === 'QueryCommand') return { Items: [] };
        return {};
      });
      const noConsent = await handler(makeEvent('PATCH', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { visibility: 'public' },
      }));
      expect(noConsent.statusCode).toBe(400);

      const withConsent = await handler(makeEvent('PATCH', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { visibility: 'public', licenseConsent: true },
      }));
      expect(withConsent.statusCode).toBe(200);
    });
  });

  describe('PATCH / DELETE /shared-assignments/{id} (author only)', () => {
    test('the author updates metadata and can republish', async () => {
      const mine = { ...publishedItem, authorSub: 'dev-test-teacher', status: 'unlisted' };
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetCommand') return { Item: mine };
        if (command.constructor.name === 'UpdateCommand') {
          return { Attributes: { ...mine, title: '改訂版', status: 'published' } };
        }
        return {};
      });
      const res = await handler(makeEvent('PATCH', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { title: '改訂版', status: 'published' },
      }));
      expect(res.statusCode).toBe(200);
      const updated = JSON.parse(res.body as string);
      expect(updated.title).toBe('改訂版');
      expect(updated.status).toBe('published');
      expect(updated.authorSub).toBeUndefined();
    });

    test('a stranger cannot update or unlist (404, no write)', async () => {
      mockSend.mockResolvedValue({ Item: publishedItem }); // authorSub: someone-else
      const patch = await handler(makeEvent('PATCH', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { title: '乗っ取り' },
      }));
      expect(patch.statusCode).toBe(404);

      const del = await handler(makeEvent('DELETE', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN,
      }));
      expect(del.statusCode).toBe(404);
      expect(commandNames()).not.toContain('UpdateCommand');
    });

    test('the author unlists their item (204)', async () => {
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'GetCommand') {
          return { Item: { ...publishedItem, authorSub: 'dev-test-teacher' } };
        }
        return {};
      });
      const res = await handler(makeEvent('DELETE', '/shared-assignments/s1', { sharedId: 's1' }, {
        token: DEV_TOKEN,
      }));
      expect(res.statusCode).toBe(204);
      expect(commandNames()).toContain('UpdateCommand');
    });
  });

  describe('POST /shared-assignments/{id}/report', () => {
    test('stores a report with the reason (201)', async () => {
      let putItem: Record<string, unknown> | undefined;
      mockSend.mockImplementation(async (command: {
        constructor: { name: string }; input?: Record<string, unknown>;
      }) => {
        const name = command.constructor.name;
        if (name === 'GetCommand') return { Item: publishedItem };
        if (name === 'UpdateCommand') return { Attributes: { count: 1 } };
        if (name === 'PutCommand') {
          putItem = command.input?.Item as Record<string, unknown>;
          return {};
        }
        return {};
      });
      const res = await handler(makeEvent('POST', '/shared-assignments/s1/report', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { reason: '不適切な内容が含まれています' },
      }));
      expect(res.statusCode).toBe(201);
      expect(putItem?.reason).toBe('不適切な内容が含まれています');
      expect(putItem?.reporterSub).toBe('dev-test-teacher');
      expect(typeof putItem?.ttl).toBe('number');
    });

    test('rejects an empty reason (400)', async () => {
      const res = await handler(makeEvent('POST', '/shared-assignments/s1/report', { sharedId: 's1' }, {
        token: DEV_TOKEN, body: { reason: '' },
      }));
      expect(res.statusCode).toBe(400);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});

