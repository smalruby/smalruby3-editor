import {
    buildAuditCsv,
    buildEvaluationCsv,
    chunk,
    combineOverall,
    csvField,
    currentLessonOnlyStep,
    evaluationColumns,
    evaluationFlowMode,
    evaluationSnapshot,
    isLessonOnlyAssignment,
    unsavedEvaluation,
} from '../../../src/lib/classroom-evaluation/evaluation-utils';

describe('combineOverall', () => {
    test('additive improvement rule for two lessons (Tamayu combine_overall)', () => {
        expect(combineOverall(['A', 'A'])).toBe('S'); // 1+1 >= 2
        expect(combineOverall(['S', 'C'])).toBe('S'); // 2+0 >= 2
        expect(combineOverall(['A', 'C'])).toBe('A'); // 1+0 == 1
        expect(combineOverall(['B', 'B'])).toBe('B'); // 0
        expect(combineOverall(['C', 'C'])).toBe('B'); // 0
    });

    test('a single graded lesson keeps its own grade (lone C stays C)', () => {
        expect(combineOverall(['C'])).toBe('C');
        expect(combineOverall(['S'])).toBe('S');
        expect(combineOverall(['A', null, ''])).toBe('A');
    });

    test('null when nothing is graded', () => {
        expect(combineOverall([])).toBeNull();
        expect(combineOverall([null, ''])).toBeNull();
        expect(combineOverall(null)).toBeNull();
    });
});

describe('csvField', () => {
    test('quotes fields with commas, quotes, and newlines', () => {
        expect(csvField('plain')).toBe('plain');
        expect(csvField('a,b')).toBe('"a,b"');
        expect(csvField('say "hi"')).toBe('"say ""hi"""');
        expect(csvField('line1\nline2')).toBe('"line1\nline2"');
        expect(csvField(null)).toBe('');
    });

    test('採点結果 CSV の課題名が = で始まっても数式にしない（#1603）', () => {
        const csv = buildEvaluationCsv(
            [{ classroomId: 'c1', assignmentName: '=1+1', hasLesson: true }],
            [],
            () => null,
            {
                c1: { total: 100, submitWork: false, scores: {} },
            },
        );
        expect(csv.slice(1).split('\r\n')[0]).toBe("出席番号,'=1+1:レッスンの点,総合評価");
    });
});

describe('buildEvaluationCsv', () => {
    const lessons = [
        { classroomId: 'c1', assignmentName: '第1回' },
        { classroomId: 'c2', assignmentName: '第2回' },
    ];
    const cells = {
        '1:c1': { submitted: true, grade: 'A', reason: '動く' },
        '1:c2': { submitted: true, grade: 'A', reason: '要件達成' },
        '2:c1': { submitted: false },
    };
    const getCell = (seat, cid) => cells[`${seat}:${cid}`] || null;

    test('renders header, rows, and the overall grade', () => {
        const csv = buildEvaluationCsv(lessons, [1, 2], getCell);
        const lines = csv.replace(/^﻿/, '').split('\r\n');
        expect(lines[0]).toBe(
            '出席番号,第1回:提出,第1回:評価,第1回:評価理由,第2回:提出,第2回:評価,第2回:評価理由,総合評価',
        );
        expect(lines[1]).toBe('1,○,A,動く,○,A,要件達成,S');
        expect(lines[2]).toBe('2,×,,,×,,,');
    });
});

describe('buildAuditCsv', () => {
    test('one row per seat × lesson with signals and pseudocode', () => {
        const lessons = [{ classroomId: 'c1', assignmentName: '第1回' }];
        const getCell = () => ({
            submitted: true,
            grade: 'B',
            reason: '未接続',
            needsReview: true,
            signals: { wiredScriptCount: 0 },
            pseudocode: '◇ スクリプト:\n    10 歩動かす',
        });
        const csv = buildAuditCsv(lessons, [5], getCell);
        const lines = csv.replace(/^﻿/, '').split('\r\n');
        expect(lines[0]).toContain('擬似コード');
        expect(lines[1]).toContain('5,第1回,○,B,未接続,要確認');
        expect(lines[1]).toContain('""wiredScriptCount"":0');
    });
});

describe('chunk', () => {
    test('splits into chunks of at most size', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunk([], 3)).toEqual([]);
        expect(chunk(null, 3)).toEqual([]);
    });
});

