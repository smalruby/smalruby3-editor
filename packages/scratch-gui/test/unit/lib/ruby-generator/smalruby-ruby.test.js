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

    describe('stringMethod', () => {
        test('should generate reverse (no args)', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = { RECEIVER: '"hello"' };
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_stringMethod',
                fields: { METHOD: { value: 'reverse' } },
            };
            const result = RubyGenerator.smalrubyRuby_stringMethod(block);
            expect(result).toEqual('"hello".reverse\n');
        });

        test('should generate delete (1 arg)', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = { RECEIVER: '"hello"', ARG1: '"l"' };
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_stringMethod',
                fields: { METHOD: { value: 'delete' } },
                inputs: { ARG1: {} },
            };
            const result = RubyGenerator.smalrubyRuby_stringMethod(block);
            expect(result).toEqual('"hello".delete("l")\n');
        });

        test('should generate gsub (2 args)', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = { RECEIVER: '"hello"', ARG1: '"l"', ARG2: '"r"' };
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_stringMethod',
                fields: { METHOD: { value: 'gsub' } },
                inputs: { ARG1: {}, ARG2: {} },
            };
            const result = RubyGenerator.smalrubyRuby_stringMethod(block);
            expect(result).toEqual('"hello".gsub("l", "r")\n');
        });

        test('should generate bang method with variable receiver', () => {
            RubyGenerator.variableNameByName = (name) => name;
            RubyGenerator.valueToCode = () => '';
            const block = {
                opcode: 'smalrubyRuby_stringMethod',
                fields: {
                    METHOD: { value: 'reverse!' },
                    RECEIVER: { value: 'name' },
                },
            };
            const result = RubyGenerator.smalrubyRuby_stringMethod(block);
            expect(result).toEqual('name.reverse!\n');
        });
    });

    describe('arrayMethod', () => {
        test('should generate max (no args)', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = { RECEIVER: 'ticket' };
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_arrayMethod',
                fields: { METHOD: { value: 'max' } },
            };
            const result = RubyGenerator.smalrubyRuby_arrayMethod(block);
            expect(result).toEqual('ticket.max\n');
        });

        test('should generate join with separator', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = { RECEIVER: 'ticket', ARG1: '", "' };
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_arrayMethod',
                fields: { METHOD: { value: 'join' } },
                inputs: { ARG1: {} },
            };
            const result = RubyGenerator.smalrubyRuby_arrayMethod(block);
            expect(result).toEqual('ticket.join(", ")\n');
        });
    });

    describe('returnValue', () => {
        test('should generate _rv_ placeholder', () => {
            const block = { opcode: 'smalrubyRuby_returnValue' };
            const result = RubyGenerator.smalrubyRuby_returnValue(block);
            expect(result[0]).toEqual('_rv_');
        });
    });

    describe('returnValueTruthy', () => {
        test('should generate _rv_truthy_ placeholder', () => {
            const block = { opcode: 'smalrubyRuby_returnValueTruthy' };
            const result =
                RubyGenerator.smalrubyRuby_returnValueTruthy(block);
            expect(result[0]).toEqual('_rv_truthy_');
        });
    });
});
