/* eslint-env jest */
// ブラウザの中での折り返し（lib/mesh-practice/loopback.js）。VM は EventEmitter のにせもの。
import EventEmitter from 'events';
import {
    attachPracticeLoopback,
    PRACTICE_OWNER_CHANGED,
    practiceLoopbackOwner,
} from '../../../../src/lib/mesh-practice/loopback';
import {
    MAX_PENDING_REPLIES,
    MESH_PRACTICE_PARTNER_NODE_ID as PARTNER,
    REPLY_DELAY_MS,
} from '../../../../src/lib/mesh-practice/partner';

const makeVm = (connectionState = 'disconnected') => {
    const runtime = new EventEmitter();
    const messages = ['ping', 'pong', 'chat'];
    const stage = {
        variables: { s: { id: 's', name: 'score', type: '', value: 1 } },
        blocks: { resetCache: jest.fn() },
        lookupBroadcastMsg: (id, name) => {
            const found = messages.find((m) => m.toUpperCase() === String(name).toUpperCase());
            return found ? { name: found } : undefined;
        },
        lookupVariableById: (id) => stage.variables[id],
        lookupVariableByNameAndType: () => undefined,
    };
    runtime.targets = [stage];
    runtime.getTargetForStage = () => stage;
    runtime._primitives = {
        event_broadcast: jest.fn(),
        meshV2_broadcastWithValue: jest.fn(),
        data_setvariableto: jest.fn(),
    };
    runtime.getOpcodeFunction = function (opcode) {
        return this._primitives[opcode];
    };
    runtime.startHats = jest.fn(() => []);
    const service = {
        meshId: 'me',
        remoteData: {},
        messageHistory: [],
        recordMessage(entry) {
            this.messageHistory.unshift(Object.freeze({ ...entry }));
        },
    };
    const ext = {
        connectionState,
        meshService: service,
        startMessageHats: jest.fn((name, value, util) => util.startHats('event_whenbroadcastreceived', {})),
    };
    runtime.peripheralExtensions = { meshV2: ext };
    return { runtime, ext, service };
};

// execute.js と同じく getOpcodeFunction から取って呼ぶ
const run = (vm, opcode, args, util = {}) => vm.runtime.getOpcodeFunction(opcode)(args, util);

