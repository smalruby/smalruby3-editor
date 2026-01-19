import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator', () => {
    describe('quote_', () => {
        test('should escape double quotes', () => {
            const result = RubyGenerator.quote_('"');
            expect(result).toBe('"\\\""');
        });

        test('should escape backslashes', () => {
            const result = RubyGenerator.quote_('\\');
            expect(result).toBe('"\\\\"');
        });

        test('should escape newline characters', () => {
            const result = RubyGenerator.quote_('\n');
            expect(result).toBe('"\\n"');
        });

        test('should escape tab characters', () => {
            const result = RubyGenerator.quote_('\t');
            expect(result).toBe('"\\t"');
        });

        test('should escape carriage return characters', () => {
            const result = RubyGenerator.quote_('\r');
            expect(result).toBe('"\\r"');
        });

        test('should escape backspace characters', () => {
            const result = RubyGenerator.quote_('\b');
            expect(result).toBe('"\\b"');
        });

        test('should escape form feed characters', () => {
            const result = RubyGenerator.quote_('\f');
            expect(result).toBe('"\\f"');
        });

        test('should escape vertical tab characters', () => {
            const result = RubyGenerator.quote_('\v');
            expect(result).toBe('"\\v"');
        });

        test('should escape null characters', () => {
            const result = RubyGenerator.quote_('\0');
            expect(result).toBe('"\\0"');
        });
    });
});
