// === Smalruby: This file is Smalruby-specific (delete_at(-1) deletes the last item when the blocks run) ===
/**
 * `@a.delete_at(-1)` deletes the last item of the list when the blocks run (issue #1840: the block
 * was "delete 1 of a", which deleted the first item), and comes back as `@a.delete_at(-1)`.
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

describe('delete_at(-1) when the blocks run (#1840)', () => {
    let vm;

    afterEach(() => {
        vm.stopAll();
        vm.runtime.quit();
    });

    test('deletes the last item of the list', async () => {
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
            '  @a = [1, 2, 3]',
            '  @a.delete_at(-1)',
            '  @b = ["x"]',
            '  @b.delete_at(-1)',
            '  @c = []',
            '  @c.delete_at(-1)',
            '  $d = [4, 5]',
            '  $d.delete_at(-1)',
            '  e = [6, 7]',
            '  e.delete_at(-1)',
            '  @e = e.length',
            'end',
        ].join('\n');
        const converter = await targetCodeToBlocks(vm, sprite, code, null, { version: '2' });
        expect(converter.errors).toEqual([]);
        await converter.apply();

        vm.start();
        vm.greenFlag();
        await sleep(300);

        const items = (target, name) => target.lookupVariableByNameAndType(name, 'list').value.map(String);
        expect(items(sprite, 'a')).toEqual(['1', '2']);
        expect(items(sprite, 'b')).toEqual([]);
        expect(items(sprite, 'c')).toEqual([]);
        expect(items(vm.runtime.getTargetForStage(), 'd')).toEqual(['4']);
        expect(sprite.lookupVariableByNameAndType('e', '').value).toBe(1);
    }, 20000);
});
