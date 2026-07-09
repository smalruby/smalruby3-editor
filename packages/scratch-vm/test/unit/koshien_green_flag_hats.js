/**
 * Green flag → koshien connect-game hat, proven on a REAL Runtime.
 *
 * These tests exercise the actual hat machinery (extension registration via
 * the extension manager, runtime.greenFlag, startHats, the sequencer) instead
 * of mocks, to pin down the side effects of starting an extension hat from
 * PROJECT_START:
 *   - runtime.startHats executes the started hat block immediately, so the
 *     mock connection is made synchronously inside greenFlag()
 *   - the blocks under the hat run on subsequent runtime steps
 *   - plain when-flag-clicked hats keep starting
 *   - extra connect-game hats report false (already connected) and retire
 *   - a project without any connect-game hat is unaffected
 */
const test = require('tap').test;
const VirtualMachine = require('../../src/virtual-machine');
const Blocks = require('../../src/engine/blocks');
const Sprite = require('../../src/sprites/sprite');

const textShadow = (id, value, parent) => ({
    id,
    opcode: 'text',
    fields: { TEXT: { name: 'TEXT', value } },
    inputs: {},
    next: null,
    parent,
    shadow: true,
    topLevel: false,
});

// Builds a target holding:
//   [connect-game "player1"] -> [get map area "3:2"] -> [turn over]
//   (optionally a second, childless connect-game hat "player2")
//   [when flag clicked]  (no children; proves flag hats still start)
const buildAiTarget = (vm, { hatCount = 1 } = {}) => {
    const b = new Blocks(vm.runtime);
    for (let i = 1; i <= hatCount; i++) {
        b.createBlock(textShadow(`shName${i}`, `player${i}`, `hat${i}`));
        b.createBlock({
            id: `hat${i}`,
            opcode: 'koshien_connectGame',
            inputs: { NAME: { name: 'NAME', block: `shName${i}`, shadow: `shName${i}` } },
            fields: {},
            next: i === 1 ? 'scan1' : null,
            parent: null,
            shadow: false,
            topLevel: true,
            x: 0,
            y: i * 100,
        });
    }
    b.createBlock(textShadow('shPos', '3:2', 'scan1'));
    b.createBlock({
        id: 'scan1',
        opcode: 'koshien_getMapArea',
        inputs: { POSITION: { name: 'POSITION', block: 'shPos', shadow: 'shPos' } },
        fields: {},
        next: 'turn1',
        parent: 'hat1',
        shadow: false,
        topLevel: false,
    });
    b.createBlock({
        id: 'turn1',
        opcode: 'koshien_turnOver',
        inputs: {},
        fields: {},
        next: null,
        parent: 'scan1',
        shadow: false,
        topLevel: false,
    });
    b.createBlock({
        id: 'flag1',
        opcode: 'event_whenflagclicked',
        inputs: {},
        fields: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: true,
        x: 200,
        y: 0,
    });
    const sprite = new Sprite(b, vm.runtime);
    sprite.name = 'AI';
    const target = sprite.createClone();
    vm.runtime.addTarget(target);
    return target;
};

const makeVm = async () => {
    const vm = new VirtualMachine();
    await vm.extensionManager.loadExtensionURL('koshien');
    vm.runtime.getKoshienMockConfig = () => ({ rival: 'stop' });
    // The runtime is stepped by hand below; without runtime.start() the
    // sequencer's work-time budget would be 0 and no thread would advance.
    vm.runtime.currentStepTime = 1000 / 30;
    return vm;
};

// Step the runtime (flushing promises in between) until every thread retired.
const drainThreads = async (vm) => {
    for (let i = 0; i < 100 && vm.runtime.threads.length > 0; i++) {
        vm.runtime._step();
        await Promise.resolve();
        await Promise.resolve();
    }
    return vm.runtime.threads.length;
};

test('green flag runs the connect-game hat and the script under it', async (t) => {
    const vm = await makeVm();
    buildAiTarget(vm);

    vm.runtime.greenFlag();

    // Threads for both our hat and the plain flag hat were created.
    const topBlocks = vm.runtime.threads.map((th) => th.topBlock);
    t.ok(topBlocks.includes('hat1'), 'connect-game hat thread started');
    t.ok(topBlocks.includes('flag1'), 'when-flag-clicked hats still start');

    // startHats executed the hat immediately: already connected.
    const s1 = vm.runtime.koshienMockState;
    t.equal(s1.connected, true, 'connected synchronously by the hat');
    t.equal(s1.playerName, 'player1', 'the hat argument was used');
    t.equal(s1.game.turn, 1, 'fresh game');

    const leftover = await drainThreads(vm);
    t.equal(leftover, 0, 'all threads retired');
    const s2 = vm.runtime.koshienMockState;
    t.ok(s2.myMap[2][3] !== -1, 'get-map-area under the hat revealed cells');
    t.equal(s2.game.turn, 2, 'turn-over under the hat resolved the turn');
    t.ok(
        s2.journal.some((e) => e.kind === 'action' && e.text.includes('マップ取得')),
        'the script was journaled',
    );

    // Pressing the flag again starts a fresh game and replays the script.
    vm.runtime.greenFlag();
    t.equal(vm.runtime.koshienMockState.game.turn, 1, 'world restarted');
    await drainThreads(vm);
    t.equal(vm.runtime.koshienMockState.game.turn, 2, 'script replayed');
    t.end();
});

test('an extra connect-game hat retires without a second connection', async (t) => {
    const vm = await makeVm();
    buildAiTarget(vm, { hatCount: 2 });

    vm.runtime.greenFlag();
    t.equal(vm.runtime.koshienMockState.playerName, 'player1', 'first hat won');

    const leftover = await drainThreads(vm);
    t.equal(leftover, 0, 'the false-reporting hat thread retired cleanly');
    t.equal(vm.runtime.koshienMockState.connected, true, 'still connected');
    t.equal(vm.runtime.koshienMockState.playerName, 'player1', 'no takeover');
    t.end();
});

test('green flag without a connect-game hat leaves the mock untouched', async (t) => {
    const vm = await makeVm();
    const b = new Blocks(vm.runtime);
    b.createBlock({
        id: 'flagOnly',
        opcode: 'event_whenflagclicked',
        inputs: {},
        fields: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: true,
        x: 0,
        y: 0,
    });
    const sprite = new Sprite(b, vm.runtime);
    sprite.name = 'FlagOnly';
    vm.runtime.addTarget(sprite.createClone());

    t.doesNotThrow(() => vm.runtime.greenFlag());
    t.equal(vm.runtime.koshienMockState.connected, false, 'no connection');
    await drainThreads(vm);
    t.equal(vm.runtime.koshienMockState.connected, false, 'still none');
    t.end();
});
