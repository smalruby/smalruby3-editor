import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('control_repeat screen_refresh', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        RubyGenerator._options = null;
    });

    const makeRepeatBlock = (times, body) => ({
        id: 'test_block',
        opcode: 'control_repeat',
        fields: {},
        inputs: {
            TIMES: {
                block: 'times_value'
            },
            SUBSTACK: body ? {block: 'body_block'} : undefined
        },
        comment: null
    });

    describe('without forSave option', () => {
        test('generates N.times do without screen_refresh', () => {
            // Mock valueToCode and statementToCode
            const origValueToCode = RubyGenerator.valueToCode;
            const origStatementToCode = RubyGenerator.statementToCode;
            const origGetCommentText = RubyGenerator.getCommentText;

            RubyGenerator.valueToCode = () => '10';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {};

            const result = RubyGenerator.control_repeat(makeRepeatBlock(10, true));
            expect(result).toBe('10.times do\n  move(10)\nend\n');
            expect(result).not.toContain('screen_refresh');

            RubyGenerator.valueToCode = origValueToCode;
            RubyGenerator.statementToCode = origStatementToCode;
            RubyGenerator.getCommentText = origGetCommentText;
        });
    });

    describe('with forSave option', () => {
        test('generates N.times(screen_refresh: true) do', () => {
            const origValueToCode = RubyGenerator.valueToCode;
            const origStatementToCode = RubyGenerator.statementToCode;
            const origGetCommentText = RubyGenerator.getCommentText;

            RubyGenerator.valueToCode = () => '10';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {forSave: true};

            const result = RubyGenerator.control_repeat(makeRepeatBlock(10, true));
            expect(result).toBe('10.times(screen_refresh: true) do\n  move(10)\nend\n');

            RubyGenerator.valueToCode = origValueToCode;
            RubyGenerator.statementToCode = origStatementToCode;
            RubyGenerator.getCommentText = origGetCommentText;
        });
    });

    describe('forSave with empty body', () => {
        test('generates N.times(screen_refresh: true) do with empty body', () => {
            const origValueToCode = RubyGenerator.valueToCode;
            const origStatementToCode = RubyGenerator.statementToCode;
            const origGetCommentText = RubyGenerator.getCommentText;

            RubyGenerator.valueToCode = () => '5';
            RubyGenerator.statementToCode = () => '';
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {forSave: true};

            const result = RubyGenerator.control_repeat(makeRepeatBlock(5, false));
            expect(result).toBe('5.times(screen_refresh: true) do\nend\n');

            RubyGenerator.valueToCode = origValueToCode;
            RubyGenerator.statementToCode = origStatementToCode;
            RubyGenerator.getCommentText = origGetCommentText;
        });
    });
});
