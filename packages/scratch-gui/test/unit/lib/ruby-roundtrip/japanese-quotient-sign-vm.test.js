// === Smalruby: This file is Smalruby-specific (the sign before ÷ when the blocks run) ===
/**
 * The integer quotient `÷` of the Japanese mode with a sign, when the blocks run (issue #2548):
 * a sign binds tighter than `÷`, so `-7 ÷ 2` and `(-a) ÷ 2` are `-4` (the quotient is rounded
 * down, docs/smalruby-dncl-spec.ja.md), and `-(a ÷ 2)` is `-3`.
 */
import VM from '@smalruby/scratch-vm';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
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

describe('the sign before ÷ when the blocks run (#2548)', () => {
    let vm;

    afterEach(() => {
        vm.stopAll();
        vm.runtime.quit();
    });

    test('a sign binds tighter than ÷, and the quotient is rounded down', async () => {
        vm = new VM();
        await vm.loadProject({
            targets: [targetJson(true, 'Stage'), targetJson(false, 'Sprite1')],
            monitors: [],
            extensions: [],
            meta: { semver: '3.0.0' },
        });
        const sprite = vm.runtime.targets.find((t) => t.isOriginal && !t.isStage);
        vm.setEditingTarget(sprite.id);

        const { ruby, errors } = dnclToRuby(
            ['a = 7', 'p = 7 ÷ 2', 'q = -7 ÷ 2', 'r = (-a) ÷ 2', 's = -a ÷ 2', 't = -(a ÷ 2)'].join('\n'),
        );
        expect(errors).toEqual([]);
        const code = ['when_flag_clicked do', ...ruby.split('\n').map((line) => `  ${line}`), 'end'].join('\n');
        const converter = await targetCodeToBlocks(vm, sprite, code, null, { version: '2' });
        expect(converter.errors).toEqual([]);
        await converter.apply();
        vm.start();
        vm.greenFlag();
        await sleep(300);

        const value = (name) => Number(sprite.lookupVariableByNameAndType(name, '').value);
        expect(['p', 'q', 'r', 's', 't'].map(value)).toEqual([3, -4, -4, -4, -3]);
    }, 20000);
});
