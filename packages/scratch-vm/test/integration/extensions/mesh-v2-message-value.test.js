const test = require('tap').test;
const minilog = require('minilog');
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const VirtualMachine = require('../../../src/index');
const { MAX_MESSAGE_VALUE_LENGTH } = require('../../../src/extensions/scratch3_mesh_v2/message-value');

// Issue #1843: 「(メッセージ1 ▼) といっしょに ( ) を送る」と「メッセージの値」。
// 実際の VM でプロジェクトを動かし、値がスクリプトごとに読めることを確かめる。

const VARS = ['got1', 'got2', 'got3', 'gotOther', 'gotAfter', 'count'];
const MESSAGES = ['m1', 'm2', 'm3'];

/**
 * Build blocks of one script from a compact description.
 * Each step is [opcode, inputs, fields]; reporters go in `inputs` as {block: [...]}.
 */
class ScriptBuilder {
    constructor() {
        this.blocks = {};
        this.count = 0;
    }

    id() {
        this.count += 1;
        return `b${this.count}`;
    }

    // A reporter block plugged into an input. Returns [3, id, shadow].
    reporter(opcode, parent, inputs = {}, shadow = [10, '']) {
        const id = this.id();
        this.blocks[id] = {
            opcode,
            next: null,
            parent,
            inputs: this.inputs(id, inputs),
            fields: {},
            shadow: false,
            topLevel: false,
        };
        return [3, id, shadow];
    }

    // A menu shadow block (e.g. control_create_clone_of_menu). Returns [1, id].
    menu(opcode, parent, field, value) {
        const id = this.id();
        this.blocks[id] = {
            opcode,
            next: null,
            parent,
            inputs: {},
            fields: { [field]: [value, null] },
            shadow: true,
            topLevel: false,
        };
        return [1, id];
    }

    inputs(id, inputs) {
        const out = {};
        Object.keys(inputs).forEach((name) => {
            const v = inputs[name];
            if (v && v.reporter) {
                out[name] = this.reporter(v.reporter, id, v.inputs, v.shadow);
            } else if (v && v.menu) {
                out[name] = this.menu(v.menu, id, v.field, v.value);
            } else if (v && v.message) {
                out[name] = [1, [11, v.message, `${v.message}-id`]];
            } else {
                out[name] = [1, [10, String(v)]];
            }
        });
        return out;
    }

    script(steps) {
        let prev = null;
        steps.forEach(([opcode, inputs = {}, fields = {}], i) => {
            const id = this.id();
            this.blocks[id] = {
                opcode,
                next: null,
                parent: prev,
                inputs: this.inputs(id, inputs),
                fields,
                shadow: false,
                topLevel: i === 0,
            };
            if (i === 0) {
                this.blocks[id].x = 0;
                this.blocks[id].y = 0;
            }
            if (prev) this.blocks[prev].next = id;
            prev = id;
        });
    }
}

const when = (message) => ['event_whenbroadcastreceived', {}, { BROADCAST_OPTION: [message, `${message}-id`] }];
const flag = () => ['event_whenflagclicked'];
const wait = (secs) => ['control_wait', { DURATION: secs }];
const send = (message, value) => ['meshV2_broadcastWithValue', { BROADCAST_INPUT: { message }, VALUE: value }];
const broadcast = (message) => ['event_broadcast', { BROADCAST_INPUT: { message } }];
const setVar = (name, value) => ['data_setvariableto', { VALUE: value }, { VARIABLE: [name, `${name}-id`] }];
const messageValue = { reporter: 'meshV2_messageValue' };
const changeVar = (name, value) => ['data_changevariableby', { VALUE: value }, { VARIABLE: [name, `${name}-id`] }];
const cloneMyself = () => [
    'control_create_clone_of',
    { CLONE_OPTION: { menu: 'control_create_clone_of_menu', field: 'CLONE_OPTION', value: '_myself_' } },
];

// 中身は読まない（storage を付けないので VM は読み込みを飛ばす）。sb3 の形として 1 つ要る。
const COSTUME = {
    assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
    name: 'costume1',
    md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0,
};

