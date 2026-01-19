import RubyGenerator from '../../../../src/lib/ruby-generator';
import LooksBlocks from '../../../../src/lib/ruby-generator/looks';

describe('RubyGenerator/Looks', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {},
            targetCommentTexts: []
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        LooksBlocks(RubyGenerator);
    });

    describe('looks_say', () => {
        test('normal say', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {
                    MESSAGE: {}
                }
            };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"Hello!"');
            const expected = 'say("Hello!")\n';
            expect(RubyGenerator.looks_say(block)).toEqual(expected);
        });

        test('with @ruby:method:print', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {
                    MESSAGE: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:print' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"Hello!"');
            const expected = 'print("Hello!")\n';
            expect(RubyGenerator.looks_say(block)).toEqual(expected);
        });

        test('with @ruby:method:puts', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {
                    MESSAGE: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:puts' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"Hello!"');
            const expected = 'puts("Hello!")\n';
            expect(RubyGenerator.looks_say(block)).toEqual(expected);
        });

        test('with @ruby:method:p', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {
                    MESSAGE: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:p' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"Hello!"');
            const expected = 'p("Hello!")\n';
            expect(RubyGenerator.looks_say(block)).toEqual(expected);
        });

        test('with unknown @ruby: tag defaults to say', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {
                    MESSAGE: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:unknown' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"Hello!"');
            const expected = 'say("Hello!")\n';
            expect(RubyGenerator.looks_say(block)).toEqual(expected);
        });

        test('print with newline character', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: { MESSAGE: {} }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:print' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"Hello, Ruby.\\n"');
            const expected = 'print("Hello, Ruby.\\n")\n';
            expect(RubyGenerator.looks_say(block)).toEqual(expected);
        });

        test('puts with tab character', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: { MESSAGE: {} }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:puts' };
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('"Hello\\tRuby"');
            const expected = 'puts("Hello\\tRuby")\n';
            expect(RubyGenerator.looks_say(block)).toEqual(expected);
        });
    });

    describe('scrub_ (meta-comment filtering)', () => {
        test('should filter out @ruby: comments', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {},
                next: null
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:print' };
            RubyGenerator.getInputs = jest.fn().mockReturnValue({});
            RubyGenerator.isConnectedValue = jest.fn().mockReturnValue(false);
            RubyGenerator.getBlock = jest.fn().mockReturnValue(null);
            RubyGenerator.blockToCode = jest.fn().mockReturnValue('');

            const code = 'print("Hello!")\n';
            const result = RubyGenerator.scrub_(block, code);
            
            // Should NOT contain the comment since it starts with @ruby:
            expect(result).toEqual('print("Hello!")\n');
        });

        test('should keep normal comments', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {},
                next: null
            };
            RubyGenerator.cache_.comments['block-id'] = { text: 'normal comment' };
            RubyGenerator.getInputs = jest.fn().mockReturnValue({});
            RubyGenerator.isConnectedValue = jest.fn().mockReturnValue(false);
            RubyGenerator.getBlock = jest.fn().mockReturnValue(null);
            RubyGenerator.blockToCode = jest.fn().mockReturnValue('');

            const code = 'say("Hello!")\n';
            const result = RubyGenerator.scrub_(block, code);
            
            expect(result).toEqual('# normal comment\nsay("Hello!")\n');
        });
    });
});
