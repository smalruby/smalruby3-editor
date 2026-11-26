import {
    groupByShape,
    shapeOf,
    starterThresholds,
    tagKind,
} from '../../../../src/lib/classroom-evaluation/shape-tags.js';

/**
 * A pseudocode text with running scripts (◆), like analyzeProject makes.
 * @param {...string} scripts - script bodies, 4 spaces per level from the hat
 * @returns {string} pseudocode
 */
const code = (...scripts) =>
    ['=== スプライト: スプライト1 ===', ...scripts.map((s) => `◆ スクリプト:\n${s}\n`)].join('\n');

const FLAG = '    緑の旗が押されたとき';
const READ = '        変数 明るさ を [smalrubotS1_getSensorValue] POSITION=left にする';
const SWITCH_LED = (n) =>
    [
        FLAG,
        '    ずっと',
        READ,
        `        もし (明るさ > ${n}) なら…でなければ`,
        '            [smalrubotS1_turnLedOn] POSITION=left',
        '        でなければ:',
        '            [smalrubotS1_turnLedOff] POSITION=left',
    ].join('\n');
const STARTER = [
    '=== スプライト: スプライト1 ===',
    '◆ スクリプト:',
    '    緑の旗が押されたとき',
    '',
    '◇ スクリプト:',
    '    ( > 50)',
].join('\n');

describe('shapeOf', () => {
    test('a light switch of the LED', () => {
        const shape = shapeOf({ pseudocode: code(SWITCH_LED(300)), added: ['x'], starterPseudocode: STARTER });
        expect(shape.tags).toEqual(['明るさで LED を切りかえ', 'しきい値 300']);
    });

    test('works that chose other numbers are one shape', () => {
        const a = shapeOf({ pseudocode: code(SWITCH_LED(300)), added: ['x'], starterPseudocode: STARTER });
        const b = shapeOf({ pseudocode: code(SWITCH_LED(415)), added: ['x'], starterPseudocode: STARTER });
        expect(a.key).toBe(b.key);
    });

    test("marks the starter's number and keeps it in the key", () => {
        const kept = shapeOf({ pseudocode: code(SWITCH_LED(50)), added: ['x'], starterPseudocode: STARTER });
        const own = shapeOf({ pseudocode: code(SWITCH_LED(300)), added: ['x'], starterPseudocode: STARTER });
        expect(kept.tags).toContain('しきい値 50（スターターのまま）');
        expect(kept.key).not.toBe(own.key);
    });

    test('names the parts the switch moves and the other parts after it', () => {
        const servo = [
            FLAG,
            '    ずっと',
            READ,
            '        もし (明るさ > 300) なら…でなければ',
            '            [smalrubotS1_bendArm] SECS=1, DEGREE=90',
            '        でなければ:',
            '            [smalrubotS1_bendArm] SECS=1, DEGREE=0',
        ].join('\n');
        const motor = [FLAG, '    [smalrubotS1_actionAndStopAfter] ACTION=forward, SECS=0.5'].join('\n');
        expect(shapeOf({ pseudocode: code(servo, motor), added: ['x'] }).tags).toEqual([
            '明るさでサーボを切りかえ',
            'しきい値 300',
            'モーター',
        ]);
    });

    test('the same action on both sides is not a switch', () => {
        const same = [
            FLAG,
            '    ずっと',
            READ,
            '        もし (明るさ > 200) なら…でなければ',
            '            [smalrubotS1_bendArm] SECS=1, DEGREE=90',
            '        でなければ:',
            '            [smalrubotS1_bendArm] SECS=1, DEGREE=90',
        ].join('\n');
        expect(shapeOf({ pseudocode: code(same), added: ['x'] }).tags).toEqual([
            'どちらも同じ',
            'しきい値 200',
            'サーボ',
        ]);
    });

    test('one side only, an empty もし, and a check outside the loop', () => {
        const oneSide = [
            FLAG,
            READ.slice(4),
            '    もし (明るさ > 40) なら',
            '        [smalrubotS1_turnLedOn] POSITION=right',
        ];
        expect(shapeOf({ pseudocode: code(oneSide.join('\n')), added: ['x'] }).tags).toEqual([
            '片側だけ',
            'ずっとの外',
            'しきい値 40',
            'LED',
        ]);
        const empty = [FLAG, '    ずっと', READ, '        もし (明るさ > 300) なら'];
        expect(shapeOf({ pseudocode: code(empty.join('\n')), added: ['x'] }).tags).toEqual([
            'もしの中が空',
            'しきい値 300',
        ]);
    });

    test('a comparison on a motor speed is not a sensor', () => {
        const fromMotor = [
            FLAG,
            '    ずっと',
            '        変数 明るさ を [smalrubotS1_getMotorSpeed] POSITION=left にする',
            '        もし (明るさ > 212) なら…でなければ',
            '            [smalrubotS1_actionAndStopAfter] ACTION=forward, SECS=0.5',
            '        でなければ:',
            '            [smalrubotS1_actionAndStopAfter] ACTION=stop, SECS=0.5',
        ].join('\n');
        expect(shapeOf({ pseudocode: code(fromMotor), added: ['x'] }).tags).toContain('センサー以外の値で判定');
    });

    test('another script that keeps setting the sensor variable to a number', () => {
        const reset = [FLAG, '    ずっと', '        変数 明るさ を 0 にする'].join('\n');
        expect(shapeOf({ pseudocode: code(SWITCH_LED(278), reset), added: ['x'] }).tags).toContain(
            '明るさを書きかえ続ける',
        );
    });

    test('parts without the sensor, nothing moved, and the starter as it was', () => {
        const blink = [FLAG, '    ずっと', '        [smalrubotS1_turnLedOn] POSITION=left'].join('\n');
        expect(shapeOf({ pseudocode: code(blink), added: ['x'] }).tags).toEqual(['LED', 'センサーを使わない']);
        const say = [FLAG, '    ずっと', READ, '        明るさ と言う'].join('\n');
        expect(shapeOf({ pseudocode: code(say), added: ['x'] }).tags).toEqual(['動かす部品なし']);
        expect(shapeOf({ pseudocode: code(SWITCH_LED(300)), added: [] }).tags).toEqual(['スターターのまま']);
    });

    test('a work without robot blocks is named by its operations', () => {
        const move = [FLAG, '    10 歩動かす'].join('\n');
        const shape = shapeOf({ pseudocode: code(move), added: ['10 歩動かす'] });
        expect(shape.tags).toEqual(['ロボットを動かさない']);
        expect(shape.key.startsWith('ops:')).toBe(true);
    });
});

