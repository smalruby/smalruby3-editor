// === Smalruby: This file is Smalruby-specific (DNCL ↔ Ruby source map) ===
import { codeOfLine } from './dncl-trailing-comment';

/** The length the converter cuts a quoted line to (`_truncateSource`). */
const QUOTE_LENGTH = 40;

/**
 * A line as the converter quotes it: the first line only, then cut, with `...` for what is left.
 * @param {string} text - The text.
 * @returns {string} The quoted text.
 */
const cut = (text) => (text.length > QUOTE_LENGTH ? `${text.slice(0, QUOTE_LENGTH)}...` : text);

/**
 * The code of a Japanese line, as the student reads it: without the line number (`(01)`), the
 * marks of the blocks on its left (`｜` `⎿`) and the comment at its end.
 * @param {string} line - The Japanese line.
 * @returns {string} The code.
 */
const jaCodeOfLine = (line) =>
    codeOfLine(line.replace(/^\s*\(\s*\d+(?:-\d+)*\s*\)/, '').replace(/^[\s｜|│⎿└]*/, '')).trim();

/**
 * Source map for DNCL ↔ Ruby line position mapping.
 *
 * DNCL and Ruby lines do not correspond 1:1: continuation lines are one
 * statement, a multi-assignment is several, a block of the standard form has
 * no closing line, and an input or a counting loop is 2 Ruby lines. The map
 * is therefore built from the Japanese line of each Ruby line that
 * ja-notation writes (use `dnclToRuby(dncl).sourceMap`).
 */
class DnclSourceMap {
    /**
     * Build a source map from the Ruby → DNCL line correspondence.
     * @param {Array<number>} rubyToDncl - `rubyToDncl[i]` is the 1-based DNCL
     *   line of Ruby line i+1.
     * @param {number} dnclLineCount - Number of lines in the DNCL source.
     * @param {object} [texts] - The sources (`ja`, `ruby`), so errors can quote the Japanese.
     */
    constructor(rubyToDncl, dnclLineCount, texts = {}) {
        this._jaLines = typeof texts.ja === 'string' ? texts.ja.split('\n') : null;
        this._rubyLines = typeof texts.ruby === 'string' ? texts.ruby.split('\n') : null;
        // rubyToDncl[i] = the DNCL line number (1-based) corresponding to
        // Ruby line i+1 (1-based)
        this._rubyToDncl = rubyToDncl.slice();

        // dnclToRuby[i] = the first Ruby line number (1-based) corresponding to
        // DNCL line i+1 (1-based)
        this._dnclToRuby = new Array(dnclLineCount).fill(null);
        this._rubyToDncl.forEach((dnclLine, idx) => {
            const dnclIdx = dnclLine - 1;
            if (dnclIdx >= 0 && dnclIdx < dnclLineCount && this._dnclToRuby[dnclIdx] === null) {
                this._dnclToRuby[dnclIdx] = idx + 1;
            }
        });
        // DNCL lines without their own Ruby line (continuation lines joined into
        // the line above) point at the Ruby line of the nearest line above.
        let previous = 1;
        for (let i = 0; i < this._dnclToRuby.length; i++) {
            if (this._dnclToRuby[i] === null) {
                this._dnclToRuby[i] = previous;
            } else {
                previous = this._dnclToRuby[i];
            }
        }
    }

    /**
     * Map a DNCL line number to a Ruby line number.
     * @param {number} dnclLine - 1-based DNCL line number.
     * @returns {number} 1-based Ruby line number.
     */
    dnclLineToRubyLine(dnclLine) {
        const idx = dnclLine - 1;
        if (idx < 0 || idx >= this._dnclToRuby.length) {
            return dnclLine;
        }
        return this._dnclToRuby[idx];
    }

    /**
     * Map a Ruby line number to a DNCL line number.
     *
     * Out-of-range Ruby lines are clamped to the first / last Ruby line. The
     * Ruby code is usually longer than the DNCL source, so returning the Ruby
     * line number unchanged would point at an unrelated or missing DNCL line.
     * @param {number} rubyLine - 1-based Ruby line number.
     * @returns {number} 1-based DNCL line number.
     */
    rubyLineToDnclLine(rubyLine) {
        const lastIdx = this._rubyToDncl.length - 1;
        if (lastIdx < 0) {
            return rubyLine;
        }
        const idx = Math.min(Math.max(rubyLine - 1, 0), lastIdx);
        return this._rubyToDncl[idx];
    }

    /**
     * The words of a conversion error with the Ruby it quotes (`"…" is the wrong instruction.`,
     * `「…」は…`) replaced by the Japanese line it was made from, as the student wrote it
     * (issue #1822): the Ruby has `@` and names the student did not write.
     * Only a quote that is the Ruby of the error (its statement, its line, or either cut as the
     * converter cuts them) is replaced; other quotes (the examples of a hint) are kept.
     * @param {object} err - The error, on its Ruby `row`.
     * @param {number} dnclRow - The 0-based DNCL row of the error.
     * @returns {string} The words.
     */
    _quoteJapanese(err, dnclRow) {
        const { text } = err;
        if (typeof text !== 'string' || !this._jaLines || !this._rubyLines) return text;
        const rubyLine = (this._rubyLines[err.row] || '').trim();
        const jaLine = this._jaLines[dnclRow];
        if (!rubyLine || typeof jaLine !== 'string') return text;
        const ja = jaCodeOfLine(jaLine);
        if (!ja) return text;
        const quoted = new Set([rubyLine, cut(rubyLine), `${rubyLine}...`, cut(`${rubyLine}...`)]);
        if (err.source) quoted.add(err.source);
        let words = text;
        [...quoted]
            .filter((ruby) => ruby !== ja)
            .sort((a, b) => b.length - a.length)
            .forEach((ruby) => {
                words = words
                    .split(`"${ruby}"`)
                    .join(`"${cut(ja)}"`)
                    .split(`「${ruby}」`)
                    .join(`「${cut(ja)}」`);
            });
        return words;
    }

    /**
     * Move conversion errors from their Ruby lines to the matching DNCL lines.
     *
     * Ruby columns have no DNCL counterpart, so each error is set to cover the
     * whole DNCL line (`column: 0`, `source: null`), and the Ruby the words
     * quote is replaced by the Japanese line.
     * @param {Array<object>} errors - Errors with a 0-based Ruby `row`.
     * @returns {Array<object>} Copies of the errors with a 0-based DNCL `row`.
     */
    rubyErrorsToDncl(errors) {
        return errors.map((err) => {
            const row = this.rubyLineToDnclLine(err.row + 1) - 1;
            return { ...err, row, column: 0, source: null, text: this._quoteJapanese(err, row) };
        });
    }
}

export { DnclSourceMap, jaCodeOfLine };
