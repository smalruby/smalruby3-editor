/**
 * Unit tests for the lesson goal monitor (src/lib/lessons/goal-monitor.js) and the
 * VM execution hook. The VM is replaced by a small fake runtime: an EventEmitter with
 * `getOpcodeFunction`, targets and threads shaped like scratch-vm's.
 */
import EventEmitter from 'events';
import { attachGoalMonitor, takeCostumeCounts, takeSnapshot } from '../../../../src/lib/lessons/goal-monitor';
import { hookOpcodeExecution, isExecutionHooked } from '../../../../src/lib/lessons/vm-execution-hook';

const makeTarget = ({ id, isStage = false, blocks = {}, variables = {}, costumes = 1 }) => ({
    id,
    isStage,
    isOriginal: true,
    variables,
    blocks: {
        resetCache: jest.fn(),
        getBlock: (blockId) => blocks[blockId] || null,
    },
    getCostumes: () => Array(costumes).fill({}),
});

const makeRuntime = (targets) => {
    const runtime = new EventEmitter();
    runtime.targets = targets;
    runtime.flyoutBlocks = { resetCache: jest.fn() };
    runtime.getTargetForStage = () => targets.find((t) => t.isStage) || null;
    runtime._primitives = {};
    runtime.getOpcodeFunction = function (opcode) {
        return this._primitives[opcode];
    };
    return runtime;
};

const makeVm = (targets, loaded = []) => {
    const runtime = makeRuntime(targets);
    return {
        runtime,
        extensionManager: { isExtensionLoaded: (id) => loaded.includes(id) },
    };
};

// Run `opcode` the way execute.js does: fetch the (wrapped) primitive and call it with
// the shared block utility whose `thread` points at the running thread.
const exec = (runtime, thread, opcode, args = {}) =>
    runtime.getOpcodeFunction(opcode)(args, { thread, target: thread.target });

const hatThread = (target, topBlock, extra = {}) => ({ topBlock, target, blockContainer: target.blocks, ...extra });

describe('hookOpcodeExecution', () => {
    test('wraps primitives once per runtime and notifies listeners with the thread', () => {
        const runtime = makeRuntime([]);
        const say = jest.fn(() => 'said');
        runtime._primitives.looks_say = say;
        const listener = jest.fn();
        const unhook = hookOpcodeExecution(runtime, listener);
        expect(isExecutionHooked(runtime)).toBe(true);

        const thread = { topBlock: 'b1' };
        const result = runtime.getOpcodeFunction('looks_say')({ MESSAGE: 'hi' }, { thread });
        expect(result).toBe('said');
        expect(say).toHaveBeenCalledWith({ MESSAGE: 'hi' }, { thread });
        expect(listener).toHaveBeenCalledWith('looks_say', { MESSAGE: 'hi' }, { thread });

        // the same wrapper is returned for the same primitive (execute.js caches it)
        expect(runtime.getOpcodeFunction('looks_say')).toBe(runtime.getOpcodeFunction('looks_say'));
        // hats without a primitive stay undefined
        expect(runtime.getOpcodeFunction('event_whenflagclicked')).toBeUndefined();

        unhook();
        runtime.getOpcodeFunction('looks_say')({ MESSAGE: 'again' }, { thread });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(say).toHaveBeenCalledTimes(2);
    });

    test('records only the outer primitive when one primitive calls another', () => {
        const runtime = makeRuntime([]);
        runtime._primitives.inner = jest.fn();
        runtime._primitives.outer = (args, util) => runtime.getOpcodeFunction('inner')(args, util);
        const listener = jest.fn();
        hookOpcodeExecution(runtime, listener);
        runtime.getOpcodeFunction('outer')({}, { thread: {} });
        expect(listener.mock.calls.map((c) => c[0])).toEqual(['outer']);
        expect(runtime._primitives.inner).toHaveBeenCalledTimes(1);
    });

    test('re-wraps when the primitive is replaced (extension load / mesh override)', () => {
        const runtime = makeRuntime([]);
        runtime._primitives.event_broadcast = jest.fn();
        const listener = jest.fn();
        hookOpcodeExecution(runtime, listener);
        const first = runtime.getOpcodeFunction('event_broadcast');
        runtime._primitives.event_broadcast = jest.fn();
        const second = runtime.getOpcodeFunction('event_broadcast');
        expect(second).not.toBe(first);
        second({}, { thread: {} });
        expect(runtime._primitives.event_broadcast).toHaveBeenCalledTimes(1);
    });

    test('a failing listener does not break the block', () => {
        const runtime = makeRuntime([]);
        runtime._primitives.looks_say = () => 'ok';
        const error = jest.spyOn(console, 'error').mockImplementation(() => {});
        hookOpcodeExecution(runtime, () => {
            throw new Error('boom');
        });
        expect(runtime.getOpcodeFunction('looks_say')({}, { thread: {} })).toBe('ok');
        expect(error).toHaveBeenCalled();
        error.mockRestore();
    });
});

