import {
    groupName,
    groupSubmissions,
    operationsOf,
    pickRepresentatives,
    rareBlocks,
} from '../../../../src/lib/classroom-evaluation/grouping';

const LED_ON = '緑の旗が押されたとき\n左の LED を点ける';
const LED_BLINK =
    '緑の旗が押されたとき\nずっと\n    左の LED を点ける\n    1 秒待つ\n    左の LED を消す\n    1 秒待つ';
const SERVO_90 = '緑の旗が押されたとき\nサーボを 90 度に曲げる（1 秒）';
const SERVO_120 = '緑の旗が押されたとき\nサーボを 120 度に曲げる（2 秒）';
const MOTOR_SERVO = 'スペース キーが押されたとき\nモーターで進む（0.5 秒で止まる）\nサーボを 45 度に曲げる（1 秒）';

describe('operationsOf', () => {
    test('ignores numbers, sides and hats', () => {
        expect(operationsOf([SERVO_90])).toEqual(operationsOf([SERVO_120]));
        expect(operationsOf([LED_BLINK]).map((op) => op.operation)).toEqual([
            'LED を消す',
            'LED を点ける',
            '… 秒待つ',
            'ずっと',
        ]);
    });

    test('keeps hats when asked', () => {
        expect(operationsOf([MOTOR_SERVO], { withHats: true }).map((op) => op.operation)).toContain(
            '… キーが押されたとき',
        );
    });
});

describe('groupName', () => {
    test.each([
        [[], true, 'スターターのまま'],
        [[{ part: 'led' }], false, 'LED だけ'],
        [[{ part: 'servo' }], false, 'サーボだけ'],
        [[{ part: 'motor' }, { part: 'servo' }], false, 'モーターとサーボ'],
        [[{ part: 'servo' }, { part: 'led' }], false, 'サーボと LED'],
        [[{ part: 'led' }, { part: 'sensor' }], false, 'LED だけ（センサーを使う）'],
        [[{ part: 'other' }], false, 'ロボットを動かさない'],
    ])('%j → %s', (ops, unchanged, name) => {
        expect(groupName(ops, unchanged)).toBe(name);
    });
});

describe('groupSubmissions', () => {
    const submissions = [
        { seatNumber: 3, added: [SERVO_90] },
        { seatNumber: 1, added: [SERVO_120] },
        { seatNumber: 2, added: [] },
        { seatNumber: 4, added: [MOTOR_SERVO] },
        { seatNumber: 5, added: [LED_ON] },
        { seatNumber: 6, added: [LED_BLINK] },
    ];

    test('groups works with the same operations, largest first', () => {
        const groups = groupSubmissions(submissions);
        expect(groups[0]).toMatchObject({ name: 'サーボだけ', seatNumbers: [1, 3] });
        expect(groups.find((g) => g.key === '')).toMatchObject({ name: 'スターターのまま', seatNumbers: [2] });
        expect(groups.find((g) => g.seatNumbers.includes(4)).name).toBe('モーターとサーボ');
    });

    test('tells apart groups that would share a name', () => {
        const names = groupSubmissions(submissions)
            .filter((g) => g.name.startsWith('LED だけ'))
            .map((g) => g.name);
        expect(names).toHaveLength(2);
        expect(names).toContain('LED だけ（LED を点ける）');
        expect(names).toContain('LED だけ（LED を消す・LED を点ける）');
    });
});

describe('pickRepresentatives', () => {
    const group = (key, seats) => ({ key, name: key || 'スターターのまま', seatNumbers: seats });

    test('one per group: largest, then small ones, then the rest, starter last', () => {
        const groups = [group('big', [5, 2, 9, 7]), group('mid', [10, 11, 12]), group('one', [4]), group('', [1, 3])];
        expect(pickRepresentatives(groups).map((p) => [p.key, p.seatNumber, p.size])).toEqual([
            ['big', 2, 4],
            ['one', 4, 1],
            ['mid', 10, 3],
            ['', 1, 2],
        ]);
    });

    test('caps at max, dropping middle groups before small ones', () => {
        const groups = [
            group('big', [1, 2, 3, 4]),
            group('mid1', [5, 6, 7]),
            group('mid2', [8, 9, 10]),
            group('a', [11]),
            group('b', [12, 13]),
        ];
        expect(pickRepresentatives(groups, { max: 3 }).map((p) => p.key)).toEqual(['big', 'a', 'b']);
    });

    test('handles no groups', () => {
        expect(pickRepresentatives([])).toEqual([]);
    });
});

describe('rareBlocks', () => {
    test('marks operations used by threshold students or fewer', () => {
        const submissions = [
            { seatNumber: 1, added: [LED_ON] },
            { seatNumber: 2, added: [LED_ON] },
            { seatNumber: 3, added: [LED_ON] },
            { seatNumber: 4, added: [MOTOR_SERVO] },
            { seatNumber: 5, added: [] },
        ];
        const rare = rareBlocks(submissions, { threshold: 2 });
        expect(rare.find((r) => r.seatNumber === 1).rare).toEqual([]);
        expect(rare.find((r) => r.seatNumber === 4).rare).toEqual([
            '… キーが押されたとき',
            'サーボを曲げる',
            'モーターで進む（時間で止まる）',
        ]);
        expect(rare.find((r) => r.seatNumber === 5).rare).toEqual([]);
    });
});
