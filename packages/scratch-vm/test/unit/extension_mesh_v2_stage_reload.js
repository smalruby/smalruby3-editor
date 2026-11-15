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

require('tap').teardown(() => {
    delete global.window;
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

test('variable changes on the stage are sent after connecting', (t) => {
    const { runtime, blocks, sent } = setup();
    const stage = makeStage(runtime);
    stage.createVariable('v1', 'score', Variable.SCALAR_TYPE);
    blocks.setVariableFunctionHOC();
    stage.setVariableValue('v1', 5);
    t.same(sent, [{ key: 'score', value: '5' }]);
    t.end();
});

test('the new stage is hooked after the project is reloaded (#1833)', (t) => {
    const { runtime, blocks, sent } = setup();
    makeStage(runtime);
    blocks.setVariableFunctionHOC();

    const stage2 = reloadProject(runtime);
    stage2.createVariable('v2', 'level', Variable.SCALAR_TYPE);
    t.same(sent, [{ key: 'level', value: '0' }], 'a variable made on the new stage is sent');
    stage2.setVariableValue('v2', 3);
    t.same(sent[1], { key: 'level', value: '3' }, 'a value set on the new stage (e.g. slider) is sent');
    t.equal(stage2.variables.v2.value, 3, 'the new stage really keeps the value');
    stage2.renameVariable('v2', 'stage');
    t.same(sent[2], { key: 'stage', value: '3' });
    t.equal(stage2.variables.v2.name, 'stage');
    t.end();
});

test('reloading twice hooks only the current stage once (#1833)', (t) => {
    const { runtime, blocks, sent } = setup();
    makeStage(runtime);
    blocks.setVariableFunctionHOC();
    reloadProject(runtime);
    const stage3 = reloadProject(runtime);
    blocks.setVariableFunctionHOC(); // e.g. connect() again: must not wrap twice
    stage3.createVariable('v3', 'hp', Variable.SCALAR_TYPE);
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
    stage2.createVariable('v4', 'x', Variable.SCALAR_TYPE);
    stage2.setVariableValue('v4', 1);
    t.same(sent, []);
    t.equal(stage2.variables.v4.value, 1);
    t.end();
});
