import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('control blocks with_screen_refresh for save', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        RubyGenerator._options = null;
        RubyGenerator.version = '2';
    });

    const mockGeneratorMethods = () => {
        const orig = {
            valueToCode: RubyGenerator.valueToCode,
            statementToCode: RubyGenerator.statementToCode,
            getCommentText: RubyGenerator.getCommentText
        };
        return orig;
    };

    const restoreGeneratorMethods = (orig) => {
        RubyGenerator.valueToCode = orig.valueToCode;
        RubyGenerator.statementToCode = orig.statementToCode;
        RubyGenerator.getCommentText = orig.getCommentText;
    };

    // --- control_repeat (N.times) ---

    describe('control_repeat', () => {
        test('without forSave: generates N.times do (no with_screen_refresh)', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.valueToCode = () => '10';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {};

            const result = RubyGenerator.control_repeat({});
            expect(result).toBe('10.times do\n  move(10)\nend\n');
            expect(result).not.toContain('with_screen_refresh');

            restoreGeneratorMethods(orig);
        });

        test('with forSave: generates N.times.with_screen_refresh do', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.valueToCode = () => '10';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {forSave: true};

            const result = RubyGenerator.control_repeat({});
            expect(result).toBe('10.times.with_screen_refresh do\n  move(10)\nend\n');

            restoreGeneratorMethods(orig);
        });
    });

    // --- control_forever (loop) ---

    describe('control_forever', () => {
        test('without forSave: generates loop do', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(2)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {};

            const result = RubyGenerator.control_forever({});
            expect(result).toBe('loop do\n  move(2)\nend\n');
            expect(result).not.toContain('with_screen_refresh');

            restoreGeneratorMethods(orig);
        });

        test('with forSave: generates loop.with_screen_refresh do', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(2)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {forSave: true};

            const result = RubyGenerator.control_forever({});
            expect(result).toBe('loop.with_screen_refresh do\n  move(2)\nend\n');

            restoreGeneratorMethods(orig);
        });
    });

    // --- control_repeat_until (until/while) ---

    describe('control_repeat_until', () => {
        test('without forSave: generates until ... end without with_screen_refresh', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.valueToCode = () => 'touching?("goal")';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {};

            const result = RubyGenerator.control_repeat_until({});
            expect(result).toBe('until touching?("goal")\n  move(10)\nend\n');
            expect(result).not.toContain('with_screen_refresh');

            restoreGeneratorMethods(orig);
        });

        test('with forSave: generates until ... with_screen_refresh do ... end end', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.valueToCode = () => 'touching?("goal")';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {forSave: true};

            const result = RubyGenerator.control_repeat_until({});
            expect(result).toBe(
                'until touching?("goal")\n' +
                '  with_screen_refresh do\n' +
                '    move(10)\n' +
                '  end\n' +
                'end\n'
            );

            restoreGeneratorMethods(orig);
        });
    });

    // --- version 1: no with_screen_refresh even with forSave ---

    describe('version 1 with forSave', () => {
        test('control_repeat: no with_screen_refresh for version 1', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.valueToCode = () => '10';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {forSave: true};
            RubyGenerator.version = '1';

            const result = RubyGenerator.control_repeat({});
            expect(result).toBe('10.times do\n  move(10)\nend\n');
            expect(result).not.toContain('with_screen_refresh');

            restoreGeneratorMethods(orig);
        });

        test('control_forever: no with_screen_refresh for version 1', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(2)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {forSave: true};
            RubyGenerator.version = '1';

            const result = RubyGenerator.control_forever({});
            expect(result).toBe('loop do\n  move(2)\nend\n');
            expect(result).not.toContain('with_screen_refresh');

            restoreGeneratorMethods(orig);
        });

        test('control_repeat_until: no with_screen_refresh for version 1', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.valueToCode = () => 'touching?("goal")';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => null;
            RubyGenerator._options = {forSave: true};
            RubyGenerator.version = '1';

            const result = RubyGenerator.control_repeat_until({});
            expect(result).toBe('until touching?("goal")\n  move(10)\nend\n');
            expect(result).not.toContain('with_screen_refresh');

            restoreGeneratorMethods(orig);
        });
    });

    // --- @ruby:method:with_screen_refresh comment (round-trip) ---

    describe('with_screen_refresh comment', () => {
        test('control_repeat: comment triggers with_screen_refresh even without forSave', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.valueToCode = () => '10';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => '@ruby:method:with_screen_refresh';
            RubyGenerator._options = {};

            const result = RubyGenerator.control_repeat({});
            expect(result).toBe('10.times.with_screen_refresh do\n  move(10)\nend\n');

            restoreGeneratorMethods(orig);
        });

        test('control_forever: comment triggers with_screen_refresh even without forSave', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(2)\n`;
            RubyGenerator.getCommentText = () => '@ruby:method:with_screen_refresh';
            RubyGenerator._options = {};

            const result = RubyGenerator.control_forever({});
            expect(result).toBe('loop.with_screen_refresh do\n  move(2)\nend\n');

            restoreGeneratorMethods(orig);
        });

        test('control_repeat_until: comment triggers with_screen_refresh even without forSave', () => {
            const orig = mockGeneratorMethods();
            RubyGenerator.valueToCode = () => 'touching?("goal")';
            RubyGenerator.statementToCode = () => `${RubyGenerator.INDENT}move(10)\n`;
            RubyGenerator.getCommentText = () => '@ruby:method:with_screen_refresh';
            RubyGenerator._options = {};

            const result = RubyGenerator.control_repeat_until({});
            expect(result).toBe(
                'until touching?("goal")\n' +
                '  with_screen_refresh do\n' +
                '    move(10)\n' +
                '  end\n' +
                'end\n'
            );

            restoreGeneratorMethods(orig);
        });
    });
});
