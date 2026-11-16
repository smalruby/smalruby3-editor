// Issue #1930: a stage variable changed without the hooks (vm.setVariableValue,
// the same direct write as the GUI's monitor slider) reaches sendData on the
// next frame of the real runtime, and nothing is sent while it does not change.
const test = require('tap').test;
const minilog = require('minilog');
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

process.env.MESH_NETWORK_FILTER = 'false';

const URLSearchParams = require('url').URLSearchParams;
const VirtualMachine = require('../../src/virtual-machine');
const MeshV2Blocks = require('../../src/extensions/scratch3_mesh_v2/index.js');
const Sprite = require('../../src/sprites/sprite');
const Variable = require('../../src/engine/variable');

const originalURLSearchParams = global.URLSearchParams;
require('tap').teardown(() => {
    delete global.window;
    global.URLSearchParams = originalURLSearchParams;
});

const setup = async () => {
    global.window = { location: { search: '?mesh=test-domain' } };
    global.URLSearchParams = URLSearchParams;
    const vm = new VirtualMachine();
    const runtime = vm.runtime;
    const stage = new Sprite(null, runtime).createClone();
    stage.isStage = true;
    runtime.addTarget(stage);
    stage.createVariable('score-id', 'score', Variable.SCALAR_TYPE);

    const blocks = new MeshV2Blocks(runtime);
    const service = blocks.meshService;
    service.stopEventBatchTimer();
    // Like connect(): hook the opcodes and the variable functions.
    blocks.setOpcodeFunctionHOC();
    blocks.setVariableFunctionHOC();

    // Joined a group: the join sends all global variables once.
    service.groupId = 'group1';
    service.client = { mutate: () => Promise.resolve({}) };
    await service.sendAllGlobalVariables();

    const sent = [];
    const originalSendData = service.sendData.bind(service);
    service.sendData = (data, options) => {
        sent.push(data);
        return originalSendData(data, options);
    };
    return { vm, runtime, stage, service, sent };
};

test('mesh v2 sends a variable changed by vm.setVariableValue on the next frame (#1930)', async (t) => {
    const { vm, runtime, stage, service, sent } = await setup();

    t.ok(vm.setVariableValue(stage.id, 'score-id', 42), 'the slider path writes the value');
    t.same(sent, [], 'the direct write itself goes through no hook');

    runtime._step(); // emits BEFORE_STEP
    t.same(sent, [[{ key: 'score', value: '42' }]], 'sent on the next frame');

    runtime._step();
    runtime._step();
    t.equal(sent.length, 1, 'not sent again while the value does not change');

    vm.setVariableValue(stage.id, 'score-id', 43);
    runtime._step();
    t.same(sent[1], [{ key: 'score', value: '43' }], 'the next change is sent too');

    await service.dataRateLimiter.waitForCompletion();
    service.cleanup();
    t.end();
});
