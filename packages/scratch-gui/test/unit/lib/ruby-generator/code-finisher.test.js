import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator code-finisher', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
    });

    describe('initTargets', () => {
        test('initializes requires_ and prepares_', () => {
            RubyGenerator.initTargets();
            expect(RubyGenerator.requires_).toEqual({});
            expect(RubyGenerator.prepares_).toEqual({});
        });

        test('populates requires_ from options', () => {
            RubyGenerator.initTargets({requires: ['smalruby3']});
            expect(RubyGenerator.requires_).toEqual({
                require__smalruby3: 'require "smalruby3"'
            });
        });
    });

    describe('finishTargets', () => {
        beforeEach(() => {
            RubyGenerator.initTargets();
        });

        test('prepends requires to code', () => {
            RubyGenerator.requires_.require__smalruby3 = 'require "smalruby3"';
            const result = RubyGenerator.finishTargets('code\n');
            expect(result).toEqual('require "smalruby3"\n\ncode\n');
        });

        test('prepends prepares to code', () => {
            RubyGenerator.prepares_.prepare__init = 'init_something';
            const result = RubyGenerator.finishTargets('code\n');
            expect(result).toEqual('init_something\n\ncode\n');
        });

        test('deduplicates module definitions', () => {
            const code = [
                'module MyMod',
                '  def foo',
                '  end',
                'end',
                '',
                'class A',
                'end',
                '',
                'module MyMod',
                '  def foo',
                '  end',
                'end',
                '',
                'class B',
                'end',
                ''
            ].join('\n');
            const result = RubyGenerator.finishTargets(code);
            // Module should appear only once
            const moduleCount = (result.match(/module MyMod/g) || []).length;
            expect(moduleCount).toEqual(1);
            // Both classes should remain
            expect(result).toContain('class A');
            expect(result).toContain('class B');
        });

        test('returns code as-is when no requires/prepares/modules', () => {
            const result = RubyGenerator.finishTargets('code\n');
            expect(result).toEqual('code\n');
        });
    });

    describe('finish', () => {
        beforeEach(() => {
            RubyGenerator.initTargets();
            RubyGenerator.init();
            RubyGenerator.currentTarget = {
                sprite: {name: 'Sprite1'},
                comments: {},
                blocks: {getBlock: () => null, getInputs: () => ({}), getScripts: () => []},
                variables: {},
                runtime: {targets: [{isStage: false, sprite: {name: 'Sprite1'}}]}
            };
        });

        test('returns empty string for no definitions and no code', () => {
            expect(RubyGenerator.finish('')).toEqual('');
        });

        test('returns code as-is for simple code', () => {
            expect(RubyGenerator.finish('move 10\n')).toEqual('move 10\n');
        });

        test('collects require definitions', () => {
            RubyGenerator.definitions_.require__foo = 'require "foo"';
            RubyGenerator.finish('code\n');
            expect(RubyGenerator.requires_.require__foo).toEqual('require "foo"');
        });

        test('collects prepare definitions', () => {
            RubyGenerator.definitions_.prepare__bar = 'bar_init';
            RubyGenerator.finish('code\n');
            expect(RubyGenerator.prepares_.prepare__bar).toEqual('bar_init');
        });

        test('includes non-require/prepare definitions before code', () => {
            RubyGenerator.definitions_.my_helper = 'def helper; end';
            const result = RubyGenerator.finish('code\n');
            expect(result).toEqual('def helper; end\n\ncode\n');
        });
    });
});
