import {
  MAX_TAKEOVER_MESSAGE_LENGTH,
  TAKEOVER_MAX_TOKENS,
  TAKEOVER_FIXED_INSTRUCTION,
  TAKEOVER_JOB_STALE_SECONDS,
  COPY_START,
  COPY_END,
  buildTakeoverSystem,
  takeoverRateLimitPlan,
  seatCurrentKey,
  usageKey,
  usageUpdateExpression,
  jstDate,
  isValidJobId,
  jobResponseBody,
  anthropicErrorCode,
} from '../takeover';
import { buildTakeoverClaudeRequest } from '../takeover-worker';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: jest.fn() })) },
  UpdateCommand: jest.fn(input => input),
}));
jest.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: jest.fn(() => ({})) }));

describe('takeover limits', () => {
  test('takeover の入力上限は 1 万字、max_tokens は 8192', () => {
    expect(MAX_TAKEOVER_MESSAGE_LENGTH).toBe(10000);
    expect(TAKEOVER_MAX_TOKENS).toBe(8192);
  });
});

describe('buildTakeoverSystem', () => {
  const stateContext = {
    sprite: {
      name: 'ネコ',
      costumes: [{ name: 'コスチューム1' }],
      sounds: [{ name: 'ニャー' }],
      currentCode: 'move(10)  # STUDENT_CODE_MARKER',
    },
    stage: { costumes: [{ name: '背景1' }], sounds: [] },
  };

  test('先頭ブロックは固定部分で cache_control (ttl 1h) が付く', () => {
    const system = buildTakeoverSystem(stateContext);
    expect(system[0]).toEqual({
      type: 'text',
      text: TAKEOVER_FIXED_INSTRUCTION,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    });
  });

  test('先頭ブロックは作品の中身を含まず、毎回同じ', () => {
    const a = buildTakeoverSystem(stateContext);
    const b = buildTakeoverSystem({ sprite: { name: '別', currentCode: 'say("x")' } });
    expect(a[0]).toEqual(b[0]);
    expect(String(a[0].text)).not.toContain('STUDENT_CODE_MARKER');
    expect(String(a[0].text)).not.toContain('ニャー');
  });

  test('毎回変わる部分は後ろのブロックに入り、cache_control を持たない', () => {
    const system = buildTakeoverSystem(stateContext);
    expect(system).toHaveLength(2);
    expect(system[1].cache_control).toBeUndefined();
    expect(String(system[1].text)).toContain('STUDENT_CODE_MARKER');
    expect(String(system[1].text)).toContain('"ニャー"');
    expect(String(system[1].text)).toContain('"背景1"');
  });

  test('答えの形（スプライトごとの見出しと ▼▼〜▲▲）を指示する', () => {
    expect(TAKEOVER_FIXED_INSTRUCTION).toContain(COPY_START);
    expect(TAKEOVER_FIXED_INSTRUCTION).toContain(COPY_END);
    expect(TAKEOVER_FIXED_INSTRUCTION).toContain('# 「スプライト名」');
  });

  test('言語仕様（禁止メソッドなど）を含み、Sonnet のキャッシュ最小長を超える', () => {
    expect(TAKEOVER_FIXED_INSTRUCTION).toContain('Forbidden Methods');
    // 1024 トークン ≒ 英文 4000 字。十分な余裕を見る
    expect(TAKEOVER_FIXED_INSTRUCTION.length).toBeGreaterThan(8000);
  });
});

describe('buildTakeoverClaudeRequest', () => {
  test('max_tokens 8192・system は配列・履歴と userMessage を messages に置く', () => {
    const req = buildTakeoverClaudeRequest({
      jobId: '00000000-0000-4000-8000-000000000000',
      userMessage: '音が鳴らないので直して',
      history: [
        { role: 'user', parts: [{ text: '前の質問' }] },
        { role: 'model', parts: [{ text: '前の答え' }] },
      ],
      usageContext: { purpose: 'genai-takeover' },
    }, 'claude-sonnet-5-5');
    expect(req.model).toBe('claude-sonnet-5-5');
    expect(req.max_tokens).toBe(8192);
    expect(Array.isArray(req.system)).toBe(true);
    expect(req.messages).toEqual([
      { role: 'user', content: '前の質問' },
      { role: 'assistant', content: '前の答え' },
      { role: 'user', content: '音が鳴らないので直して' },
    ]);
  });
});

