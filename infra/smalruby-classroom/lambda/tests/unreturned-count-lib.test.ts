import {
  countUnreturnedSubmissions,
  hasUnreturnedSubmission,
  isSeatOccupied,
  needsUnreturnedBackfill,
  needsUnreturnedVerify,
  parseUnreturnedBackfillArgs,
  unreturnedCountOf,
  unreturnedDeltaOnOccupancy,
  unreturnedDeltaOnSubmit,
  unreturnedDeltaOnUpdate,
} from '../unreturned-count-lib';

/**
 * 課題ごとの「返却していない提出の数」の数え方と増減 (issue #1972)。
 * 数え方は GUI の課題ボード（`enrichMembers` + `summarizeAssignmentRow`）と同じ:
 * 席ごとにいちばん新しい提出・返却していないもの・退室した席は数えない。
 */
describe('countUnreturnedSubmissions', () => {
  test('席ごとにいちばん新しい提出だけを見て、返却していないものを数える', () => {
    expect(countUnreturnedSubmissions([
      { memberId: 'seat-01', status: 'returned', submittedAt: '2026-11-01T00:00:00Z' },
      { memberId: 'seat-01', status: 'submitted', submittedAt: '2026-11-02T00:00:00Z' },
      { memberId: 'seat-02', status: 'submitted', submittedAt: '2026-11-01T00:00:00Z' },
      { memberId: 'seat-02', status: 'returned', submittedAt: '2026-11-03T00:00:00Z' },
      { memberId: 'seat-03', status: 'submitted', submittedAt: '2026-11-01T00:00:00Z' },
    ])).toBe(2);
  });

  test('memberId の無い行は数えない', () => {
    expect(countUnreturnedSubmissions([{ status: 'submitted' }])).toBe(0);
  });

  test('在席の席を渡すと、退室した席の提出は数えない', () => {
    const subs = [
      { memberId: 'seat-01', status: 'submitted', submittedAt: 'a' },
      { memberId: 'seat-02', status: 'submitted', submittedAt: 'a' },
    ];
    expect(countUnreturnedSubmissions(subs, new Set(['seat-01']))).toBe(1);
    expect(countUnreturnedSubmissions(subs)).toBe(2);
  });

  test('hasUnreturnedSubmission はその席のいちばん新しい提出で決まる', () => {
    expect(hasUnreturnedSubmission([])).toBe(false);
    expect(hasUnreturnedSubmission([{ memberId: 'seat-01', status: 'submitted' }])).toBe(true);
    expect(hasUnreturnedSubmission([{ memberId: 'seat-01', status: 'returned' }])).toBe(false);
  });
});

describe('isSeatOccupied', () => {
  test('行があり kicked でなければ在席', () => {
    expect(isSeatOccupied({ memberId: 'seat-01' })).toBe(true);
    expect(isSeatOccupied({ memberId: 'seat-01', kicked: true })).toBe(false);
    expect(isSeatOccupied(undefined)).toBe(false);
    expect(isSeatOccupied(null)).toBe(false);
  });
});

describe('増減', () => {
  test('提出: 前が無い・前が返却済みなら +1、前が返却していないものなら 0', () => {
    expect(unreturnedDeltaOnSubmit(null)).toBe(1);
    expect(unreturnedDeltaOnSubmit({ status: 'returned' })).toBe(1);
    expect(unreturnedDeltaOnSubmit({ status: 'submitted' })).toBe(0);
  });

  test('返却: 在席の席の返却していないものを返却したときだけ -1', () => {
    expect(unreturnedDeltaOnUpdate('submitted', 'returned', true)).toBe(-1);
    expect(unreturnedDeltaOnUpdate('returned', 'returned', true)).toBe(0);
    expect(unreturnedDeltaOnUpdate('submitted', undefined, true)).toBe(0);
    expect(unreturnedDeltaOnUpdate('submitted', 'returned', false)).toBe(0);
  });

  test('在・不在: 返却していない提出がある席だけ動く', () => {
    expect(unreturnedDeltaOnOccupancy(true, false, true)).toBe(-1);
    expect(unreturnedDeltaOnOccupancy(false, true, true)).toBe(1);
    expect(unreturnedDeltaOnOccupancy(true, true, true)).toBe(0);
    expect(unreturnedDeltaOnOccupancy(true, false, false)).toBe(0);
  });
});

describe('unreturnedCountOf', () => {
  test('数を持っていない課題は undefined、負の数は 0 にする', () => {
    expect(unreturnedCountOf({})).toBeUndefined();
    expect(unreturnedCountOf({ unreturnedCount: '3' })).toBeUndefined();
    expect(unreturnedCountOf({ unreturnedCount: 3 })).toBe(3);
    expect(unreturnedCountOf({ unreturnedCount: -1 })).toBe(0);
  });
});

describe('バックフィル', () => {
  test('引数', () => {
    expect(parseUnreturnedBackfillArgs([])).toEqual({ apply: false, recount: false, verify: false });
    expect(parseUnreturnedBackfillArgs(['--apply', '--recount'])).toEqual({ apply: true, recount: true, verify: false });
    expect(parseUnreturnedBackfillArgs(['--verify'])).toEqual({ apply: false, recount: false, verify: true });
    expect(() => parseUnreturnedBackfillArgs(['--verify', '--apply'])).toThrow();
    expect(() => parseUnreturnedBackfillArgs(['--force'])).toThrow();
  });

  test('既定では数を持っていない active / archived の課題だけを埋める', () => {
    expect(needsUnreturnedBackfill({ classroomId: 'c', status: 'active' }, false)).toBe(true);
    expect(needsUnreturnedBackfill({ classroomId: 'c', status: 'archived' }, false)).toBe(true);
    expect(needsUnreturnedBackfill({ classroomId: 'c', status: 'deleted' }, false)).toBe(false);
    expect(needsUnreturnedBackfill({ classroomId: 'c', status: 'active', unreturnedCount: 2 }, false)).toBe(false);
    expect(needsUnreturnedBackfill({ classroomId: 'c', status: 'active', unreturnedCount: 2 }, true)).toBe(true);
  });

  test('--verify は数を持っている active / archived の課題だけを確かめる', () => {
    expect(needsUnreturnedVerify({ classroomId: 'c', status: 'active', unreturnedCount: 0 })).toBe(true);
    expect(needsUnreturnedVerify({ classroomId: 'c', status: 'active' })).toBe(false);
    expect(needsUnreturnedVerify({ classroomId: 'c', status: 'deleted', unreturnedCount: 1 })).toBe(false);
  });
});
