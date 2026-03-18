import RubyGenerator from '../../../../../src/lib/ruby-generator';
import OperatorsBlocks from '../../../../../src/lib/ruby-generator/operators';
import DataBlocks from '../../../../../src/lib/ruby-generator/data';

describe('RubyGenerator/Operators/Regexp', () => {
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
        RubyGenerator.regexNotMatchCallCache_ = {};
        RubyGenerator.currentTarget = null;
        OperatorsBlocks(RubyGenerator);
        DataBlocks(RubyGenerator);
    });

    describe('operator_contains with =~ comment', () => {
        test('string =~ /pattern/', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_contains',
                inputs: {STRING1: {}, STRING2: {}}
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:operator:=~:1'};
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"hello"')
                .mockReturnValueOnce('"/^he/"');
            expect(RubyGenerator.operator_contains(block)).toEqual(
                ['"hello" =~ /^he/', RubyGenerator.ORDER_EQUALS]
            );
        });

        test('string =~ /pattern/i with flags', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_contains',
                inputs: {STRING1: {}, STRING2: {}}
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:operator:=~:1'};
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"Hello"')
                .mockReturnValueOnce('"/hello/i"');
            expect(RubyGenerator.operator_contains(block)).toEqual(
                ['"Hello" =~ /hello/i', RubyGenerator.ORDER_EQUALS]
            );
        });

        test('/pattern/ =~ string (receiver)', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_contains',
                inputs: {STRING1: {}, STRING2: {}}
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:operator:=~:1:receiver'};
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"hello"')
                .mockReturnValueOnce('"/^he/"');
            expect(RubyGenerator.operator_contains(block)).toEqual(
                ['/^he/ =~ "hello"', RubyGenerator.ORDER_EQUALS]
            );
        });

        test('variable =~ variable (no unquote needed)', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_contains',
                inputs: {STRING1: {}, STRING2: {}}
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:operator:=~:1'};
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('@name')
                .mockReturnValueOnce('r');
            expect(RubyGenerator.operator_contains(block)).toEqual(
                ['@name =~ r', RubyGenerator.ORDER_EQUALS]
            );
        });
    });

    describe('operator_not with !~ comment', () => {
        test('string !~ /pattern/', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_not',
                inputs: {OPERAND: {}}
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:operator:!~:1'};
            RubyGenerator.regexNotMatchCallCache_['1'] = {
                str: '"hello"', regex: '/world/', receiverFlag: undefined
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValue('@ruby:operator:!~:1');
            expect(RubyGenerator.operator_not(block)).toEqual(
                ['"hello" !~ /world/', RubyGenerator.ORDER_EQUALS]
            );
            expect(RubyGenerator.regexNotMatchCallCache_['1']).toBeUndefined();
        });

        test('/pattern/ !~ string (receiver)', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_not',
                inputs: {OPERAND: {}}
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:operator:!~:1:receiver'};
            RubyGenerator.regexNotMatchCallCache_['1:receiver'] = {
                str: '"hello"', regex: '/world/', receiverFlag: ':receiver'
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValue('@ruby:operator:!~:1:receiver');
            expect(RubyGenerator.operator_not(block)).toEqual(
                ['/world/ !~ "hello"', RubyGenerator.ORDER_EQUALS]
            );
        });
    });

    describe('operator_contains without comment (existing behavior)', () => {
        test('include? is preserved', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_contains',
                inputs: {STRING1: {}, STRING2: {}}
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"apple"')
                .mockReturnValueOnce('"a"');
            expect(RubyGenerator.operator_contains(block)).toEqual(
                ['"apple".include?("a")', RubyGenerator.ORDER_ATOMIC]
            );
        });
    });

    describe('data_setvariableto with @ruby:regexp:literal', () => {
        test('global variable regex assignment', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_setvariableto',
                inputs: {VALUE: {block: 'value-block-id'}},
                fields: {VARIABLE: {id: 'var-id', value: '$r'}}
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:regexp:literal'};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"/^hello/i"');
            RubyGenerator.variableName = jest.fn().mockReturnValue('$r');
            RubyGenerator.getFieldId = jest.fn().mockReturnValue('var-id');
            expect(RubyGenerator.data_setvariableto(block)).toBe('$r = /^hello/i\n');
        });

        test('local variable regex assignment', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_setvariableto',
                inputs: {VALUE: {block: 'value-block-id'}},
                fields: {VARIABLE: {id: 'var-id', value: '_r_1_'}}
            };
            RubyGenerator.cache_.comments['block-id'] = {
                text: '@ruby:lvar:r:1,@ruby:regexp:literal'
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"/^hello/"');
            RubyGenerator.variableName = jest.fn().mockReturnValue('_r_1_');
            RubyGenerator.getFieldId = jest.fn().mockReturnValue('var-id');
            expect(RubyGenerator.data_setvariableto(block)).toBe('r = /^hello/\n');
        });
    });
});
