import RubyGenerator from '../../../../src/lib/ruby-generator';
import OperatorsBlocks from '../../../../src/lib/ruby-generator/operators';

describe('RubyGenerator/Operators', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {}
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.emptyCallCache_ = {};
        RubyGenerator.currentTarget = null;
        OperatorsBlocks(RubyGenerator);
    });

    describe('operator_add', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_add',
                inputs: {
                    NUM1: {},
                    NUM2: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2');
            expect(RubyGenerator.operator_add(block)).toEqual(['1 + 2', RubyGenerator.ORDER_ADDITIVE]);
        });

        test('with @ruby:method:to_i', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_add',
                inputs: {
                    NUM1: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:to_i' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('x');
            expect(RubyGenerator.operator_add(block)).toEqual(['x.to_i', RubyGenerator.ORDER_FUNCTION_CALL]);
        });
    });

    describe('operator_join', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_join',
                inputs: {
                    STRING1: {},
                    STRING2: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"hello "')
                .mockReturnValueOnce('"world"');
            expect(RubyGenerator.operator_join(block)).toEqual(['"hello " + "world"', RubyGenerator.ORDER_ADDITIVE]);
        });

        test('with @ruby:method:to_s', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_join',
                inputs: {
                    STRING1: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:to_s' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('x');
            expect(RubyGenerator.operator_join(block)).toEqual(['x.to_s', RubyGenerator.ORDER_FUNCTION_CALL]);
        });
    });

    describe('operator_length', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_length',
                inputs: {
                    STRING: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"apple"');
            expect(RubyGenerator.operator_length(block)).toEqual(['"apple".length', RubyGenerator.ORDER_FUNCTION_CALL]);
        });

        test('with @ruby:method:empty?', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_length',
                inputs: {
                    STRING: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:empty?:1' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('x');
            expect(RubyGenerator.operator_length(block)).toEqual(['@ruby:method:empty?:1', RubyGenerator.ORDER_FUNCTION_CALL]);
            expect(RubyGenerator.emptyCallCache_['1']).toEqual('x');
        });
    });

    describe('operator_equals', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_equals',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2');
            RubyGenerator.nosToCode = jest.fn(v => v);
            expect(RubyGenerator.operator_equals(block)).toEqual(['1 == 2', RubyGenerator.ORDER_EQUALS]);
        });

        test('with @ruby:method:empty?', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_equals',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:empty?:1' };
            RubyGenerator.emptyCallCache_['1'] = 'x';
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('@ruby:method:empty?:1')
                .mockReturnValueOnce('0');
            RubyGenerator.nosToCode = jest.fn(v => {
                if (v === '0') return 0;
                return v;
            });

            expect(RubyGenerator.operator_equals(block)).toEqual(['x.empty?', RubyGenerator.ORDER_FUNCTION_CALL]);
            expect(RubyGenerator.emptyCallCache_['1']).toBeUndefined();
        });
    });
});
