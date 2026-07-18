/**
 * Restore-plan tests (EPIC #1073 S4 #1084). Mirrors the classroom
 * restore-lib tests — the planning logic is deliberately duplicated
 * (independent infra projects), so the behavior is pinned here too.
 */
import { buildRestorePlan, matchSnapshot, Snapshot } from '../restore-plan';

const NOW = Date.parse('2026-07-18T00:00:00.000Z');
const DAY = 24 * 60 * 60;

const classroom = {
  classroomId: 'c1',
  className: '5年1組',
  assignmentName: 'ねこあつめ',
  joinCode: 'ABC123',
  status: 'archived',
  ttl: 100, // stale — must be replaced
};

describe('buildRestorePlan (issue #1084)', () => {
  test('rehydrates with fresh TTLs, active status and a restoredAt stamp', () => {
    const plan = buildRestorePlan({
      classroom,
      memberships: [{ classroomId: 'c1', memberId: 'seat-01', ttl: 100 }],
      submissions: [{ classroomId: 'c1', submissionId: 's1', ttl: 100 }],
    }, NOW);

    expect(plan.map(p => p.table)).toEqual(['classrooms', 'memberships', 'submissions']);
    const nowSeconds = Math.floor(NOW / 1000);
    expect(plan[0].item.ttl).toBe(nowSeconds + 90 * DAY);
    expect(plan[0].item.status).toBe('active');
    expect(plan[0].item.restoredAt).toBe('2026-07-18T00:00:00.000Z');
    expect(plan[1].item.ttl).toBe(nowSeconds + 90 * DAY);
    expect(plan[2].item.ttl).toBe(nowSeconds + 90 * DAY);
  });

  test('a swept group is restored first so the classroom never dangles', () => {
    const plan = buildRestorePlan({
      classroom,
      memberships: [],
      submissions: [],
      group: { groupId: 'g1', status: 'archived', ttl: 100 },
    }, NOW);

    expect(plan.map(p => p.table)).toEqual(['groups', 'classrooms']);
    expect(plan[0].item.status).toBe('active');
    // Groups live on a school-year scale (400 days), not the classroom's 90.
    expect(plan[0].item.ttl).toBe(Math.floor(NOW / 1000) + 400 * DAY);
  });
});

describe('matchSnapshot (issue #1084)', () => {
  const snapshot: Snapshot = { table: 'classrooms', deletedAt: null, eventId: null, item: classroom };

  test('matches the join code exactly, case-insensitively', () => {
    expect(matchSnapshot(snapshot, 'abc123')).toBe(true);
    expect(matchSnapshot(snapshot, 'ABC12')).toBe(false); // no partial join codes
  });

  test('matches class/assignment names by substring', () => {
    expect(matchSnapshot(snapshot, '5年')).toBe(true);
    expect(matchSnapshot(snapshot, 'ねこ')).toBe(true);
    expect(matchSnapshot(snapshot, '6年')).toBe(false);
  });

  test('an empty query never matches (guards accidental full listing)', () => {
    expect(matchSnapshot(snapshot, '')).toBe(false);
    expect(matchSnapshot(snapshot, '   ')).toBe(false);
  });
});
