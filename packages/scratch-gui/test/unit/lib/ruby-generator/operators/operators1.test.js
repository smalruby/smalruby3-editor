import RubyGenerator from '../../../../../src/lib/ruby-generator';
import OperatorsBlocks from '../../../../../src/lib/ruby-generator/operators';

describe('RubyGenerator/Operators', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {}
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.emptyCallCache_ = {};
        RubyGenerator.notEqualsCallCache_ = {};
        RubyGenerator.greaterThanOrEqualCallCache_ = {};
        RubyGenerator.lessThanOrEqualCallCache_ = {};
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

    describe('operator_subtract', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_subtract',
                inputs: {
                    NUM1: {},
                    NUM2: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('5')
                .mockReturnValueOnce('3');
            expect(RubyGenerator.operator_subtract(block))
                .toEqual(['5 - 3', RubyGenerator.ORDER_ADDITIVE]);
        });

        test('with @ruby:array:index passes through NUM1 for round-trip', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_subtract',
                inputs: {
                    NUM1: {block: 'itemnumoflist-block-id'},
                    NUM2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:array:index'};
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('@my_list.index("thing")');
            expect(RubyGenerator.operator_subtract(block))
                .toEqual(['@my_list.index("thing")', RubyGenerator.ORDER_FUNCTION_CALL]);
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

    describe('operator_not', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_not',
                inputs: {
                    OPERAND: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('true');
            expect(RubyGenerator.operator_not(block)).toEqual(['!true', RubyGenerator.ORDER_UNARY_SIGN]);
        });

        test('with @ruby:operator:!=:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_not',
                inputs: {
                    OPERAND: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:operator:!=:1' };
            RubyGenerator.notEqualsCallCache_['1'] = { lhs: '1', rhs: '2' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('@ruby:operator:!=:1');

            expect(RubyGenerator.operator_not(block)).toEqual(['1 != 2', RubyGenerator.ORDER_EQUALS]);
            expect(RubyGenerator.notEqualsCallCache_['1']).toBeUndefined();
        });
    });

    describe('operator_gt', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_gt',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2');
            RubyGenerator.nosToCode = jest.fn(v => v);
            expect(RubyGenerator.operator_gt(block)).toEqual(['1 > 2', RubyGenerator.ORDER_RELATIONAL]);
        });

        test('with @ruby:operator:>=:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_gt',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:operator:>=:1' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2');
            RubyGenerator.nosToCode = jest.fn(v => v);

            expect(RubyGenerator.operator_gt(block)).toEqual(['@ruby:operator:>=:1', RubyGenerator.ORDER_RELATIONAL]);
            expect(RubyGenerator.greaterThanOrEqualCallCache_['1']).toEqual({ lhs: '1', rhs: '2' });
        });
    });
});
