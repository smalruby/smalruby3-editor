import {
    assignmentFolderNames,
    assignmentZipPlan,
    buildSubmissionsCsv,
    sanitizeEntryName,
    submissionStatusLabel,
} from '../../../src/lib/classroom-download-utils.js';

describe('sanitizeEntryName', () => {
    test('replaces filesystem-hostile characters', () => {
        expect(sanitizeEntryName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
    });

    test('falls back for empty names', () => {
        expect(sanitizeEntryName('')).toBe('untitled');
        expect(sanitizeEntryName(null)).toBe('untitled');
        expect(sanitizeEntryName('   ')).toBe('untitled');
    });
});

describe('assignmentFolderNames', () => {
    test('uses the assignment name, falling back to the class name', () => {
        const map = assignmentFolderNames([
            { classroomId: 'c1', assignmentName: 'ねこあつめ', className: '技術' },
            { classroomId: 'c2', assignmentName: null, className: '技術' },
        ]);
        expect(map.get('c1')).toBe('ねこあつめ');
        expect(map.get('c2')).toBe('技術');
    });

    test('deduplicates identical names with a numeric suffix', () => {
        const map = assignmentFolderNames([
            { classroomId: 'c1', assignmentName: 'ねこあつめ' },
            { classroomId: 'c2', assignmentName: 'ねこあつめ' },
            { classroomId: 'c3', assignmentName: 'ねこあつめ' },
        ]);
        expect(map.get('c1')).toBe('ねこあつめ');
        expect(map.get('c2')).toBe('ねこあつめ (2)');
        expect(map.get('c3')).toBe('ねこあつめ (3)');
    });
});

describe('submissionStatusLabel', () => {
    test('labels every submission state', () => {
        expect(submissionStatusLabel({ hasSubmission: false })).toBe('未提出');
        expect(submissionStatusLabel({ hasSubmission: true, submissionStatus: 'submitted' })).toBe('提出済み');
        expect(submissionStatusLabel({ hasSubmission: true, submissionStatus: 'returned' })).toBe('返却済み');
    });
});

describe('buildSubmissionsCsv', () => {
    test('produces a BOM + CRLF CSV with a Japanese header', () => {
        const csv = buildSubmissionsCsv([
            {
                assignmentName: 'ねこあつめ',
                seat: 1,
                name: 'たろう',
                projectName: 'さくひん',
                submittedAt: '2026-07-17T00:00:00.000Z',
                status: '提出済み',
            },
        ]);
        expect(csv.startsWith('\ufeff')).toBe(true);
        const lines = csv.slice(1).split('\r\n');
        expect(lines[0]).toBe('課題名,出席番号,名前,作品名,提出日時,状態');
        expect(lines[1]).toBe('ねこあつめ,1,たろう,さくひん,2026-07-17T00:00:00.000Z,提出済み');
    });

    test('escapes commas and quotes', () => {
        const csv = buildSubmissionsCsv([
            {
                assignmentName: 'a,b',
                seat: 2,
                name: 'say "hi"',
                projectName: '',
                submittedAt: null,
                status: '未提出',
            },
        ]);
        expect(csv).toContain('"a,b",2,"say ""hi""",,,未提出');
    });
});

describe('CSV formula injection (#1767 M3)', () => {
    test('prefixes cells that start with = + - @ tab or CR with a quote', () => {
        const csv = buildSubmissionsCsv([
            {
                assignmentName: '=1+1',
                seat: 1,
                name: '+cmd|x',
                projectName: '-2',
                submittedAt: '@SUM(A1)',
                status: '\tx',
            },
            { assignmentName: 'ふつう', seat: 2, name: '\rname', projectName: 'a=b', submittedAt: '', status: '' },
        ]);
        const lines = csv.replace(/^﻿/, '').split('\r\n');
        expect(lines[1]).toBe("'=1+1,1,'+cmd|x,'-2,'@SUM(A1),'\tx");
        expect(lines[2].startsWith('ふつう,2,"\'\rname",a=b,')).toBe(true);
    });

    test('numbers are not prefixed', () => {
        const csv = buildSubmissionsCsv([
            { assignmentName: 'x', seat: -1, name: 'n', projectName: '', submittedAt: '', status: '' },
        ]);
        expect(csv.split('\r\n')[1]).toBe('x,-1,n,,,');
    });
});

describe('buildSubmissionsCsv のレッスンの列（#1603）', () => {
    const base = { assignmentName: 'L', seat: '01', name: 'あ', projectName: '', submittedAt: '', status: '未提出' };

    test('レッスンの課題が無ければ前と同じ列', () => {
        expect(buildSubmissionsCsv([base]).slice(1).split('\r\n')[0]).toBe(
            '課題名,出席番号,名前,作品名,提出日時,状態',
        );
    });

    test('課題クリア・できた数・得点・チャレンジごとの列（レッスンの無い行は空）', () => {
        const columns = [
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
        ];
        const lesson = { cleared: '○', done: 2, score: 100, times: { a: '前', b: '2026/11/15 10:23' } };
        const lines = buildSubmissionsCsv(
            [
                { ...base, lesson },
                { ...base, seat: '02', lesson: null },
            ],
            columns,
        )
            .slice(1)
            .split('\r\n');
        expect(lines[0]).toBe('課題名,出席番号,名前,作品名,提出日時,状態,課題クリア,できた数,得点,A,B');
        expect(lines[1]).toBe('L,01,あ,,,未提出,○,2,100,前,2026/11/15 10:23');
        expect(lines[2]).toBe('L,02,あ,,,未提出,,,,,');
    });

    test('ほかの課題のチャレンジの列は空', () => {
        const lesson = { cleared: '', done: 0, score: 0, times: { a: '' } };
        const line = buildSubmissionsCsv([{ ...base, lesson }], [{ id: 'z', name: 'Z' }])
            .slice(1)
            .split('\r\n')[1];
        expect(line).toBe('L,01,あ,,,未提出,,0,0,');
    });
});

describe('assignmentZipPlan（課題の「全作品ダウンロード」・#1603）', () => {
    test('レッスンの無い課題はいままでどおり（CSV なし・提出 0 件ならダウンロードしない）', () => {
        expect(assignmentZipPlan(false, 3)).toEqual({ statusCsv: false });
        expect(assignmentZipPlan(false, 0)).toBeNull();
    });

    test('レッスンの課題は提出 0 件でも 提出状況.csv の zip を作る', () => {
        expect(assignmentZipPlan(true, 0)).toEqual({ statusCsv: true });
        expect(assignmentZipPlan(true, 2)).toEqual({ statusCsv: true });
    });
});
