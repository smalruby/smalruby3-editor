import {
    legacyGradingBody,
    parseCsv,
    parseLegacyGradingCsv,
    planLegacyImport,
} from '../../../../src/lib/classroom-evaluation/legacy-csv-import';

// The shape buildEvaluationCsv writes: BOM, CRLF, quoted fields when needed.
const OLD_CSV = [
    '\uFEFF出席番号,02_LED:提出,02_LED:評価,02_LED:評価理由,07_タイピング:レッスンの点,04_モーター:提出,04_モーター:評価,04_モーター:評価理由,総合評価',
    '1,○,A,明るさで LED を切りかえる,80,○,B,"サーボを曲げる, 戻さない",A',
    '2,○,S,"""全体の ON/OFF"" を作った",90,×,,,S',
    "3,×,,,70,○,c,'=はじめに LED,C",
    '',
].join('\r\n');

describe('parseCsv', () => {
    test('quotes, escaped quotes, commas and newlines inside quotes', () => {
        expect(parseCsv('a,"b,c","d""e"\r\n"f\ng",h\n')).toEqual([
            ['a', 'b,c', 'd"e'],
            ['f\ng', 'h'],
        ]);
    });

    test('drops a BOM and blank lines', () => {
        expect(parseCsv('\uFEFFx,y\r\n\r\n1,2')).toEqual([
            ['x', 'y'],
            ['1', '2'],
        ]);
    });
});

describe('parseLegacyGradingCsv', () => {
    test('reads grade and reason per assignment, skipping lesson-only columns', () => {
        const result = parseLegacyGradingCsv(OLD_CSV);
        expect(result.error).toBeNull();
        expect(result.skipped).toEqual(['07_タイピング']);
        expect(result.assignments).toEqual([
            {
                name: '02_LED',
                grades: {
                    1: { grade: 'A', reason: '明るさで LED を切りかえる' },
                    2: { grade: 'S', reason: '"全体の ON/OFF" を作った' },
                },
            },
            {
                name: '04_モーター',
                grades: {
                    1: { grade: 'B', reason: 'サーボを曲げる, 戻さない' },
                    3: { grade: 'C', reason: '=はじめに LED' },
                },
            },
        ]);
    });

    test('an assignment name containing ":" is split on the last one', () => {
        const result = parseLegacyGradingCsv('出席番号,第2回: LED:評価\n1,A\n');
        expect(result.assignments).toEqual([{ name: '第2回: LED', grades: { 1: { grade: 'A', reason: '' } } }]);
    });

    test('rejects a file that is not the grading CSV', () => {
        expect(parseLegacyGradingCsv('').error).toBe('empty');
        expect(parseLegacyGradingCsv('名前,点\nたろう,3').error).toBe('not-grading-csv');
        expect(parseLegacyGradingCsv('出席番号,なにか\n1,2').error).toBe('not-grading-csv');
    });
});

describe('planLegacyImport', () => {
    const csv = parseLegacyGradingCsv(OLD_CSV).assignments;

    test('matches by name and flags assignments that already have grades', () => {
        const plan = planLegacyImport(csv, [
            { classroomId: 'c-led', assignmentName: '02_LED' },
            { classroomId: 'c-motor', assignmentName: '04_モーター ', hasGrades: true },
        ]);
        expect(plan.unmatched).toEqual([]);
        expect(plan.matches.map(({ classroomId, count, overwrite }) => ({ classroomId, count, overwrite }))).toEqual([
            { classroomId: 'c-led', count: 2, overwrite: false },
            { classroomId: 'c-motor', count: 2, overwrite: true },
        ]);
    });

    test('a missing or duplicated name is unmatched', () => {
        const plan = planLegacyImport(csv, [
            { classroomId: 'a', assignmentName: '02_LED' },
            { classroomId: 'b', assignmentName: '02_LED' },
        ]);
        expect(plan.matches).toEqual([]);
        expect(plan.unmatched).toEqual(['02_LED', '04_モーター']);
    });
});

describe('legacyGradingBody', () => {
    test('teacher grades, confirmed at the import time, reasons cut to 300', () => {
        const body = legacyGradingBody(
            { 1: { grade: 'A', reason: 'x'.repeat(400) }, 2: { grade: 'C' } },
            '2026-11-26T00:00:00.000Z',
        );
        expect(body.confirmedAt).toBe('2026-11-26T00:00:00.000Z');
        expect(body.grades[1]).toEqual({ grade: 'A', reason: 'x'.repeat(300), source: 'teacher' });
        expect(body.grades[2]).toEqual({ grade: 'C', reason: '', source: 'teacher' });
    });
});
