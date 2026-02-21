import RubyGenerator from '../../../../src/lib/ruby-generator';
import MathBlocks from '../../../../src/lib/ruby-generator/math';

describe('RubyGenerator', () => {
    describe('math_number', () => {
        beforeEach(() => {
            MathBlocks(RubyGenerator);
        });

        const makeBlock = numFieldValue => ({
            id: 'block-id',
            opcode: 'math_number',
            fields: {
                NUM: {name: 'NUM', value: numFieldValue}
            }
        });

        test('integer field value returns number', () => {
            const [result] = RubyGenerator.math_number(makeBlock('1'));
            expect(result).toBe(1);
        });

        test('float field value with integer appearance (1.0) preserves decimal notation', () => {
            const [result] = RubyGenerator.math_number(makeBlock('1.0'));
            expect(result).toBe('1.0');
        });

        test('non-integer float field value (3.14) returns number', () => {
            const [result] = RubyGenerator.math_number(makeBlock('3.14'));
            expect(result).toBe(3.14);
        });

        test('negative float with integer appearance (-1.0) preserves decimal notation', () => {
            const [result] = RubyGenerator.math_number(makeBlock('-1.0'));
            expect(result).toBe('-1.0');
        });

        test('zero float (0.0) preserves decimal notation', () => {
            const [result] = RubyGenerator.math_number(makeBlock('0.0'));
            expect(result).toBe('0.0');
        });
    });

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
