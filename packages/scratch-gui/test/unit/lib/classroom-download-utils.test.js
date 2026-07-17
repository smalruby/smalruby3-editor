import {
    assignmentFolderNames,
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