describe('レッスンの点の列（#1603）', () => {
    const lessons = [
        { classroomId: 'c1', assignmentName: '第1回' },
        { classroomId: 'c2', assignmentName: 'レッスン', hasLesson: true },
        { classroomId: 'c3', assignmentName: '作品も', hasLesson: true },
    ];
    const lessonScores = {
        c2: { total: 100, submitWork: false, scores: { 1: 78 } },
        c3: { total: 50, submitWork: true, scores: { 2: 50 } },
    };
    const getCell = (seat, cid) => (seat === 1 && cid === 'c1' ? { submitted: true, grade: 'A', reason: 'r' } : null);

    test('作品の列のすぐ横に「レッスン」の列。作品を出さない課題はレッスンの列だけ', () => {
        expect(evaluationColumns(lessons, lessonScores).map((c) => `${c.lesson.classroomId}:${c.kind}`)).toEqual([
            'c1:work',
            'c2:lesson',
            'c3:work',
            'c3:lesson',
        ]);
    });

    test('点を出せなくても作品を出さないと分かっていれば作品の列は出さない', () => {
        const info = { c2: { total: null, submitWork: false, scores: {} } };
        expect(evaluationColumns([lessons[1]], info).map((c) => c.kind)).toEqual(['lesson']);
    });

    test('採点できない（設定も読めない）ときは作品の列も残す', () => {
        expect(evaluationColumns([lessons[1]], { c2: null }).map((c) => c.kind)).toEqual(['work', 'lesson']);
    });

    test('CSV: <課題>:レッスンの点（記録の無い席は空）・総合評価は作品の評価だけで出す', () => {
        const lines = buildEvaluationCsv(lessons, [1, 2], getCell, lessonScores).slice(1).split('\r\n');
        expect(lines[0]).toBe(
            '出席番号,第1回:提出,第1回:評価,第1回:評価理由,レッスン:レッスンの点,' +
                '作品も:提出,作品も:評価,作品も:評価理由,作品も:レッスンの点,総合評価',
        );
        expect(lines[1]).toBe('1,○,A,r,78,×,,,,A');
        expect(lines[2]).toBe('2,×,,,,×,,,50,');
    });
});

describe('採点の流れ（#1778）', () => {
    const work = { classroomId: 'w', hasLesson: false };
    const lessonOnly = { classroomId: 'lo', hasLesson: true, lessonSetting: { submitWork: false } };
    const lessonWithWork = { classroomId: 'lw', hasLesson: true, lessonSetting: { submitWork: true } };
    const lessonUnknown = { classroomId: 'lu', hasLesson: true };

    test('作品を出さないレッスンの課題だけ → AI を使わない流れ', () => {
        expect(evaluationFlowMode([lessonOnly])).toBe('lessonOnly');
        expect(isLessonOnlyAssignment(lessonOnly)).toBe(true);
    });

    test('作品も提出するレッスンの課題・ふつうの課題 → いまの AI の流れ', () => {
        expect(evaluationFlowMode([lessonWithWork])).toBe('work');
        expect(evaluationFlowMode([work, lessonWithWork])).toBe('work');
        expect(evaluationFlowMode([])).toBe('work');
    });

    test('混ぜて選んだ → AI の流れ（レッスンだけの課題には AI を使わない）', () => {
        expect(evaluationFlowMode([work, lessonOnly])).toBe('mixed');
        expect(evaluationFlowMode([lessonWithWork, lessonOnly])).toBe('mixed');
    });

    test('設定がまだ読めていなければ、進み具合と一緒に返った設定で決める（読めなければ AI の流れ）', () => {
        expect(evaluationFlowMode([lessonUnknown])).toBe('work');
        expect(evaluationFlowMode([lessonUnknown], { lu: { submitWork: false, scores: {} } })).toBe('lessonOnly');
        expect(evaluationColumns([lessonOnly]).map((c) => c.kind)).toEqual(['lesson']);
        expect(evaluationColumns([lessonWithWork]).map((c) => c.kind)).toEqual(['work', 'lesson']);
    });

    test('レッスンだけの流れ: ①読み込む → ②点を確かめる → ③書き出す', () => {
        expect(currentLessonOnlyStep({ loaded: false, checked: false })).toBe('load');
        expect(currentLessonOnlyStep({ loaded: false, checked: true })).toBe('load');
        expect(currentLessonOnlyStep({ loaded: true, checked: false })).toBe('check');
        expect(currentLessonOnlyStep({ loaded: true, checked: true })).toBe('export');
    });
});