describe('mesh practice partner: loopback (#1845)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('the partner sends a message with a value: hats start with the value, history shows it', () => {
        const vm = makeVm();
        const loop = attachPracticeLoopback({ vm });
        loop.act({ set: [], broadcast: 'PING', value: 'hello' });
        expect(vm.ext.startMessageHats).toHaveBeenCalledWith('ping', 'hello', expect.any(Object));
        expect(vm.runtime.startHats).toHaveBeenCalled();
        expect(vm.service.messageHistory[0]).toMatchObject({
            direction: 'received',
            name: 'ping',
            value: 'hello',
            nodeId: PARTNER,
        });
        loop.detach();
    });

    test('partner variables go into remoteData (read by "sensor value"), values capped at 1000', () => {
        const vm = makeVm();
        const loop = attachPracticeLoopback({ vm });
        loop.setVariable('hp', 'x'.repeat(1500));
        expect(vm.service.remoteData[PARTNER].hp.value).toHaveLength(1000);
        loop.syncVariables([
            { name: 'made', value: '' },
            { name: 'notYet', value: null },
        ]);
        expect(Object.keys(vm.service.remoteData[PARTNER])).toEqual(['made']);
        loop.detach();
    });

    test('syncVariables keeps the time of unchanged values', () => {
        let t = 1000;
        const vm = makeVm();
        const loop = attachPracticeLoopback({ vm, now: () => t });
        loop.syncVariables([{ name: 'a', value: '1' }]);
        t = 2000;
        loop.syncVariables([
            { name: 'a', value: '1' },
            { name: 'b', value: '2' },
        ]);
        expect(vm.service.remoteData[PARTNER].a.timestamp).toBe(1000);
        expect(vm.service.remoteData[PARTNER].b.timestamp).toBe(2000);
        loop.detach();
    });

    test('automatic replies: one pending per message, sent back with the value after the delay', () => {
        const vm = makeVm();
        const partner = { buttons: [], replies: [{ onBroadcast: 'ping', set: [], broadcast: 'pong', value: '7' }] };
        const loop = attachPracticeLoopback({ vm, partner });
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'x', name: 'Ping' } });
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'x', name: 'ping' } });
        expect(vm.ext.startMessageHats).not.toHaveBeenCalled();
        jest.advanceTimersByTime(REPLY_DELAY_MS);
        expect(vm.ext.startMessageHats).toHaveBeenCalledTimes(1);
        expect(vm.ext.startMessageHats).toHaveBeenCalledWith('pong', '7', expect.any(Object));
        // the student's send is in the history once (same message within 1 s)
        const sent = vm.service.messageHistory.filter((e) => e.direction === 'sent');
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ name: 'Ping', nodeId: 'me', value: '' });
        loop.detach();
    });

    test('"broadcast with value" is seen with its value', () => {
        const vm = makeVm();
        const loop = attachPracticeLoopback({ vm });
        run(vm, 'meshV2_broadcastWithValue', { BROADCAST_OPTION: { name: 'chat' }, VALUE: 'hi' });
        expect(vm.service.messageHistory[0]).toMatchObject({ direction: 'sent', name: 'chat', value: 'hi' });
        loop.detach();
    });

    test('pending replies are capped', () => {
        const vm = makeVm();
        const names = Array.from({ length: MAX_PENDING_REPLIES + 10 }, (_, i) => `m${i}`);
        const partner = { buttons: [], replies: names.map((n) => ({ onBroadcast: n, set: [], broadcast: 'pong' })) };
        const loop = attachPracticeLoopback({ vm, partner });
        names.forEach((n) => run(vm, 'event_broadcast', { BROADCAST_OPTION: { name: n } }));
        expect(jest.getTimerCount()).toBe(MAX_PENDING_REPLIES);
        loop.detach();
        expect(jest.getTimerCount()).toBe(0);
    });

    test('own global variables are seeded like the real mesh (#713)', () => {
        const vm = makeVm();
        const loop = attachPracticeLoopback({ vm });
        run(vm, 'data_setvariableto', { VARIABLE: { id: 's', name: 'score' }, VALUE: 5 });
        expect(vm.service.remoteData.me.score.value).toBe('5');
        loop.detach();
        expect(vm.service.remoteData.me).toBeUndefined();
    });

    test('connecting tears it down: values and the practice history are removed, nothing is sent', () => {
        const vm = makeVm();
        vm.service.recordMessage({ direction: 'received', name: 'real', value: '', nodeId: 'other', at: 1 });
        const partner = { buttons: [], replies: [{ onBroadcast: 'ping', set: [], broadcast: 'pong', value: '' }] };
        const loop = attachPracticeLoopback({ vm, partner });
        loop.setVariable('hp', '3');
        loop.act({ set: [], broadcast: 'ping', value: '' });
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { name: 'ping' } });
        vm.ext.connectionState = 'connecting';
        vm.runtime.emit('BEFORE_STEP');
        expect(vm.service.remoteData[PARTNER]).toBeUndefined();
        expect(vm.service.messageHistory.map((e) => e.name)).toEqual(['real']);
        // the pending reply fires while connecting: nothing happens
        vm.ext.startMessageHats.mockClear();
        jest.advanceTimersByTime(REPLY_DELAY_MS);
        expect(vm.ext.startMessageHats).not.toHaveBeenCalled();
        // student's sends are not watched while connecting
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { name: 'ping' } });
        expect(jest.getTimerCount()).toBe(0);
        expect(loop.isActive()).toBe(false);
        loop.detach();
        expect(vm.runtime.listenerCount('BEFORE_STEP')).toBe(0);
    });

    test('a failed connect (connecting → error) suspends it once, and the caller is told', () => {
        const vm = makeVm();
        const onSuspend = jest.fn();
        const loop = attachPracticeLoopback({ vm, onSuspend });
        loop.setVariable('hp', '3');
        vm.ext.connectionState = 'connecting';
        vm.runtime.emit('BEFORE_STEP');
        vm.runtime.emit('BEFORE_STEP');
        expect(onSuspend).toHaveBeenCalledTimes(1);
        expect(vm.service.remoteData[PARTNER]).toBeUndefined();
        vm.ext.connectionState = 'error';
        vm.runtime.emit('BEFORE_STEP');
        expect(onSuspend).toHaveBeenCalledTimes(1);
        loop.detach();
    });

    test('only one loopback per runtime (a lesson partner and the standalone one never both attach)', () => {
        const vm = makeVm();
        const changes = [];
        vm.runtime.on(PRACTICE_OWNER_CHANGED, (owner) => changes.push(owner));
        const lesson = attachPracticeLoopback({ vm, owner: 'lesson' });
        expect(practiceLoopbackOwner(vm.runtime)).toBe('lesson');
        expect(attachPracticeLoopback({ vm, owner: 'standalone' })).toBeNull();
        lesson.detach();
        expect(practiceLoopbackOwner(vm.runtime)).toBeNull();
        const standalone = attachPracticeLoopback({ vm, owner: 'standalone' });
        expect(standalone).not.toBeNull();
        standalone.detach();
        expect(changes).toEqual(['lesson', null, 'standalone', null]);
    });

    test('remembered history entries do not grow past the history (50)', () => {
        const vm = makeVm();
        // keep the history at 50 like the VM
        const record = vm.service.recordMessage.bind(vm.service);
        vm.service.recordMessage = (entry) => {
            record(entry);
            vm.service.messageHistory.length = Math.min(vm.service.messageHistory.length, 50);
        };
        vm.service.recordMessage({ direction: 'received', name: 'real', value: '', nodeId: 'x', at: 1 });
        const loop = attachPracticeLoopback({ vm });
        for (let i = 0; i < 200; i++) {
            run(vm, 'event_broadcast', { BROADCAST_OPTION: { name: i % 2 ? 'a' : 'b' } });
        }
        expect(vm.service.messageHistory).toHaveLength(50);
        loop.detach();
        // everything this loopback put in is gone, and the real entry had been pushed out
        expect(vm.service.messageHistory).toHaveLength(0);
    });
});
