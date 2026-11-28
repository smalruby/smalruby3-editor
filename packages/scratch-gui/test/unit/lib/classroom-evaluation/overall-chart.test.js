/* eslint-env jest */
/**
 * 総合評価のグラフ (#2458・EPIC #2438 の F7・F8): 積み上げ帯・点の分布・区切りの線のドラッグ。
 */
import {
    CUT_STEP,
    axisTicks,
    chartDomain,
    clampCut,
    cutFromFraction,
    dotLayout,
    overallDistribution,
    stackedSegments,
    stepCut,
    toFraction,
} from '../../../../src/lib/classroom-evaluation/overall-chart.js';

const row = (seatNumber, average, grade) => ({ seatNumber, average, grade, missing: [] });

describe('overallDistribution: 総合の分布', () => {
    test('総合の評価を数え、S+A+B の人数と % を出す。評価の無い席は数えない', () => {
        const d = overallDistribution([
            row(1, 3.6, 'S'),
            row(2, 3, 'A'),
            row(3, 2, 'B'),
            row(4, 1, 'C'),
            row(5, null, ''),
        ]);
        expect(d.counts).toEqual({ S: 1, A: 1, B: 1, C: 1 });
        expect(d.graded).toBe(4);
        expect(d.sab).toEqual({ count: 3, percent: 75, ok: true });
    });

    test('S+A+B が 75% 未満なら注意', () => {
        const d = overallDistribution([row(1, 3, 'A'), row(2, 1, 'C'), row(3, 1, 'C')]);
        expect(d.sab.ok).toBe(false);
    });
});

describe('stackedSegments: 100% の積み上げ帯', () => {
    test('S → C の順に、評価のついた人の中の割合（丸めない）', () => {
        const segments = stackedSegments({ counts: { S: 1, A: 1, B: 1, C: 0 }, graded: 3 });
        expect(segments.map((s) => s.grade)).toEqual(['S', 'A', 'B', 'C']);
        expect(segments[0].share).toBeCloseTo(100 / 3);
        expect(segments[3]).toEqual({ grade: 'C', count: 0, share: 0 });
    });

    test('評価が無いときは、どれも 0', () => {
        const segments = stackedSegments({ counts: { S: 0, A: 0, B: 0, C: 0 }, graded: 0 });
        expect(segments.every((s) => s.share === 0)).toBe(true);
    });
});

describe('chartDomain / toFraction: 横の軸', () => {
    test('点のいちばん小さい値から大きい値まで（未提出の点も入れる）', () => {
        expect(chartDomain({ S: 4, A: 3, B: 2, C: 1, none: 0 })).toEqual({ min: 0, max: 4 });
        expect(chartDomain({ S: 5, A: 3, B: 2, C: 1, none: null })).toEqual({ min: 1, max: 5 });
    });

    test('幅が 0 のときは 1 を足す', () => {
        expect(chartDomain({ S: 2, A: 2, B: 2, C: 2, none: 2 })).toEqual({ min: 2, max: 3 });
    });

    test('目盛りは整数。点が大きいときは重ならないよう 10 個くらいに間引く', () => {
        expect(axisTicks({ min: 0, max: 4 })).toEqual([0, 1, 2, 3, 4]);
        expect(axisTicks({ min: 0.5, max: 3.5 })).toEqual([1, 2, 3]);
        expect(axisTicks({ min: 0, max: 100 })).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
        expect(axisTicks({ min: 5, max: 37 })).toEqual([8, 12, 16, 20, 24, 28, 32, 36]);
    });

    test('位置は 0〜1 に収める', () => {
        const domain = { min: 0, max: 4 };
        expect(toFraction(2, domain)).toBe(0.5);
        expect(toFraction(-1, domain)).toBe(0);
        expect(toFraction(9, domain)).toBe(1);
    });
});

describe('区切りの線を動かす', () => {
    const domain = { min: 0, max: 4 };
    const cuts = { S: 3.5, A: 2.5, B: 1.5 };

    test('ドラッグの位置 → 0.1 きざみの値', () => {
        expect(CUT_STEP).toBe(0.1);
        expect(cutFromFraction(0.5, domain)).toBe(2);
        expect(cutFromFraction(0.7123, domain)).toBe(2.8);
    });

    test('ほかの区切りを越えない（S ≥ A ≥ B）、軸の外に出ない', () => {
        expect(clampCut('A', 3.9, cuts, domain)).toBe(3.5);
        expect(clampCut('A', 1.0, cuts, domain)).toBe(1.5);
        expect(clampCut('S', 5, cuts, domain)).toBe(4);
        expect(clampCut('B', -1, cuts, domain)).toBe(0);
        expect(clampCut('B', 2.04, cuts, domain)).toBe(2);
    });

    test('キーボードで 1 きざみ動かす（端で止まる）', () => {
        expect(stepCut('A', cuts, 1, domain)).toBe(2.6);
        expect(stepCut('A', cuts, -1, domain)).toBe(2.4);
        expect(stepCut('S', { ...cuts, S: 4 }, 1, domain)).toBe(4);
    });
});

describe('dotLayout: 点の分布', () => {
    test('平均の位置に点を置き、同じ所に重なる点は上に積む。平均の無い席は置かない', () => {
        const dots = dotLayout(
            [row(1, 2, 'B'), row(2, 2, 'B'), row(3, 4, 'S'), row(4, null, ''), row(5, 2.02, 'B')],
            { min: 0, max: 4 },
        );
        expect(dots.map((d) => [d.seatNumber, d.fraction, d.level])).toEqual([
            [1, 0.5, 0],
            [2, 0.5, 1],
            [5, 0.505, 2],
            [3, 1, 0],
        ]);
        expect(dots[0].grade).toBe('B');
    });
});