const makeProject = (scripts, stageScripts = []) => {
    const builder = new ScriptBuilder();
    scripts.forEach((steps) => builder.script(steps));
    const stageBuilder = new ScriptBuilder();
    stageBuilder.count = 1000; // ids must not clash with the sprite's
    stageScripts.forEach((steps) => stageBuilder.script(steps));
    const variables = {};
    VARS.forEach((name) => {
        variables[`${name}-id`] = [name, 'unset'];
    });
    const broadcasts = {};
    MESSAGES.forEach((name) => {
        broadcasts[`${name}-id`] = name;
    });
    return {
        targets: [
            {
                isStage: true,
                name: 'Stage',
                variables,
                lists: {},
                broadcasts,
                blocks: stageBuilder.blocks,
                comments: {},
                currentCostume: 0,
                costumes: [COSTUME],
                sounds: [],
                volume: 100,
                layerOrder: 0,
            },
            {
                isStage: false,
                name: 'Sprite1',
                variables: {},
                lists: {},
                broadcasts: {},
                blocks: builder.blocks,
                comments: {},
                currentCostume: 0,
                costumes: [COSTUME],
                sounds: [],
                volume: 100,
                layerOrder: 1,
                visible: true,
                x: 0,
                y: 0,
                size: 100,
                direction: 90,
                draggable: false,
                rotationStyle: 'all around',
            },
        ],
        monitors: [],
        extensions: ['meshV2'],
        meta: { semver: '3.0.0', vm: '0.2.0', agent: '' },
    };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runProject = async (scripts, options = {}) => {
    const vm = new VirtualMachine();
    await vm.loadProject(options.json || JSON.stringify(makeProject(scripts, options.stageScripts)));
    const ext = vm.runtime.peripheralExtensions.meshV2;
    if (ext.meshService) {
        ext.meshService.stopEventBatchTimer();
        if (options.connected) {
            ext.meshService.groupId = 'group1';
            ext.meshService.client = { mutate: () => Promise.resolve({}) };
        }
    }
    vm.start();
    if (options.beforeFlag) options.beforeFlag(vm, ext);
    vm.greenFlag();
    await sleep(options.waitMs || 600);
    if (options.afterRun) await options.afterRun(vm, ext);
    const stage = vm.runtime.getTargetForStage();
    const values = {};
    VARS.forEach((name) => {
        values[name] = stage.variables[`${name}-id`].value;
    });
    vm.quit();
    if (ext.meshService) {
        ext.meshService.groupId = null;
        ext.meshService.cleanup();
    }
    return { values, ext, vm };
};

test('mesh v2 message value (#1843)', async (t) => {
    t.test('each receiving script reads the value that started it', async (st) => {
        const { values } = await runProject([
            [
                flag(),
                send('m1', 'a'),
                send('m2', '42'),
                wait(0.15),
                setVar('gotOther', messageValue),
                broadcast('m3'),
                wait(0.1),
                setVar('gotAfter', messageValue),
            ],
            // m2 の値が後から届いても、m1 で動いたスクリプトは m1 の値のまま
            [when('m1'), wait(0.05), setVar('got1', messageValue)],
            // 数は数として読める（"42" + 1 = 43）
            [when('m2'), setVar('got2', { reporter: 'operator_add', inputs: { NUM1: messageValue, NUM2: 1 } })],
            // 値なしのメッセージで動いたスクリプトでは空
            [when('m3'), setVar('got3', messageValue)],
        ]);
        st.equal(values.got1, 'a');
        st.equal(values.got2, 43);
        st.equal(values.got3, '');
        // ほかの場所では最後に受け取った値
        st.equal(values.gotOther, '42');
        // 値なしのメッセージは「最後に受け取った値」を消さない
        st.equal(values.gotAfter, '42');
        st.end();
    });

    t.test('restarting a running script with a new value updates its value', async (st) => {
        const { values } = await runProject([
            [flag(), send('m1', 'a'), wait(0.03), send('m1', 'c')],
            [when('m1'), wait(0.15), setVar('got1', messageValue)],
        ]);
        st.equal(values.got1, 'c');
        st.end();
    });

    t.test('restarting with a payload-less broadcast empties the value', async (st) => {
        const { values } = await runProject([
            [flag(), send('m1', 'a'), wait(0.03), broadcast('m1')],
            [when('m1'), wait(0.15), setVar('got1', messageValue)],
        ]);
        st.equal(values.got1, '');
        st.end();
    });

    t.test('the value is cut to the server limit', async (st) => {
        const long = 'x'.repeat(MAX_MESSAGE_VALUE_LENGTH + 5);
        const { values } = await runProject([
            [flag(), send('m1', long)],
            [when('m1'), setVar('got1', messageValue)],
        ]);
        st.equal(values.got1.length, MAX_MESSAGE_VALUE_LENGTH);
        st.end();
    });

    t.test('when connected, the value is queued for the mesh and local scripts still run', async (st) => {
        let queued = null;
        const { values } = await runProject(
            [
                [flag(), send('m1', 'hello')],
                [when('m1'), setVar('got1', messageValue)],
            ],
            {
                connected: true,
                afterRun: (vm, ext) => {
                    queued = ext.meshService.eventQueue.map((e) => [e.eventName, e.payload]);
                },
            },
        );
        st.equal(values.got1, 'hello');
        st.same(queued, [['m1', 'hello']]);
        st.end();
    });

    t.test('a received mesh event starts the receiving script with its value', async (st) => {
        const { values } = await runProject(
            [
                [flag(), wait(0.05)],
                [when('m1'), setVar('got1', messageValue)],
                [when('m3'), setVar('got3', messageValue)],
            ],
            {
                // つないだときと同じく、受け取り用に元の event_broadcast を覚えさせる
                beforeFlag: (vm, ext) => ext.setOpcodeFunctionHOC(),
                afterRun: async (vm, ext) => {
                    ext.meshService.broadcastEvent({ name: 'm1', payload: 'remote' });
                    ext.meshService.broadcastEvent({ name: 'm3', payload: null });
                    await sleep(200);
                },
            },
        );
        st.equal(values.got1, 'remote');
        st.equal(values.got3, '');
        st.end();
    });

    t.test('an empty value does not change the last value received (M1)', async (st) => {
        const { values, ext } = await runProject([
            [flag(), send('m1', 'hi'), wait(0.05), send('m1', ''), wait(0.1), setVar('gotOther', messageValue)],
            // やり直しで値が空になったスクリプトでは空
            [when('m1'), wait(0.02), setVar('got1', messageValue)],
        ]);
        st.equal(values.got1, '');
        st.equal(values.gotOther, 'hi');
        st.equal(ext.lastMessageValue, 'hi');
        st.end();
    });

    t.test('an empty value is queued like a message without a value (M1)', async (st) => {
        let queued = null;
        await runProject([[flag(), send('m1', '')]], {
            connected: true,
            afterRun: (vm, ext) => {
                queued = ext.meshService.eventQueue.map((e) => [e.eventName, e.payload]);
            },
        });
        st.same(queued, [['m1', '']]);
        st.end();
    });

    t.test('loading another project forgets the last value (FYI1)', async (st) => {
        const vm = new VirtualMachine();
        await vm.loadProject(JSON.stringify(makeProject([[flag(), send('m1', 'old')]])));
        const ext = vm.runtime.peripheralExtensions.meshV2;
        ext.meshService.stopEventBatchTimer();
        vm.start();
        vm.greenFlag();
        await sleep(200);
        st.equal(ext.lastMessageValue, 'old');
        await vm.loadProject(JSON.stringify(makeProject([])));
        st.equal(vm.runtime.peripheralExtensions.meshV2, ext);
        st.equal(ext.lastMessageValue, '');
        vm.quit();
        ext.meshService.cleanup();
        st.end();
    });

    t.test('a project saved with the block loads and runs again (FYI4)', async (st) => {
        const vm = new VirtualMachine();
        await vm.loadProject(
            JSON.stringify(
                makeProject([
                    [flag(), send('m1', 'saved')],
                    [when('m1'), setVar('got1', messageValue)],
                ]),
            ),
        );
        const saved = JSON.parse(vm.toJSON());
        vm.runtime.peripheralExtensions.meshV2.meshService.cleanup();
        vm.quit();
        const sprite = saved.targets.find((target) => !target.isStage);
        const block = Object.values(sprite.blocks).find((b) => b.opcode === 'meshV2_broadcastWithValue');
        st.same(block.inputs.BROADCAST_INPUT, [1, [11, 'm1', 'm1-id']]);
        st.ok(saved.extensions.includes('meshV2'));

        const { values } = await runProject(null, { json: JSON.stringify(saved) });
        st.equal(values.got1, 'saved');
        st.end();
    });

    t.test('the stage and clones receive the value (FYI4)', async (st) => {
        const { values } = await runProject(
            [
                [flag(), cloneMyself(), wait(0.05), send('m1', '1')],
                // 本体とクローンの両方で、値の 1 を足す → 2
                [when('m1'), changeVar('count', messageValue)],
            ],
            {
                stageScripts: [[when('m1'), setVar('got3', messageValue)]],
            },
        );
        st.equal(values.count, 2);
        st.equal(values.got3, '1');
        st.end();
    });

    t.test('a reporter plugged into the message slot (FYI4)', async (st) => {
        const joined = {
            reporter: 'operator_join',
            inputs: { STRING1: 'm', STRING2: '1' },
            shadow: [11, 'm3', 'm3-id'],
        };
        const { values } = await runProject([
            [flag(), ['meshV2_broadcastWithValue', { BROADCAST_INPUT: joined, VALUE: 'joined' }]],
            [when('m1'), setVar('got1', messageValue)],
            [when('m3'), setVar('got3', messageValue)],
        ]);
        st.equal(values.got1, 'joined');
        st.equal(values.got3, 'unset');
        st.end();
    });

    t.end();
});
