// === Smalruby: This file is Smalruby-specific (v2 hash methods give the right values when the blocks run) ===
/**
 * `@h.length` / `@h.empty?` / `@h.key?` read the keys list of the hash, so the blocks give the
 * real values when they run (issue #1652: they used to read an empty list named after the hash).
 */
import VM from '@smalruby/scratch-vm';
import { targetCodeToBlocks } from '../../../../src/lib/ruby-to-blocks-converter';

// jsdom has no performance.mark / measure (scratch-vm calls them when it loads)
if (typeof performance.mark !== 'function') performance.mark = () => {};
if (typeof performance.measure !== 'function') performance.measure = () => {};

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('V2 hash methods when the blocks run (#1652)', () => {
    let vm;

    afterEach(() => {
        vm.stopAll();
        vm.runtime.quit();
    });

    test('length / empty? / key? give the values of the hash', async () => {
        vm = new VM();
        await vm.loadProject({
            targets: [targetJson(true, 'Stage'), targetJson(false, 'Sprite1')],
            monitors: [],
            extensions: [],
            meta: { semver: '3.0.0' },
        });
        const sprite = vm.runtime.targets.find((t) => t.isOriginal && !t.isStage);
        vm.setEditingTarget(sprite.id);
        const code = [
            'when_flag_clicked do',
            '  @h = {a: 1, b: 2, "c" => 3}',
            '  @length = @h.length',
            '  @empty = @h.empty?',
            '  @has_a = @h.key?(:a)',
            '  @has_z = @h.key?(:z)',
            '  @has_c = @h.key?("c")',
            '  @e = {}',
            '  @e_empty = @e.empty?',
            '  h = {x: 1}',
            '  @local_length = h.length',
            '  @local_has_x = h.key?(:x)',
            'end',
        ].join('\n');
        const converter = await targetCodeToBlocks(vm, sprite, code, null, { version: '2' });
        expect(converter.errors).toEqual([]);
        await converter.apply();

        vm.start();
        vm.greenFlag();
        await sleep(300);

        const value = (name) => sprite.lookupVariableByNameAndType(name, '').value;
        expect(value('length')).toBe(3);
        expect(value('empty')).toBe(false);
        expect(value('has_a')).toBe(true);
        expect(value('has_z')).toBe(false);
        expect(value('has_c')).toBe(true);
        expect(value('e_empty')).toBe(true);
        expect(value('local_length')).toBe(1);
        expect(value('local_has_x')).toBe(true);
    }, 20000);
});
