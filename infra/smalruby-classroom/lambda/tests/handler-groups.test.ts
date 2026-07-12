import {
  validateGroupName,
  validateGroupYear,
  selectPriorClassrooms,
  buildDuplicatedAssignment,
  topicToEnsureForDuplicate,
} from '../handler';

describe('validateGroupName', () => {
  test('accepts and trims a normal name', () => {
    expect(validateGroupName(' 2年1組 ')).toBe('2年1組');
  });

  test('rejects empty / non-string names', () => {
    expect(() => validateGroupName('')).toThrow('Group name is required');
    expect(() => validateGroupName('   ')).toThrow('Group name is required');
    expect(() => validateGroupName(42)).toThrow('Group name is required');
  });

  test('rejects names over 50 characters', () => {
    expect(() => validateGroupName('あ'.repeat(51))).toThrow('50 characters or less');
    expect(validateGroupName('あ'.repeat(50))).toHaveLength(50);
  });
});

describe('validateGroupYear', () => {
  test('accepts a plausible year (number or numeric string)', () => {
    expect(validateGroupYear(2026)).toBe(2026);
    expect(validateGroupYear('2026')).toBe(2026);
  });

  test('rejects out-of-range or non-numeric years', () => {
    expect(() => validateGroupYear(1999)).toThrow('between 2000 and 2100');
    expect(() => validateGroupYear(2101)).toThrow('between 2000 and 2100');
    expect(() => validateGroupYear('next year')).toThrow('between 2000 and 2100');
  });
});

describe('selectPriorClassrooms', () => {
  const items = [
    { classroomId: 'c1', groupId: 'g1', status: 'active', createdAt: '2026-04-01T00:00:00Z' },
    { classroomId: 'c2', groupId: 'g1', status: 'active', createdAt: '2026-05-01T00:00:00Z' },
    { classroomId: 'c3', groupId: 'g1', status: 'archived', createdAt: '2026-06-01T00:00:00Z' },
    { classroomId: 'c4', groupId: 'g2', status: 'active', createdAt: '2026-07-01T00:00:00Z' },
    { classroomId: 'c5', groupId: 'g1', status: 'active', createdAt: '2026-07-01T00:00:00Z' },
  ];

  test('filters to the same active group, excludes self, newest first', () => {
    const prior = selectPriorClassrooms(items, 'g1', 'c5');
    expect(prior.map((c) => c.classroomId)).toEqual(['c2', 'c1']);
  });

  test('caps to the lookback limit', () => {
    const prior = selectPriorClassrooms(items, 'g1', 'none', 1);
    expect(prior.map((c) => c.classroomId)).toEqual(['c5']);
  });

  test('returns [] when the group has no other lessons', () => {
    expect(selectPriorClassrooms(items, 'g2', 'c4')).toEqual([]);
  });
});

describe('buildDuplicatedAssignment', () => {
  test('returns undefined assignment and no copies when the source has none', () => {
    expect(buildDuplicatedAssignment(undefined, 'src', 'dst')).toEqual({ assignment: undefined, copies: [] });
    expect(buildDuplicatedAssignment({ pages: [] }, 'src', 'dst')).toEqual({ assignment: undefined, copies: [] });
  });

  test('rewrites image and starter keys to the new classroom prefix', () => {
    const source = {
      pages: [
        { text: 'p1' },
        { text: 'p2', imageKey: 'src/assignment/image-abc.png' },
      ],
      starterKey: 'src/assignment/starter-def.sb3',
      updatedAt: '2026-07-01T00:00:00Z',
    };
    const { assignment, copies } = buildDuplicatedAssignment(source, 'src', 'dst');
    expect(assignment?.pages).toEqual([
      { text: 'p1' },
      { text: 'p2', imageKey: 'dst/assignment/image-abc.png' },
    ]);
    expect(assignment?.starterKey).toBe('dst/assignment/starter-def.sb3');
    expect(copies).toEqual([
      { from: 'src/assignment/image-abc.png', to: 'dst/assignment/image-abc.png' },
      { from: 'src/assignment/starter-def.sb3', to: 'dst/assignment/starter-def.sb3' },
    ]);
  });

  test('pages-only assignment duplicates without a starter', () => {
    const { assignment, copies } = buildDuplicatedAssignment({ pages: [{ text: 'p' }] }, 'src', 'dst');
    expect(assignment?.pages).toEqual([{ text: 'p' }]);
    expect(assignment?.starterKey).toBeUndefined();
    expect(copies).toEqual([]);
  });
});

describe('topicToEnsureForDuplicate', () => {
  test('returns the source topic when the copy is filed under a target group', () => {
    // Reuse into a group that may not list this topic yet — the duplicate
    // must register it so the assignment lands in a visible section.
    expect(topicToEnsureForDuplicate({ topic: 'ループ' }, 'g1')).toBe('ループ');
  });

  test('returns undefined when the duplicate has no target group', () => {
    // Ungrouped duplicate: no class to register the topic on.
    expect(topicToEnsureForDuplicate({ topic: 'ループ' }, undefined)).toBeUndefined();
    expect(topicToEnsureForDuplicate({ topic: 'ループ' }, '')).toBeUndefined();
  });

  test('returns undefined when the source carries no usable topic', () => {
    expect(topicToEnsureForDuplicate({}, 'g1')).toBeUndefined();
    expect(topicToEnsureForDuplicate({ topic: '' }, 'g1')).toBeUndefined();
    expect(topicToEnsureForDuplicate({ topic: 42 as unknown as string }, 'g1')).toBeUndefined();
  });
});
