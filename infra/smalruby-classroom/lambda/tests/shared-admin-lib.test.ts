/**
 * Moderation CLI planning tests (issue #1071).
 */
import {
  groupReports,
  parseAdminArgs,
  renderReportQueue,
  renderSharedItem,
} from '../shared-admin-lib';

describe('parseAdminArgs', () => {
  test('parses the four commands, dry-run by default', () => {
    expect(parseAdminArgs(['list-reports'])).toEqual({ command: 'list-reports', sharedId: null, apply: false });
    expect(parseAdminArgs(['show', 's1'])).toEqual({ command: 'show', sharedId: 's1', apply: false });
    expect(parseAdminArgs(['unpublish', 's1', '--apply'])).toEqual({
      command: 'unpublish', sharedId: 's1', apply: true,
    });
    expect(parseAdminArgs(['republish', 's1'])).toEqual({ command: 'republish', sharedId: 's1', apply: false });
  });

  test('rejects unknown commands, unknown flags and missing ids', () => {
    expect(() => parseAdminArgs(['delete', 's1'])).toThrow('Usage');
    expect(() => parseAdminArgs(['unpublish'])).toThrow('requires a sharedId');
    expect(() => parseAdminArgs(['show', 's1', '--force'])).toThrow('Unknown argument');
  });
});

describe('groupReports', () => {
  test('groups by sharedId, most-reported first, newest report first inside', () => {
    const grouped = groupReports([
      { sharedId: 'a', reason: 'r1', createdAt: '2026-07-18T01:00:00Z' },
      { sharedId: 'b', reason: 'r2', createdAt: '2026-07-18T02:00:00Z' },
      { sharedId: 'b', reason: 'r3', createdAt: '2026-07-18T03:00:00Z' },
    ]);
    expect([...grouped.keys()]).toEqual(['b', 'a']);
    expect(grouped.get('b')!.map((r) => r.reason)).toEqual(['r3', 'r2']);
  });
});

describe('renderReportQueue', () => {
  test('shows title/status per reported item and never the reporter', () => {
    const grouped = groupReports([
      { sharedId: 's1', reason: '不適切', createdAt: '2026-07-18T00:00:00Z' },
    ]);
    const lines = renderReportQueue(grouped, new Map([
      ['s1', { title: 'ねこあつめ', status: 'published' }],
    ]));
    expect(lines[0]).toContain('ねこあつめ');
    expect(lines[0]).toContain('status=published');
    expect(lines[1]).toContain('不適切');
    expect(lines.join('\n')).not.toContain('reporterSub');
  });

  test('handles an empty queue and deleted items', () => {
    expect(renderReportQueue(new Map(), new Map())).toEqual(['通報はありません。']);
    const grouped = groupReports([{ sharedId: 'gone', reason: 'x', createdAt: '' }]);
    expect(renderReportQueue(grouped, new Map())[0]).toContain('(削除済み/不明)');
  });
});

describe('renderSharedItem', () => {
  test('renders the public fields and truncated page texts', () => {
    const lines = renderSharedItem({
      sharedId: 's1',
      title: 'ねこあつめ',
      status: 'published',
      authorName: 'るびお',
      authorAffiliation: '島根県',
      schoolLevel: 'junior-high',
      subject: '技術・家庭（技術分野）',
      grades: [1, 2],
      tags: ['甲子園'],
      supplementUrl: 'https://example.com',
      reuseCount: 3,
      createdAt: 'c',
      updatedAt: 'u',
      content: { pages: [{ text: 'ページ1\n続き' }], starterKey: 'shared/s1/starter.sb3' },
    });
    const text = lines.join('\n');
    expect(text).toContain('るびお（島根県）');
    expect(text).toContain('学年 1・2');
    expect(text).toContain('starter:    あり');
    expect(text).toContain('1. ページ1 / 続き');
  });
});
