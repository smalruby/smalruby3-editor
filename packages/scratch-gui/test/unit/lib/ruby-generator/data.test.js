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