describe('takeoverRateLimitPlan', () => {
  const base = { sourceIp: '1.2.3.4', seatLimit: 40, ipLimit: 1600, defaultLimit: 40 };

  test('classroom と seat があれば 1 席ごと + IP（クラス全員ぶん）で数える', () => {
    expect(takeoverRateLimitPlan({ ...base, classroom: 'c1', seat: '3' })).toEqual([
      { key: 'seat#c1:3', limit: 40, seat: true },
      { key: 'takeover-ip#1.2.3.4', limit: 1600 },
    ]);
  });

  test('同じ IP の別の席は別のキーになる（クラス全員が同じ IP でも 429 にならない）', () => {
    const a = takeoverRateLimitPlan({ ...base, classroom: 'c1', seat: '3' });
    const b = takeoverRateLimitPlan({ ...base, classroom: 'c1', seat: '4' });
    expect(a[0].key).not.toBe(b[0].key);
  });

  test('classroom か seat が無ければ今の IP 単位', () => {
    expect(takeoverRateLimitPlan({ ...base, classroom: 'c1' })).toEqual([{ key: '1.2.3.4', limit: 40 }]);
    expect(takeoverRateLimitPlan({ ...base, seat: '3' })).toEqual([{ key: '1.2.3.4', limit: 40 }]);
  });

  test('席ごとの「今の状況」は windowStart = 0 の固定行', () => {
    expect(seatCurrentKey('c1', '3')).toEqual({ sourceIp: 'seat#c1:3#current', windowStart: 0 });
  });
});

describe('usage keys', () => {
  test('日本時間の日付で区切る', () => {
    // 2026-11-01T15:30:00Z = 2026-11-02 00:30 JST
    expect(jstDate(Date.UTC(2026, 10, 1, 15, 30))).toBe('2026-11-02');
    expect(jstDate(Date.UTC(2026, 10, 1, 14, 59))).toBe('2026-11-01');
  });

  test('classroom / seat / purpose からキーを作る（purpose 未指定は chat）', () => {
    const nowMs = Date.UTC(2026, 10, 1, 3, 0);
    expect(usageKey({ classroom: 'c1', seat: '3', purpose: 'genai-takeover', nowMs })).toEqual({
      pk: 'classroom#c1',
      sk: '2026-11-01#seat#3#genai-takeover',
    });
    expect(usageKey({ nowMs })).toEqual({ pk: 'classroom#-', sk: '2026-11-01#seat#-#chat' });
  });

  test('回数とトークン数を ADD でまとめて足し込む', () => {
    const expr = usageUpdateExpression(['requests', 'succeeded'], {
      inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheCreationTokens: 0,
    });
    expect(expr.UpdateExpression).toBe(
      'ADD #requests :one, #succeeded :one, #inputTokens :inputTokens, #outputTokens :outputTokens, '
      + '#cacheReadTokens :cacheReadTokens, #cacheCreationTokens :cacheCreationTokens',
    );
    expect(expr.ExpressionAttributeValues).toEqual({
      ':one': 1, ':inputTokens': 10, ':outputTokens': 20, ':cacheReadTokens': 30, ':cacheCreationTokens': 0,
    });
  });
});

describe('jobs', () => {
  test('jobId は UUID v4 の形だけ受け付ける', () => {
    expect(isValidJobId('3b241101-e2bb-4255-8caf-4136c566a962')).toBe(true);
    expect(isValidJobId('../etc/passwd')).toBe(false);
    expect(isValidJobId('3B241101-E2BB-4255-8CAF-4136C566A962')).toBe(false);
    expect(isValidJobId(undefined)).toBe(false);
  });

  const jobId = '3b241101-e2bb-4255-8caf-4136c566a962';

  test('pending は pending、古すぎる pending は JOB_TIMEOUT', () => {
    expect(jobResponseBody({ jobId, status: 'pending', createdAt: 1000 }, 1010)).toEqual({ jobId, status: 'pending' });
    expect(jobResponseBody({ jobId, status: 'pending', createdAt: 1000 }, 1001 + TAKEOVER_JOB_STALE_SECONDS))
      .toEqual({ jobId, status: 'error', error: 'JOB_TIMEOUT' });
  });

  test('done は答えを返し、error はコードを返す', () => {
    expect(jobResponseBody({ jobId, status: 'done', createdAt: 0, text: 'ans', outputTokens: 5 }, 1))
      .toEqual({ jobId, status: 'done', text: 'ans', outputTokens: 5 });
    expect(jobResponseBody({ jobId, status: 'error', createdAt: 0, error: 'AI_OVERLOADED' }, 1))
      .toEqual({ jobId, status: 'error', error: 'AI_OVERLOADED' });
  });

  test('Anthropic の状態コードを同期の経路と同じエラーコードにする', () => {
    expect(anthropicErrorCode(529)).toBe('AI_OVERLOADED');
    expect(anthropicErrorCode(500)).toBe('AI_API_ERROR');
  });
});

describe('seat normalization', () => {
  test('"03" と "3" は同じ席', () => {
    const base = { sourceIp: 'ip', seatLimit: 40, ipLimit: 1600, defaultLimit: 40 };
    expect(takeoverRateLimitPlan({ ...base, classroom: 'c', seat: '03' })[0].key).toBe('seat#c:3');
    expect(usageKey({ classroom: 'c', seat: '03', nowMs: 0 }).sk).toBe('1970-01-01#seat#3#chat');
  });
});
