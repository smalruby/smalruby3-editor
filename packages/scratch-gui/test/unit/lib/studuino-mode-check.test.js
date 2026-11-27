import {
    checkModeSwitch,
    findNormalModeUnusableBlocks,
    findStuduinoUnusableBlocks,
    settingsAfterClear,
    targetsFromVm,
} from '../../../src/lib/studuino-mode-check';

// 小さなブロックの組み立て（VM の target.blocks._blocks と同じ形）
const makeBlocks = () => {
    const blocks = {};
    let n = 0;
    const add = (opcode, { fields = {}, inputs = {}, topLevel = false, shadow = false } = {}) => {
        n += 1;
        const id = `b${n}`;
        blocks[id] = { id, opcode, fields, inputs, next: null, parent: null, topLevel, shadow };
        Object.values(inputs).forEach((input) => {
            if (blocks[input.block]) blocks[input.block].parent = id;
        });
        return id;
    };
    const chain = (...ids) => {
        for (let i = 0; i < ids.length - 1; i++) {
            blocks[ids[i]].next = ids[i + 1];
            blocks[ids[i + 1]].parent = ids[i];
        }
        return ids[0];
    };
    const num = (value) => {
        const id = add('math_number', { fields: { NUM: { name: 'NUM', value } }, shadow: true });
        return { name: 'X', block: id, shadow: id };
    };
    return { blocks, add, chain, num };
};

const SETTINGS = { mode: 'studuino', ports: { A0: 'led', M1: 'dc_motor' }, calibration: {} };
const stage = (blocks) => [{ id: 'stage', isStage: true, blocks, variables: {} }];
const port = (value) => ({ PORT: { name: 'PORT', value } });

describe('findStuduinoUnusableBlocks', () => {
    test('使えるブロックだけなら空', () => {
        const ws = makeBlocks();
        ws.chain(
            ws.add('event_whenflagclicked', { topLevel: true }),
            ws.add('smalrubotS1_studuinoLed', { fields: { ...port('A0'), STATE: { name: 'STATE', value: 'on' } } }),
            ws.add('control_wait', { inputs: { DURATION: ws.num('1') } }),
        );
        expect(findStuduinoUnusableBlocks(stage(ws.blocks), SETTINGS)).toEqual([]);
    });

    test('見た目のブロック・外したポート・2 つ目の旗に印（同じブロックは 1 回）', () => {
        const ws = makeBlocks();
        const say = ws.add('looks_say', { inputs: { MESSAGE: ws.num('hi') } });
        const led = ws.add('smalrubotS1_studuinoLed', {
            fields: { ...port('A1'), STATE: { name: 'STATE', value: 'on' } },
        });
        ws.chain(ws.add('event_whenflagclicked', { topLevel: true }), say, led);
        const second = ws.add('event_whenflagclicked', { topLevel: true });
        const found = findStuduinoUnusableBlocks(stage(ws.blocks), SETTINGS);
        const ids = found.map((b) => b.blockId);
        expect(ids).toEqual(expect.arrayContaining([say, led, second]));
        expect(new Set(ids).size).toBe(ids.length);
        expect(found.find((b) => b.blockId === led)).toMatchObject({
            targetId: 'stage',
            reason: 'port_not_assigned',
        });
        expect(found.find((b) => b.blockId === second).reason).toBe('too_many_flags');
    });

    test('旗の下に無いスクリプトには印を付けない（S8）', () => {
        const ws = makeBlocks();
        ws.add('event_whenflagclicked', { topLevel: true });
        ws.add('looks_say', { inputs: { MESSAGE: ws.num('hi') }, topLevel: true });
        ws.chain(
            ws.add('event_whenkeypressed', { topLevel: true }),
            ws.add('smalrubotS1_studuinoLed', { fields: { ...port('A1'), STATE: { name: 'STATE', value: 'on' } } }),
        );
        expect(findStuduinoUnusableBlocks(stage(ws.blocks), SETTINGS)).toEqual([]);
    });

    test('旗が 1 つも無いことは印にしない（ブロックに結びつかない）', () => {
        const ws = makeBlocks();
        ws.add('control_wait', { inputs: { DURATION: ws.num('1') }, topLevel: true });
        expect(findStuduinoUnusableBlocks(stage(ws.blocks), SETTINGS)).toEqual([]);
    });
});

describe('findNormalModeUnusableBlocks', () => {
    test('Studuino モードの部品のブロックだけを数える', () => {
        const ws = makeBlocks();
        const part = ws.add('smalrubotS1_studuinoLed', { topLevel: true });
        ws.add('smalrubotS1_setMotorSpeed', { topLevel: true });
        ws.add('looks_say', { topLevel: true });
        expect(findNormalModeUnusableBlocks(stage(ws.blocks))).toEqual([
            { targetId: 'stage', blockId: part, reason: 'studuino_only_block' },
        ]);
    });
});

describe('checkModeSwitch', () => {
    test('通常 → Studuino は、Studuino モードで使えないブロックがあると止める', () => {
        const ws = makeBlocks();
        const say = ws.add('looks_say');
        ws.chain(ws.add('event_whenflagclicked', { topLevel: true }), say);
        expect(checkModeSwitch(stage(ws.blocks), SETTINGS, true)).toEqual({
            allowed: false,
            blocks: [{ targetId: 'stage', blockId: say, reason: 'unsupported_block' }],
        });
        expect(checkModeSwitch(stage({}), SETTINGS, true)).toEqual({ allowed: true, blocks: [] });
        // 旗の下に無いスクリプトは止める理由にしない（S8）
        const loose = makeBlocks();
        loose.add('looks_say', { topLevel: true });
        expect(checkModeSwitch(stage(loose.blocks), SETTINGS, true)).toEqual({ allowed: true, blocks: [] });
    });

    test('Studuino → 通常は、部品のブロックがあると止める', () => {
        const ws = makeBlocks();
        ws.add('smalrubotS1_studuinoLightSensor', { topLevel: true });
        expect(checkModeSwitch(stage(ws.blocks), SETTINGS, false).allowed).toBe(false);
        const ws2 = makeBlocks();
        ws2.add('looks_say', { topLevel: true });
        expect(checkModeSwitch(stage(ws2.blocks), SETTINGS, false).allowed).toBe(true);
    });
});

test('settingsAfterClear はポートの設定を残して動かし方だけ変える', () => {
    expect(settingsAfterClear(SETTINGS, false)).toEqual({ ...SETTINGS, mode: 'normal' });
    expect(settingsAfterClear({ ...SETTINGS, mode: 'normal' }, true).mode).toBe('studuino');
});

test('targetsFromVm は元の target だけ（クローンは除く）', () => {
    const t = (id, isOriginal) => ({ id, isOriginal, isStage: false, blocks: { _blocks: {} }, variables: {} });
    const vm = { runtime: { targets: [t('a', true), t('b', false)] } };
    expect(targetsFromVm(vm).map((x) => x.id)).toEqual(['a']);
    expect(targetsFromVm(null)).toEqual([]);
});
