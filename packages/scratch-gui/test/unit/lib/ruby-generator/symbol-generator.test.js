import RubyGenerator from '../../../../src/lib/ruby-generator';
import DataBlocks from '../../../../src/lib/ruby-generator/data';
import OperatorsBlocks from '../../../../src/lib/ruby-generator/operators';
import LooksBlocks from '../../../../src/lib/ruby-generator/looks';

describe('RubyGenerator/Symbol', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {},
            targetCommentTexts: []
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.emptyCallCache_ = {};
        RubyGenerator.currentTarget = null;
        DataBlocks(RubyGenerator);
        OperatorsBlocks(RubyGenerator);
        LooksBlocks(RubyGenerator);
    });

    describe('data_itemnumoflist with @ruby:symbol comment', () => {
        test('generates :foo for @ruby:symbol:foo comment', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_itemnumoflist',
                fields: {
                    LIST: {id: 'list-id', value: '_symbols_'}
                },
                inputs: {
                    ITEM: {block: 'item-block-id'}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:symbol:foo'};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('":foo"');
            RubyGenerator.getFieldId = jest.fn().mockReturnValue('list-id');
            RubyGenerator.variableName = jest.fn().mockReturnValue('$_symbols_');

            const result = RubyGenerator.data_itemnumoflist(block);
            expect(result[0]).toBe(':foo');
        });

        test('generates normal list.index() without @ruby:symbol comment', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_itemnumoflist',
                fields: {
                    LIST: {id: 'list-id', value: 'my_list'}
                },
                inputs: {
                    ITEM: {block: 'item-block-id'}
                }
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"thing"');
            RubyGenerator.getFieldId = jest.fn().mockReturnValue('list-id');
            RubyGenerator.variableName = jest.fn().mockReturnValue('$my_list');

            const result = RubyGenerator.data_itemnumoflist(block);
            expect(result[0]).toContain('.index(');
        });
    });

    describe('operator_join with @ruby:symbol comment', () => {
        test('generates :foo.to_s for @ruby:symbol:foo comment', () => {
            const block = {
                id: 'block-id',
                opcode: 'operator_join',
                inputs: {
                    STRING1: {},
                    STRING2: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:symbol:foo'};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"foo"');

            const result = RubyGenerator.operator_join(block);
            expect(result[0]).toBe(':foo.to_s');
        });
    });

    describe('looks_say with @ruby:symbol comment', () => {
        test('generates say(:foo) for @ruby:symbol:foo comment', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {
                    MESSAGE: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:symbol:foo'};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"foo"');

            const result = RubyGenerator.looks_say(block);
            expect(result).toBe('say(:foo)\n');
        });

        test('generates say("hello") without @ruby:symbol comment', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {
                    MESSAGE: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"hello"');

            const result = RubyGenerator.looks_say(block);
            expect(result).toBe('say("hello")\n');
        });
    });

    describe('looks_think with @ruby:symbol comment', () => {
        test('generates think(:foo) for @ruby:symbol:foo comment', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_think',
                inputs: {
                    MESSAGE: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:symbol:foo'};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"foo"');

            const result = RubyGenerator.looks_think(block);
            expect(result).toBe('think(:foo)\n');
        });
    });

    describe('data_itemoflist with @ruby:symbol:var comment', () => {
        test('generates variable name for @ruby:symbol:var comment', () => {
            const block = {
                id: 'block-id',
                opcode: 'data_itemoflist',
                fields: {
                    LIST: {id: 'list-id', value: '_symbols_'}
                },
                inputs: {
                    INDEX: {block: 'index-block-id'}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = {text: '@ruby:symbol:var'};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('$a');

            const result = RubyGenerator.data_itemoflist(block);
            expect(result[0]).toBe('$a');
        });
    });
});
