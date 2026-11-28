// === Smalruby: This file is Smalruby-specific (the settings of the Japanese mode stay with the project) ===
/**
 * The settings of a program of the Japanese mode are the sentences at its top
 * (docs/dncl/design.md 4 章). They become Ruby comments, so they stay with the
 * blocks: the project is saved and opened again, and the same sentences and
 * settings come back (#1757).
 */
import { settingsOfSource } from '@smalruby/ja-notation';
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

/**
 * The Japanese made into blocks, the project saved and opened again, and the
 * blocks written back as Japanese.
 * @param {string} dncl - The Japanese.
 * @returns {Promise<string>} The Japanese of the project opened again.
 */
const saveAndOpen = async (dncl) => {
    const vm = new VM();
    await vm.loadProject({
        targets: [targetJson(true, 'Stage'), targetJson(false, 'Sprite1')],
        monitors: [],
        extensions: [],
        meta: { semver: '3.0.0' },
    });
    vm.setEditingTarget(spriteOf(vm).id);
    const converter = await targetCodeToBlocks(vm, spriteOf(vm), dnclToRuby(dncl).ruby, null, { version: '2' });
    expect(converter.errors).toEqual([]);
    await converter.apply();
    const saved = JSON.parse(JSON.stringify(vm.toJSON()));
    vm.runtime.quit();

    const opened = new VM();
    await opened.loadProject(saved);
    setupRubyGenerator();
    RubyGenerator.currentTarget = spriteOf(opened);
    const ruby = RubyGenerator.targetToCode(spriteOf(opened), { version: '2' }).trim();
    opened.runtime.quit();
    return rubyToDncl(ruby).dncl;
};

const INDEX_FROM_ONE = '# すべての配列の添字は 1 から始まる。';
const AND_NOTE = '# 「and」は「かつ」を意味する論理演算子であり，左右の式がともに真のときにだけ真となる。';

describe('the settings stay with the project (#1757)', () => {
    test('indexes from 1 and the logical operators', async () => {
        const dncl = [INDEX_FROM_ONE, AND_NOTE, 'A = [5, 6]', '表示する(A[1])'].join('\n');
        const back = await saveAndOpen(dncl);
        expect(back).toBe(dncl);
        expect(settingsOfSource(back)).toEqual({ indexBase: 1, commentMarker: '#', logicNote: true });
    });

    test('the comment mark //', async () => {
        const dncl = ['// 「//」から行の終わりまでは，処理の対象とならない。', 'a = 1 // 個数', '表示する(a)'].join(
            '\n',
        );
        const back = await saveAndOpen(dncl);
        expect(back).toBe(dncl);
        expect(settingsOfSource(back).commentMarker).toBe('//');
    });

    test('a program of only the sentences', async () => {
        expect(await saveAndOpen(INDEX_FROM_ONE)).toBe(INDEX_FROM_ONE);
    });
});
