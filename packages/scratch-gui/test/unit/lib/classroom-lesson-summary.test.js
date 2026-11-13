/* eslint-env jest */
/**
 * 先生の画面のレッスンの要約（#1603）: パネル・席の詳細・［授業］の行・採点・CSV の列。
 */
import { lessonCsvCells, lessonProgressContext } from '../../../src/lib/classroom-lesson-progress.js';
import {
    barWidths,
    elapsedMinutes,
    isSameLocalDay,
    lessonClearedCount,
    lessonScoresBySeat,
    mergedChallengeColumns,
    panelLessonSummary,
    seatChallengeDetails,
    submissionCsvRows,
} from '../../../src/lib/classroom-lesson-summary.js';

const course = {
    id: 'c',
    lessons: [
        { id: 'l1', challenges: [{ id: 'a' }, { id: 'b' }, { id: 'x' }] },
        { id: 'l2', challenges: [{ id: 'd' }, { id: 'e' }] },
    ],
};

// 4 つ選んで ★ 2（b・d）、条件は 3 つ。満点 100・必須 70 → 必須 35・必須でない 15
const lesson = {
    courseId: 'c',
    challengeIds: ['a', 'b', 'd', 'e'],
    requiredChallengeIds: ['b', 'd'],
    completion: { type: 'count', count: 3 },
    submitWork: false,
    scoring: null,
};

const NOW = Date.UTC(2026, 10, 15, 1, 30);
const minutesAgo = (m) => new Date(NOW - m * 60 * 1000).toISOString();
const done = (before = false) => ({ completedAt: minutesAgo(30), before });
const ctx = lessonProgressContext(lesson, course);

const members = [
    { memberId: 'seat-01', displayName: 'あ' },
    { memberId: 'seat-02', displayName: 'い' },
    { memberId: 'seat-03', displayName: 'う' },
    { memberId: 'seat-04', displayName: 'え', left: true },
];
const progressData = {
    lesson,
    progress: [
        // 止まっている（b に 12 分）
        {
            memberId: 'seat-01',
            seatNumber: 1,
            challenges: { a: done() },
            current: { challengeId: 'b', openedAt: minutesAgo(12) },
            updatedAt: minutesAgo(1),
        },
        // 課題クリア（発展の e に 15 分いても止まっていない）
        {
            memberId: 'seat-02',
            seatNumber: 2,
            challenges: { a: done(true), b: done(), d: done() },
            current: { challengeId: 'e', openedAt: minutesAgo(15) },
            updatedAt: minutesAgo(1),
        },
        // 退出した席の記録（パネルの数には入らない・横棒には入る）
        { memberId: 'seat-04', seatNumber: 4, challenges: { a: done() }, current: null, updatedAt: minutesAgo(1) },
    ],
};

describe('panelLessonSummary', () => {
    const summary = panelLessonSummary({ members, progressData, studentCount: 5, ctx, now: NOW });

    test('課題クリア・止まっている・参加の数（クリアした子は止まっていない）', () => {
        expect(summary.cleared).toBe(1);
        expect(summary.stuck).toBe(1);
        expect(summary.joined).toBe(3);
        expect(summary.tiles.map((t) => t.state)).toEqual([
            'inProgress',
            'cleared',
            'notStarted',
            'notJoined',
            'notJoined',
        ]);
    });

    test('チャレンジごとの横棒: できた人といまやっている人（進み具合タブと同じ行を数える）', () => {
        expect(summary.rowCount).toBe(4);
        expect(summary.bars.map((b) => [b.id, b.done, b.current, b.required])).toEqual([
            ['a', 3, 0, false],
            ['b', 1, 1, true],
            ['d', 1, 0, true],
            ['e', 0, 1, false],
        ]);
    });
});

describe('barWidths', () => {
    test('できた・いまやっているの幅（合わせて 100 まで）', () => {
        expect(barWidths({ done: 1, current: 1 }, 4)).toEqual({ done: 25, current: 25 });
        expect(barWidths({ done: 4, current: 1 }, 4)).toEqual({ done: 100, current: 0 });
        expect(barWidths({ done: 1, current: 1 }, 0)).toEqual({ done: 0, current: 0 });
    });
});

describe('seatChallengeDetails', () => {
    test('チャレンジごとに、できた時刻・前・いまやっている（経過）・まだ', () => {
        const { rows, progress } = seatChallengeDetails(progressData.progress[0], ctx, NOW);
        expect(progress.done).toBe(1);
        expect(rows.map((r) => [r.id, r.kind])).toEqual([
            ['a', 'done'],
            ['b', 'stuck'],
            ['d', 'todo'],
            ['e', 'todo'],
        ]);
        expect(rows[0].completedAt).toBe(minutesAgo(30));
        expect(rows[1].elapsedMs).toBe(12 * 60 * 1000);
        expect(rows[2].completedAt).toBeNull();
        expect(rows[1].required).toBe(true);
    });

    test('前からできたものは before・記録の無い席は全部まだ', () => {
        expect(seatChallengeDetails(progressData.progress[1], ctx, NOW).rows[0].kind).toBe('before');
        expect(seatChallengeDetails(null, ctx, NOW).rows.every((r) => r.kind === 'todo')).toBe(true);
    });

    test('最後の送信が 1 時間より前なら、いまやっているを出さない', () => {
        const row = { ...progressData.progress[0], updatedAt: minutesAgo(61) };
        expect(seatChallengeDetails(row, ctx, NOW).rows[1].kind).toBe('todo');
    });
});

