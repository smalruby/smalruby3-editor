// === Smalruby: This file is Smalruby-specific (find a note that the array indexes start at 1) ===
//
// The arrays of the Japanese mode start at 0 unless the sentence at the top of
// the program says they start at 1 (docs/dncl/design.md 4 章). Some problems
// say it in their own words (`# 配列の添字は1から始まる`, `// 添字は1から`).
// When such a program is pasted, the editor offers to take the note as the
// setting (../../containers/ruby-tab/dncl-index-setting.js); the indexes of
// the pasted text are kept as they are written.

/**
 * A note saying the indexes start at 1: `添字は1から始まる`, `添え字は１から`,
 * `インデックスは 1 から` (full-width digits are normalized first).
 */
const NOTE_RE = /(?:添え?字|インデックス)[^0-9\n]{0,15}?1\s*から/;

/**
 * Mask string literals (`"..."`, `'...'`, `「...」`) with spaces, keeping the
 * quotes and the length, and find where the `#` comment starts.
 * @param {string} line - A DNCL source line.
 * @returns {{code: string, comment: number}} The masked line and the index
 *   of the comment `#` (`line.length` when there is none).
 */
const scanLine = (line) => {
    let code = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            if (ch === '\\' && quote !== '」' && i + 1 < line.length) {
                code += '  ';
                i++;
            } else {
                code += ch === quote ? ch : ' ';
                if (ch === quote) quote = null;
            }
            continue;
        }
        if (ch === '#') return { code: code + ' '.repeat(line.length - i), comment: i };
        if (ch === '"' || ch === "'") quote = ch;
        if (ch === '「') quote = '」';
        code += ch;
    }
    return { code, comment: line.length };
};

/**
 * Whether the pasted text has a note saying that array indexes start at 1.
 * Only comments are looked at (`# 配列の添字は1から始まる`, and `//` comments
 * of a sample that was not tidied).
 * @param {string} text - The pasted text.
 * @returns {boolean} True when such a note is found.
 */
const hasOneBasedIndexNote = (text) =>
    text.split(/\r?\n/).some((line) => {
        const { code, comment } = scanLine(line);
        const slash = code.indexOf('//');
        const start = slash >= 0 && slash < comment ? slash : comment;
        const note = line.substring(start).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
        return NOTE_RE.test(note);
    });

export { hasOneBasedIndexNote };
