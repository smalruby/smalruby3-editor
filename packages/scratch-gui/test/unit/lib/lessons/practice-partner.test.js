/**
 * Unit tests for the mesh practice partner: the definition (practice-partner.js) and the
 * in-browser loopback (practice-loopback.js). The VM is a small fake runtime shaped like
 * scratch-vm's (EventEmitter + getOpcodeFunction + a stage with variables + the meshV2
 * peripheral extension holding a meshService with `remoteData`).
 */
import EventEmitter from 'events';
import { attachPracticeLoopback, LESSON_OWNER } from '../../../../src/lib/lessons/practice-loopback';
import {
    normalizePartner,
    PRACTICE_PARTNER_NODE_ID,
    findName,
    partnerNames,
    pushArrival,
    RECEIVED_ARRIVALS_MAX,
    receivedArrival,
    receivedSummary,
} from '../../../../src/lib/lessons/practice-partner';
import {
    attachPracticeLoopback as attachSharedLoopback,
    practiceLoopbackOwner,
} from '../../../../src/lib/mesh-practice/loopback';
import {
    MESH_PRACTICE_PARTNER_NODE_ID,
    practiceAllowed,
    repliesFor,
} from '../../../../src/lib/mesh-practice/partner';

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
                {
                    label: 'あいさつする',
                    set: [{ name: 'へんじ', value: 'こんにちは' }],
                    broadcast: 'メッセージ',
                    value: '',
                },
                {
                    label: '2 つ変える',
                    set: [
                        { name: 'a', value: '1' },
                        { name: 'b', value: 'x' },
                    ],
                    broadcast: null,
                    value: '',
                },
            ],
            replies: [
                {
                    onBroadcast: 'メッセージ',
                    set: [{ name: 'へんじ', value: 'やあ' }],
                    broadcast: 'へんじ',
                    value: '',
                },
            ],
            watch: [],
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

    test('a value may be the value of a variable of the student (fromVariable, per locale)', () => {
        const partner = normalizePartner(
            {
                buttons: [
                    {
                        label: 'DM',
                        set: [
                            { variable: 'あて先', value: { fromVariable: { ja: '名前', en: 'name' } } },
                            { variable: 'x', value: { fromVariable: '' } },
                            { variable: 'y', value: { other: 1 } },
                        ],
                    },
                ],
            },
            'en',
        );
        // 名前の無い fromVariable・知らない形の値は使わない
        expect(partner.buttons[0].set).toEqual([{ name: 'あて先', fromVariable: 'name' }]);
    });

    test('fromVariable may list other names and be required (the DM to you of 4-5)', () => {
        const partner = normalizePartner(
            {
                buttons: [
                    {
                        label: 'DM',
                        set: {
                            variable: 'あて先',
                            value: {
                                fromVariable: { ja: 'なまえ', en: 'name' },
                                orVariables: ['なまえ', '名前', 'name'],
                                required: true,
                            },
                        },
                    },
                ],
            },
            'ja',
        );
        // fromVariable と同じ名前は orVariables に入れない
        expect(partner.buttons[0].set).toEqual([
            { name: 'あて先', fromVariable: 'なまえ', orVariables: ['名前', 'name'], required: true },
        ]);
    });

    test('a value may be written per locale (the mood of 3-3, #1643)', () => {
        const def = {
            buttons: [
                {
                    label: { ja: 'うれしい', en: 'happy' },
                    set: {
                        variable: { ja: 'シマネコの気分', en: 'shimacat_mood' },
                        value: { ja: 'うれしい', en: 'happy' },
                    },
                },
            ],
        };
        expect(normalizePartner(def, 'en').buttons[0].set).toEqual([{ name: 'shimacat_mood', value: 'happy' }]);
        // キーの無い locale は en
        expect(normalizePartner(def, 'ja-Hira').buttons[0].set).toEqual([{ name: 'shimacat_mood', value: 'happy' }]);
        expect(normalizePartner(def, 'ja').buttons[0].set).toEqual([{ name: 'シマネコの気分', value: 'うれしい' }]);
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

describe('partnerNames / findName', () => {
    test('the names the partner uses: set variables, fromVariable and messages', () => {
        const partner = normalizePartner(
            {
                buttons: [
                    {
                        label: 'x',
                        set: [{ variable: 'あて先', value: { fromVariable: '名前' } }],
                        broadcast: 'メッセージ',
                    },
                ],
                replies: [{ onBroadcast: 'シマラビのメッセージ', set: { variable: 'へんじ', value: 'a' } }],
            },
            'ja',
        );
        expect(partnerNames(partner).sort()).toEqual(
            ['あて先', 'へんじ', 'シマラビのメッセージ', 'メッセージ', '名前'].sort(),
        );
        expect(partnerNames(null)).toEqual([]);
    });

    test('watch adds names of student variables to show, per locale too (3-3: the own mood)', () => {
        const def = {
            buttons: [{ label: 'うれしい', set: { variable: 'シマネコの気分', value: 'うれしい' } }],
            watch: [{ ja: 'シマラビの気分', en: 'shimaraby_mood' }, 'x', '', 3, null],
        };
        expect(normalizePartner(def, 'en').watch).toEqual(['shimaraby_mood', 'x', '3']);
        expect(partnerNames(normalizePartner(def, 'ja'))).toContain('シマラビの気分');
        // watch だけでは練習相手にならない（ボタンも返事も無ければ null）
        expect(normalizePartner({ watch: ['a'] }, 'ja')).toBeNull();
    });

    test('finds the exact name first, then without case', () => {
        expect(findName(['Hello', 'hello'], 'hello')).toBe('hello');
        expect(findName(['Hello'], 'HELLO')).toBe('Hello');
        expect(findName(['Hello'], 'bye')).toBeNull();
    });
});

describe('receivedSummary', () => {
    test('a message shows with the value of the variable of the same name (the course names them alike)', () => {
        expect(
            receivedSummary({
                last: { kind: 'message', name: 'シマラビのメッセージ' },
                values: { シマラビのメッセージ: 'こんにちは' },
            }),
        ).toBe('シマラビのメッセージ = こんにちは');
        expect(receivedSummary({ last: { kind: 'message', name: 'Hello' }, values: { hello: 'hi' } })).toBe(
            'Hello = hi',
        );
        expect(receivedSummary({ last: { kind: 'message', name: '手をふる' }, values: {} })).toBe('手をふる');
        // 大文字小文字まで一致する変数を先に使う
        expect(
            receivedSummary({ last: { kind: 'message', name: 'hello' }, values: { Hello: 'A', hello: 'b' } }),
        ).toBe('hello = b');
    });

    test('a variable alone shows its value', () => {
        expect(
            receivedSummary({
                last: { kind: 'variable', name: 'シマラビの気分' },
                values: { シマラビの気分: 'ねむい' },
            }),
        ).toBe('シマラビの気分 = ねむい');
    });

    test('nothing yet gives null', () => {
        expect(receivedSummary(null)).toBeNull();
        expect(receivedSummary({ last: null, values: {} })).toBeNull();
    });
});

describe('receivedArrival (one row of 「〜に届いた」)', () => {
    test('a variable gives its value (shown large) and its name (shown small)', () => {
        expect(
            receivedArrival({
                last: { kind: 'variable', name: 'シマラビの気分' },
                values: { シマラビの気分: 'ねむい' },
            }),
        ).toEqual({ kind: 'variable', name: 'シマラビの気分', value: 'ねむい' });
    });

    test('a message gives just its name, or the value of the variable of the same name', () => {
        expect(receivedArrival({ last: { kind: 'message', name: 'てをふる' }, values: {} })).toEqual({
            kind: 'message',
            name: 'てをふる',
            value: null,
        });
        expect(
            receivedArrival({
                last: { kind: 'message', name: 'シマラビのメッセージ' },
                values: { シマラビのメッセージ: 'へいへい！' },
            }),
        ).toEqual({ kind: 'message', name: 'シマラビのメッセージ', value: 'へいへい！' });
    });

    test('nothing yet gives null', () => {
        expect(receivedArrival(null)).toBeNull();
        expect(receivedArrival({ last: null, values: {} })).toBeNull();
    });
});

describe('pushArrival (the rows of 「〜に届いた」)', () => {
    const row = (id, value = 'やあ') => ({ id, kind: 'variable', name: 'シマラビのメッセージ', value });

    test('keeps the newest 3, newest first', () => {
        expect(RECEIVED_ARRIVALS_MAX).toBe(3);
        let rows = [];
        [1, 2, 3, 4].forEach((id) => {
            rows = pushArrival(rows, row(id, `v${id}`));
        });
        expect(rows.map((one) => one.id)).toEqual([4, 3, 2]);
    });

    test('the same thing arriving again is another row (so a repeat can be seen)', () => {
        const rows = pushArrival(pushArrival([], row(1)), row(2));
        expect(rows).toHaveLength(2);
        expect(rows.map((one) => one.value)).toEqual(['やあ', 'やあ']);
    });

    test('does not change the list it was given', () => {
        const before = [row(1)];
        pushArrival(before, row(2));
        expect(before).toEqual([row(1)]);
    });
});

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

    const watch = (partnerDef = PARTNER) => {
        const fake = makeVm();
        const onReceived = jest.fn();
        const loop = attachPracticeLoopback({
            vm: fake.vm,
            partner: normalizePartner(partnerDef, 'ja'),
            now: () => 1000,
            timers: makeTimers(),
            onReceived,
        });
        const step = () => fake.runtime.emit('BEFORE_STEP');
        return { ...fake, loop, onReceived, step };
    };

    const message = (name, value = null) => ({ kind: 'message', name, value });
    const variable = (name, value) => ({ kind: 'variable', name, value });

    test('tells what reached the partner once per frame: the last message, with the value of the same name (D3)', () => {
        const { loop, onReceived, runtime, step } = watch();
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 'hi' });
        // フレームの最初にまとめて知らせる
        expect(onReceived).not.toHaveBeenCalled();
        step();
        // count は相手の使う名前ではないので、行にしない
        expect(onReceived).not.toHaveBeenCalled();
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        step();
        expect(onReceived).toHaveBeenLastCalledWith(message('メッセージ'), { announce: true });
        // ボタン（相手から生徒へ）は相手に届いたものではない
        loop.press(0);
        step();
        expect(onReceived).toHaveBeenCalledTimes(1);
        loop.detach();
    });

    test('the same message arriving again is told again (a new row, so the student sees it arrived)', () => {
        const { loop, onReceived, runtime, step } = watch();
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        step();
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        step();
        expect(onReceived).toHaveBeenCalledTimes(2);
        expect(onReceived).toHaveBeenNthCalledWith(2, message('メッセージ'), { announce: true });
        // 何も届かないフレームでは知らせない
        step();
        expect(onReceived).toHaveBeenCalledTimes(2);
        loop.detach();
    });

    test('a variable the partner uses shows its value and name, and is not read aloud', () => {
        const { loop, onReceived, runtime, step } = watch();
        runtime.targets[0].variables.v3 = { id: 'v3', name: 'へんじ', type: '', value: '' };
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v3', name: 'へんじ' }, VALUE: 'おはよう' });
        step();
        expect(onReceived).toHaveBeenLastCalledWith(variable('へんじ', 'おはよう'), { announce: false });
        // 同じ値に入れ直しても、相手には何も新しく届かない（ずっと同じ値を入れるスクリプトで行が増え続けない）
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v3', name: 'へんじ' }, VALUE: 'おはよう' });
        step();
        expect(onReceived).toHaveBeenCalledTimes(1);
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v3', name: 'へんじ' }, VALUE: 'こんばんは' });
        step();
        expect(onReceived).toHaveBeenLastCalledWith(variable('へんじ', 'こんばんは'), { announce: false });
        loop.detach();
    });

    test('a variable listed in watch shows even though the partner does not use it', () => {
        const { loop, onReceived, runtime, step } = watch({ ...PARTNER, watch: ['count'] });
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 'ねむい' });
        step();
        expect(onReceived).toHaveBeenLastCalledWith(variable('count', 'ねむい'), { announce: false });
        loop.detach();
    });

    test('a script that changes an unrelated variable every frame does not add rows', () => {
        const { loop, onReceived, runtime, step } = watch();
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        step();
        for (let i = 0; i < 30; i++) {
            exec(runtime, 'data_changevariableby', { VARIABLE: { id: 'v1', name: 'count' }, VALUE: 1 });
            step();
        }
        expect(onReceived).toHaveBeenCalledTimes(1);
        expect(onReceived).toHaveBeenLastCalledWith(message('メッセージ'), { announce: true });
        loop.detach();
    });

    test('several changes in one frame are told once', () => {
        const { loop, onReceived, runtime, step } = watch();
        runtime.targets[0].variables.v4 = { id: 'v4', name: 'メッセージ', type: '', value: '' };
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v4', name: 'メッセージ' }, VALUE: 'a' });
        exec(runtime, 'data_setvariableto', { VARIABLE: { id: 'v4', name: 'メッセージ' }, VALUE: 'b' });
        exec(runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        step();
        expect(onReceived).toHaveBeenCalledTimes(1);
        expect(onReceived).toHaveBeenLastCalledWith(message('メッセージ', 'b'), { announce: true });
        loop.detach();
    });

    test('a value fromVariable is the value of the student variable, or empty without it (D4)', () => {
        const fake = makeVm();
        fake.runtime.targets[0].variables.v2 = { id: 'v2', name: '名前', type: '', value: 'たろう' };
        const loop = attachPracticeLoopback({
            vm: fake.vm,
            partner: normalizePartner(
                {
                    buttons: [
                        { label: 'DM', set: { variable: 'あて先', value: { fromVariable: '名前' } } },
                        { label: 'none', set: { variable: 'あて先', value: { fromVariable: 'ない' } } },
                    ],
                },
                'ja',
            ),
            now: () => 1000,
            timers: makeTimers(),
        });
        loop.press(0);
        expect(fake.meshService.remoteData[PRACTICE_PARTNER_NODE_ID].あて先.value).toBe('たろう');
        loop.press(1);
        expect(fake.meshService.remoteData[PRACTICE_PARTNER_NODE_ID].あて先.value).toBe('');
        loop.detach();
    });

    // 4-5 の「あなたに DM」（教員レビュー）: 押したときの生徒の名前（なまえ）をあて先にして送る。名前がまだ空なら
    // 何もせず、空の変数の名前を返す（パネルが「先に入れよう」と出す）
    const dmPartner = () =>
        normalizePartner(
            {
                buttons: [
                    {
                        label: 'あなたに DM',
                        set: [
                            {
                                variable: 'あてさき',
                                value: { fromVariable: 'なまえ', orVariables: ['名前', 'name'], required: true },
                            },
                            { variable: 'メッセージ', value: 'シマネコ：ないしょだよ' },
                        ],
                        broadcast: 'メッセージ',
                    },
                    {
                        label: 'ミミに DM',
                        set: [
                            { variable: 'あてさき', value: 'ミミ' },
                            { variable: 'メッセージ', value: 'シマネコ：ミミにだけ' },
                        ],
                        broadcast: 'メッセージ',
                    },
                ],
            },
            'ja',
        );

    test('DM to you sends to the name the student entered, read when pressed (4-5)', () => {
        const fake = makeVm();
        const name = { id: 'v5', name: 'なまえ', type: '', value: 0 };
        fake.runtime.targets[0].variables.v5 = name;
        let clock = 1000;
        const loop = attachPracticeLoopback({
            vm: fake.vm,
            partner: dmPartner(),
            now: () => clock,
            timers: makeTimers(),
        });
        const node = () => fake.meshService.remoteData[PRACTICE_PARTNER_NODE_ID];
        // まだ名前を入れていない（作ったときのまま 0）: 送らない
        expect(loop.press(0)).toEqual({ missingVariable: 'なまえ' });
        expect(node()).toBeUndefined();
        expect(fake.runtime.startHats).not.toHaveBeenCalled();
        name.value = '  ';
        expect(loop.press(0)).toEqual({ missingVariable: 'なまえ' });
        // 名前を入れた: 押したときの値をあて先にする（「あなた」などの決まった文字ではない）
        name.value = 'たかお';
        clock = 2000;
        expect(loop.press(0)).toEqual({ done: true });
        expect(node().あてさき).toEqual({ value: 'たかお', timestamp: 2000 });
        expect(node().メッセージ.value).toBe('シマネコ：ないしょだよ');
        expect(fake.runtime.startHats).toHaveBeenLastCalledWith('event_whenbroadcastreceived', {
            BROADCAST_OPTION: 'メッセージ',
        });
        // ミミに DM は、名前に関係なくミミあて
        expect(loop.press(1)).toEqual({ done: true });
        expect(node().あてさき.value).toBe('ミミ');
        // 名前を変えたら、次に押したときの名前
        name.value = 'はなこ';
        loop.press(0);
        expect(node().あてさき.value).toBe('はなこ');
        // 「0」と入力した名前（答えは文字）は入っている扱い
        name.value = '0';
        expect(loop.press(0)).toEqual({ done: true });
        loop.detach();
    });

    test('DM to you also reads the name written as 名前 or name (the names the goal accepts)', () => {
        const fake = makeVm();
        fake.runtime.targets[0].variables.v5 = { id: 'v5', name: '名前', type: '', value: 'たかお' };
        const loop = attachPracticeLoopback({ vm: fake.vm, partner: dmPartner(), timers: makeTimers() });
        expect(loop.press(0)).toEqual({ done: true });
        expect(fake.meshService.remoteData[PRACTICE_PARTNER_NODE_ID].あてさき.value).toBe('たかお');
        loop.detach();
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

describe('attachPracticeLoopback on the shared parts (lib/mesh-practice, #1876)', () => {
    const partner = () => normalizePartner(PARTNER, 'ja');

    test('connects as the lesson and lets the others go after detach', () => {
        const fake = makeVm();
        const loop = attachPracticeLoopback({ vm: fake.vm, partner: partner(), timers: makeTimers() });
        expect(practiceLoopbackOwner(fake.runtime)).toBe(LESSON_OWNER);
        // ひとりで使う練習相手は、レッスンがつないでいるあいだはつながない（二重に見張らない）
        expect(attachSharedLoopback({ vm: fake.vm, owner: 'standalone', timers: makeTimers() })).toBeNull();
        loop.detach();
        expect(practiceLoopbackOwner(fake.runtime)).toBeNull();
    });

    test('gives null while another practice partner is connected', () => {
        const fake = makeVm();
        const other = attachSharedLoopback({ vm: fake.vm, owner: 'standalone', timers: makeTimers() });
        expect(attachPracticeLoopback({ vm: fake.vm, partner: partner(), timers: makeTimers() })).toBeNull();
        other.detach();
        const loop = attachPracticeLoopback({ vm: fake.vm, partner: partner(), timers: makeTimers() });
        expect(loop).not.toBeNull();
        loop.detach();
    });

    test('uses the same node id as the standalone practice partner', () => {
        expect(PRACTICE_PARTNER_NODE_ID).toBe(MESH_PRACTICE_PARTNER_NODE_ID);
    });

    test('records sent and received messages in the mesh history, and removes them on detach', () => {
        const fake = makeVm();
        const svc = fake.meshService;
        svc.messageHistory = [];
        svc.recordMessage = (entry) => svc.messageHistory.unshift(entry);
        const timers = makeTimers();
        const loop = attachPracticeLoopback({ vm: fake.vm, partner: partner(), now: () => 1000, timers });
        exec(fake.runtime, 'event_broadcast', { BROADCAST_OPTION: { id: 'm2', name: 'メッセージ' } });
        timers.flush();
        expect(svc.messageHistory.map((e) => [e.direction, e.name, e.nodeId])).toEqual([
            ['received', 'へんじ', PRACTICE_PARTNER_NODE_ID],
            ['sent', 'メッセージ', 'me'],
        ]);
        loop.detach();
        expect(svc.messageHistory).toEqual([]);
    });
});