describe('starterThresholds', () => {
    test('reads the numbers of loose and used comparisons', () => {
        expect([...starterThresholds(STARTER)]).toEqual([50]);
        expect([...starterThresholds('もし (明るさ1 > 30) なら')]).toEqual([30]);
    });
});

describe('tagKind', () => {
    test('colors switches, parts, numbers and notes', () => {
        expect(tagKind('明るさで LED を切りかえ')).toBe('good');
        expect(tagKind('モーター')).toBe('part');
        expect(tagKind('しきい値 300')).toBe('number');
        expect(tagKind('しきい値 50（スターターのまま）')).toBe('note');
        expect(tagKind('片側だけ')).toBe('note');
    });
});

describe('groupByShape', () => {
    test('largest first, seats sorted, the number dropped when it differs', () => {
        const groups = groupByShape([
            { seatNumber: 3, key: 'a', tags: ['明るさで LED を切りかえ', 'しきい値 300'] },
            { seatNumber: 1, key: 'a', tags: ['明るさで LED を切りかえ', 'しきい値 415'] },
            { seatNumber: 2, key: 'b', tags: ['LED', 'センサーを使わない'] },
        ]);
        expect(groups).toEqual([
            { key: 'a', tags: ['明るさで LED を切りかえ'], seatNumbers: [1, 3] },
            { key: 'b', tags: ['LED', 'センサーを使わない'], seatNumbers: [2] },
        ]);
    });
});
