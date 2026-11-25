/* eslint-env jest */
/**
 * 採点簿と課題の採点の判定 (EPIC #2421 / #2424)。
 */
import {
    assignmentCounts,
    assignmentTextOf,
    columnStatus,
    currentGradingStep,
    gradeCounts,
    gradebookCell,
    gradebookColumns,
    gradebookSeats,
    gradesFromMatrix,
    hasUnreturnedComments,
    isDraftGrade,
    sameGrades,
    withSavedGrade,
} from '../../../src/lib/classroom-evaluation/gradebook.js';

describe('gradebookColumns: 新しい課題が左', () => {
    test('sortDate（無ければ createdAt）の新しい順。同じ日は元の順', () => {
        const list = [
            { classroomId: 'a', createdAt: '2026-10-01' },
            { classroomId: 'b', sortDate: '2026-11-01', createdAt: '2026-09-01' },
            { classroomId: 'c', createdAt: '2026-10-15' },
            { classroomId: 'd', createdAt: '2026-10-15' },
            { classroomId: 'e' },
        ];
        expect(gradebookColumns(list).map((x) => x.classroomId)).toEqual(['b', 'c', 'd', 'a', 'e']);
    });

    test('元の配列は変えない', () => {
        const list = [{ classroomId: 'a', createdAt: '1' }, { classroomId: 'b', createdAt: '2' }];
        gradebookColumns(list);
        expect(list.map((x) => x.classroomId)).toEqual(['a', 'b']);
    });
});

describe('gradeCounts: いちばん上の行の人数', () => {
    test('S/A/B/C を数え、ほかの値は数えない', () => {
        expect(
            gradeCounts({ 1: { grade: 'A' }, 2: { grade: 'A' }, 3: { grade: 'S' }, 4: { grade: 'C' }, 5: { grade: 'x' } }),
        ).toEqual({ S: 1, A: 2, B: 0, C: 1 });
        expect(gradeCounts(null)).toEqual({ S: 0, A: 0, B: 0, C: 0 });
    });
});

describe('セルの状態: 確定していない AI の案は点線で薄く', () => {
    const grading = {
        grades: { 1: { grade: 'A', source: 'ai' }, 2: { grade: 'B', source: 'teacher', needsReview: true } },
        confirmedAt: null,
    };

    test('AI の案は確定するまで draft、先生の評価は draft ではない', () => {
        expect(gradebookCell(grading, 1)).toEqual({ grade: 'A', draft: true, needsReview: false });
        expect(gradebookCell(grading, 2)).toEqual({ grade: 'B', draft: false, needsReview: true });
        expect(gradebookCell({ ...grading, confirmedAt: '2026-11-25T00:00:00Z' }, 1).draft).toBe(false);
    });

    test('評価の無い席・保存が無い課題は null', () => {
        expect(gradebookCell(grading, 3)).toBeNull();
        expect(gradebookCell(null, 1)).toBeNull();
    });

    test('isDraftGrade', () => {
        expect(isDraftGrade(null, { source: 'ai' })).toBe(true);
        expect(isDraftGrade(null, null)).toBe(false);
    });
});

describe('gradebookSeats: 行はどれかの課題に評価がある席', () => {
    test('全部の課題をまとめ、小さい順', () => {
        expect(
            gradebookSeats({
                a: { grades: { 10: { grade: 'A' }, 2: { grade: 'B' } } },
                b: { grades: { 2: { grade: 'S' }, 7: { grade: 'C' } } },
                c: null,
            }),
        ).toEqual([2, 7, 10]);
    });
});

describe('columnStatus: 列の見出しの状態', () => {
    test('未採点・AI の案・確定、基準の有無', () => {
        expect(columnStatus(null)).toEqual({ kind: 'none', graded: 0, drafts: 0, hasRubric: false });
        expect(
            columnStatus({
                grades: { 1: { grade: 'A', source: 'ai' }, 2: { grade: 'B', source: 'teacher' } },
                rubric: { levels: [{ grade: 'S', text: 'x' }] },
            }),
        ).toEqual({ kind: 'draft', graded: 2, drafts: 1, hasRubric: true });
        expect(columnStatus({ grades: { 1: { grade: 'A', source: 'ai' } }, confirmedAt: 'now' })).toEqual({
            kind: 'confirmed',
            graded: 1,
            drafts: 0,
            hasRubric: false,
        });
    });
});

