
/**
 * 逆引き索引バックフィルの純粋関数のテスト (issue #1146)。
 *
 * バックフィルを取りこぼすと「既存の共同管理者から資源が見えない」という形で
 * 壊れる（権限は item 上の coTeacherEmails で判定するので直リンクでは操作でき、
 * 一覧に出ないだけ = 気付きにくい）。行の作り方をここで固定する。
 */

import {
  BATCH_WRITE_LIMIT,
  chunkIndexWrites,
  indexRowsForResource,
  normalizeIndexEmail,
  parseBackfillArgs,
} from '../coteacher-index-lib';
import { resourceNamesForStage } from '../restore-lib';

describe('indexRowsForResource', () => {
  test('課題 1 件から共同管理者ごとの行を作り、ttl を写す', () => {
    expect(indexRowsForResource('assignment', {
      classroomId: 'c1',
      coTeacherEmails: ['A@Example.com', 'b@example.com'],
      ttl: 1800000000,
    })).toEqual([
      {
        coTeacherEmail: 'a@example.com', resourceKey: 'assignment#c1',
        resourceType: 'assignment', resourceId: 'c1', ttl: 1800000000,
      },
      {
        coTeacherEmail: 'b@example.com', resourceKey: 'assignment#c1',
        resourceType: 'assignment', resourceId: 'c1', ttl: 1800000000,
      },
    ]);
  });

  test('組は group# 接頭辞になる（同じ email で課題と組を撃ち分けるため）', () => {
    expect(indexRowsForResource('group', { groupId: 'g1', coTeacherEmails: ['a@example.com'] }))
      .toEqual([{
        coTeacherEmail: 'a@example.com', resourceKey: 'group#g1',
        resourceType: 'group', resourceId: 'g1',
      }]);
  });

  test('共同管理者がいない / 壊れた行は無視する', () => {
    expect(indexRowsForResource('assignment', { classroomId: 'c1' })).toEqual([]);
    expect(indexRowsForResource('assignment', { classroomId: 'c1', coTeacherEmails: [] })).toEqual([]);
    expect(indexRowsForResource('assignment', { classroomId: 'c1', coTeacherEmails: ['', '  ', 42] })).toEqual([]);
    // id が無い行はキーを作れない（索引に入れても引けない）。
    expect(indexRowsForResource('group', { coTeacherEmails: ['a@example.com'] })).toEqual([]);
  });

  test('アーカイブ済みの資源も索引に載せる', () => {
    // アーカイブ一覧 (?includeArchived=1) からも共同管理者に見えるべきで、
    // 落とすのは TTL（索引行は資源の ttl を写す）に任せる。
    expect(indexRowsForResource('assignment', {
      classroomId: 'c1', status: 'archived', coTeacherEmails: ['a@example.com'],
    })).toHaveLength(1);
  });

  test('同じ email が重複していても 1 行だけ作る', () => {
    expect(indexRowsForResource('assignment', {
      classroomId: 'c1', coTeacherEmails: ['a@example.com', 'A@EXAMPLE.COM'],
    })).toHaveLength(1);
  });
});

describe('chunkIndexWrites', () => {
  test('25 件ずつに割る', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      coTeacherEmail: `t${i}@example.com`, resourceKey: 'assignment#c1',
      resourceType: 'assignment' as const, resourceId: 'c1',
    }));
    expect(chunkIndexWrites(rows).map(c => c.length)).toEqual([25, 25, 10]);
    expect(BATCH_WRITE_LIMIT).toBe(25);
  });

  test('同一キーの重複は落とす（BatchWrite が ValidationException を返すため）', () => {
    const row = {
      coTeacherEmail: 'a@example.com', resourceKey: 'assignment#c1',
      resourceType: 'assignment' as const, resourceId: 'c1',
    };
    expect(chunkIndexWrites([row, { ...row }])).toEqual([[row]]);
  });

  test('同じ email でも課題と組は別キーなので両方残す', () => {
    const chunks = chunkIndexWrites([
      { coTeacherEmail: 'a@example.com', resourceKey: 'assignment#c1', resourceType: 'assignment', resourceId: 'c1' },
      { coTeacherEmail: 'a@example.com', resourceKey: 'group#g1', resourceType: 'group', resourceId: 'g1' },
    ]);
    expect(chunks[0]).toHaveLength(2);
  });
});

describe('parseBackfillArgs / resourceNamesForStage', () => {
  test('既定は dry-run', () => {
    expect(parseBackfillArgs([])).toEqual({ apply: false });
    expect(parseBackfillArgs(['--apply'])).toEqual({ apply: true });
  });

  test('索引テーブル名は prod だけ無印', () => {
    expect(resourceNamesForStage('prod').coTeacherIndexTable).toBe('ClassroomCoTeacherIndex');
    expect(resourceNamesForStage('stg').coTeacherIndexTable).toBe('ClassroomCoTeacherIndex-stg');
  });

  test('email の正規化は handler 側と同じ（読み書きでキーが揃う必要がある）', () => {
    expect(normalizeIndexEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com');
  });
});
