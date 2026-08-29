import {
  buildOverview, buildRestoreFacets, isRealClassroom, richness, tokenizeTitle,
} from '../classroom-overview';

const NOW = Date.parse('2026-07-19T00:00:00.000Z');

const rows = [
  // rich + recent + unshared → top candidate
  {
    classroomId: 'c1', className: '5年1組', assignmentName: 'ねこ迷路ゲーム', teacherSub: 't1',
    status: 'active', createdAt: '2026-07-10T00:00:00.000Z',
    assignment: { pages: [{ text: 'a', imageKey: 'k1' }, { text: 'b' }], starterKey: 's1' },
    recommendedForSharingAt: '2026-07-15T00:00:00.000Z',
  },
  // rich but already shared
  {
    classroomId: 'c2', className: '6年2組', assignmentName: 'ねこあつめ入門', teacherSub: 't2',
    status: 'archived', createdAt: '2026-06-05T00:00:00.000Z',
    assignment: { pages: [{ text: 'a', imageKey: 'k' }, { text: 'b' }], starterKey: 's' },
  },
  // thin content → not a candidate
  {
    classroomId: 'c3', className: '5年1組', assignmentName: 'ねこ体操', teacherSub: 't1',
    status: 'active', createdAt: '2026-07-01T00:00:00.000Z',
    assignment: { pages: [{ text: 'a' }] },
  },
  // quota row → excluded from everything
  { classroomId: 'eval-quota#t1#2026-07-19', status: 'active', createdAt: '2026-07-19T00:00:00.000Z' },
];

describe('richness / tokenizeTitle / isRealClassroom', () => {
  test('richness scores pages, images and starter', () => {
    expect(richness(rows[0]).score).toBe(4); // >=2 pages(2) + image(1) + starter(1)
    expect(richness(rows[2]).score).toBe(1); // 1 page only
    expect(richness({}).score).toBe(0);
  });

  test('tokenizeTitle drops short tokens and pure numbers', () => {
    const t = tokenizeTitle('ねこ迷路ゲーム 2026');
    expect(t).toContain('ねこ迷路ゲーム');
    expect(t).not.toContain('2026');
  });

  test('quota rows are not real classrooms', () => {
    expect(isRealClassroom(rows[3])).toBe(false);
    expect(isRealClassroom(rows[0])).toBe(true);
  });
});

describe('buildOverview (issue #1106 dashboard)', () => {
  const o = buildOverview(rows, ['ねこあつめ入門'], NOW);

  test('summary counts exclude quota rows and split active/archived', () => {
    expect(o.summary.total).toBe(3);
    expect(o.summary.active).toBe(2);
    expect(o.summary.archived).toBe(1);
    expect(o.summary.recent30d).toBe(2); // c1 and c3 within 30d of NOW
  });

  test('creation trend is per-month, ascending', () => {
    expect(o.creationTrend).toEqual([
      { month: '2026-06', count: 1 },
      { month: '2026-07', count: 2 },
    ]);
  });

  test('richness distribution covers scores 0-4', () => {
    expect(o.richnessDistribution).toHaveLength(5);
    expect(o.richnessDistribution.find(d => d.score === 4)?.count).toBe(2);
  });

  test('candidates: unshared rich ones first, shared flagged, thin excluded', () => {
    expect(o.candidates.map(c => c.classroomId)).toEqual(['c1', 'c2']);
    expect(o.candidates[0].likelyShared).toBe(false);
    expect(o.candidates[1].likelyShared).toBe(true); // ねこあつめ入門 already shared
    expect(o.candidates.some(c => c.classroomId === 'c3')).toBe(false);
  });

  test('候補に共有推奨フラグが載る (#1106)', () => {
    expect(o.candidates.find(c => c.classroomId === 'c1')?.recommendedForSharing).toBe(true);
    expect(o.candidates.find(c => c.classroomId === 'c2')?.recommendedForSharing).toBe(false);
  });

  test('classroom item の実フィールド名は assignment（content だと richness が 0 になる回帰）', () => {
    expect(richness({ content: { pages: [{ text: 'a' }], starterKey: 's' } } as never).score).toBe(0);
  });

  test('theme keywords tally repeated tokens only', () => {
    // '5年1組' appears on c1 and c3
    expect(o.themeKeywords.some(k => k.keyword === '5年1組' && k.count === 2)).toBe(true);
  });
});

describe('buildRestoreFacets (issue #1084 restore facets)', () => {
  test('groups snapshots by deletion month and teacher', () => {
    const f = buildRestoreFacets([
      { deletedAt: '2026-07-10T00:00:00Z', teacherSub: 't1' },
      { deletedAt: '2026-07-11T00:00:00Z', teacherSub: 't1' },
      { deletedAt: '2026-06-01T00:00:00Z', teacherSub: 't2' },
      { deletedAt: null, teacherSub: '' },
    ]);
    expect(f.byMonth).toEqual([
      { month: '2026-07', count: 2 },
      { month: '2026-06', count: 1 },
      { month: '(不明)', count: 1 },
    ]);
    expect(f.byTeacher[0]).toEqual({ teacherSub: 't1', count: 2 });
  });
});
