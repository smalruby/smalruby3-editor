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

        test('with @ruby:literal:false:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_lt',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:literal:false:1' };
            expect(RubyGenerator.operator_lt(block)).toEqual(['false', RubyGenerator.ORDER_ATOMIC]);
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

        test('with @ruby:literal:true:1', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_equals',
                inputs: {
                    OPERAND1: {},
                    OPERAND2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:literal:true:1' };
            expect(RubyGenerator.operator_equals(block)).toEqual(['true', RubyGenerator.ORDER_ATOMIC]);
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
