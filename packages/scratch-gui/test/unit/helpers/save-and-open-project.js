// === Smalruby: This file is Smalruby-specific (Ruby made into a project, saved and opened again) ===
/**
 * A saved project keeps a variable read inside an input as a primitive and makes a new block of it
 * when it is opened again, so the comments `@ruby:*` of such a block are lost. These helpers make
 * Ruby into blocks, save and open the project, and write the blocks back as Ruby (#2588 / #2592).
 */
import VM from '@smalruby/scratch-vm';
import RubyGenerator from '../../../src/lib/ruby-generator';
import { targetCodeToBlocks } from '../../../src/lib/ruby-to-blocks-converter';
import { setupRubyGenerator } from './ruby-roundtrip-helper';

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

const spriteOf = (vm) => vm.runtime.targets.find((t) => t.isOriginal && !t.isStage);
const stageOf = (vm) => vm.runtime.getTargetForStage();

/**
 * The Ruby made into blocks, the project saved and opened again, and the blocks written back as Ruby.
 * The caller loads prism first (`loadPrism`).
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

export { saveAndOpenRuby };
