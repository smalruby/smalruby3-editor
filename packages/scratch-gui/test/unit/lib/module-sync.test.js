import {
    getModuleNamesFromTarget,
    findTargetsWithModule,
    extractModuleCode,
    replaceModuleCode,
} from '../../../src/lib/module-sync';
import { makeConverter, makeSpriteTarget, setupRubyGenerator } from '../helpers/ruby-roundtrip-helper';

describe('module-sync', () => {
    describe('getModuleNamesFromTarget', () => {
        test('returns empty set for target without comments', () => {
            const target = { comments: {} };
            expect(getModuleNamesFromTarget(target)).toEqual(new Set());
        });

        test('returns empty set for null target', () => {
            expect(getModuleNamesFromTarget(null)).toEqual(new Set());
        });

        test('finds module names from @ruby:module_source comments', () => {
            const target = {
                comments: {
                    c1: { text: '@ruby:module_source:Utils', blockId: 'b1' },
                    c2: { text: '@ruby:module_source:Helpers', blockId: 'b2' },
                    c3: { text: '@ruby:class', blockId: null },
                    c4: { text: '@ruby:return:add', blockId: 'b3' },
                },
            };
            const result = getModuleNamesFromTarget(target);
            expect(result).toEqual(new Set(['Utils', 'Helpers']));
        });

        // A comment of the user before `def` comes before the marker (issue #1857).
        test('finds a module name after a comment of the user', () => {
            const target = {
                comments: {
                    c1: { text: 'メモ\n@ruby:module_source:Utils', blockId: 'b1' },
                    c2: { text: '@ruby:module_source:Helpers:super_of:greet', blockId: 'b2' },
                },
            };
            expect(getModuleNamesFromTarget(target)).toEqual(new Set(['Utils', 'Helpers']));
        });

        test('finds the module of a converted method with a comment before def', async () => {
            const { target, runtime } = makeSpriteTarget();
            setupRubyGenerator();
            const converter = makeConverter(target, runtime, { version: '2' });
            const code = [
                'module Walk',
                '  # メモ',
                '  def step',
                '    move(10)',
                '  end',
                'end',
                '',
                'class Sprite1 < ::Smalruby3::Sprite',
                '  include Walk',
                'end',
            ].join('\n');
            expect(await converter.targetCodeToBlocks(target, code)).toBeTruthy();
            await converter.applyTargetBlocks(target);
            expect(Object.values(target.comments).map((c) => c.text)).toContain('メモ\n@ruby:module_source:Walk');
            expect(getModuleNamesFromTarget(target)).toEqual(new Set(['Walk']));
        });

        test('deduplicates module names', () => {
            const target = {
                comments: {
                    c1: { text: '@ruby:module_source:Utils', blockId: 'b1' },
                    c2: { text: '@ruby:module_source:Utils', blockId: 'b2' },
                },
            };
            const result = getModuleNamesFromTarget(target);
            expect(result).toEqual(new Set(['Utils']));
        });
    });

    describe('findTargetsWithModule', () => {
        test('finds a target whose method has a comment of the user', () => {
            const sprite1 = { id: 'sprite1', comments: {} };
            const sprite2 = {
                id: 'sprite2',
                comments: { c1: { text: 'メモ\n@ruby:module_source:Utils', blockId: 'b1' } },
            };
            const vm = { runtime: { targets: [sprite1, sprite2] } };
            expect(findTargetsWithModule(vm, 'Utils', 'sprite1')).toEqual([sprite2]);
        });

        test('finds targets with matching module comments', () => {
            const sprite1 = {
                id: 'sprite1',
                comments: {
                    c1: { text: '@ruby:module_source:Utils', blockId: 'b1' },
                },
            };
            const sprite2 = {
                id: 'sprite2',
                comments: {
                    c1: { text: '@ruby:module_source:Utils', blockId: 'b2' },
                },
            };
            const sprite3 = {
                id: 'sprite3',
                comments: {
                    c1: { text: '@ruby:class', blockId: null },
                },
            };
            const vm = {
                runtime: { targets: [sprite1, sprite2, sprite3] },
            };

            const result = findTargetsWithModule(vm, 'Utils', 'sprite1');
            expect(result).toHaveLength(1);
            expect(result[0].id).toEqual('sprite2');
        });

        test('excludes the source target', () => {
            const sprite1 = {
                id: 'sprite1',
                comments: { c1: { text: '@ruby:module_source:Utils', blockId: 'b1' } },
            };
            const vm = { runtime: { targets: [sprite1] } };

            const result = findTargetsWithModule(vm, 'Utils', 'sprite1');
            expect(result).toHaveLength(0);
        });

        test('returns empty array when no targets match', () => {
            const sprite1 = {
                id: 'sprite1',
                comments: { c1: { text: '@ruby:class', blockId: null } },
            };
            const vm = { runtime: { targets: [sprite1] } };

            const result = findTargetsWithModule(vm, 'Utils', 'other');
            expect(result).toHaveLength(0);
        });
    });

    describe('extractModuleCode', () => {
        test('extracts module definition from code', () => {
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
            ].join('\n');

            const result = extractModuleCode(code, 'Utils');
            expect(result).toEqual('module Utils\n  def add(a, b)\n    a + b\n  end\nend\n');
        });

        test('returns null when module not found', () => {
            const code = 'class Sprite1\nend\n';
            expect(extractModuleCode(code, 'Utils')).toBeNull();
        });

        test('extracts correct module when multiple modules exist', () => {
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
                'end',
                '',
            ].join('\n');

            const utils = extractModuleCode(code, 'Utils');
            expect(utils).toContain('def add');
            expect(utils).not.toContain('def greet');

            const helpers = extractModuleCode(code, 'Helpers');
            expect(helpers).toContain('def greet');
            expect(helpers).not.toContain('def add');
        });
    });

    describe('replaceModuleCode', () => {
        test('replaces module definition', () => {
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
            ].join('\n');

            const newModule = 'module Utils\n  def add(a, b, c)\n    a + b + c\n  end\nend\n';
            const result = replaceModuleCode(code, 'Utils', newModule);

            expect(result).toContain('def add(a, b, c)');
            expect(result).not.toContain('def add(a, b)\n');
            expect(result).toContain('class Sprite1');
        });

        test('returns unchanged code when module not found', () => {
            const code = 'class Sprite1\nend\n';
            const result = replaceModuleCode(code, 'Utils', 'module Utils\nend\n');
            expect(result).toEqual(code);
        });
    });
});
