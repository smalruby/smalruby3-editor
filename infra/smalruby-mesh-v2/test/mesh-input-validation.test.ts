import * as fs from 'fs';
import * as path from 'path';
import { meshInputValidatedSource } from '../lib/appsync-code';

// issue #1267: AppSync JS Function の入力検査（name / hostId / nodeId の長さと文字）
//
// CDK がデプロイするのと同じ連結済みソースを、@aws-appsync/utils の util をモックして評価する。

class AppSyncError extends Error {
  constructor(message: string, public errorType: string) {
    super(message);
  }
}

const util = {
  error: (message: string, errorType: string) => {
    throw new AppSyncError(message, errorType);
  },
  dynamodb: { toMapValues: (v: unknown) => v },
  time: {
    nowEpochMilliSeconds: () => 1_700_000_000_000,
    nowISO8601: () => '2023-11-14T22:13:20Z',
  },
};

type Fn = { request: (ctx: unknown) => unknown };

function loadFunction(file: string): Fn {
  const source = meshInputValidatedSource(path.join(__dirname, '../js/functions', file))
    .replace(/^import .*$/m, '')
    .replace(/^export function/gm, 'function');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('util', `${source}\nreturn { request, response };`)(util) as Fn;
}

const HEX_ID = '0123456789abcdef0123456789abcdef';
const ctxWith = (args: Record<string, unknown>) => ({ args, env: {}, stash: {} });

function expectValidationError(fn: () => unknown, pattern: RegExp) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppSyncError);
    expect((e as AppSyncError).errorType).toBe('ValidationError');
    expect((e as AppSyncError).message).toMatch(pattern);
    return;
  }
  throw new Error('expected ValidationError');
}

describe('checkExistingGroup（createGroup の入口）', () => {
  const fn = loadFunction('checkExistingGroup.js');
  const base = { domain: 'example.com', useWebSocket: true };

  test.each([
    [HEX_ID, HEX_ID],
    [`${HEX_ID}s07`, `${HEX_ID}s07|host=7`],
    [`${HEX_ID}s03`, `${HEX_ID}s03|seats=3,7,12|host=3`],
    [HEX_ID, `${HEX_ID}|host=teacher`],
    ['host-001', 'Test Group'],
    ['host-001', 'テストグループ'],
    ['a'.repeat(128), 'a'.repeat(1024)],
  ])('今のクライアントの形式を通す（hostId=%s, name=%s）', (hostId, name) => {
    expect(fn.request(ctxWith({ ...base, hostId, name }))).toHaveProperty('operation', 'Query');
  });

  test('129 文字以上の hostId は ValidationError', () => {
    expectValidationError(
      () => fn.request(ctxWith({ ...base, hostId: 'a'.repeat(129), name: 'g' })),
      /hostId must be 128 characters or less/,
    );
  });

  test.each(['#', '|', ' ', '@', 'あ', '\n'])('使えない文字（%j）の hostId は ValidationError', bad => {
    expectValidationError(
      () => fn.request(ctxWith({ ...base, hostId: `host${bad}1`, name: 'g' })),
      /hostId contains invalid characters/,
    );
  });

  test('1025 文字以上の name は ValidationError', () => {
    expectValidationError(
      () => fn.request(ctxWith({ ...base, hostId: HEX_ID, name: 'a'.repeat(1025) })),
      /name must be 1024 characters or less/,
    );
  });

  test.each(['\u0000', '\n', '\t', '\u001f', '\u007f'])('制御文字（%j）入りの name は ValidationError', ctrl => {
    expectValidationError(
      () => fn.request(ctxWith({ ...base, hostId: HEX_ID, name: `group${ctrl}name` })),
      /name contains control characters/,
    );
  });

  test('空の name・hostId は ValidationError', () => {
    expectValidationError(() => fn.request(ctxWith({ ...base, hostId: HEX_ID, name: '' })), /name is required/);
    expectValidationError(() => fn.request(ctxWith({ ...base, hostId: '', name: 'g' })), /hostId is required/);
  });
});

