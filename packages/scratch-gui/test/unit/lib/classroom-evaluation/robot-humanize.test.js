import {
    humanizePseudocode,
    humanizeRobotBlock,
    robotOperationsOf,
} from '../../../../src/lib/classroom-evaluation/robot-humanize';
import { analyzeProject } from '../../../../src/lib/classroom-evaluation/sb3-analyzer';

describe('humanizeRobotBlock', () => {
    test.each([
        ['smalrubotS1_bendArm', { SECS: '1', DEGREE: '100' }, 'サーボを 100 度に曲げる（1 秒）'],
        ['smalrubotS1_turnLedOn', { POSITION: 'left' }, '左の LED を点ける'],
        ['smalrubotS1_turnLedOff', { POSITION: 'right' }, '右の LED を消す'],
        ['smalrubotS1_actionAndStopAfter', { ACTION: 'forward', SECS: '0.5' }, 'モーターで進む（0.5 秒で止まる）'],
        ['smalrubotS1_action', { ACTION: 'forward' }, 'モーターで進む'],
        ['smalrubotS1_action', { ACTION: 'backward' }, 'モーターで下がる'],
        ['smalrubotS1_getSensorValue', { POSITION: 'left' }, '左のセンサーの値'],
        ['smalrubotS1_getSensorValue', { POSITION: 'light' }, '光センサーの値'],
        ['smalrubotS1_controlMotor', { MOTOR: 'M1', DIRECTION: 'normal' }, 'モーター M1 を正転させる'],
        ['smalrubotS1_setMotorSpeed', { POSITION: 'left', SPEED: '80' }, '左のモーターの速さを 80 % にする'],
        ['smalrubotS1_setArmCalibration', { DEGREE: '5' }, 'サーボを 5 度調整する'],
    ])('%s %j → %s', (opcode, args, expected) => {
        expect(humanizeRobotBlock(opcode, args)).toBe(expected);
    });

    test('leaves unknown opcodes alone', () => {
        expect(humanizeRobotBlock('smalrubotS1_somethingNew', {})).toBeNull();
        expect(humanizeRobotBlock('koshien_getMapArea', { AREA: 'A1' })).toBeNull();
    });

    test('keeps an unknown menu value as it is', () => {
        expect(humanizeRobotBlock('smalrubotS1_action', { ACTION: 'jump' })).toBe('モーターでjump');
    });
});

describe('humanizePseudocode', () => {
    test('rewrites raw robot lines and keeps the rest', () => {
        const text = [
            '◆ スクリプト:',
            '    緑の旗が押されたとき',
            '    [smalrubotS1_bendArm] SECS=1, DEGREE=100',
            '    [smalrubotS1_turnLedOn] POSITION=left',
            '    [smalrubotS1_unknown] X=1',
        ].join('\n');
        expect(humanizePseudocode(text).split('\n')).toEqual([
            '◆ スクリプト:',
            '    緑の旗が押されたとき',
            '    サーボを 100 度に曲げる（1 秒）',
            '    左の LED を点ける',
            '    [smalrubotS1_unknown] X=1',
        ]);
    });
});

describe('humanizePseudocode inside a sentence', () => {
    test('keeps the words after a robot reporter', () => {
        expect(humanizePseudocode('    変数 明るさ を [smalrubotS1_getSensorValue] POSITION=left にする')).toBe(
            '    変数 明るさ を 左のセンサーの値 にする',
        );
        expect(humanizePseudocode('もし ([smalrubotS1_getSensorValue] POSITION=right > 50) なら')).toBe(
            'もし (右のセンサーの値 > 50) なら',
        );
    });
});

describe('robotOperationsOf', () => {
    test('names the operation without numbers or sides', () => {
        expect(robotOperationsOf('サーボを 30 度に曲げる（2 秒）')).toEqual([
            { part: 'servo', operation: 'サーボを曲げる' },
        ]);
        expect(robotOperationsOf('右の LED を点ける')).toEqual([{ part: 'led', operation: 'LED を点ける' }]);
        expect(robotOperationsOf('モーターで進む（1 秒で止まる）')).toEqual([
            { part: 'motor', operation: 'モーターで進む（時間で止まる）' },
        ]);
        expect(robotOperationsOf('[smalrubotS1_action] ACTION=forward')).toEqual([
            { part: 'motor', operation: 'モーターで進む' },
        ]);
    });

    test('finds a sensor read inside a condition', () => {
        expect(robotOperationsOf('もし (左のセンサーの値 < 50) なら')).toEqual([
            { part: 'sensor', operation: 'センサーの値を調べる' },
        ]);
    });

    test('returns nothing for a non-robot line', () => {
        expect(robotOperationsOf('10 歩動かす')).toEqual([]);
    });
});

describe('sb3-analyzer uses the robot phrases', () => {
    test('renders robot blocks and their menus in Japanese', () => {
        const project = {
            targets: [
                {
                    isStage: false,
                    name: 'ロボット',
                    blocks: {
                        hat: { opcode: 'event_whenflagclicked', next: 'arm', topLevel: true },
                        arm: {
                            opcode: 'smalrubotS1_bendArm',
                            next: 'drive',
                            inputs: { DEGREE: [1, [4, '100']], SECS: [1, [4, '1']] },
                        },
                        drive: {
                            opcode: 'smalrubotS1_actionAndStopAfter',
                            next: null,
                            inputs: { ACTION: [1, 'menu'], SECS: [1, [4, '0.5']] },
                        },
                        menu: {
                            opcode: 'smalrubotS1_menu_actions',
                            shadow: true,
                            fields: { actions: ['forward', null] },
                        },
                    },
                },
            ],
        };
        const { pseudocode } = analyzeProject(project);
        expect(pseudocode).toContain('サーボを 100 度に曲げる（1 秒）');
        expect(pseudocode).toContain('モーターで進む（0.5 秒で止まる）');
        expect(pseudocode).not.toContain('smalrubotS1');
    });
});
