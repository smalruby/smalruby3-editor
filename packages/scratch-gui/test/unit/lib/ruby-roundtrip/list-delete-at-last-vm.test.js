// === Smalruby: This file is Smalruby-specific (delete_at(-1) deletes the last item when the blocks run) ===
/**
 * `@a.delete_at(-1)` deletes the last item of the list when the blocks run (issue #1840: the block
 * was "delete 1 of a", which deleted the first item), and comes back as `@a.delete_at(-1)`.
 */
import VM from '@smalruby/scratch-vm';
import { targetCodeToBlocks } from '../../../../src/lib/ruby-to-blocks-converter';
import {
    expectRoundTrip,
    makeConverter,
    makeSpriteTarget,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

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

    const loadSprite = async () => {
        vm = new VM();
        await vm.loadProject({
            targets: [targetJson(true, 'Stage'), targetJson(false, 'Sprite1')],
            monitors: [],
            extensions: [],
            meta: { semver: '3.0.0' },
        });
        const sprite = vm.runtime.targets.find((t) => t.isOriginal && !t.isStage);
        vm.setEditingTarget(sprite.id);
        return sprite;
    };

    const run = async (sprite, code, version) => {
        const converter = await targetCodeToBlocks(vm, sprite, code, null, { version });
        expect(converter.errors).toEqual([]);
        await converter.apply();
        vm.start();
        vm.greenFlag();
        await sleep(300);
    };

    const items = (target, name) => target.lookupVariableByNameAndType(name, 'list').value.map(String);

    test('deletes the last item of the list', async () => {
        const sprite = await loadSprite();
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
        await run(sprite, code, '2');

        expect(items(sprite, 'a')).toEqual(['1', '2']);
        expect(items(sprite, 'b')).toEqual([]);
        expect(items(sprite, 'c')).toEqual([]);
        expect(items(vm.runtime.getTargetForStage(), 'd')).toEqual(['4']);
        expect(sprite.lookupVariableByNameAndType('e', '').value).toBe(1);
    }, 20000);

    test('deletes the last item of the list in Ruby v1', async () => {
        const sprite = await loadSprite();
        const code = [
            'self.when(:flag_clicked) do',
            '  list("$a").clear',
            '  list("$a").push(1)',
            '  list("$a").push(2)',
            '  list("$a").push(3)',
            '  list("$a").delete_at(-1)',
            'end',
        ].join('\n');
        await run(sprite, code, '1');

        expect(items(vm.runtime.getTargetForStage(), 'a')).toEqual(['1', '2']);
    }, 20000);
});

describe('delete_at(-1) round-trips in Ruby v1 (#1840)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '1' });
    });

    test('list("$a").delete_at(-1) comes back', async () => {
        await expectRoundTrip(converter, target, 'list("$a").delete_at(-1)');
    });

    test('delete_at of the length of the same list is written as delete_at(-1)', async () => {
        // The same as delete_at(-1): the item at the length is the last item
        await expectRoundTrip(
            converter,
            target,
            'list("$a").delete_at(list("$a").length)',
            'list("$a").delete_at(-1)',
        );
    });

    test('delete_at with another index comes back', async () => {
        await expectRoundTrip(converter, target, 'list("$a").delete_at(1)');
    });
});
