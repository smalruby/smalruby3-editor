import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator/Module', () => {
    beforeEach(() => {
        RubyGenerator.init({version: '2'});
        RubyGenerator.definitions_ = {};
        RubyGenerator.requires_ = {};
        RubyGenerator.prepares_ = {};
        RubyGenerator.cache_ = {
            targetCommentTexts: [],
            comments: {}
        };
    });

    const makeMockTarget = (name, index = 1) => {
        const targets = [];
        const stage = {isStage: true, sprite: {name: 'Stage'}};
        for (let i = 0; i < index; i++) {
            targets.push({isStage: false, sprite: {name: `Sprite${i + 1}`}});
        }
        const target = targets[index - 1];
        target.sprite = {name};
        targets.unshift(stage);
        return {
            target,
            runtime: {targets}
        };
    };

    describe('_moduleMethodCodes initialization', () => {
        test('init() resets _moduleMethodCodes', () => {
            RubyGenerator._moduleMethodCodes = {Utils: ['def foo\nend\n']};
            RubyGenerator.init({version: '2'});
            expect(RubyGenerator._moduleMethodCodes).toEqual({});
        });
    });

    describe('finish(): module wrapping and include', () => {
        test('generates module...end before class and include inside class', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:include=Utils'];

            // Simulate module method codes collected during block generation
            RubyGenerator._moduleMethodCodes = {
                Utils: ['def add(a, b)\n  a + b\nend\n']
            };

            const code = 'when_flag_clicked do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            // module...end should appear before class
            expect(result).toContain('module Utils');
            expect(result).toContain('  def add(a, b)');
            expect(result).toContain('end\n');

            // include inside class
            expect(result).toContain('include Utils');

            // module should be before class
            const moduleIdx = result.indexOf('module Utils');
            const classIdx = result.indexOf('class Sprite1');
            expect(moduleIdx).toBeLessThan(classIdx);

            // include should be inside class (after class line, before end)
            const includeIdx = result.indexOf('include Utils');
            expect(includeIdx).toBeGreaterThan(classIdx);
        });

        test('multiple modules with include order preserved', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = [
                '@ruby:class:include=Utils,include=Helpers'
            ];

            RubyGenerator._moduleMethodCodes = {
                Utils: ['def add(a, b)\n  a + b\nend\n'],
                Helpers: ['def greet\n  say("hello")\nend\n']
            };

            const code = 'when_flag_clicked do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            // Both modules should appear
            expect(result).toContain('module Utils');
            expect(result).toContain('module Helpers');

            // Module order: Utils first then Helpers (following include order)
            expect(result.indexOf('module Utils')).toBeLessThan(result.indexOf('module Helpers'));

            // include order preserved inside class
            expect(result).toContain('include Utils');
            expect(result).toContain('include Helpers');
            const includeUtilsIdx = result.indexOf('include Utils');
            const includeHelpersIdx = result.indexOf('include Helpers');
            expect(includeUtilsIdx).toBeLessThan(includeHelpersIdx);
        });

        test('no module codes means no module block generated', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            RubyGenerator._moduleMethodCodes = {};

            const code = 'when_flag_clicked do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).not.toContain('module ');
            expect(result).not.toContain('include ');
            expect(result).toContain('class Sprite1');
        });
    });

    describe('finishTargets(): module deduplication', () => {
        test('deduplicates module definitions in multi-target output', () => {
            RubyGenerator.initTargets({requires: ['smalruby3']});

            // Simulate multi-target output where module appears in each target
            const code = [
                'module Utils',
                '  def add(a, b)',
                '    a + b',
                '  end',
                'end',
                '',
                'class Sprite1',
                '  include Utils',
                'end',
                '',
                'module Utils',
                '  def add(a, b)',
                '    a + b',
                '  end',
                'end',
                '',
                'class Sprite2',
                '  include Utils',
                'end',
                ''
            ].join('\n');

            const result = RubyGenerator.finishTargets(code, {});

            // Module should appear only once
            const moduleCount = (result.match(/^module Utils$/gm) || []).length;
            expect(moduleCount).toEqual(1);

            // Both classes should still be present
            expect(result).toContain('class Sprite1');
            expect(result).toContain('class Sprite2');

            // include should be in both classes
            const includeCount = (result.match(/include Utils/g) || []).length;
            expect(includeCount).toEqual(2);

            // require should be at the top
            expect(result).toContain('require "smalruby3"');

            // module should be after require, before classes
            const requireIdx = result.indexOf('require "smalruby3"');
            const moduleIdx = result.indexOf('module Utils');
            const class1Idx = result.indexOf('class Sprite1');
            expect(requireIdx).toBeLessThan(moduleIdx);
            expect(moduleIdx).toBeLessThan(class1Idx);
        });

        test('deduplicates multiple different modules', () => {
            RubyGenerator.initTargets({requires: ['smalruby3']});

            const code = [
                'module Utils',
                '  def add(a, b)',
                '    a + b',
                '  end',
                'end',
                '',
                'module Helpers',
                '  def greet',
                '    say("hello")',
                '  end',
                'end',
                '',
                'class Sprite1',
                '  include Utils',
                '  include Helpers',
                'end',
                '',
                'module Utils',
                '  def add(a, b)',
                '    a + b',
                '  end',
                'end',
                '',
                'module Helpers',
                '  def greet',
                '    say("hello")',
                '  end',
                'end',
                '',
                'class Sprite2',
                '  include Utils',
                '  include Helpers',
                'end',
                ''
            ].join('\n');

            const result = RubyGenerator.finishTargets(code, {});

            const utilsCount = (result.match(/^module Utils$/gm) || []).length;
            const helpersCount = (result.match(/^module Helpers$/gm) || []).length;
            expect(utilsCount).toEqual(1);
            expect(helpersCount).toEqual(1);
        });

        test('no modules means no deduplication needed', () => {
            RubyGenerator.initTargets({requires: ['smalruby3']});

            const code = 'class Sprite1\nend\n\nclass Sprite2\nend\n';
            const result = RubyGenerator.finishTargets(code, {});

            expect(result).toContain('require "smalruby3"');
            expect(result).toContain('class Sprite1');
            expect(result).toContain('class Sprite2');
        });
    });
});
