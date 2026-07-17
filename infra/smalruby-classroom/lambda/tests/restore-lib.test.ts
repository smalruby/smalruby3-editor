/**
 * Restore CLI planning tests (issue #1054).
 */
import {
  buildRestorePlan,
  matchClassroomSnapshot,
  parseRestoreArgs,
  resourceNamesForStage,
  type Snapshot,
} from '../restore-lib';

describe('parseRestoreArgs', () => {
  test('parses a full invocation and defaults to dry-run', () => {
    expect(parseRestoreArgs(['--classroom-id', 'c1'])).toEqual({
      classroomId: 'c1',
      joinCode: null,
      className: null,
      apply: false,
      ttlDays: 90,
      groupTtlDays: 400,
    });
  });

  test('lowercases join codes and honors --apply / --ttl-days', () => {
    const args = parseRestoreArgs(['--join-code', 'ABC234', '--apply', '--ttl-days', '30']);
    expect(args.joinCode).toBe('abc234');
    expect(args.apply).toBe(true);
    expect(args.ttlDays).toBe(30);
  });

  test('rejects unknown flags, missing targets, and bad TTLs', () => {
    expect(() => parseRestoreArgs(['--oops'])).toThrow('Unknown flag');
    expect(() => parseRestoreArgs([])).toThrow('Specify a target');
    expect(() => parseRestoreArgs(['--classroom-id', 'c1', '--ttl-days', '0'])).toThrow('positive integer');
    expect(() => parseRestoreArgs(['--classroom-id', 'c1', '--ttl-days', 'x'])).toThrow('positive integer');
  });
});

describe('matchClassroomSnapshot', () => {
  const snapshot = (item: Record<string, unknown>): Snapshot => ({
    table: 'classrooms',
    deletedAt: null,
    eventId: null,
    item,
  });

  test('matches by exact classroomId', () => {
    const target = { classroomId: 'c1', joinCode: null, className: null };
    expect(matchClassroomSnapshot(snapshot({ classroomId: 'c1' }), target)).toBe(true);
    expect(matchClassroomSnapshot(snapshot({ classroomId: 'c2' }), target)).toBe(false);
  });

  test('matches join codes case-insensitively', () => {
    const target = { classroomId: null, joinCode: 'abc234', className: null };
    expect(matchClassroomSnapshot(snapshot({ joinCode: 'abc234' }), target)).toBe(true);
    expect(matchClassroomSnapshot(snapshot({ joinCode: 'ABC234' }), target)).toBe(true);
    expect(matchClassroomSnapshot(snapshot({ joinCode: 'zzz999' }), target)).toBe(false);
  });

  test('matches class names by substring', () => {
    const target = { classroomId: null, joinCode: null, className: '2年1組' };
    expect(matchClassroomSnapshot(snapshot({ className: '技術 2年1組' }), target)).toBe(true);
    expect(matchClassroomSnapshot(snapshot({ className: '2年2組' }), target)).toBe(false);
  });
});

describe('buildRestorePlan', () => {
  const NOW = new Date('2026-07-17T00:00:00.000Z').getTime();
  const DAY = 24 * 60 * 60;

  test('re-stamps TTLs from now and reactivates the classroom', () => {
    const plan = buildRestorePlan(
      {
        classroom: { classroomId: 'c1', status: 'archived', ttl: 123 },
        memberships: [{ classroomId: 'c1', memberId: 'seat-01', ttl: 123 }],
        submissions: [{ classroomId: 'c1', submissionId: 's1', ttl: 123 }],
      },
      NOW,
      90,
      400,
    );

    expect(plan.map((p) => p.table)).toEqual(['classrooms', 'memberships', 'submissions']);
    const classroom = plan[0].item;
    expect(classroom.status).toBe('active');
    expect(classroom.restoredAt).toBe('2026-07-17T00:00:00.000Z');
    expect(classroom.ttl).toBe(Math.floor(NOW / 1000) + 90 * DAY);
    expect(plan[1].item.ttl).toBe(Math.floor(NOW / 1000) + 90 * DAY);
  });

  test('restores the group first with its own (longer) TTL', () => {
    const plan = buildRestorePlan(
      {
        classroom: { classroomId: 'c1', groupId: 'g1' },
        memberships: [],
        submissions: [],
        group: { groupId: 'g1', status: 'archived' },
      },
      NOW,
      90,
      400,
    );

    expect(plan[0].table).toBe('groups');
    expect(plan[0].item.status).toBe('active');
    expect(plan[0].item.ttl).toBe(Math.floor(NOW / 1000) + 400 * DAY);
  });
});

describe('resourceNamesForStage', () => {
  test('prod has no suffix; other stages are suffixed', () => {
    expect(resourceNamesForStage('prod').classroomsTable).toBe('Classrooms');
    expect(resourceNamesForStage('prod').bucket).toBe('smalruby-classroom-submissions');
    expect(resourceNamesForStage('stg').classroomsTable).toBe('Classrooms-stg');
    expect(resourceNamesForStage('stg').groupsTable).toBe('ClassroomGroups-stg');
  });
});
