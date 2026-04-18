import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator/SmalrubyRuby', () => {
    beforeEach(() => {
        RubyGenerator.getFieldValue = (block, name) => {
            if (block.fields && block.fields[name]) {
                return block.fields[name].value;
            }
            return '';
        };
        RubyGenerator.getBlock = () => null;
        RubyGenerator._smalrubyLastMethodExpr = null;
        RubyGenerator.requires_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.prepares_ = {};
    });

    describe('stringMethod', () => {
        test('should generate reverse as statement', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = { RECEIVER: '"hello"' };
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_stringMethod',
                fields: { METHOD: { value: 'reverse' } },
                next: null,
            };
            const result =
                RubyGenerator.smalrubyRuby_stringMethod(block);
            expect(result).toEqual('"hello".reverse\n');
        });

        test('should generate delete with args', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = { RECEIVER: '"hello"', ARG1: '"l"' };
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_stringMethod',
                fields: { METHOD: { value: 'delete' } },
                inputs: { ARG1: {} },
                next: null,
            };
            const result =
                RubyGenerator.smalrubyRuby_stringMethod(block);
            expect(result).toEqual('"hello".delete("l")\n');
        });

        test('should generate gsub with 2 args', () => {
            RubyGenerator.valueToCode = (block, name, _order) => {
                const map = {
                    RECEIVER: '"hello"',
                    ARG1: '"l"',
                    ARG2: '"r"',
                };
                return map[name] || '';
            };
            const block = {
                opcode: 'smalrubyRuby_stringMethod',
                fields: { METHOD: { value: 'gsub' } },
                inputs: { ARG1: {}, ARG2: {} },
                next: null,
            };
            const result =
                RubyGenerator.smalrubyRuby_stringMethod(block);
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
                next: null,
            };
            const result =
                RubyGenerator.smalrubyRuby_stringMethod(block);
            expect(result).toEqual('name.reverse!\n');
        });
    });

    describe('returnValue', () => {
        test('should return _rv_ placeholder', () => {
            const block = { opcode: 'smalrubyRuby_returnValue' };
            const result =
                RubyGenerator.smalrubyRuby_returnValue(block);
            expect(result[0]).toEqual('_rv_');
        });
    });

    describe('returnValueTruthy', () => {
        test('should return _rv_truthy_ placeholder', () => {
            const block = {
                opcode: 'smalrubyRuby_returnValueTruthy',
            };
            const result =
                RubyGenerator.smalrubyRuby_returnValueTruthy(block);
            expect(result[0]).toEqual('_rv_truthy_');
        });
    });

    describe('finishTargets (post-processing)', () => {
        test('should inline _rv_ with preceding method call', () => {
            const input =
                '  "Jimmy".reverse\n  say(_rv_, 2)\n';
            const result = RubyGenerator.finishTargets(input, {});
            expect(result).toEqual(
                '  say("Jimmy".reverse, 2)\n',
            );
        });

        test('should inline _rv_ with gsub (args)', () => {
            const input =
                '  "hello".gsub("l", "r")\n  say(_rv_, 2)\n';
            const result = RubyGenerator.finishTargets(input, {});
            expect(result).toEqual(
                '  say("hello".gsub("l", "r"), 2)\n',
            );
        });

        test('should inline _rv_truthy_ with empty?', () => {
            const input =
                '  name.empty?\n  if _rv_truthy_\n';
            const result = RubyGenerator.finishTargets(input, {});
            expect(result).toEqual('  if name.empty?\n');
        });

        test('should not inline when no _rv_ reference follows', () => {
            const input = '  "hello".reverse\n  say("world")\n';
            const result = RubyGenerator.finishTargets(input, {});
            expect(result).toEqual(
                '  "hello".reverse\n  say("world")\n',
            );
        });

        test('should handle array method max', () => {
            const input =
                '  ticket.max\n  say(_rv_, 2)\n';
            const result = RubyGenerator.finishTargets(input, {});
            expect(result).toEqual('  say(ticket.max, 2)\n');
        });

        test('should handle hash method keys', () => {
            const input =
                '  books.keys\n  say(_rv_)\n';
            const result = RubyGenerator.finishTargets(input, {});
            expect(result).toEqual('  say(books.keys)\n');
        });
    });
});
