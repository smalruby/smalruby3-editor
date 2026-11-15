const test = require('tap').test;
const minilog = require('minilog');
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const { MAX_MESSAGE_VALUE_LENGTH, toMessageValue } = require('../../src/extensions/scratch3_mesh_v2/message-value');
const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const BlockUtility = require('../../src/engine/block-utility');

test('toMessageValue (#1843)', (t) => {
    t.equal(toMessageValue('hello'), 'hello');
    t.equal(toMessageValue(42), '42');
    t.equal(toMessageValue(true), 'true');
    t.equal(toMessageValue(null), '');
    t.equal(toMessageValue(undefined), '');
    t.equal(MAX_MESSAGE_VALUE_LENGTH, 1000);
    t.equal(toMessageValue('a'.repeat(1001)).length, 1000);
    t.equal(toMessageValue('a'.repeat(1000)).length, 1000);
    // サロゲートペアを途中で切らない（999 文字 + 絵文字 → 999 文字）
    const cut = toMessageValue(`${'a'.repeat(999)}😀`);
    t.equal(cut, 'a'.repeat(999));
    // 絵文字は String#length で 2 と数える（サーバーと同じ数え方）
    const emoji500 = '😀'.repeat(500);
    t.equal(emoji500.length, 1000);
    t.equal(toMessageValue(emoji500), emoji500);
    t.equal(toMessageValue('😀'.repeat(501)), emoji500);
    t.ok(toMessageValue(`a${'😀'.repeat(600)}`).length <= MAX_MESSAGE_VALUE_LENGTH);
    t.equal(toMessageValue(`a${'😀'.repeat(600)}`), `a${'😀'.repeat(499)}`);
    t.end();
});

test('broadcastEvent routes a payload to startMessageHats (#1843)', (t) => {
    const originalLastInstance = BlockUtility.lastInstance;
    const util = { sequencer: {} };
    BlockUtility.lastInstance = () => util;
    const calls = [];
    const blocks = {
        runtime: { sequencer: {}, emit: () => {}, on: () => {}, off: () => {} },
        opcodeFunctions: {
            event_broadcast: (args) => calls.push(['broadcast', args.BROADCAST_OPTION.name]),
        },
        startMessageHats: (name, value) => calls.push(['withValue', name, value]),
    };
    const service = new MeshV2Service(blocks, 'node1', 'domain1');
    service.stopEventBatchTimer();

    service.broadcastEvent({ name: 'a', payload: 'v' });
    service.broadcastEvent({ name: 'b', payload: '' });
    service.broadcastEvent({ name: 'c', payload: null });

    t.same(calls, [
        ['withValue', 'a', 'v'],
        ['broadcast', 'b'],
        ['broadcast', 'c'],
    ]);

    // startMessageHats を持たない blocks（古い呼び出し方）では今までどおり送る
    delete blocks.startMessageHats;
    calls.length = 0;
    service.broadcastEvent({ name: 'd', payload: 'v' });
    t.same(calls, [['broadcast', 'd']]);

    service.cleanup();
    BlockUtility.lastInstance = originalLastInstance;
    t.end();
});

test('the broadcast argument type uses the standard message dropdown (#1843)', (t) => {
    const Runtime = require('../../src/engine/runtime');
    const BlockType = require('../../src/extension-support/block-type');
    const runtime = new Runtime();
    runtime.on(Runtime.EXTENSION_ADDED, (categoryInfo) => {
        const blockInfo = categoryInfo.blocks[0];
        t.equal(
            blockInfo.xml,
            '<block type="test_send"><value name="BROADCAST_INPUT"><shadow type="event_broadcast_menu">' +
                '</shadow></value></block>',
        );
        t.same(blockInfo.json.args0[0], { type: 'input_value', name: 'BROADCAST_INPUT' });
        t.end();
    });
    runtime._registerExtensionPrimitives({
        id: 'test',
        name: 'test',
        blocks: [
            {
                opcode: 'send',
                blockType: BlockType.COMMAND,
                text: 'send [BROADCAST_INPUT]',
                arguments: { BROADCAST_INPUT: { type: 'broadcast' } },
            },
        ],
    });
});

test('fireEvent never queues a payload longer than the server cap (#1843, #1846)', (t) => {
    const blocks = { runtime: { sequencer: {}, emit: () => {}, on: () => {}, off: () => {} } };
    const service = new MeshV2Service(blocks, 'node1', 'domain1');
    service.stopEventBatchTimer();
    service.client = { mutate: () => Promise.resolve({}) };
    service.groupId = 'group1';

    service.fireEvent('ok', 'short');
    service.fireEvent('long', '😀'.repeat(700));
    service.fireEvent('edge', `x${'😀'.repeat(500)}`);

    service.eventQueue.forEach((e) => t.ok(e.payload.length <= MAX_MESSAGE_VALUE_LENGTH, e.eventName));
    t.equal(service.eventQueue[1].payload, '😀'.repeat(500));
    t.equal(service.eventQueue[2].payload, `x${'😀'.repeat(499)}`);
    t.equal(service.eventQueue[0].payload, 'short');
    service.groupId = null;
    service.cleanup();
    t.end();
});
