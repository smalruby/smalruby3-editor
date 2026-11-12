// === Smalruby: This file is Smalruby-specific (trailing # comment of DNCL / Ruby lines) ===
import { skipString } from './paren-utils';

/**
 * Index of the `#` that starts the comment of a line, or -1 when there is
 * none. A `#` inside a string literal (`"..."` / `'...'`, or the DNCL
 * 「...」) is text, not a comment. An unclosed 「 is not a string.
 * @param {string} line - A DNCL or Ruby line.
 * @returns {number} Index of the comment `#`, or -1.
 */
const commentIndex = (line) => {
    let i = 0;
    while (i < line.length) {
        const ch = line[i];
        if (ch === '"' || ch === "'") {
            i = skipString(line, i, ch);
            continue;
        }
        if (ch === '「') {
            const close = line.indexOf('」', i + 1);
            if (close !== -1) {
                i = close + 1;
                continue;
            }
        }
        if (ch === '#') return i;
        i++;
    }
    return -1;
};

/**
 * Split the `# comment` at the end of a code line from the code, so the
 * line can be matched as a block opener / closer (`もし ... ならば`,
 * `を実行する`, `if ...`, `end`) and the comment put back at the end of the
 * converted line (Issue #1696).
 *
 * `comment` keeps the whitespace before the `#`, so `code + comment` is the
 * line again. A line that is only a comment is all code (`comment` is ''):
 * the converters already keep such lines as they are.
 * @param {string} line - A DNCL or Ruby line.
 * @returns {{code: string, comment: string}} The code and the comment.
 */
const splitTrailingComment = (line) => {
    const idx = commentIndex(line);
    if (idx === -1 || line.substring(0, idx).trim() === '') return { code: line, comment: '' };
    const code = line.substring(0, idx).replace(/\s+$/, '');
    return { code, comment: line.substring(code.length) };
};

export { splitTrailingComment };