describe('attachGoalMonitor', () => {
    let cat;
    let stage;
    let vm;
    let runtime;

    beforeEach(() => {
        cat = makeTarget({
            id: 'cat',
            blocks: {
                spaceHat: {
                    opcode: 'event_whenkeypressed',
                    fields: { KEY_OPTION: { name: 'KEY_OPTION', value: 'space' } },
                },
                clickHat: { opcode: 'event_whenthisspriteclicked', fields: {} },
            },
            costumes: 2,
        });
        stage = makeTarget({
            id: 'stage',
            isStage: true,
            variables: { v1: { name: '回数', type: '', value: 0 } },
        });
        vm = makeVm([stage, cat]);
        runtime = vm.runtime;
        runtime._primitives.sound_play = jest.fn();
        runtime._primitives.sound_playuntildone = jest.fn();
        runtime._primitives.looks_say = jest.fn();
    });

    test('calls onSatisfied once at the next step after a uses goal is met, then detaches', () => {
        const onSatisfied = jest.fn();
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenkeypressed', key: 'space' },
                blocks: ['sound_playuntildone', 'sound_play'],
            },
        ];
        attachGoalMonitor(vm, goal, onSatisfied);
        // caches are reset so blocks cached before the hook pick up the wrapped primitive
        expect(cat.blocks.resetCache).toHaveBeenCalled();
        expect(runtime.flyoutBlocks.resetCache).toHaveBeenCalled();

        const thread = hatThread(cat, 'spaceHat');
        exec(runtime, thread, 'sound_playuntildone', { SOUND_MENU: 'ニャー' });
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).not.toHaveBeenCalled();

        exec(runtime, thread, 'sound_play', { SOUND_MENU: 'Owl' });
        expect(onSatisfied).not.toHaveBeenCalled(); // evaluated on the next step, not inline
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).toHaveBeenCalledTimes(1);

        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).toHaveBeenCalledTimes(1);
        expect(runtime.listenerCount('BEFORE_STEP')).toBe(0);
        expect(runtime.listenerCount('SAY')).toBe(0);
    });

    test('ignores scripts run by clicking them and monitor threads', () => {
        const onSatisfied = jest.fn();
        const goal = [
            { type: 'uses', trigger: { hat: 'event_whenkeypressed', key: 'space' }, blocks: ['sound_play'] },
        ];
        attachGoalMonitor(vm, goal, onSatisfied);
        exec(runtime, hatThread(cat, 'spaceHat', { stackClick: true }), 'sound_play');
        exec(runtime, hatThread(cat, 'spaceHat', { updateMonitor: true }), 'sound_play');
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).not.toHaveBeenCalled();
        exec(runtime, hatThread(cat, 'spaceHat'), 'sound_play');
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).toHaveBeenCalledTimes(1);
    });

    test('detach stops watching', () => {
        const onSatisfied = jest.fn();
        const goal = [
            { type: 'uses', trigger: { hat: 'event_whenkeypressed', key: 'space' }, blocks: ['sound_play'] },
        ];
        const detach = attachGoalMonitor(vm, goal, onSatisfied);
        detach();
        exec(runtime, hatThread(cat, 'spaceHat'), 'sound_play');
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).not.toHaveBeenCalled();
        expect(runtime.listenerCount('BEFORE_STEP')).toBe(0);
    });

    test('said: SAY and ANSWER events feed the facts, with the variables at that time', () => {
        const onSatisfied = jest.fn();
        const goal = [
            { type: 'said', text: '正解です', answer: { eq: 7 } },
            { type: 'said', equalsVariable: '回数' },
        ];
        attachGoalMonitor(vm, goal, onSatisfied);
        runtime.emit('SAY', cat, 'say', '正解です'); // before any answer
        runtime.emit('ANSWER', '7');
        runtime.emit('SAY', cat, 'say', '正解です');
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).not.toHaveBeenCalled();
        stage.variables.v1.value = 3;
        runtime.emit('SAY', cat, 'say', 3);
        runtime.emit('SAY', cat, 'say', ''); // bubble cleared: ignored
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).toHaveBeenCalledTimes(1);
    });

    test('result goals re-evaluate when the project changes (costumes, sprites, extensions)', () => {
        const onSatisfied = jest.fn();
        const goal = [
            { type: 'costumes', added: 1 },
            { type: 'sprites', min: 2 },
        ];
        attachGoalMonitor(vm, goal, onSatisfied);
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).not.toHaveBeenCalled();

        cat.getCostumes = () => [{}, {}, {}];
        runtime.emit('PROJECT_CHANGED');
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).not.toHaveBeenCalled();

        runtime.targets.push(makeTarget({ id: 'penguin', costumes: 4 }));
        runtime.emit('targetWasCreated');
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).toHaveBeenCalledTimes(1);
    });

    test('variable goal reads the stage variable at the next step', () => {
        const onSatisfied = jest.fn();
        attachGoalMonitor(vm, [{ type: 'variable', name: '回数', value: { gte: 3 } }], onSatisfied);
        runtime._primitives.data_changevariableby = () => {
            stage.variables.v1.value += 1;
        };
        const thread = hatThread(cat, 'clickHat');
        for (let i = 0; i < 3; i += 1) {
            exec(runtime, thread, 'data_changevariableby', { VARIABLE: '回数', VALUE: 1 });
            runtime.emit('BEFORE_STEP');
        }
        expect(onSatisfied).toHaveBeenCalledTimes(1);
    });

    test('broadcast args ({id, name}) are recorded as the message name', () => {
        const onSatisfied = jest.fn();
        const penguin = makeTarget({
            id: 'penguin',
            blocks: {
                recv: {
                    opcode: 'event_whenbroadcastreceived',
                    fields: { BROADCAST_OPTION: { name: 'BROADCAST_OPTION', value: 'あいさつ', id: 'm1' } },
                },
            },
        });
        runtime.targets.push(penguin);
        runtime._primitives.event_broadcast = jest.fn();
        runtime._primitives.looks_sayforsecs = jest.fn();
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' },
                blocks: ['looks_sayforsecs'],
            },
        ];
        attachGoalMonitor(vm, goal, onSatisfied);
        exec(runtime, hatThread(cat, 'clickHat'), 'event_broadcast', {
            BROADCAST_OPTION: { id: 'm1', name: 'あいさつ' },
        });
        exec(runtime, hatThread(penguin, 'recv'), 'looks_sayforsecs', { MESSAGE: 'やあ！', SECS: 2 });
        runtime.emit('BEFORE_STEP');
        expect(onSatisfied).toHaveBeenCalledTimes(1);
    });
});

describe('takeSnapshot / takeCostumeCounts', () => {
    test('collects sprites, costumes, variables and extension state', () => {
        const cat = makeTarget({ id: 'cat', costumes: 2, variables: { a: { name: 'x', type: '', value: 1 } } });
        const stage = makeTarget({
            id: 'stage',
            isStage: true,
            costumes: 1,
            variables: { l: { name: 'トーク', type: 'list', value: ['a'] } },
        });
        const clone = { ...makeTarget({ id: 'clone' }), isOriginal: false };
        const vm = makeVm([stage, cat, clone], ['text2speech']);
        const baseline = takeCostumeCounts(vm.runtime);
        expect(baseline).toEqual({ stage: { isStage: true, count: 1 }, cat: { isStage: false, count: 2 } });
        const snap = takeSnapshot(vm, baseline);
        expect(snap.spriteCount).toBe(1);
        expect(snap.baselineCostumes).toBe(baseline);
        expect(snap.variables).toEqual([
            { name: 'トーク', type: 'list', value: ['a'], isStage: true },
            { name: 'x', type: '', value: 1, isStage: false },
        ]);
        expect(snap.isExtensionLoaded('text2speech')).toBe(true);
        expect(snap.isExtensionLoaded('music')).toBe(false);
    });
});