describe('unsavedEvaluation (#1923 C4)', () => {
    // 返却しても採点（grade・reason）はサーバーに残らない。残る手段は「採点結果」の CSV だけ。
    const run = ({ cells = {}, comments = {}, exported = {} }) =>
        unsavedEvaluation({ matrix: cells, comments, exported });
    const NONE = { grades: false, comments: false };

    test('nothing graded or drafted: nothing is lost', () => {
        expect(run({ cells: { '1:c1': { submitted: true, grade: null, reason: '' } } })).toEqual(NONE);
    });

    test('a grade that is not exported is lost', () => {
        expect(run({ cells: { '1:c1': { submitted: true, grade: 'A', reason: '' } } })).toEqual({
            grades: true,
            comments: false,
        });
    });

    test('a reason alone that is not exported is lost', () => {
        expect(run({ cells: { '1:c1': { submitted: true, grade: null, reason: '旗で動く' } } }).grades).toBe(true);
    });

    test('a returned cell still loses its grade when it is not exported (returning does not save grades)', () => {
        const cells = {
            '1:c1': { submitted: true, grade: 'A', reason: '', returned: true, returnedComment: 'よい' },
        };
        expect(run({ cells, comments: { '1:c1': 'よい' } })).toEqual({ grades: true, comments: false });
    });

    test('exported grades are kept; a grade changed after the export is lost', () => {
        const cells = { '1:c1': { submitted: true, grade: 'A', reason: '旗で動く' } };
        const exported = evaluationSnapshot(cells);
        expect(run({ cells, exported })).toEqual(NONE);
        expect(run({ cells: { '1:c1': { ...cells['1:c1'], grade: 'S' } }, exported }).grades).toBe(true);
        expect(run({ cells: { '1:c1': { ...cells['1:c1'], reason: '工夫あり' } }, exported }).grades).toBe(true);
    });

    test('a comment draft that is not returned is lost (even without a cell)', () => {
        expect(run({ comments: { '2:c1': 'よくできました' } })).toEqual({ grades: false, comments: true });
    });

    test('blank comment drafts do not count', () => {
        expect(run({ comments: { '1:c1': '   ' } })).toEqual(NONE);
    });

    test('a comment returned as it is now is kept; edited after the return it is lost', () => {
        const cells = { '1:c1': { submitted: true, grade: null, returned: true, returnedComment: 'よくできました' } };
        expect(run({ cells, comments: { '1:c1': ' よくできました ' } })).toEqual(NONE);
        expect(run({ cells, comments: { '1:c1': 'よくできました！' } }).comments).toBe(true);
    });

    test('an assignment unselected after grading still counts (レビュー M2)', () => {
        // c2 は選択を外した課題。表には出ていないが、離れる・読み込み直すと消える。
        const cells = {
            '1:c1': { submitted: true, grade: 'A', reason: '' },
            '1:c2': { submitted: true, grade: 'B', reason: '' },
        };
        const exported = evaluationSnapshot({ '1:c1': cells['1:c1'] });
        expect(run({ cells, exported })).toEqual({ grades: true, comments: false });
        expect(run({ cells: { '1:c1': cells['1:c1'] }, comments: { '1:c2': 'すてき' }, exported })).toEqual({
            grades: false,
            comments: true,
        });
    });

    // 筋書き（レビュー M1）: 一連の操作で、いつ「消える」と数えるか。
    describe('scenarios', () => {
        const grade = (cells, key, g, reason = '旗で動く') => ({
            ...cells,
            [key]: { ...cells[key], grade: g, reason },
        });
        const returnAll = (cells, comments) =>
            Object.fromEntries(
                Object.entries(cells).map(([key, cell]) => [
                    key,
                    comments[key] ? { ...cell, returned: true, returnedComment: comments[key].trim() } : cell,
                ]),
            );
        const loaded = {
            '1:c1': { submitted: true, grade: null, reason: '' },
            '2:c1': { submitted: true, grade: null, reason: '' },
        };

        test('1: load → AI → fix → comments → return → cancel: the grades are lost (not exported)', () => {
            let cells = grade(grade(loaded, '1:c1', 'A'), '2:c1', 'B');
            cells = grade(cells, '2:c1', 'A', '直した');
            const comments = { '1:c1': 'よい', '2:c1': 'すてき' };
            cells = returnAll(cells, comments);
            expect(run({ cells, comments })).toEqual({ grades: true, comments: false });
        });

        test('2: … → export → return → cancel: nothing is lost', () => {
            const cells = grade(grade(loaded, '1:c1', 'A'), '2:c1', 'B');
            const exported = evaluationSnapshot(cells);
            const comments = { '1:c1': 'よい', '2:c1': 'すてき' };
            expect(run({ cells: returnAll(cells, comments), comments, exported })).toEqual(NONE);
        });

        test('3: … → export → return → AI drafts the comments again (overwrites): lost', () => {
            const cells = grade(grade(loaded, '1:c1', 'A'), '2:c1', 'B');
            const exported = evaluationSnapshot(cells);
            const returned = returnAll(cells, { '1:c1': 'よい', '2:c1': 'すてき' });
            expect(run({ cells: returned, comments: { '1:c1': 'よい', '2:c1': '新しい下書き' }, exported })).toEqual({
                grades: false,
                comments: true,
            });
        });
    });
});
