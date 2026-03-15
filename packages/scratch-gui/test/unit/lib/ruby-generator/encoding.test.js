import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator encoding helpers', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
    });

    describe('quote_', () => {
        test('wraps string in double quotes', () => {
            expect(RubyGenerator.quote_('hello')).toEqual('"hello"');
        });

        test('escapes double quote', () => {
            expect(RubyGenerator.quote_('say "hi"')).toEqual('"say \\"hi\\""');
        });

        test('escapes backslash', () => {
            expect(RubyGenerator.quote_('a\\b')).toEqual('"a\\\\b"');
        });

        test('escapes newline, tab, carriage return', () => {
            expect(RubyGenerator.quote_('a\nb')).toEqual('"a\\nb"');
            expect(RubyGenerator.quote_('a\tb')).toEqual('"a\\tb"');
            expect(RubyGenerator.quote_('a\rb')).toEqual('"a\\rb"');
        });

        test('escapes null, backspace, form feed, vertical tab', () => {
            expect(RubyGenerator.quote_('a\0b')).toEqual('"a\\0b"');
            expect(RubyGenerator.quote_('a\bb')).toEqual('"a\\bb"');
            expect(RubyGenerator.quote_('a\fb')).toEqual('"a\\fb"');
            expect(RubyGenerator.quote_('a\vb')).toEqual('"a\\vb"');
        });

        test('converts number to string', () => {
            expect(RubyGenerator.quote_(42)).toEqual('"42"');
        });
    });

    describe('scalarToCode', () => {
        test('quotes string values', () => {
            expect(RubyGenerator.scalarToCode('hello')).toEqual('"hello"');
        });

        test('returns non-string values as-is', () => {
            expect(RubyGenerator.scalarToCode(42)).toEqual(42);
            expect(RubyGenerator.scalarToCode(true)).toEqual(true);
        });
    });

    describe('listToCode', () => {
        test('returns empty array for empty list', () => {
            expect(RubyGenerator.listToCode([])).toEqual('[]');
        });

        test('quotes string items', () => {
            expect(RubyGenerator.listToCode(['a', 'b'])).toEqual('["a", "b"]');
        });

        test('does not quote non-string items', () => {
            expect(RubyGenerator.listToCode([1, 2, 3])).toEqual('[1, 2, 3]');
        });

        test('handles mixed types', () => {
            expect(RubyGenerator.listToCode([1, 'two', 3])).toEqual('[1, "two", 3]');
        });
    });

    describe('hashToCode', () => {
        test('generates Ruby hash with braces by default', () => {
            const result = RubyGenerator.hashToCode({x: 10, y: 20});
            expect(result).toEqual('{\n  x: 10,\n  y: 20\n}');
        });

        test('generates hash without braces when brace=false', () => {
            const result = RubyGenerator.hashToCode({x: 10}, ': ', false);
            expect(result).toEqual('x: 10');
        });

        test('uses custom separator', () => {
            const result = RubyGenerator.hashToCode({a: 1}, ' => ', false);
            expect(result).toEqual('a => 1');
        });
    });

    describe('numberOrStringToCode', () => {
        test('converts quoted number string to number', () => {
            expect(RubyGenerator.numberOrStringToCode('"42"')).toEqual(42);
            expect(RubyGenerator.numberOrStringToCode('"3.14"')).toEqual(3.14);
            expect(RubyGenerator.numberOrStringToCode('"-5"')).toEqual(-5);
        });

        test('returns non-numeric quoted string as-is', () => {
            expect(RubyGenerator.numberOrStringToCode('"hello"')).toEqual('"hello"');
        });

        test('returns non-quoted value as-is', () => {
            expect(RubyGenerator.numberOrStringToCode(42)).toEqual(42);
            expect(RubyGenerator.numberOrStringToCode('hello')).toEqual('hello');
        });

        test('does not convert whitespace-only to zero', () => {
            expect(RubyGenerator.numberOrStringToCode('" "')).toEqual('" "');
            expect(RubyGenerator.numberOrStringToCode('""')).toEqual('""');
        });
    });

    describe('nosToCode alias', () => {
        test('is the same function as numberOrStringToCode', () => {
            expect(RubyGenerator.nosToCode).toBe(RubyGenerator.numberOrStringToCode);
        });
    });

    describe('scrubNakedValue', () => {
        test('appends newline to value', () => {
            expect(RubyGenerator.scrubNakedValue('x')).toEqual('x\n');
        });
    });

    describe('isString', () => {
        test('returns true for strings', () => {
            expect(RubyGenerator.isString('hello')).toBe(true);
            expect(RubyGenerator.isString('')).toBe(true);
        });

        test('returns false for non-strings', () => {
            expect(RubyGenerator.isString(42)).toBe(false);
            expect(RubyGenerator.isString(null)).toBe(false);
        });
    });

    describe('isWhiteSpace', () => {
        test('returns true for null', () => {
            expect(RubyGenerator.isWhiteSpace(null)).toBe(true);
        });

        test('returns true for empty/whitespace strings', () => {
            expect(RubyGenerator.isWhiteSpace('')).toBe(true);
            expect(RubyGenerator.isWhiteSpace('   ')).toBe(true);
        });

        test('returns false for non-whitespace strings', () => {
            expect(RubyGenerator.isWhiteSpace('x')).toBe(false);
        });
    });
});
