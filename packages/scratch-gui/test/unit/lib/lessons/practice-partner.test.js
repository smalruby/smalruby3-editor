/**
 * Unit tests for the mesh practice partner: the definition (practice-partner.js) and the
 * in-browser loopback (practice-loopback.js). The VM is a small fake runtime shaped like
 * scratch-vm's (EventEmitter + getOpcodeFunction + a stage with variables + the meshV2
 * peripheral extension holding a meshService with `remoteData`).
 */
import EventEmitter from 'events';
import { attachPracticeLoopback } from '../../../../src/lib/lessons/practice-loopback';
import {
    normalizePartner,
    PRACTICE_PARTNER_NODE_ID,
    practiceAllowed,
    repliesFor,
} from '../../../../src/lib/lessons/practice-partner';

const PARTNER = {
    name: 'ロボ',
    buttons: [
        { label: 'あいさつする', set: { variable: 'へんじ', value: 'こんにちは' }, broadcast: 'メッセージ' },
        {
            label: '2 つ変える',
            set: [
                { variable: 'a', value: 1 },
                { variable: 'b', value: 'x' },
            ],
        },
    ],
    replies: [{ onBroadcast: 'メッセージ', set: { variable: 'へんじ', value: 'やあ' }, broadcast: 'へんじ' }],
};

describe('normalizePartner', () => {
    test('reads the data-only definition (set is one {variable, value} or an array)', () => {
        expect(normalizePartner(PARTNER, 'ja')).toEqual({
            name: 'ロボ',
            buttons: [
                { label: 'あいさつする', set: [{ name: 'へんじ', value: 'こんにちは' }], broadcast: 'メッセージ' },
                {
                    label: '2 つ変える',
                    set: [
                        { name: 'a', value: '1' },
                        { name: 'b', value: 'x' },
                    ],
                    broadcast: null,
                },
            ],
            replies: [{ onBroadcast: 'メッセージ', set: [{ name: 'へんじ', value: 'やあ' }], broadcast: 'へんじ' }],
        });
    });

    test('texts may be given per locale', () => {
        const partner = normalizePartner(
            {
                name: { ja: 'ロボ', en: 'Robo' },
                buttons: [{ label: { ja: 'おす', en: 'Push' }, broadcast: { ja: 'あいさつ', en: 'hello' } }],
            },
            'en',
        );
        expect(partner.name).toBe('Robo');
        expect(partner.buttons[0]).toMatchObject({ label: 'Push', broadcast: 'hello' });
    });

    test('no partner, or nothing to do, gives null', () => {
        expect(normalizePartner(null, 'ja')).toBeNull();
        expect(normalizePartner({ name: 'ロボ' }, 'ja')).toBeNull();
        expect(normalizePartner({ name: 'ロボ', replies: [{ onBroadcast: 'x' }] }, 'ja')).toBeNull();
    });

    test('replies match the message name without case', () => {
        const partner = normalizePartner({ replies: [{ onBroadcast: 'Hello', broadcast: 'hi' }] }, 'en');
        expect(repliesFor(partner, 'HELLO')).toHaveLength(1);
        expect(repliesFor(partner, 'bye')).toHaveLength(0);
    });

    test('practice runs only while the real mesh is not connected', () => {
        expect(practiceAllowed(null)).toBe(true);
        expect(practiceAllowed('disconnected')).toBe(true);
        expect(practiceAllowed('error')).toBe(true);
        expect(practiceAllowed('connecting')).toBe(false);
        expect(practiceAllowed('connected')).toBe(false);
    });
});