describe('gradesFromMatrix / withSavedGrade: 保存と読み戻し', () => {
    const matrix = {
        '1:c1': { submitted: true, grade: 'A', reason: '動く', gradeEdited: false },
        '2:c1': { submitted: true, grade: 'S', reason: '', gradeEdited: true, needsReview: true },
        '3:c1': { submitted: true, grade: null },
        '1:c2': { submitted: true, grade: 'C' },
    };

    test('その課題の評価だけ。先生が変えた評価は teacher', () => {
        expect(gradesFromMatrix(matrix, 'c1')).toEqual({
            1: { grade: 'A', reason: '動く', source: 'ai' },
            2: { grade: 'S', reason: '', source: 'teacher', needsReview: true },
        });
    });

    test('評価が同じなら、保存してあったまとまり（group）を残す', () => {
        const saved = { 1: { grade: 'A', group: 3 }, 2: { grade: 'A', group: 1 } };
        const grades = gradesFromMatrix(matrix, 'c1', saved);
        expect(grades[1].group).toBe(3);
        expect(grades[2].group).toBeUndefined();
    });

    test('読み込んだセルに保存した評価を戻す（先生の評価は先生のまま）', () => {
        const cell = { submitted: true, grade: null, reason: '' };
        expect(withSavedGrade(cell, { grade: 'B', reason: 'r', source: 'teacher' })).toEqual({
            submitted: true,
            grade: 'B',
            reason: 'r',
            needsReview: false,
            manual: true,
            gradeEdited: true,
        });
        expect(withSavedGrade(cell, { grade: 'A', source: 'ai' }).manual).toBe(false);
        expect(withSavedGrade(cell, null)).toBe(cell);
    });

    test('sameGrades', () => {
        const a = { 1: { grade: 'A', reason: '', source: 'ai' } };
        expect(sameGrades(a, { 1: { grade: 'A', source: 'ai' } })).toBe(true);
        expect(sameGrades(a, { 1: { grade: 'B', source: 'ai' } })).toBe(false);
        expect(sameGrades(a, {})).toBe(false);
        expect(sameGrades(null, {})).toBe(true);
    });
});

describe('assignmentCounts: 右の上の人数', () => {
    const cells = {
        1: { submitted: true, grade: 'A' },
        2: { submitted: true, grade: 'B', gradeEdited: true },
        3: { submitted: true, grade: null, returned: true },
    };
    const getCell = (seat) => cells[seat] || null;

    test('読み込んだあと: 未提出・AI の案・返却済み', () => {
        expect(assignmentCounts({ seats: [1, 2, 3, 4], getCell, grading: null, loaded: true })).toEqual({
            notSubmitted: 1,
            drafts: 1,
            confirmed: 0,
            returned: 1,
        });
    });

    test('確定したら、評価のある席はみな確定', () => {
        expect(
            assignmentCounts({ seats: [1, 2, 3], getCell, grading: { confirmedAt: 'now' }, loaded: true }),
        ).toEqual({ notSubmitted: 0, drafts: 0, confirmed: 2, returned: 1 });
    });

    test('読み込む前は保存した評価から（未提出は分からない）', () => {
        expect(
            assignmentCounts({
                seats: [1],
                getCell: () => null,
                grading: { grades: { 1: { grade: 'A', source: 'ai' } } },
                loaded: false,
            }),
        ).toEqual({ notSubmitted: null, drafts: 1, confirmed: 0, returned: 0 });
    });
});

describe('currentGradingStep: 1 提出 → 2 基準 → 3 採点 → 4 確定 → 5 下書き → 6 返却', () => {
    const base = { loaded: true, rubricDone: false, hasGrades: false, confirmed: false, hasComments: false };
    test('順に進む', () => {
        expect(currentGradingStep({ ...base, loaded: false })).toBe('load');
        expect(currentGradingStep(base)).toBe('rubric');
        expect(currentGradingStep({ ...base, rubricDone: true })).toBe('grade');
        expect(currentGradingStep({ ...base, hasGrades: true })).toBe('confirm');
        expect(currentGradingStep({ ...base, hasGrades: true, confirmed: true })).toBe('comment');
        expect(currentGradingStep({ ...base, hasGrades: true, confirmed: true, hasComments: true })).toBe('return');
    });
    test('コメントの下書きがあれば、採点の前でも返却', () => {
        expect(currentGradingStep({ ...base, hasComments: true })).toBe('return');
    });
});

describe('assignmentTextOf: AI に渡す課題の説明', () => {
    test('ページの文をつなぐ。無ければ空', () => {
        expect(
            assignmentTextOf({ assignment: { pages: [{ text: ' LED を点ける ' }, { text: '' }, { text: '消す' }] } }),
        ).toBe('LED を点ける\n消す');
        expect(assignmentTextOf({ assignment: null })).toBe('');
        expect(assignmentTextOf(null)).toBe('');
    });
});

describe('hasUnreturnedComments: 離れると消えるコメント', () => {
    test('返却していない・返却した文から直したものだけ', () => {
        const matrix = { '1:c': { returned: true, returnedComment: 'よい' } };
        expect(hasUnreturnedComments(matrix, { '1:c': 'よい' })).toBe(false);
        expect(hasUnreturnedComments(matrix, { '1:c': 'よい！' })).toBe(true);
        expect(hasUnreturnedComments({}, { '2:c': '  ' })).toBe(false);
        expect(hasUnreturnedComments({}, { '2:c': 'x' })).toBe(true);
    });
});
