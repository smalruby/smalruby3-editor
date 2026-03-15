// === Smalruby: This file is Smalruby-specific (Ruby code encoding helpers for RubyGenerator) ===

import _ from 'lodash';

/**
 * Register value encoding and string escaping methods on the RubyGenerator.
 * Handles: quote_, escapeChars_, scalarToCode, listToCode, hashToCode,
 * numberOrStringToCode, nosToCode, scrubNakedValue, isString, isWhiteSpace.
 * @param {object} Generator - The RubyGenerator instance.
 * @returns {object} The Generator instance.
 */
export default function (Generator) {
    Generator.isString = function (s) {
        return _.isString(s);
    };

    Generator.isWhiteSpace = function (s) {
        return s === null || (this.isString(s) && s.trim().length === 0);
    };

    Generator.scalarToCode = function (scalar) {
        if (this.isString(scalar)) {
            return this.quote_(scalar);
        }
        return scalar;
    };

    Generator.listToCode = function (list) {
        const values = list.map(i => {
            if (this.isString(i)) {
                return this.quote_(i);
            }
            return i;
        }).join(', ');
        return `[${values}]`;
    };

    Generator.hashToCode = function (hash, separator = ': ', brace = true) {
        const lines = [];
        for (const key in hash) {
            const value = hash[key];
            lines.push(`${key}${separator}${value}`);
        }
        let code = lines.join(',\n');
        if (brace) {
            code = ['{', this.prefixLines(code, this.INDENT), '}'].join('\n');
        }
        return code;
    };

    Generator.numberOrStringToCode = function (value) {
        if (Generator.isString(value) &&
            value[0] === '"' &&
            value[value.length - 1] === '"') {
            const s = value.slice(1, value.length - 1);
            const n = Number(s);
            if (!isNaN(n) && !(n === 0 && Generator.isWhiteSpace(s))) {
                return n;
            }
        }
        return value;
    };
    Generator.nosToCode = Generator.numberOrStringToCode;

    Generator.scrubNakedValue = function (line) {
        return `${line}\n`;
    };

    Generator.escapeChars_ = {
        '"': '\\"',
        '\\': '\\\\',
        '\n': '\\n',
        '\t': '\\t',
        '\r': '\\r',
        '\b': '\\b',
        '\f': '\\f',
        '\v': '\\v',
        '\0': '\\0'
    };

    Generator.quote_ = function (string) {
        let i;
        const s = String(string);
        const sb = ['"'];
        for (i = 0; i < s.length; i++) {
            const ch = s.charAt(i);
            sb.push(Generator.escapeChars_[ch] || ch);
        }
        sb.push('"');
        return sb.join('');
    };

    return Generator;
}
