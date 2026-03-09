import PrismErrorTranslator from '../../../../src/lib/ruby-to-blocks-converter/prism-error-translator';

describe('PrismErrorTranslator', () => {
    let translator;

    // Default translator uses defaultMessage (English with hints)
    beforeEach(() => {
        translator = new PrismErrorTranslator();
    });

    describe('missing closing delimiters', () => {
        test('missing ) for arguments', () => {
            const result = translator.translate(
                "unexpected end-of-input; expected a `)` to close the arguments"
            );
            expect(result).not.toBe("unexpected end-of-input; expected a `)` to close the arguments");
            expect(result).toMatch(/`\)`/);
        });

        test('missing ] for array', () => {
            const result = translator.translate(
                "unexpected end-of-input; expected a `]` to close the array"
            );
            expect(result).toMatch(/`\]`/);
        });

        test('missing } for hash', () => {
            const result = translator.translate(
                "expected a `}` to close the hash literal"
            );
            expect(result).toMatch(/`\}`/);
        });

        test('missing } for block with {', () => {
            const result = translator.translate(
                "expected a block beginning with `{` to end with `}`"
            );
            expect(result).toMatch(/`\}`/);
        });
    });

    describe('missing end keyword', () => {
        test('missing end for def', () => {
            const result = translator.translate(
                "expected an `end` to close the `def` statement"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`def`/);
        });

        test('missing end for conditional (if)', () => {
            const result = translator.translate(
                "expected an `end` to close the conditional clause"
            );
            expect(result).toMatch(/`end`/);
        });

        test('missing end for class', () => {
            const result = translator.translate(
                "expected an `end` to close the `class` statement"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`class`/);
        });

        test('missing end for while', () => {
            const result = translator.translate(
                "expected an `end` to close the `while` statement"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`while`/);
        });

        test('missing end for until', () => {
            const result = translator.translate(
                "expected an `end` to close the `until` statement"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`until`/);
        });

        test('missing end for do block', () => {
            const result = translator.translate(
                "expected a block beginning with `do` to end with `end`"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`do`/);
        });

        test('missing end for else', () => {
            const result = translator.translate(
                "expected an `end` to close the `else` clause"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`else`/);
        });

        test('missing end for case', () => {
            const result = translator.translate(
                "expected an `end` to close the `case` statement"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`case`/);
        });

        test('missing end for begin', () => {
            const result = translator.translate(
                "expected an `end` to close the `begin` statement"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`begin`/);
        });
    });

    describe('unterminated string', () => {
        test('unterminated string', () => {
            const result = translator.translate(
                "unterminated string meets end of file"
            );
            expect(result).not.toBe("unterminated string meets end of file");
        });
    });

    describe('unexpected end-of-input', () => {
        test('generic end-of-input', () => {
            const result = translator.translate(
                "unexpected end-of-input, assuming it is closing the parent top level context"
            );
            expect(result).not.toBe(
                "unexpected end-of-input, assuming it is closing the parent top level context"
            );
        });
    });

    describe('unexpected end', () => {
        test('extra end keyword', () => {
            const result = translator.translate(
                "unexpected 'end', ignoring it"
            );
            expect(result).toMatch(/`end`/);
        });
    });

    describe('other common errors', () => {
        test('cannot parse expression', () => {
            const result = translator.translate(
                "cannot parse the expression"
            );
            expect(result).not.toBe("cannot parse the expression");
        });

        test('missing => in hash', () => {
            const result = translator.translate(
                "expected a `=>` between the hash key and value"
            );
            expect(result).toMatch(/`=>`/);
        });

        test('missing then or semicolon', () => {
            const result = translator.translate(
                "expected `then` or `;` or '\\n'"
            );
            expect(result).toMatch(/`then`/);
        });

        test('missing | for block params', () => {
            const result = translator.translate(
                "expected the block parameters to end with `|`"
            );
            expect(result).toMatch(/`\|`/);
        });

        test('missing ) for parameters with %s', () => {
            const result = translator.translate(
                "unexpected end-of-input; expected a `)` to close the parameters"
            );
            expect(result).toMatch(/`\)`/);
        });
    });

    describe('fallback for unknown messages', () => {
        test('returns original message for unrecognized errors', () => {
            const msg = "some unknown prism error message";
            const result = translator.translate(msg);
            expect(result).toBe(msg);
        });
    });

    describe('with custom translator function', () => {
        test('uses provided translator for i18n', () => {
            const mockTranslator = (message, values) => {
                let text = message.defaultMessage;
                if (values) {
                    Object.keys(values).forEach(key => {
                        text = text.replace(
                            new RegExp(`\\{\\s*${key}\\s*\\}`, 'g'),
                            values[key]
                        );
                    });
                }
                return text;
            };
            const t = new PrismErrorTranslator(mockTranslator);
            const result = t.translate(
                "expected an `end` to close the `def` statement"
            );
            expect(result).toMatch(/`end`/);
            expect(result).toMatch(/`def`/);
        });
    });
});
