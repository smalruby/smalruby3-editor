const test = require('tap').test;
const minilog = require('minilog');
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

process.env.MESH_NETWORK_FILTER = 'false';

const URLSearchParams = require('url').URLSearchParams;
const MeshV2Blocks = require('../../src/extensions/scratch3_mesh_v2/index.js');
const Runtime = require('../../src/engine/runtime');
const Sprite = require('../../src/sprites/sprite');
const Variable = require('../../src/engine/variable');

const originalURLSearchParams = global.URLSearchParams;
require('tap').teardown(() => {
    delete global.window;
    global.URLSearchParams = originalURLSearchParams;
});

const makeStage = (runtime) => {
    const stage = new Sprite(null, runtime).createClone();
    stage.isStage = true;
    runtime.addTarget(stage);
    return stage;
};

/**
 * Make the extension on a real runtime, and record what it sends to the mesh.
 * @returns {{runtime: Runtime, blocks: MeshV2Blocks, sent: Array}} test fixtures.
 */
const setup = () => {
    global.window = { location: { search: '?mesh=test-domain' } };
    global.URLSearchParams = URLSearchParams;
    const runtime = new Runtime();
    const blocks = new MeshV2Blocks(runtime);
    blocks.meshService.stopEventBatchTimer();
    const sent = [];
    blocks.meshService.sendData = (data) => sent.push(...data);
    return { runtime, blocks, sent };
};

/**
 * Like connect(): hook the opcodes and the variable functions.
 * @param {MeshV2Blocks} blocks - the extension.
 */
const connectHooks = (blocks) => {
    blocks.setOpcodeFunctionHOC();
    blocks.setVariableFunctionHOC();
};

/**
 * Replace the project like vm.loadProject: dispose, install a new stage, then PROJECT_LOADED.
 * @param {Runtime} runtime - the runtime.
 * @returns {Target} the new stage.
 */
const reloadProject = (runtime) => {
    runtime.dispose();
    const stage = makeStage(runtime);
    runtime.handleProjectLoaded();
    return stage;
};

// The paths the editor really uses (blocks.js handles the Blockly variable events).
const makeVariableFromMenu = (stage, id, name) =>
    stage.blocks.blocklyListen({ type: 'var_create', varId: id, varName: name, varType: '', isLocal: false });
const renameVariableFromMenu = (stage, id, newName) =>
    stage.blocks.blocklyListen({ type: 'var_rename', varId: id, newName });
const runSetVariableBlock = (runtime, stage, id, name, value) =>
    runtime.getOpcodeFunction('data_setvariableto')({ VARIABLE: { id, name }, VALUE: value }, { target: stage });

test('"Make a Variable" on the stage is sent after connecting', (t) => {
    const { runtime, blocks, sent } = setup();
    const stage = makeStage(runtime);
    connectHooks(blocks);
    makeVariableFromMenu(stage, 'v1', 'score');
    t.same(sent, [{ key: 'score', value: '0' }]);
    t.end();
});

test('after reloading the project, the new stage is hooked (#1833)', (t) => {
    const { runtime, blocks, sent } = setup();
    makeStage(runtime);
    connectHooks(blocks);

    const stage2 = reloadProject(runtime);
    makeVariableFromMenu(stage2, 'v2', 'level');
    t.same(sent, [{ key: 'level', value: '0' }], '"Make a Variable" on the new stage is sent');
    t.equal(stage2.variables.v2.name, 'level', 'the new stage really has the variable');

    renameVariableFromMenu(stage2, 'v2', 'stage');
    t.same(sent[1], { key: 'stage', value: '0' }, 'renaming on the new stage is sent');
    t.equal(stage2.variables.v2.name, 'stage');

    runSetVariableBlock(runtime, stage2, 'v2', 'stage', 3);
    t.same(sent[2], { key: 'stage', value: '3' }, 'the set variable block still sends on the new stage');
    t.equal(stage2.variables.v2.value, 3);
    t.end();
});

test('reloading twice hooks only the current stage once (#1833)', (t) => {
    const { runtime, blocks, sent } = setup();
    makeStage(runtime);
    connectHooks(blocks);
    reloadProject(runtime);
    const stage3 = reloadProject(runtime);
    blocks.setVariableFunctionHOC(); // e.g. connect() again: must not wrap twice
    makeVariableFromMenu(stage3, 'v3', 'hp');
    stage3.setVariableValue('v3', 9);
    t.same(sent, [
        { key: 'hp', value: '0' },
        { key: 'hp', value: '9' },
    ]);
    t.end();
});

test('a reload before connecting does not hook the stage', (t) => {
    const { runtime, sent } = setup();
    makeStage(runtime);
    const stage2 = reloadProject(runtime);
    makeVariableFromMenu(stage2, 'v4', 'x');
    stage2.setVariableValue('v4', 1);
    t.same(sent, []);
    t.equal(stage2.variables.v4.value, 1);
    t.end();
});
