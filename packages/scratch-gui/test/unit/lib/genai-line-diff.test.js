import { countLineChanges, diffLines, markedLines } from '../../../src/lib/genai-line-diff.js';

const kinds = (diff) => diff.map((line) => `${line.kind}:${line.text}`);

describe('diffLines', () => {
    test('has only same lines for the same code', () => {
        expect(kinds(diffLines('a\nb\n', 'a\nb\n'))).toEqual(['same:a', 'same:b']);
    });

    test('finds the lines added', () => {
        const diff = diffLines('a\nc\n', 'a\nb\nc\n');
        expect(kinds(diff)).toEqual(['same:a', 'added:b', 'same:c']);
        expect(diff[1]).toEqual({ kind: 'added', text: 'b', beforeLine: null, afterLine: 2 });
    });

    test('finds the lines removed', () => {
        const diff = diffLines('a\nb\nc\n', 'a\nc\n');
        expect(kinds(diff)).toEqual(['same:a', 'removed:b', 'same:c']);
        expect(diff[1]).toEqual({ kind: 'removed', text: 'b', beforeLine: 2, afterLine: null });
    });

    test('pairs a removed line with the added line in its place as changed', () => {
        const diff = diffLines('when_flag_clicked do\n  move(10)\nend\n', 'when_flag_clicked do\n  move(20)\nend\n');
        expect(kinds(diff)).toEqual(['same:when_flag_clicked do', 'changed:  move(20)', 'same:end']);
        expect(diff[1]).toEqual({
            kind: 'changed',
            text: '  move(20)',
            beforeText: '  move(10)',
            beforeLine: 2,
            afterLine: 2,
        });
    });

    test('pairs as many as both sides have, the rest added or removed', () => {
        expect(kinds(diffLines('a\nx\nz\n', 'a\np\nq\nr\nz\n'))).toEqual([
            'same:a',
            'changed:p',
            'added:q',
            'added:r',
            'same:z',
        ]);
        expect(kinds(diffLines('a\nx\ny\nz\n', 'a\np\nz\n'))).toEqual(['same:a', 'changed:p', 'removed:y', 'same:z']);
    });

    test('compares from empty code', () => {
        expect(kinds(diffLines('', 'a\nb'))).toEqual(['added:a', 'added:b']);
        expect(kinds(diffLines('a\n', ''))).toEqual(['removed:a']);
        expect(diffLines('', '')).toEqual([]);
    });

    test('does not take the line break at the end or a CRLF as a change', () => {
        expect(kinds(diffLines('a\r\nb', 'a\nb\n'))).toEqual(['same:a', 'same:b']);
    });

    test('keeps the order of a code with lines moved around', () => {
        const diff = diffLines('a\nb\nc\n', 'c\na\nb\n');
        expect(diff.filter((line) => line.kind !== 'removed').map((line) => line.text)).toEqual(['c', 'a', 'b']);
        expect(diff.filter((line) => line.kind !== 'added').map((line) => line.text)).toEqual(['a', 'b', 'c']);
    });
});

describe('countLineChanges', () => {
    test('counts the lines added, changed and removed', () => {
        expect(countLineChanges(diffLines('a\nx\ny\nz\n', 'a\np\nz\nw\n'))).toEqual({
            added: 1,
            changed: 1,
            removed: 1,
        });
        expect(countLineChanges([])).toEqual({ added: 0, changed: 0, removed: 0 });
    });
});

describe('markedLines', () => {
    test('lists the lines of the new code to mark, with their kind', () => {
        expect(markedLines(diffLines('a\nx\ny\nz\n', 'a\np\nz\nw\n'))).toEqual([
            { line: 2, kind: 'changed' },
            { line: 4, kind: 'added' },
        ]);
    });
});
