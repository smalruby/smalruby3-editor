import RubyGenerator from '../../../../src/lib/ruby-generator';
import SmalrubyRubyBlocks from '../../../../src/lib/ruby-generator/smalruby-ruby';

describe('RubyGenerator/SmalrubyRuby', () => {
    let originalValueToCode;

    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        SmalrubyRubyBlocks(RubyGenerator);

        // Save original and mock valueToCode for testing
        originalValueToCode = RubyGenerator.valueToCode;
    });

    afterEach(() => {
        RubyGenerator.valueToCode = originalValueToCode;
    });

    describe('ruby_stringMethodR', () => {
        test('should generate delete method call', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {
                    STRING: '"hello world"',
                    ARG1: '"l"'
                };
                return map[name] || '';
            };

            const block = {
                opcode: 'ruby_stringMethodR',
                fields: {
                    METHOD: {value: 'delete'}
                }
            };
            const result = RubyGenerator.ruby_stringMethodR(block);
            expect(result[0]).toEqual('"hello world".delete("l")');
            expect(result[1]).toEqual(RubyGenerator.ORDER_FUNCTION_CALL);
        });

        test('should use default values when inputs are empty', () => {
            RubyGenerator.valueToCode = () => '';

            const block = {
                opcode: 'ruby_stringMethodR',
                fields: {
                    METHOD: {value: 'delete'}
                }
            };
            const result = RubyGenerator.ruby_stringMethodR(block);
            expect(result[0]).toEqual('"".delete("")');
        });

        test('should include ARG2 when present', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {
                    STRING: '"hello"',
                    ARG1: '"l"',
                    ARG2: '"o"'
                };
                return map[name] || '';
            };

            const block = {
                opcode: 'ruby_stringMethodR',
                fields: {
                    METHOD: {value: 'delete'}
                }
            };
            const result = RubyGenerator.ruby_stringMethodR(block);
            expect(result[0]).toEqual('"hello".delete("l", "o")');
        });
    });

    describe('ruby_stringMethodC', () => {
        test('should generate delete! method call', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {
                    STRING: '"hello world"',
                    ARG1: '"l"'
                };
                return map[name] || '';
            };

            const block = {
                opcode: 'ruby_stringMethodC',
                fields: {
                    METHOD: {value: 'delete!'}
                }
            };
            const result = RubyGenerator.ruby_stringMethodC(block);
            expect(result).toEqual('"hello world".delete!("l")\n');
        });

        test('should use default values when inputs are empty', () => {
            RubyGenerator.valueToCode = () => '';

            const block = {
                opcode: 'ruby_stringMethodC',
                fields: {
                    METHOD: {value: 'delete!'}
                }
            };
            const result = RubyGenerator.ruby_stringMethodC(block);
            expect(result).toEqual('"".delete!("")\n');
        });

        test('should include ARG2 when present', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {
                    STRING: '"hello"',
                    ARG1: '"l"',
                    ARG2: '"o"'
                };
                return map[name] || '';
            };

            const block = {
                opcode: 'ruby_stringMethodC',
                fields: {
                    METHOD: {value: 'delete!'}
                }
            };
            const result = RubyGenerator.ruby_stringMethodC(block);
            expect(result).toEqual('"hello".delete!("l", "o")\n');
        });
    });
});
