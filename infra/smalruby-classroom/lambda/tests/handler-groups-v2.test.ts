import {
  validateTopicName,
  validateSortDate,
  schoolYearFromIso,
  planGroupMigration,
} from '../handler';

describe('validateTopicName', () => {
  test('accepts and trims a normal topic', () => {
    expect(validateTopicName(' 計測と制御 ')).toBe('計測と制御');
  });

  test('rejects empty / non-string topics', () => {
    expect(() => validateTopicName('')).toThrow('Topic name is required');
    expect(() => validateTopicName(null)).toThrow('Topic name is required');
  });

  test('rejects topics over 50 characters', () => {
    expect(() => validateTopicName('あ'.repeat(51))).toThrow('50 characters or less');
  });
});

describe('validateSortDate', () => {
  test('normalizes a parseable date to ISO 8601', () => {
    expect(validateSortDate('2026-07-12')).toBe('2026-07-12T00:00:00.000Z');
    expect(validateSortDate('2026-07-12T10:00:00+09:00')).toBe('2026-07-12T01:00:00.000Z');
  });

  test('rejects non-dates', () => {
    expect(() => validateSortDate('not a date')).toThrow('ISO 8601');
    expect(() => validateSortDate(12345)).toThrow('ISO 8601');
  });
});

describe('schoolYearFromIso', () => {
  test('April and later belong to the current year', () => {
    expect(schoolYearFromIso('2026-04-01T00:00:00+09:00')).toBe(2026);
    expect(schoolYearFromIso('2026-12-25T00:00:00+09:00')).toBe(2026);
  });

  test('January to March belong to the previous school year', () => {
    expect(schoolYearFromIso('2026-01-15T00:00:00+09:00')).toBe(2025);
    expect(schoolYearFromIso('2026-03-31T23:59:59+09:00')).toBe(2025);
  });

  test('evaluates the April boundary in JST, not UTC', () => {
    // 2026-03-31T15:30:00Z is already 2026-04-01 00:30 in JST.
    expect(schoolYearFromIso('2026-03-31T15:30:00Z')).toBe(2026);
    // 2026-03-31T14:30:00Z is still 2026-03-31 23:30 in JST.
    expect(schoolYearFromIso('2026-03-31T14:30:00Z')).toBe(2025);
  });
});

describe('planGroupMigration', () => {
  const classroom = (over: Record<string, unknown>): Record<string, unknown> => ({
    classroomId: 'c1',
    className: '2年1組',
    status: 'active',
    createdAt: '2026-05-01T00:00:00Z',
    studentCount: 30,
    ...over,
  });

  test('creates one class per className and assigns ungrouped assignments to it', () => {
    const plan = planGroupMigration([
      classroom({ classroomId: 'c1' }),
      classroom({ classroomId: 'c2', createdAt: '2026-06-01T00:00:00Z' }),
      classroom({ classroomId: 'c3', className: '2年2組' }),
    ], []);

    expect(plan.createGroups).toEqual([
      { key: 'new:2年1組:2026', name: '2年1組', year: 2026 },
      { key: 'new:2年2組:2026', name: '2年2組', year: 2026 },
    ]);
    expect(plan.assignments).toEqual([
      { classroomId: 'c1', groupKey: 'new:2年1組:2026' },
      { classroomId: 'c2', groupKey: 'new:2年1組:2026' },
      { classroomId: 'c3', groupKey: 'new:2年2組:2026' },
    ]);
  });

  test('estimates the school year from the assignment creation date', () => {
    const plan = planGroupMigration([
      classroom({ classroomId: 'c1', createdAt: '2026-02-01T00:00:00+09:00' }),
    ], []);
    expect(plan.createGroups).toEqual([{ key: 'new:2年1組:2025', name: '2年1組', year: 2025 }]);
  });

  test('reuses an existing class with the same name instead of creating a duplicate', () => {
    const plan = planGroupMigration([
      classroom({ classroomId: 'c1' }),
    ], [
      { groupId: 'g1', name: '2年1組', year: 2026, status: 'active', schemaVersion: 2 },
    ]);
    expect(plan.createGroups).toEqual([]);
    expect(plan.assignments).toEqual([{ classroomId: 'c1', groupKey: 'g1' }]);
  });

  test('ignores archived assignments', () => {
    const plan = planGroupMigration([
      classroom({ classroomId: 'c1', status: 'archived' }),
    ], []);
    expect(plan.createGroups).toEqual([]);
    expect(plan.assignments).toEqual([]);
  });

  test('lifts GC courseId (earliest), co-teacher union, and max studentCount to the class', () => {
    const plan = planGroupMigration([
      classroom({
        classroomId: 'c1',
        groupId: 'g1',
        createdAt: '2026-05-01T00:00:00Z',
        googleClassroomCourseId: 'course-early',
        coTeacherEmails: ['a@example.com'],
        studentCount: 28,
      }),
      classroom({
        classroomId: 'c2',
        groupId: 'g1',
        createdAt: '2026-06-01T00:00:00Z',
        googleClassroomCourseId: 'course-late',
        coTeacherEmails: ['b@example.com'],
        studentCount: 32,
      }),
    ], [
      { groupId: 'g1', name: '2年1組', year: 2026, status: 'active' },
    ]);

    expect(plan.groupUpdates).toEqual([{
      groupKey: 'g1',
      set: {
        schemaVersion: 2,
        googleClassroomCourseId: 'course-early',
        coTeacherEmails: ['a@example.com', 'b@example.com'],
        studentCount: 32,
      },
    }]);
  });

  test('never overwrites an existing class-level GC courseId', () => {
    const plan = planGroupMigration([
      classroom({ classroomId: 'c1', groupId: 'g1', googleClassroomCourseId: 'from-assignment' }),
    ], [
      { groupId: 'g1', name: '2年1組', year: 2026, status: 'active', schemaVersion: 2, googleClassroomCourseId: 'class-own', studentCount: 30 },
    ]);
    expect(plan.groupUpdates).toEqual([]);
  });

  test('is idempotent: a second run over migrated data produces an empty plan', () => {
    const first = planGroupMigration([classroom({ classroomId: 'c1' })], []);
    expect(first.createGroups).toHaveLength(1);

    // Simulate the executed plan: assignment adopted, class created + lifted.
    const migratedClassrooms = [classroom({ classroomId: 'c1', groupId: 'g1' })];
    const migratedGroups = [{
      groupId: 'g1', name: '2年1組', year: 2026, status: 'active',
      schemaVersion: 2, topics: [], studentCount: 30,
    }];
    const second = planGroupMigration(migratedClassrooms, migratedGroups);
    expect(second).toEqual({ createGroups: [], assignments: [], groupUpdates: [] });
  });
});

import { validateSection } from '../handler';

describe('validateSection', () => {
    test('accepts and trims a section, clears on empty/null', () => {
        expect(validateSection(' 2年1組 ')).toBe('2年1組');
        expect(validateSection('')).toBeNull();
        expect(validateSection(null)).toBeNull();
        expect(validateSection('   ')).toBeNull();
    });

    test('rejects non-strings and over-long sections', () => {
        expect(() => validateSection(42)).toThrow('Section must be a string');
        expect(() => validateSection('あ'.repeat(51))).toThrow('50 characters or less');
    });
});
