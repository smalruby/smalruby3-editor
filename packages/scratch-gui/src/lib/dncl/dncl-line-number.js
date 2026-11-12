// === Smalruby: This file is Smalruby-specific (separator between DNCL line numbers and the code) ===

/**
 * How much of the whitespace after a line number separates it from the code,
 * so that the rest is the indent of the code (Issue #1718).
 *
 * Two ways of writing line numbers are found in DNCL examples:
 *   - the code starts at the same column on every line: shorter labels get
 *     more spaces (`(9)  x` / `(10) x`)
 *   - the code starts one space after every label, whatever its length
 *     (`(00-1) a` / `(01) b`)
 * When, for every label length, the least indented line starts its code at
 * the same column, the numbers are aligned and each label length takes off
 * what reaches that column. Otherwise the same separator (the whitespace of
 * the least indented line) is taken off every line.
 * @param {Array<{label: string, ws: string}>} lines - The label and the
 *   whitespace after it of each numbered line that has code.
 * @returns {function(string): number} The number of whitespace characters
 *   to take off after the given label.
 */
const lineNumberSeparator = (lines) => {
    const minByLength = new Map();
    for (const { label, ws } of lines) {
        const min = minByLength.get(label.length);
        if (!minByLength.has(label.length) || ws.length < min) minByLength.set(label.length, ws.length);
    }
    if (minByLength.size === 0) return () => 0;
    const columns = new Set([...minByLength].map(([length, min]) => length + min));
    if (minByLength.size > 1 && columns.size === 1) {
        const [column] = columns;
        return (label) => Math.max(0, column - label.length);
    }
    const separator = Math.min(...minByLength.values());
    return () => separator;
};

export { lineNumberSeparator };
