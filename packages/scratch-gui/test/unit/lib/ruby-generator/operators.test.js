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

    describe('operator_lt', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_lt',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2');
            RubyGenerator.nosToCode = jest.fn(v => v);
            expect(RubyGenerator.operator_lt(block)).toEqual(['1 < 2', RubyGenerator.ORDER_RELATIONAL]);
        });

        test('with @ruby:operator:<=:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_lt',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:operator:<=:1' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2');
            RubyGenerator.nosToCode = jest.fn(v => v);

            expect(RubyGenerator.operator_lt(block)).toEqual(['@ruby:operator:<=:1', RubyGenerator.ORDER_RELATIONAL]);
            expect(RubyGenerator.lessThanOrEqualCallCache_['1']).toEqual({ lhs: '1', rhs: '2' });
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

        test('with @ruby:operator:!=:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_equals',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:operator:!=:1' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2');
            RubyGenerator.nosToCode = jest.fn(v => v);

            expect(RubyGenerator.operator_equals(block)).toEqual(['@ruby:operator:!=:1', RubyGenerator.ORDER_EQUALS]);
            expect(RubyGenerator.notEqualsCallCache_['1']).toEqual({ lhs: '1', rhs: '2' });
        });

        test('with @ruby:operator:>=:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_equals',
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

            expect(RubyGenerator.operator_equals(block)).toEqual(['@ruby:operator:>=:1', RubyGenerator.ORDER_EQUALS]);
        });

        test('with @ruby:operator:<=:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_equals',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:operator:<=:1' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('2');
            RubyGenerator.nosToCode = jest.fn(v => v);

            expect(RubyGenerator.operator_equals(block)).toEqual(['@ruby:operator:<=:1', RubyGenerator.ORDER_EQUALS]);
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

        test('with @ruby:method:empty? for list', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_equals',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:empty?:1' };
            RubyGenerator.emptyCallCache_['1'] = 'list("my list")';
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('@ruby:method:empty?:1')
                .mockReturnValueOnce('0');
            RubyGenerator.nosToCode = jest.fn(v => {
                if (v === '0') return 0;
                return v;
            });

            expect(RubyGenerator.operator_equals(block)).toEqual(['list("my list").empty?', RubyGenerator.ORDER_FUNCTION_CALL]);
            expect(RubyGenerator.emptyCallCache_['1']).toBeUndefined();
        });
    });

    describe('operator_or', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_or',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('true')
                .mockReturnValueOnce('false');
            expect(RubyGenerator.operator_or(block)).toEqual(['true || false', RubyGenerator.ORDER_LOGICAL_OR]);
        });

        test('with @ruby:operator:>=:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_or',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:operator:>=:1' };
            RubyGenerator.greaterThanOrEqualCallCache_['1'] = { lhs: '1', rhs: '2' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValueOnce('@ruby:operator:>=:1');

            expect(RubyGenerator.operator_or(block)).toEqual(['1 >= 2', RubyGenerator.ORDER_RELATIONAL]);
            expect(RubyGenerator.greaterThanOrEqualCallCache_['1']).toBeUndefined();
        });

        test('with @ruby:operator:<=:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_or',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:operator:<=:1' };
            RubyGenerator.lessThanOrEqualCallCache_['1'] = { lhs: '1', rhs: '2' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValueOnce('@ruby:operator:<=:1');

            expect(RubyGenerator.operator_or(block)).toEqual(['1 <= 2', RubyGenerator.ORDER_RELATIONAL]);
            expect(RubyGenerator.lessThanOrEqualCallCache_['1']).toBeUndefined();
        });
    });
});
