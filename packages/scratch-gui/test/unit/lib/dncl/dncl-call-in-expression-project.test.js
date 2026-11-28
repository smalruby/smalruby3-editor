// === Smalruby: This file is Smalruby-specific (a call inside an expression stays with the project) ===
/**
 * A call of a function inside an expression (`もし 二倍(2) > 3 ならば:`) becomes a call block before
 * the statement and a read of the return variable. The project is saved and opened again, and the
 * Japanese and the Ruby are made from the blocks alone: the call must come back inside the
 * expression (#2588).
 */
import VM from '@smalruby/scratch-vm';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import { targetCodeToBlocks } from '../../../../src/lib/ruby-to-blocks-converter';
import { setupRubyGenerator } from '../../helpers/ruby-roundtrip-helper';

// jsdom has no performance.mark / measure (scratch-vm calls them when it loads)
if (typeof performance.mark !== 'function') performance.mark = () => {};
if (typeof performance.measure !== 'function') performance.measure = () => {};

beforeAll(() => loadPrism());

const costume = {
    name: 'costume1',
    assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
    md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0,
};
const targetJson = (isStage, name) => ({
    isStage,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    costumes: [costume],
    sounds: [],
    currentCostume: 0,
    volume: 100,
    layerOrder: isStage ? 0 : 1,
    ...(isStage
        ? {}
        : { visible: true, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around' }),
});

const spriteOf = (vm) => vm.runtime.targets.find((t) => t.isOriginal && !t.isStage);
const stageOf = (vm) => vm.runtime.getTargetForStage();

/**
 * The Ruby made into blocks, the project saved and opened again, and the blocks written back as Ruby.
 * @param {string} source - The Ruby.
 * @param {object} [options] - Options.
 * @param {boolean} [options.onStage] - Whether the code is the stage's (its variables are `$`).
 * @returns {Promise<string>} The Ruby of the project opened again.
 */
const saveAndOpenRuby = async (source, { onStage = false } = {}) => {
    const targetOf = onStage ? stageOf : spriteOf;
    const vm = new VM();
    await vm.loadProject({
        targets: [targetJson(true, 'Stage'), targetJson(false, 'Sprite1')],
        monitors: [],
        extensions: [],
        meta: { semver: '3.0.0' },
    });
    vm.setEditingTarget(targetOf(vm).id);
    const converter = await targetCodeToBlocks(vm, targetOf(vm), source, null, { version: '2' });
    expect(converter.errors).toEqual([]);
    await converter.apply();
    const saved = JSON.parse(JSON.stringify(vm.toJSON()));
    vm.runtime.quit();

    const opened = new VM();
    await opened.loadProject(saved);
    setupRubyGenerator();
    RubyGenerator.currentTarget = targetOf(opened);
    const ruby = RubyGenerator.targetToCode(targetOf(opened), { version: '2' }).trim();
    opened.runtime.quit();
    return ruby;
};

/**
 * The Japanese made into blocks, the project saved and opened again, and the blocks written back
 * as Ruby and as Japanese.
 * @param {string} dncl - The Japanese.
 * @param {object} [options] - Options of `saveAndOpenRuby`.
 * @returns {Promise<{ruby: string, dncl: string}>} The Ruby and the Japanese of the project opened again.
 */
const saveAndOpen = async (dncl, options) => {
    const { ruby: source, errors } = dnclToRuby(dncl);
    expect(errors).toEqual([]);
    const ruby = await saveAndOpenRuby(source, options);
    return { ruby, dncl: rubyToDncl(ruby).dncl };
};

const TWICE = ['関数 二倍(n):', '    n * 2 を返す'];

describe('a call inside an expression stays with the project (#2588)', () => {
    test('the condition of もし', async () => {
        const dncl = [...TWICE, 'もし 二倍(2) > 3 ならば:', '    表示する("大きい")'].join('\n');
        const back = await saveAndOpen(dncl);
        expect(back.ruby).toContain('if 二倍(2) > 3');
        expect(back.dncl).toContain('もし 二倍(2) > 3 ならば:');
    });

    test('the condition of a loop', async () => {
        const dncl = [...TWICE, 'i = 0', 'i < 二倍(3) の間，', '    i = i + 1', 'を繰り返す', '表示する(i)'].join(
            '\n',
        );
        const back = await saveAndOpen(dncl);
        expect(back.ruby).toContain('while @i < 二倍(3)');
        expect(back.dncl).toContain('i < 二倍(3) の間');
    });

    test('the right side of an assignment', async () => {
        const dncl = [...TWICE, 'a = 二倍(4) + 1', '表示する(a)'].join('\n');
        const back = await saveAndOpen(dncl);
        expect(back.ruby).toContain('a = 二倍(4) + 1');
        expect(back.dncl).toContain('a = 二倍(4) + 1');
    });

    test('the argument of 表示する', async () => {
        const dncl = [...TWICE, '表示する(二倍(5) + 1)'].join('\n');
        const back = await saveAndOpen(dncl);
        expect(back.ruby).toContain('console.puts(二倍(5) + 1)');
        expect(back.dncl).toContain('表示する(二倍(5) + 1)');
    });

    test('two calls in one expression and a call inside a call', async () => {
        const dncl = [...TWICE, 'a = 二倍(1) + 二倍(2)', '表示する(二倍(二倍(a)))'].join('\n');
        const back = await saveAndOpen(dncl);
        expect(back.ruby).toContain('a = 二倍(1) + 二倍(2)');
        expect(back.ruby).toContain('console.puts(二倍(二倍(@a)))');
        expect(back.dncl).toContain('表示する(二倍(二倍(a)))');
    });

    test('the code of the stage, whose return variable is `$_return_<name>_`', async () => {
        const dncl = [...TWICE, 'もし 二倍(2) > 3 ならば:', '    表示する(二倍(1) + 二倍(2))'].join('\n');
        const back = await saveAndOpen(dncl, { onStage: true });
        expect(back.ruby).toContain('if 二倍(2) > 3');
        expect(back.ruby).toContain('console.puts(二倍(1) + 二倍(2))');
        expect(back.dncl).toContain('もし 二倍(2) > 3 ならば:');
    });

    test('a method whose name ends in ? or !, whose Ruby variable name has `_` for it', async () => {
        const source = [
            'def even?(n)',
            '  return n % 2 == 0',
            'end',
            'def half!(n)',
            '  return n / 2',
            'end',
            '@a = even?(2)',
            '@b = half!(4) + half!(6)',
        ].join('\n');
        const ruby = await saveAndOpenRuby(source);
        expect(ruby).toContain('@a = even?(2)');
        expect(ruby).toContain('@b = half!(4) + half!(6)');
    });
});
