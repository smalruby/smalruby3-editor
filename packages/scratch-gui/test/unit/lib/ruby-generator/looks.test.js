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
                opcode: 'looks_sayforsecs',
                inputs: {
                    MESSAGE: {},
                    SECS: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:print' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"Hello!"')
                .mockReturnValueOnce('1');
            const expected = 'print("Hello!")\n';
            expect(RubyGenerator.looks_sayforsecs(block)).toEqual(expected);
        });

        test('with @ruby:method:puts', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_sayforsecs',
                inputs: {
                    MESSAGE: {},
                    SECS: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:puts' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"Hello!"')
                .mockReturnValueOnce('1');
            const expected = 'puts("Hello!")\n';
            expect(RubyGenerator.looks_sayforsecs(block)).toEqual(expected);
        });

        test('with @ruby:method:p', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_sayforsecs',
                inputs: {
                    MESSAGE: {},
                    SECS: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:p' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"Hello!"')
                .mockReturnValueOnce('1');
            const expected = 'p("Hello!")\n';
            expect(RubyGenerator.looks_sayforsecs(block)).toEqual(expected);
        });

        test('with @ruby:method:puts and @ruby:argument:1:type:Integer', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_sayforsecs',
                inputs: {
                    MESSAGE: {},
                    SECS: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:puts,@ruby:argument:1:type:Integer' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"10"')
                .mockReturnValueOnce('1');
            const expected = 'puts(10)\n';
            expect(RubyGenerator.looks_sayforsecs(block)).toEqual(expected);
        });

        test('with @ruby:method:puts and @ruby:argument:1:type:Float', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_sayforsecs',
                inputs: {
                    MESSAGE: {},
                    SECS: {}
                }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:puts,@ruby:argument:1:type:Float' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"3.5"')
                .mockReturnValueOnce('1');
            const expected = 'puts(3.5)\n';
            expect(RubyGenerator.looks_sayforsecs(block)).toEqual(expected);
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
                opcode: 'looks_sayforsecs',
                inputs: { MESSAGE: {}, SECS: {} }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:print' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"Hello, Ruby.\\n"')
                .mockReturnValueOnce('1');
            const expected = 'print("Hello, Ruby.\\n")\n';
            expect(RubyGenerator.looks_sayforsecs(block)).toEqual(expected);
        });

        test('puts with tab character', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_sayforsecs',
                inputs: { MESSAGE: {}, SECS: {} }
            };
            RubyGenerator.cache_.comments['block-id'] = { text: '@ruby:method:puts' };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('"Hello\\tRuby"')
                .mockReturnValueOnce('1');
            const expected = 'puts("Hello\\tRuby")\n';
            expect(RubyGenerator.looks_sayforsecs(block)).toEqual(expected);
        });
    });

    describe('looks_changesizeby', () => {
        test('positive CHANGE emits self.size += N', () => {
            const block = {id: 'b1', opcode: 'looks_changesizeby', inputs: {CHANGE: {}}};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('10');
            expect(RubyGenerator.looks_changesizeby(block)).toEqual('self.size += 10\n');
        });

        test('negative CHANGE emits self.size -= N (absolute value)', () => {
            const block = {id: 'b1', opcode: 'looks_changesizeby', inputs: {CHANGE: {}}};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('-10');
            expect(RubyGenerator.looks_changesizeby(block)).toEqual('self.size -= 10\n');
        });

        test('zero CHANGE emits self.size += 0', () => {
            const block = {id: 'b1', opcode: 'looks_changesizeby', inputs: {CHANGE: {}}};
            RubyGenerator.valueToCode = jest.fn().mockReturnValue('0');
            expect(RubyGenerator.looks_changesizeby(block)).toEqual('self.size += 0\n');
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

        test('should filter @ruby: lines and keep user comment when mixed', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {},
                next: null
            };
            RubyGenerator.cache_.comments['block-id'] = {
                text: 'user comment\n@ruby:syntax:+=\n@ruby:lvar:x:0'
            };
            RubyGenerator.getInputs = jest.fn().mockReturnValue({});
            RubyGenerator.isConnectedValue = jest.fn().mockReturnValue(false);
            RubyGenerator.getBlock = jest.fn().mockReturnValue(null);
            RubyGenerator.blockToCode = jest.fn().mockReturnValue('');

            const code = 'x += 10\n';
            const result = RubyGenerator.scrub_(block, code);

            expect(result).toEqual('# user comment\nx += 10\n');
        });

        test('should handle multi-line user comments mixed with metadata', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {},
                next: null
            };
            RubyGenerator.cache_.comments['block-id'] = {
                text: 'first line\nsecond line\n@ruby:method:puts'
            };
            RubyGenerator.getInputs = jest.fn().mockReturnValue({});
            RubyGenerator.isConnectedValue = jest.fn().mockReturnValue(false);
            RubyGenerator.getBlock = jest.fn().mockReturnValue(null);
            RubyGenerator.blockToCode = jest.fn().mockReturnValue('');

            const code = 'puts("hello")\n';
            const result = RubyGenerator.scrub_(block, code);

            expect(result).toEqual('# first line\n# second line\nputs("hello")\n');
        });

        test('should output nothing when all lines are @ruby: metadata', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {},
                next: null
            };
            RubyGenerator.cache_.comments['block-id'] = {
                text: '@ruby:syntax:+=\n@ruby:lvar:x:0'
            };
            RubyGenerator.getInputs = jest.fn().mockReturnValue({});
            RubyGenerator.isConnectedValue = jest.fn().mockReturnValue(false);
            RubyGenerator.getBlock = jest.fn().mockReturnValue(null);
            RubyGenerator.blockToCode = jest.fn().mockReturnValue('');

            const code = 'x += 10\n';
            const result = RubyGenerator.scrub_(block, code);

            expect(result).toEqual('x += 10\n');
        });

        test('should output inline comment on same line with @ruby:comment_position:inline marker', () => {
            const block = {
                id: 'block-id',
                opcode: 'looks_say',
                inputs: {},
                next: null
            };
            RubyGenerator.cache_.comments['block-id'] = {
                text: '@ruby:comment_position:inline\ninline comment\n@ruby:syntax:+='
            };
            RubyGenerator.getInputs = jest.fn().mockReturnValue({});
            RubyGenerator.isConnectedValue = jest.fn().mockReturnValue(false);
            RubyGenerator.getBlock = jest.fn().mockReturnValue(null);
            RubyGenerator.blockToCode = jest.fn().mockReturnValue('');

            const code = 'x += 10\n';
            const result = RubyGenerator.scrub_(block, code);

            expect(result).toEqual('x += 10 # inline comment\n');
        });
    });
});
