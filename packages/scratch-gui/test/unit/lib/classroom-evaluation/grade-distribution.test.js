/* eslint-env jest */
/**
 * 課題ごとの評価の分布 (#2457・EPIC #2438 の F5・F6)。
 */
import {
    GRADE_TARGETS,
    assignmentDistribution,
    gradeDistribution,
} from '../../../../src/lib/classroom-evaluation/grade-distribution.js';

describe('GRADE_TARGETS: 目安の数字', () => {
    test('S は 5〜25%、S+A は 75% 以上', () => {
        expect(GRADE_TARGETS).toEqual({ sMin: 5, sMax: 25, saMin: 75 });
    });
});

describe('gradeDistribution: 人数と %', () => {
    test('分母は評価のついた人。S+A と S の % と目安', () => {
        const d = gradeDistribution({ S: 2, A: 6, B: 1, C: 1 });
        expect(d.counts).toEqual({ S: 2, A: 6, B: 1, C: 1 });
        expect(d.graded).toBe(10);
        expect(d.sa).toEqual({ count: 8, percent: 80, ok: true });
        expect(d.s).toEqual({ count: 2, percent: 20, ok: true });
    });

    test('S+A が 75% に届かなければ注意', () => {
        const d = gradeDistribution({ S: 1, A: 5, B: 3, C: 1 });
        expect(d.sa).toEqual({ count: 6, percent: 60, ok: false });
    });

    test('S+A がちょうど 75% は目標どおり', () => {
        expect(gradeDistribution({ S: 1, A: 2, B: 1, C: 0 }).sa.ok).toBe(true);
    });

    test('S が 5% 未満・25% を超えると注意。境目は目安の内', () => {
        expect(gradeDistribution({ S: 0, A: 10, B: 0, C: 0 }).s.ok).toBe(false);
        expect(gradeDistribution({ S: 3, A: 7, B: 0, C: 0 }).s.ok).toBe(false);
        expect(gradeDistribution({ S: 1, A: 3, B: 0, C: 0 }).s.ok).toBe(true);
        expect(gradeDistribution({ S: 1, A: 19, B: 0, C: 0 }).s.ok).toBe(true);
    });

    test('% は整数に丸める', () => {
        expect(gradeDistribution({ S: 1, A: 1, B: 1, C: 0 }).s.percent).toBe(33);
    });

    test('評価が 1 つも無いときは % を出さない（注意にもしない）', () => {
        const d = gradeDistribution({ S: 0, A: 0, B: 0, C: 0 });
        expect(d.graded).toBe(0);
        expect(d.sa).toEqual({ count: 0, percent: null, ok: true });
        expect(d.s).toEqual({ count: 0, percent: null, ok: true });
    });

    test('目安は差し替えられる', () => {
        const d = gradeDistribution({ S: 1, A: 1, B: 0, C: 0 }, { sMin: 0, sMax: 40, saMin: 100 });
        expect(d.s.ok).toBe(false);
        expect(d.sa.ok).toBe(true);
    });
});

describe('assignmentDistribution: 課題の採点の分布', () => {
    const cells = {
        1: { submitted: true, grade: 'S' },
        2: { submitted: true, grade: 'A' },
        3: { submitted: true, grade: null },
        5: { submitted: false, grade: 'B' },
    };
    const getCell = (seat) => cells[seat] || null;

    test('読み込んだあと: 提出した席の評価（いま画面にある値）を数える', () => {
        const d = assignmentDistribution({ seats: [1, 2, 3, 4, 5], getCell, grading: null, loaded: true });
        expect(d.counts).toEqual({ S: 1, A: 1, B: 0, C: 0 });
        expect(d.graded).toBe(2);
        expect(d.notSubmitted).toBe(2);
        expect(d.s.percent).toBe(50);
    });

    test('読み込む前は保存した評価から（未提出は分からない）', () => {
        const d = assignmentDistribution({
            seats: [1, 2],
            getCell: () => null,
            grading: { grades: { 1: { grade: 'A' }, 2: { grade: 'B' } } },
            loaded: false,
        });
        expect(d.counts).toEqual({ S: 0, A: 1, B: 1, C: 0 });
        expect(d.notSubmitted).toBeNull();
        expect(d.sa.percent).toBe(50);
    });
});
