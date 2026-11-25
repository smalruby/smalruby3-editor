import {
    assignmentCsvRows,
    gradingCsvText,
    overallCsvRows,
} from '../../../../src/lib/classroom-evaluation/grading-csv';

describe('assignmentCsvRows', () => {
    test('header and rows sorted by seat', () => {
        expect(
            assignmentCsvRows([
                {
                    seatNumber: 2,
                    grade: 'A',
                    reason: 'LED を点けて消している',
                    groupName: 'LED だけ',
                    confirmed: true,
                },
                { seatNumber: 1, grade: 'C' },
            ]),
        ).toEqual([
            ['出席番号', '評価', '根拠', 'まとまり', '確定'],
            [1, 'C', '', '', ''],
            [2, 'A', 'LED を点けて消している', 'LED だけ', '○'],
        ]);
    });
});

describe('overallCsvRows', () => {
    test('one column per assignment, then 平均 and 総合', () => {
        const rows = overallCsvRows({
            assignments: [
                { id: 'led', name: 'LED', grades: { 1: 'S' } },
                { id: 'robot', name: 'ロボット', grades: { 1: 'A', 2: 'B' } },
            ],
            overall: [
                { seatNumber: 1, average: 2.5, grade: 'S' },
                { seatNumber: 2, average: null, grade: '' },
            ],
        });
        expect(rows).toEqual([
            ['出席番号', 'LED', 'ロボット', '平均', '総合'],
            [1, 'S', 'A', 2.5, 'S'],
            [2, '', 'B', '', ''],
        ]);
    });
});

describe('gradingCsvText', () => {
    test('BOM, CRLF, quoting and formula-safe cells', () => {
        const text = gradingCsvText([
            ['出席番号', '根拠'],
            [1, '=1+1'],
            [2, 'a,"b"'],
        ]);
        expect(text).toBe('﻿出席番号,根拠\r\n1,\'=1+1\r\n2,"a,""b"""');
    });
});
