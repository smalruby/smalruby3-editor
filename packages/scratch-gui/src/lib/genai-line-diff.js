// The lines a generative AI's answer adds, changes or removes in the code of the Ruby
// tab (#1399): what the panel counts and the editor marks once the answer is in. The
// diff shown before putting it in is Monaco's own (genai-ruby-adapter.js); this one is
// the same lines in a form the panel and the marks can use without Monaco.

const splitLines = (code) => {
    const text = (code || '').replace(/\r\n?/g, '\n').replace(/\n$/, '');
    return text === '' ? [] : text.split('\n');
};

// The longest common subsequence of lines, as a table read from the end (the codes of
// a sprite are some hundred lines at most, so the plain table is enough).
const commonTable = (a, b) => {
    const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
        }
    }
    return table;
};

/**
 * The lines of two codes, compared line by line. Between two lines the codes share, the
 * lines removed and added in their place are paired as changed (as many as both have),
 * and the rest are added or removed.
 * @param {string} before - the code now
 * @param {string} after - the AI's code
 * @returns {Array<object>} [{kind: 'same' | 'added' | 'changed' | 'removed', text,
 *     beforeText? (changed), beforeLine, afterLine}] in order; lines are 1-based, null
 *     on the side the line is not in
 */
export const diffLines = (before, after) => {
    const a = splitLines(before);
    const b = splitLines(after);
    const table = commonTable(a, b);
    const out = [];
    let removed = [];
    let added = [];
    const flush = () => {
        const pairs = Math.min(removed.length, added.length);
        for (let k = 0; k < pairs; k++) {
            out.push({
                kind: 'changed',
                text: b[added[k]],
                beforeText: a[removed[k]],
                beforeLine: removed[k] + 1,
                afterLine: added[k] + 1,
            });
        }
        added
            .slice(pairs)
            .forEach((j) => out.push({ kind: 'added', text: b[j], beforeLine: null, afterLine: j + 1 }));
        removed
            .slice(pairs)
            .forEach((i) => out.push({ kind: 'removed', text: a[i], beforeLine: i + 1, afterLine: null }));
        removed = [];
        added = [];
    };
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && a[i] === b[j]) {
            flush();
            out.push({ kind: 'same', text: b[j], beforeLine: i + 1, afterLine: j + 1 });
            i++;
            j++;
        } else if (j < b.length && (i >= a.length || table[i][j + 1] >= table[i + 1][j])) {
            added.push(j++);
        } else {
            removed.push(i++);
        }
    }
    flush();
    return out;
};

/**
 * How many lines are added, changed and removed.
 * @param {Array<object>} diff - from diffLines
 * @returns {{added: number, changed: number, removed: number}} the counts
 */
export const countLineChanges = (diff) => {
    const counts = { added: 0, changed: 0, removed: 0 };
    diff.forEach((line) => {
        if (line.kind in counts) counts[line.kind] += 1;
    });
    return counts;
};

/**
 * The lines of the new code to mark in the editor (a removed line is not there to mark).
 * @param {Array<object>} diff - from diffLines
 * @returns {Array<{line: number, kind: string}>} the line (1-based) and 'added' or 'changed'
 */
export const markedLines = (diff) =>
    diff
        .filter((line) => line.kind === 'added' || line.kind === 'changed')
        .map((line) => ({ line: line.afterLine, kind: line.kind }));

/**
 * Where marked lines are after the code is replaced as a whole (the editor then drops its
 * marks): a line kept or changed in its place carries its mark along, a new line does not.
 * @param {string} before - the code before it was replaced
 * @param {string} after - the code now
 * @param {Array<number>} lines - the marked lines (1-based) in the code before
 * @returns {Set<number>} the lines (1-based) of the code now the marks are carried to
 */
export const carriedLines = (before, after, lines) => {
    const marked = new Set(lines);
    const carried = new Set();
    diffLines(before, after).forEach((line) => {
        if ((line.kind === 'same' || line.kind === 'changed') && marked.has(line.beforeLine)) {
            carried.add(line.afterLine);
        }
    });
    return carried;
};