const makeVm = ({ connectionState = 'disconnected', withMesh = true } = {}) => {
    const runtime = new EventEmitter();
    const variables = {
        v1: { id: 'v1', name: 'count', type: '', value: 3 },
        m1: { id: 'm1', name: 'へんじ', type: 'broadcast_msg', value: 'へんじ' },
        m2: { id: 'm2', name: 'メッセージ', type: 'broadcast_msg', value: 'メッセージ' },
    };
    const stage = {
        isStage: true,
        variables,
        blocks: { resetCache: jest.fn() },
        lookupVariableById: (id) => variables[id],
        lookupVariableByNameAndType: (name, type) =>
            Object.values(variables).find((v) => v.name === name && v.type === type),
        lookupBroadcastMsg: (id, name) =>
            Object.values(variables).find(
                (v) => v.type === 'broadcast_msg' && v.name.toLowerCase() === name.toLowerCase(),
            ),
    };
    runtime.targets = [stage];
    runtime.flyoutBlocks = { resetCache: jest.fn() };
    runtime.getTargetForStage = () => stage;
    runtime._primitives = {};
    runtime.getOpcodeFunction = function (opcode) {
        return this._primitives[opcode];
    };
    runtime.startHats = jest.fn();
    const meshService = { meshId: 'me', remoteData: {} };
    runtime.peripheralExtensions = withMesh ? { meshV2: { connectionState, meshService } } : {};
    return { vm: { runtime }, runtime, meshService };
};

const makeTimers = () => {
    const queue = new Map();
    let next = 1;
    return {
        setTimeout: (fn) => {
            const id = next++;
            queue.set(id, fn);
            return id;
        },
        clearTimeout: (id) => queue.delete(id),
        flush: () => {
            const fns = [...queue.values()];
            queue.clear();
            fns.forEach((fn) => fn());
        },
        size: () => queue.size,
    };
};

const exec = (runtime, opcode, args, util = {}) => {
    runtime._primitives[opcode] = runtime._primitives[opcode] || jest.fn();
    return runtime.getOpcodeFunction(opcode)(args, util);
};

