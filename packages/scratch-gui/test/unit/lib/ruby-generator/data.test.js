import RubyGenerator from '../../../../src/lib/ruby-generator';
import DataBlocks from '../../../../src/lib/ruby-generator/data';

describe('RubyGenerator/Data', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {}
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.emptyCallCache_ = {};
        RubyGenerator.currentTarget = null;
        DataBlocks(RubyGenerator);
    });

    describe('data_setvariableto', () => {
        const makeCompoundAssignmentTest = (operator, opcode, rhValue) => {
            const operatorBlock = {
                id: 'operator-block-id',
                opcode: opcode,
                inputs: {
                    NUM2: {block: 'num2-block-id'}
                }
            };
            const block = {
                id: 'block-id',
                opcode: 'data_setvariableto',
                fields: {
                    VARIABLE: {
                        id: 'var-id',
                        value: 'a'
                    }
                },
                inputs: {
                    VALUE: {
                        block: 'operator-block-id'
                    }
                }
            };
            RubyGenerator.cache_.comments['block-id'] = {text: `@ruby:syntax:${operator}=`};
            RubyGenerator.variableName = jest.fn().mockReturnValue('@a');
            RubyGenerator.getFieldId = jest.fn().mockReturnValue('var-id');
            RubyGenerator.getBlock = jest.fn().mockReturnValue(operatorBlock);
            RubyGenerator.valueToCode = jest.fn().mockReturnValue(String(rhValue));
            RubyGenerator.nosToCode = jest.fn(v => v);
            return block;
        };

        test('compound assignment -= generates variable -= value', () => {
            const block = makeCompoundAssignmentTest('-', 'operator_subtract', 1);
            expect(RubyGenerator.data_setvariableto(block)).toEqual('@a -= 1\n');
        });

        test('compound assignment *= generates variable *= value', () => {
            const block = makeCompoundAssignmentTest('*', 'operator_multiply', 2);
            expect(RubyGenerator.data_setvariableto(block)).toEqual('@a *= 2\n');
        });

        test('compound assignment /= generates variable /= value', () => {
            const block = makeCompoundAssignmentTest('/', 'operator_divide', 2);
            expect(RubyGenerator.data_setvariableto(block)).toEqual('@a /= 2\n');
        });

        test('compound assignment %= generates variable %= value', () => {
            const block = makeCompoundAssignmentTest('%', 'operator_mod', 3);
            expect(RubyGenerator.data_setvariableto(block)).toEqual('@a %= 3\n');
        });
    });

    describe('data_lengthoflist', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_lengthoflist',
                fields: {
                    LIST: {
                        id: 'list-id',
                        value: 'my list'
                    }
                }
            };
            RubyGenerator.listName = jest.fn().mockReturnValue('my list');
            expect(RubyGenerator.data_lengthoflist(block)).toEqual(['list("my list").length', RubyGenerator.ORDER_FUNCTION_CALL]);
        });

        test('with @ruby:method:empty?', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_lengthoflist',
                fields: {
                    LIST: {
                        id: 'list-id',
                        value: 'my list'
                    }
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:empty?:1' };
            RubyGenerator.listName = jest.fn().mockReturnValue('my list');
            expect(RubyGenerator.data_lengthoflist(block)).toEqual(['@ruby:method:empty?:1', RubyGenerator.ORDER_FUNCTION_CALL]);
            expect(RubyGenerator.emptyCallCache_['1']).toEqual('list("my list")');
        });
    });
});
