import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator/SmalrubyRuby', () => {
    beforeEach(() => {
        RubyGenerator.getFieldValue = (block, name) => {
            if (block.fields && block.fields[name]) {
                return block.fields[name].value;
            }
            return '';
        };
    });

    describe('smalrubyRuby_stringMethodR', () => {
        test('should generate reverse method call (no args)', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {STRING: '"Jimmy"'};
                return map[name] || '';
            };

            const block = {
                opcode: 'smalrubyRuby_stringMethodR',
                fields: {METHOD: {value: 'reverse'}}
            };
            const result = RubyGenerator.smalrubyRuby_stringMethodR(block);
            expect(result[0]).toEqual('"Jimmy".reverse');
        });

        test('should generate delete method call', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {
                    STRING: '"hello world"',
                    ARG1: '"l"'
                };
                return map[name] || '';
            };

            const block = {
                opcode: 'smalrubyRuby_stringMethodR',
                fields: {METHOD: {value: 'delete'}},
                inputs: {ARG1: {}}
            };
            const result = RubyGenerator.smalrubyRuby_stringMethodR(block);
            expect(result[0]).toEqual('"hello world".delete("l")');
        });

        test('should use default values when inputs are empty', () => {
            RubyGenerator.valueToCode = () => '';

            const block = {
                opcode: 'smalrubyRuby_stringMethodR',
                fields: {METHOD: {value: 'delete'}},
                inputs: {ARG1: {}}
            };
            const result = RubyGenerator.smalrubyRuby_stringMethodR(block);
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
                opcode: 'smalrubyRuby_stringMethodR',
                fields: {METHOD: {value: 'delete'}},
                inputs: {ARG1: {}, ARG2: {}}
            };
            const result = RubyGenerator.smalrubyRuby_stringMethodR(block);
            expect(result[0]).toEqual('"hello".delete("l", "o")');
        });

        test('should generate gsub with 2 args', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {STRING: '"hello"', ARG1: '"l"', ARG2: '"r"'};
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_stringMethodR',
                fields: {METHOD: {value: 'gsub'}},
                inputs: {ARG1: {}, ARG2: {}}
            };
            const result = RubyGenerator.smalrubyRuby_stringMethodR(block);
            expect(result[0]).toEqual('"hello".gsub("l", "r")');
        });
    });

    describe('smalrubyRuby_stringMethodC', () => {
        test('should generate delete! with variable receiver', () => {
            RubyGenerator.variableNameByName = name => name;
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {ARG1: '"l"'};
                return map[name] || '';
            };

            const block = {
                opcode: 'smalrubyRuby_stringMethodC',
                fields: {
                    STRING: {value: 'my_var'},
                    METHOD: {value: 'delete!'}
                }
            };
            const result = RubyGenerator.smalrubyRuby_stringMethodC(block);
            expect(result).toEqual('my_var.delete!("l")\n');
        });

        test('should use nil when variable not found', () => {
            RubyGenerator.variableNameByName = () => null;
            RubyGenerator.valueToCode = () => '';

            const block = {
                opcode: 'smalrubyRuby_stringMethodC',
                fields: {
                    STRING: {value: ''},
                    METHOD: {value: 'delete!'}
                }
            };
            const result = RubyGenerator.smalrubyRuby_stringMethodC(block);
            expect(result).toEqual('nil.delete!("")\n');
        });

        test('should include ARG2 when present', () => {
            RubyGenerator.variableNameByName = name => name;
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {ARG1: '"l"', ARG2: '"o"'};
                return map[name] || '';
            };

            const block = {
                opcode: 'smalrubyRuby_stringMethodC',
                fields: {
                    STRING: {value: 'x'},
                    METHOD: {value: 'delete!'}
                }
            };
            const result = RubyGenerator.smalrubyRuby_stringMethodC(block);
            expect(result).toEqual('x.delete!("l", "o")\n');
        });
    });
});