describe('attachPracticeLoopback', () => {
    const setup = (vmOptions) => {
        const fake = makeVm(vmOptions);
        const timers = makeTimers();
        const loop = attachPracticeLoopback({
            vm: fake.vm,
            partner: normalizePartner(PARTNER, 'ja'),
            now: () => 1000,
            timers,
        });
        return { ...fake, timers, loop };
    };

    test('a button sets the partner variable (sensor value) and then sends the message', () => {
        const { loop, meshService, runtime } = setup();
        loop.press(0);
        expect(meshService.remoteData[PRACTICE_PARTNER_NODE_ID]).toEqual({
            へんじ: { value: 'こんにちは', timestamp: 1000 },
        });
        expect(runtime.startHats).toHaveBeenCalledWith('event_whenbroadcastreceived', {
            BROADCAST_OPTION: 'メッセージ',
        });
        loop.detach();
    });

    test('a message the project does not have starts nothing (same as the real mesh)', () => {
        const fake = makeVm();
        const loop = attachPracticeLoopback({
            vm: fake.vm,
            partner: normalizePartner({ buttons: [{ label: 'x', broadcast: 'unknown' }] }, 'ja'),
        });
        loop.press(0);
        expect(fake.runtime.startHats).not.toHaveBeenCalled();
        loop.detach();
    });

    test('the student sending a message gets the automatic reply after a delay', () => {
        const { loop, meshService, runtime, timers } = setup();
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        expect(runtime.startHats).not.toHaveBeenCalled();
        timers.flush();
        expect(meshService.remoteData[PRACTICE_PARTNER_NODE_ID].へんじ.value).toBe('やあ');
        expect(runtime.startHats).toHaveBeenCalledWith('event_whenbroadcastreceived', { BROADCAST_OPTION: 'へんじ' });
        loop.detach();
    });

    test('sending the same message again while its reply waits does not queue another (like real mesh)', () => {
        // 「ずっと『メッセージ』を送る」: 毎フレーム送っても、返事は待っているあいだ 1 つだけ。本物のメッシュの
        // fireEvent も、まだ送っていない同じ合図はまとめる。返事の合図が受け取りのスクリプトを毎フレーム動かし直さない
        const { loop, runtime, timers } = setup();
        const args = { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } };
        for (let i = 0; i < 30; i++) exec(runtime, 'event_broadcast', args);
        expect(timers.size()).toBe(1);
        timers.flush();
        expect(runtime.startHats).toHaveBeenCalledTimes(1);
        // 返事が済んだら、次の合図にはまた返事をする
        exec(runtime, 'event_broadcast', args);
        expect(timers.size()).toBe(1);
        loop.detach();
    });

    test('broadcast and wait replies only on its first run', () => {
        const { loop, runtime, timers } = setup();
        const args = { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } };
        exec(runtime, 'event_broadcastandwait', args, { stackFrame: {} });
        exec(runtime, 'event_broadcastandwait', args, { stackFrame: { startedThreads: [] } });
        expect(timers.size()).toBe(1);
        loop.detach();
    });

    test('own global variables are seeded like the real mesh (#713)', () => {
        const { loop, meshService, runtime } = setup();
        exec(runtime, 'data_changevariableby', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 2 });
        expect(meshService.remoteData.me.count).toEqual({ value: '5', timestamp: 1000 });
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 'hi' });
        expect(meshService.remoteData.me.count.value).toBe('hi');
        loop.detach();
    });

    test('detach removes everything it put in and stops replying', () => {
        const { loop, meshService, runtime, timers } = setup();
        loop.press(0);
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 1 });
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        loop.detach();
        expect(meshService.remoteData).toEqual({});
        expect(timers.size()).toBe(0);
        runtime.startHats.mockClear();
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        loop.press(0);
        expect(timers.size()).toBe(0);
        expect(runtime.startHats).not.toHaveBeenCalled();
    });

    test('detach removes own values from the node they were written under, even if meshId changed', () => {
        // つながっていないあいだに出席番号が決まると meshId が変わる（setClassroomSeat）
        const { loop, meshService, runtime } = setup();
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 1 });
        meshService.meshId = 'me-s12';
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 2 });
        expect(Object.keys(meshService.remoteData).sort()).toEqual(['me', 'me-s12']);
        loop.detach();
        expect(meshService.remoteData).toEqual({});
    });

    test('a reply timer that fires after connecting started does nothing and leaves nothing', () => {
        ['connecting', 'connected'].forEach((state) => {
            const { loop, meshService, runtime, timers } = setup();
            loop.press(0);
            runtime.startHats.mockClear();
            exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
            runtime.peripheralExtensions.meshV2.connectionState = state;
            timers.flush();
            expect(runtime.startHats).not.toHaveBeenCalled();
            expect(meshService.remoteData).toEqual({});
            loop.detach();
        });
    });

    test('values are removed at the next step once connecting starts (before any script reads them)', () => {
        const { loop, meshService, runtime } = setup();
        loop.press(0);
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 1 });
        runtime.emit('BEFORE_STEP');
        expect(meshService.remoteData[PRACTICE_PARTNER_NODE_ID]).toBeDefined();
        runtime.peripheralExtensions.meshV2.connectionState = 'connecting';
        runtime.emit('BEFORE_STEP');
        expect(meshService.remoteData).toEqual({});
        loop.detach();
        expect(runtime.listenerCount('BEFORE_STEP')).toBe(0);
    });

    test('detach keeps values that someone else wrote after it', () => {
        const { loop, meshService, runtime } = setup();
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 1 });
        meshService.remoteData.me.count = { value: '9', timestamp: 2000 };
        loop.detach();
        expect(meshService.remoteData.me.count.value).toBe('9');
    });

    test('does nothing while the real mesh is connected', () => {
        const { loop, meshService, runtime, timers } = setup({ connectionState: 'connected' });
        loop.press(0);
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 1 });
        expect(meshService.remoteData).toEqual({});
        expect(timers.size()).toBe(0);
        expect(runtime.startHats).not.toHaveBeenCalled();
        loop.detach();
    });

    test('without the mesh extension, messages still go (variables have nowhere to go)', () => {
        const { loop, runtime } = setup({ withMesh: false });
        loop.press(0);
        expect(runtime.startHats).toHaveBeenCalledTimes(1);
        loop.detach();
    });
});
