import RubyGenerator from '../../../../src/lib/ruby-generator';
import SensingBlocks from '../../../../src/lib/ruby-generator/sensing';

describe('RubyGenerator/Sensing', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {},
            targetCommentTexts: []
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        SensingBlocks(RubyGenerator);
    });

    describe('sensing_askandwait', () => {
        test('normal ask', () => {
            const block = {
                id: 'block-id',
                opcode: 'sensing_askandwait',
                inputs: {
                    QUESTION: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"What\'s your name?"');
            const expected = 'ask("What\'s your name?")\n';
            expect(RubyGenerator.sensing_askandwait(block)).toEqual(expected);
        });

        test('with @ruby:method:gets', () => {
            const block = {
                id: 'block-id',
                opcode: 'sensing_askandwait',
                inputs: {
                    QUESTION: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:gets' };
            const expected = '';
            expect(RubyGenerator.sensing_askandwait(block)).toEqual(expected);
        });
    });

    describe('sensing_answer', () => {
        test('normal answer', () => {
            const block = {
                id: 'block-id',
                opcode: 'sensing_answer'
            };
            const expected = ['answer', RubyGenerator.ORDER_ATOMIC];
            expect(RubyGenerator.sensing_answer(block)).toEqual(expected);
        });

        test('with @ruby:method:gets', () => {
            const block = {
                id: 'block-id',
                opcode: 'sensing_answer'
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:gets' };
            const expected = ['gets', RubyGenerator.ORDER_ATOMIC];
            expect(RubyGenerator.sensing_answer(block)).toEqual(expected);
        });
    });
});