describe('isSameLocalDay / elapsedMinutes', () => {
    test('同じ日か', () => {
        expect(isSameLocalDay(new Date(NOW).toISOString(), NOW)).toBe(true);
        expect(isSameLocalDay(new Date(NOW - 3 * 24 * 3600 * 1000).toISOString(), NOW)).toBe(false);
        expect(isSameLocalDay('nope', NOW)).toBe(false);
    });

    test('分は切り捨て', () => {
        expect(elapsedMinutes(12 * 60 * 1000 + 59 * 1000)).toBe(12);
        expect(elapsedMinutes(null)).toBe(0);
    });
});

describe('lessonClearedCount', () => {
    test('［授業］の行の課題クリア N', () => {
        expect(lessonClearedCount({ members, progressData, course, studentCount: 5, now: NOW })).toBe(1);
    });

    test('レッスンが無い・このスモウルビーに無いコースは null', () => {
        expect(lessonClearedCount({ members, progressData: null, course, studentCount: 5, now: NOW })).toBeNull();
        expect(lessonClearedCount({ members, progressData, course: null, studentCount: 5, now: NOW })).toBeNull();
    });
});

describe('lessonScoresBySeat', () => {
    test('記録のある席ごとのレッスンの点（前も入れる・必須が未達でもできた分）', () => {
        const result = lessonScoresBySeat(progressData, course, NOW);
        expect(result.total).toBe(100);
        expect(result.submitWork).toBe(false);
        // 条件 3・必須 2（#1778）: 必須 1 つ = 35、必須以外 1 つ = 30 ÷ (3 − 2) = 30
        // 席 1: a だけ = 30、席 2: a(前)+b+d = 30+35+35 = 100（課題クリアで満点）、席 4: a = 30
        expect(result.scores).toEqual({ 1: 30, 2: 100, 4: 30 });
    });

    test('先生が決めた満点', () => {
        const data = {
            ...progressData,
            lesson: { ...lesson, scoring: { total: 50, requiredPoints: 30, optionalPoints: 20 } },
        };
        const result = lessonScoresBySeat(data, course, NOW);
        expect(result.total).toBe(50);
        // 席 2: 20 + 15 + 15 = 50（必須以外 1 つ = (50 − 30) ÷ (3 − 2)）
        expect(result.scores[2]).toBe(50);
    });

    test('設定が無ければ null・無いコースは点なしで submitWork だけ伝える（作品の列を正しく出すため）', () => {
        expect(lessonScoresBySeat(null, course, NOW)).toBeNull();
        expect(lessonScoresBySeat(progressData, null, NOW)).toEqual({ total: null, submitWork: false, scores: {} });
    });
});

describe('CSV の列', () => {
    test('lessonCsvCells: 課題クリア・できた数・時刻か前・得点', () => {
        const cells = lessonCsvCells(progressData.progress[1], ctx, NOW);
        expect(cells.cleared).toBe('○');
        expect(cells.done).toBe(3);
        expect(cells.times.a).toBe('前');
        expect(cells.times.b).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
        expect(cells.times.e).toBe('');
        expect(cells.score).toBe(100);
    });

    test('mergedChallengeColumns: 課題をまたいで重ねずに並べる', () => {
        const other = lessonProgressContext(
            { ...lesson, challengeIds: ['b', 'x'], requiredChallengeIds: [] },
            course,
        );
        expect(mergedChallengeColumns([ctx, null, other]).map((c) => c.id)).toEqual(['a', 'b', 'd', 'e', 'x']);
    });
});

describe('submissionCsvRows', () => {
    test('メンバーごとにレッスンの列を付け、提出の無い退出した席の記録も行にする', () => {
        const rows = submissionCsvRows({
            assignmentName: 'L',
            members: members.slice(0, 3),
            progressData,
            ctx,
            now: NOW,
        });
        expect(rows.map((r) => [r.seat, r.status, r.lesson && r.lesson.score])).toEqual([
            ['01', '未提出', 30],
            ['02', '未提出', 100],
            ['03', '未提出', 0],
            ['04', '未提出', 30],
        ]);
    });

    test('レッスンの無い課題はメンバーの行だけ（レッスンの列は null）', () => {
        const rows = submissionCsvRows({ assignmentName: 'L', members, progressData: null, ctx: null, now: NOW });
        expect(rows).toHaveLength(4);
        expect(rows.every((r) => r.lesson === null)).toBe(true);
    });
});