describe('checkGroupExists（joinGroup / renewHeartbeat / sendMemberHeartbeat / reportDataByNode / fireEventsByNode の入口）', () => {
  const fn = loadFunction('checkGroupExists.js');
  const base = { groupId: 'group-1', domain: 'example.com' };

  test.each([HEX_ID, `${HEX_ID}s07`, `${HEX_ID}s123`, 'node-001'])('nodeId=%s を通す', nodeId => {
    expect(fn.request(ctxWith({ ...base, nodeId }))).toHaveProperty('operation', 'GetItem');
  });

  test('hostId（renewHeartbeat）を通す', () => {
    expect(fn.request(ctxWith({ ...base, hostId: HEX_ID }))).toHaveProperty('operation', 'GetItem');
  });

  test('129 文字以上の nodeId は ValidationError', () => {
    expectValidationError(
      () => fn.request(ctxWith({ ...base, nodeId: 'a'.repeat(129) })),
      /nodeId must be 128 characters or less/,
    );
  });

  test('使えない文字の nodeId・hostId は ValidationError', () => {
    expectValidationError(
      () => fn.request(ctxWith({ ...base, nodeId: 'x#NODE#y' })),
      /nodeId contains invalid characters/,
    );
    expectValidationError(
      () => fn.request(ctxWith({ ...base, hostId: 'host|1' })),
      /hostId contains invalid characters/,
    );
  });
});

// issue #1846: イベントの payload は 1000 文字まで（fireEventsByNode は checkGroupExists で検査する）
describe('checkGroupExists のイベント payload の上限（fireEventsByNode）', () => {
  const fn = loadFunction('checkGroupExists.js');
  const base = { groupId: 'group-1', domain: 'example.com', nodeId: HEX_ID };
  const event = (payload?: unknown) => ({
    eventName: 'evt',
    firedAt: '2026-11-14T00:00:00.000Z',
    ...(payload === undefined ? {} : { payload }),
  });

  test('payload ちょうど 1000 文字は通す', () => {
    expect(fn.request(ctxWith({ ...base, events: [event('a'.repeat(1000))] }))).toHaveProperty(
      'operation',
      'GetItem',
    );
  });

  test('payload が無い・null のイベントは通す（今の GUI の形）', () => {
    expect(fn.request(ctxWith({ ...base, events: [event(), event(null)] }))).toHaveProperty('operation', 'GetItem');
  });

  test('payload 1001 文字は ValidationError（何番目のイベントかを返す）', () => {
    expectValidationError(
      () => fn.request(ctxWith({ ...base, events: [event('1'), event('a'.repeat(1001))] })),
      /events\[1\]\.payload must be 1000 characters or less/,
    );
  });

  test('文字数はコードポイント単位で数える（絵文字 1000 個は通し、1001 個は拒否する）', () => {
    expect(fn.request(ctxWith({ ...base, events: [event('😀'.repeat(1000))] }))).toHaveProperty(
      'operation',
      'GetItem',
    );
    expectValidationError(
      () => fn.request(ctxWith({ ...base, events: [event('😀'.repeat(1001))] })),
      /events\[0\]\.payload must be 1000 characters or less/,
    );
  });
});

// APPSYNC_JS の for...of は文字列を UTF-16 のコード単位で回す（stg で確認）。Node はコードポイントで回すので、
// コード単位の配列を渡して APPSYNC_JS の回り方を再現し、どちらでも同じ数になることを確かめる。
describe('meshCharCount（APPSYNC_JS と Node で同じ数え方）', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/shared/meshInputValidation.js'), 'utf8');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const meshCharCount = new Function(`${source}\nreturn meshCharCount;`)() as (text: Iterable<string>) => number;
  const codeUnits = (text: string) => text.split('');

  test.each([
    ['a'.repeat(1000), 1000],
    ['あいう', 3],
    ['😀😀', 2],
    ['a😀b', 3],
  ])('%j は %i 文字（コードポイントで回しても、コード単位で回しても）', (text, expected) => {
    expect(meshCharCount(text)).toBe(expected);
    expect(meshCharCount(codeUnits(text))).toBe(expected);
  });
});
