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

    describe('list operations - array syntax', () => {
        const makeListBlock = (opcode, extraInputs = {}) => {
            const block = {
                id: 'block-id',
                opcode: opcode,
                fields: {
                    LIST: {
                        id: 'list-id',
                        value: 'my list'
                    }
                },
                inputs: extraInputs
            };
            return block;
        };

        beforeEach(() => {
            RubyGenerator.listName = jest.fn().mockReturnValue('@my_list');
            RubyGenerator.getFieldId = jest.fn().mockReturnValue('list-id');
            RubyGenerator.nosToCode = jest.fn(v => v);
        });

        test('data_listcontents returns array variable name', () => {
            const block = makeListBlock('data_listcontents');
            expect(RubyGenerator.data_listcontents(block))
                .toEqual(['@my_list', RubyGenerator.ORDER_COLLECTION]);
        });

        test('data_addtolist generates push', () => {
            const block = makeListBlock('data_addtolist', {
                ITEM: {block: 'item-block-id'}
            });
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"thing"');
            expect(RubyGenerator.data_addtolist(block))
                .toEqual('@my_list.push("thing")\n');
        });

        test('data_deleteoflist generates delete_at with 0-indexed', () => {
            const block = makeListBlock('data_deleteoflist', {
                INDEX: {block: 'index-block-id'}
            });
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('1');
            expect(RubyGenerator.data_deleteoflist(block))
                .toEqual('@my_list.delete_at(0)\n');
        });

        test('data_deletealloflist generates clear', () => {
            const block = makeListBlock('data_deletealloflist');
            expect(RubyGenerator.data_deletealloflist(block))
                .toEqual('@my_list.clear\n');
        });

        test('data_insertatlist generates insert with 0-indexed', () => {
            const block = makeListBlock('data_insertatlist', {
                INDEX: {block: 'index-block-id'},
                ITEM: {block: 'item-block-id'}
            });
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('"thing"');
            expect(RubyGenerator.data_insertatlist(block))
                .toEqual('@my_list.insert(0, "thing")\n');
        });

        test('data_replaceitemoflist generates []= with 0-indexed', () => {
            const block = makeListBlock('data_replaceitemoflist', {
                INDEX: {block: 'index-block-id'},
                ITEM: {block: 'item-block-id'}
            });
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('1')
                .mockReturnValueOnce('"thing"');
            expect(RubyGenerator.data_replaceitemoflist(block))
                .toEqual('@my_list[0] = "thing"\n');
        });

        test('data_itemoflist generates [] with 0-indexed', () => {
            const block = makeListBlock('data_itemoflist', {
                INDEX: {block: 'index-block-id'}
            });
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('1');
            expect(RubyGenerator.data_itemoflist(block))
                .toEqual(['@my_list[0]', RubyGenerator.ORDER_FUNCTION_CALL]);
        });

        test('data_itemnumoflist generates index', () => {
            const block = makeListBlock('data_itemnumoflist', {
                ITEM: {block: 'item-block-id'}
            });
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"thing"');
            expect(RubyGenerator.data_itemnumoflist(block))
                .toEqual(['@my_list.index("thing")', RubyGenerator.ORDER_FUNCTION_CALL]);
        });

        test('data_lengthoflist generates length', () => {
            const block = makeListBlock('data_lengthoflist');
            expect(RubyGenerator.data_lengthoflist(block))
                .toEqual(['@my_list.length', RubyGenerator.ORDER_FUNCTION_CALL]);
        });

        test('data_lengthoflist with @ruby:method:empty? caches array name', () => {
            const block = makeListBlock('data_lengthoflist');
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:method:empty?:1'};
            expect(RubyGenerator.data_lengthoflist(block))
                .toEqual(['@ruby:method:empty?:1', RubyGenerator.ORDER_FUNCTION_CALL]);
            expect(RubyGenerator.emptyCallCache_['1']).toEqual('@my_list');
        });

        test('data_listcontainsitem generates include?', () => {
            const block = makeListBlock('data_listcontainsitem', {
                ITEM: {block: 'item-block-id'}
            });
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"thing"');
            expect(RubyGenerator.data_listcontainsitem(block))
                .toEqual(['@my_list.include?("thing")', RubyGenerator.ORDER_FUNCTION_CALL]);
        });

        test('data_showlist generates show_list with quoted name', () => {
            const block = makeListBlock('data_showlist');
            expect(RubyGenerator.data_showlist(block))
                .toEqual('show_list("@my_list")\n');
        });

        test('data_hidelist generates hide_list with quoted name', () => {
            const block = makeListBlock('data_hidelist');
            expect(RubyGenerator.data_hidelist(block))
                .toEqual('hide_list("@my_list")\n');
        });
    });

    describe('list index conversion', () => {
        beforeEach(() => {
            RubyGenerator.listName = jest.fn().mockReturnValue('@my_list');
            RubyGenerator.getFieldId = jest.fn().mockReturnValue('list-id');
            RubyGenerator.nosToCode = jest.fn(v => v);
        });

        test('literal index 1 becomes 0', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_itemoflist',
                fields: {LIST: {id: 'list-id', value: 'my list'}},
                inputs: {INDEX: {block: 'index-block-id'}}
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('1');
            expect(RubyGenerator.data_itemoflist(block))
                .toEqual(['@my_list[0]', RubyGenerator.ORDER_FUNCTION_CALL]);
        });

        test('literal index 3 becomes 2', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_itemoflist',
                fields: {LIST: {id: 'list-id', value: 'my list'}},
                inputs: {INDEX: {block: 'index-block-id'}}
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('3');
            expect(RubyGenerator.data_itemoflist(block))
                .toEqual(['@my_list[2]', RubyGenerator.ORDER_FUNCTION_CALL]);
        });

        test('expression index generates (expr - 1)', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_itemoflist',
                fields: {LIST: {id: 'list-id', value: 'my list'}},
                inputs: {INDEX: {block: 'index-block-id'}}
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('@i');
            expect(RubyGenerator.data_itemoflist(block))
                .toEqual(['@my_list[@i - 1]', RubyGenerator.ORDER_FUNCTION_CALL]);
        });
    });
});
