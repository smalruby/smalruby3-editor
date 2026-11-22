import {
    buildStuduinoIr,
    buildStuduinoIrFromVm,
    measureStuduinoIr,
    toStuduinoNumber,
} from '../../../../src/lib/studuino-ir/build-studuino-ir';
import { STUDUINO_IR_LIMITS } from '../../../../src/lib/studuino-ir/limits';

/**
 * ブロックを小さく組み立てる道具（VM の `target.blocks._blocks` と同じ形）。
 * @returns {object} 道具
 */
const workspace = () => {
    const blocks = {};
    let n = 0;
    const add = (opcode, { inputs = {}, fields = {}, shadow = false } = {}) => {
        n += 1;
        const id = `blk${n}`;
        const block = { id, opcode, inputs: {}, fields: {}, next: null, parent: null, shadow, topLevel: false };
        for (const [name, v] of Object.entries(fields)) {
            block.fields[name] = v && typeof v === 'object' ? { name, ...v } : { name, value: v };
        }
        for (const [name, v] of Object.entries(inputs)) {
            if (v === null) continue;
            block.inputs[name] = { name, ...v };
            const child = blocks[v.block || v.shadow];
            if (child) child.parent = id;
        }
        blocks[id] = block;
        return id;
    };
    const lit = (opcode, field, value) => ({
        block: add(opcode, { fields: { [field]: value }, shadow: true }),
        shadow: null,
    });
    const api = {
        blocks,
        add,
        num: (value) => {
            const input = lit('math_number', 'NUM', value);
            return { block: input.block, shadow: input.block };
        },
        txt: (value) => {
            const input = lit('text', 'TEXT', value);
            return { block: input.block, shadow: input.block };
        },
        // reporter をつないだ入力（影は 0 の数）
        rep: (id) => ({ block: id, shadow: add('math_number', { fields: { NUM: '0' }, shadow: true }) }),
        // 真偽の入力（影なし）
        cond: (id) => ({ block: id, shadow: null }),
        sub: (first) => ({ block: first, shadow: null }),
        stack: (...ids) => {
            for (let i = 0; i < ids.length - 1; i++) {
                blocks[ids[i]].next = ids[i + 1];
                blocks[ids[i + 1]].parent = ids[i];
            }
            return ids[0];
        },
        top: (id) => {
            blocks[id].topLevel = true;
            return id;
        },
        script: (...ids) => {
            const hat = api.top(add('event_whenflagclicked'));
            api.stack(hat, ...ids);
            return hat;
        },
    };
    return api;
};

const SETTINGS = {
    mode: 'studuino',
    ports: {
        M1: 'dc_motor',
        M2: 'dc_motor',
        D9: 'servo_motor',
        D10: 'servo_motor',
        A0: 'led',
        A1: 'buzzer',
        A2: 'touch_sensor',
        A3: 'push_switch',
        A4: 'sound_sensor',
        A5: 'ir_photoreflector',
        A6: 'light_sensor',
        A7: 'temperature_sensor',
    },
    calibration: { dcMotor: { M2: 90 }, servoMotor: { D9: -5, D10: 3 } },
};

const stageWith = (ws, variables = {}) => ({ id: 'stage', isStage: true, blocks: ws.blocks, variables });

const build = (ws, { variables, settings = SETTINGS, extraTargets = [] } = {}) =>
    buildStuduinoIr({ targets: [stageWith(ws, variables), ...extraTargets], settings });

/** 旗の下の 1 つの文だけを作る。 */
const mainOf = (ws, opts) => {
    const result = build(ws, opts);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.ir.main;
};

describe('toStuduinoNumber', () => {
    test.each([
        [10, 10],
        ['10', 10],
        [' 2.5 ', 2.5],
        ['-3', -3],
        ['', 0],
        ['   ', 0],
        [null, 0],
        [true, 1],
        ['abc', null],
        ['1a', null],
        [NaN, null],
        [Infinity, null],
    ])('%p → %p', (value, expected) => {
        expect(toStuduinoNumber(value)).toBe(expected);
    });
});

describe('buildStuduinoIr: 全体の形', () => {
    test('ports と calibration を設定から入れ、変数を v0 から付ける', () => {
        const ws = workspace();
        ws.script(
            ws.add('data_setvariableto', {
                fields: { VARIABLE: { id: 'var-a', value: 'あ' } },
                inputs: { VALUE: ws.txt('5') },
            }),
        );
        const result = build(ws, { variables: { 'var-a': { id: 'var-a', name: 'あ', type: '', value: 7 } } });
        expect(result).toEqual({
            ok: true,
            ir: {
                version: 1,
                board: 'studuino',
                ports: SETTINGS.ports,
                calibration: { dcMotor: { M2: 90 }, servoMotor: { D9: -5, D10: 3 } },
                variables: [{ id: 'v0', init: 7 }],
                main: [{ op: 'set', var: 'v0', value: { num: 5 } }],
            },
            warnings: [],
        });
    });

    test('構文木に変数の名前・ブロックの ID を入れない', () => {
        const ws = workspace();
        ws.script(
            ws.add('data_changevariableby', {
                fields: { VARIABLE: { id: 'var-secret', value: 'ひみつの名前' } },
                inputs: { VALUE: ws.num(1) },
            }),
        );
        const result = build(ws, {
            variables: { 'var-secret': { id: 'var-secret', name: 'ひみつの名前', type: '', value: 0 } },
        });
        const json = JSON.stringify(result.ir);
        expect(json).not.toMatch(/ひみつ|var-secret|blk\d/);
    });

    test('Lambda の all-ops に相当するプログラムが同じ構文木になる', () => {
        // infra/smalruby-studuino-hex/lambda/tests/fixtures/all-ops.request.json の写し。
        // ブロックからは作れない 2 か所（`msPerDegree` と `to_num` の中の `{bool: true}`）だけ、
        // ブロックで作れる形（`msPerDegree` なし・`to_num` の中は比べるブロック）に変えた。
        const expected = {
            version: 1,
            board: 'studuino',
            ports: SETTINGS.ports,
            calibration: { dcMotor: { M2: 90 }, servoMotor: { D9: -5, D10: 3 } },
            variables: [
                { id: 'v0', init: 0 },
                { id: 'v1', init: 1.5 },
            ],
            main: [
                { op: 'timer_reset' },
                { op: 'set', var: 'v0', value: { op: 'random', a: { num: 1 }, b: { num: 10 } } },
                { op: 'change', var: 'v1', by: { op: '%', a: { var: 'v0' }, b: { num: -3 } } },
                {
                    op: 'repeat',
                    times: { op: 'round', a: { op: '/', a: { num: 7 }, b: { num: 2 } } },
                    body: [
                        { op: 'led', port: 'A0', on: true },
                        { op: 'wait', secs: { num: 0.2 } },
                        { op: 'led', port: 'A0', on: false },
                    ],
                },
                { op: 'wait_until', cond: { op: 'button', kind: 'push_switch', port: 'A3' } },
                {
                    op: 'forever',
                    body: [
                        {
                            op: 'if',
                            cond: {
                                op: '<',
                                a: { op: 'sensor', kind: 'light_sensor', port: 'A6' },
                                b: { num: 300 },
                            },
                            then: [
                                {
                                    op: 'dc_motor_speed',
                                    port: 'M1',
                                    speed: {
                                        op: '*',
                                        a: { num: 2 },
                                        b: { op: '-', a: { num: 100 }, b: { op: '+', a: { num: 1 }, b: { num: 2 } } },
                                    },
                                },
                                { op: 'dc_motor_dir', port: 'M1', dir: 'normal' },
                                { op: 'dc_motor_dir', port: 'M2', dir: 'reverse' },
                            ],
                            else: [
                                { op: 'dc_motor_stop', port: 'M1', mode: 'brake' },
                                { op: 'dc_motor_stop', port: 'M2', mode: 'coast' },
                            ],
                        },
                        {
                            op: 'repeat_until',
                            cond: {
                                op: 'or',
                                a: { op: 'not', a: { op: 'button', kind: 'touch_sensor', port: 'A2' } },
                                b: { op: '>', a: { op: 'timer' }, b: { num: 5 } },
                            },
                            body: [
                                {
                                    op: 'servo',
                                    port: 'D9',
                                    angle: { op: 'sensor', kind: 'sound_sensor', port: 'A4' },
                                },
                                {
                                    op: 'servo_multi',
                                    items: [
                                        { port: 'D9', angle: { num: 0 } },
                                        { port: 'D10', angle: { num: 180 } },
                                    ],
                                },
                            ],
                        },
                        {
                            op: 'if',
                            cond: {
                                op: 'and',
                                a: {
                                    op: '=',
                                    a: { op: 'sensor', kind: 'ir_photoreflector', port: 'A5' },
                                    b: { op: 'to_num', a: { op: '<', a: { num: 1 }, b: { num: 2 } } },
                                },
                                b: {
                                    op: '>',
                                    a: { op: 'sensor', kind: 'temperature_sensor', port: 'A7' },
                                    b: { num: 0 },
                                },
                            },
                            then: [
                                { op: 'buzzer_on', port: 'A1', pitch: { num: 440 } },
                                { op: 'wait', secs: { var: 'v1' } },
                                { op: 'buzzer_off', port: 'A1' },
                            ],
                        },
                    ],
                },
            ],
        };

        const ws = workspace();
        const { add, num, txt, rep, cond, sub, stack } = ws;
        const v0 = { VARIABLE: { id: 'g0', value: 'かず' } };
        const v1 = { VARIABLE: { id: 'g1', value: 'まつ' } };
        const P = (port) => ({ PORT: port });
        const sensor = (opcode, port) => add(`smalrubotS1_${opcode}`, { fields: P(port) });

        const loop = stack(
            add('smalrubotS1_studuinoLed', { fields: { PORT: 'A0', STATE: 'on' } }),
            add('control_wait', { inputs: { DURATION: num('0.2') } }),
            add('smalrubotS1_studuinoLed', { fields: { PORT: 'A0', STATE: 'off' } }),
        );
        const thenBranch = stack(
            add('smalrubotS1_studuinoDcMotorSpeed', {
                fields: P('M1'),
                inputs: {
                    SPEED: rep(
                        add('operator_multiply', {
                            inputs: {
                                NUM1: num(2),
                                NUM2: rep(
                                    add('operator_subtract', {
                                        inputs: {
                                            NUM1: num(100),
                                            NUM2: rep(
                                                add('operator_add', { inputs: { NUM1: num(1), NUM2: num(2) } }),
                                            ),
                                        },
                                    }),
                                ),
                            },
                        }),
                    ),
                },
            }),
            add('smalrubotS1_studuinoDcMotorDirection', { fields: { PORT: 'M1', DIRECTION: 'normal' } }),
            add('smalrubotS1_studuinoDcMotorDirection', { fields: { PORT: 'M2', DIRECTION: 'reverse' } }),
        );
        const elseBranch = stack(
            add('smalrubotS1_studuinoDcMotorStop', { fields: { PORT: 'M1', MODE: 'brake' } }),
            add('smalrubotS1_studuinoDcMotorStop', { fields: { PORT: 'M2', MODE: 'coast' } }),
        );
        const untilBody = stack(
            add('smalrubotS1_studuinoServo', {
                fields: P('D9'),
                inputs: { ANGLE: rep(sensor('studuinoSoundSensor', 'A4')) },
            }),
            add('smalrubotS1_studuinoServoPair', {
                fields: { PORT1: 'D9', PORT2: 'D10' },
                inputs: { ANGLE1: num(0), ANGLE2: num(180) },
            }),
        );
        const buzz = stack(
            add('smalrubotS1_studuinoBuzzerOn', { fields: P('A1'), inputs: { PITCH: num(440) } }),
            add('control_wait', { inputs: { DURATION: rep(add('data_variable', { fields: v1 })) } }),
            add('smalrubotS1_studuinoBuzzerOff', { fields: P('A1') }),
        );
        const foreverBody = stack(
            add('control_if_else', {
                inputs: {
                    CONDITION: cond(
                        add('operator_lt', {
                            inputs: { OPERAND1: rep(sensor('studuinoLightSensor', 'A6')), OPERAND2: txt('300') },
                        }),
                    ),
                    SUBSTACK: sub(thenBranch),
                    SUBSTACK2: sub(elseBranch),
                },
            }),
            add('control_repeat_until', {
                inputs: {
                    CONDITION: cond(
                        add('operator_or', {
                            inputs: {
                                OPERAND1: cond(
                                    add('operator_not', {
                                        inputs: { OPERAND: cond(sensor('studuinoTouchSensorPressed', 'A2')) },
                                    }),
                                ),
                                OPERAND2: cond(
                                    add('operator_gt', {
                                        inputs: { OPERAND1: rep(add('sensing_timer')), OPERAND2: txt('5') },
                                    }),
                                ),
                            },
                        }),
                    ),
                    SUBSTACK: sub(untilBody),
                },
            }),
            add('control_if', {
                inputs: {
                    CONDITION: cond(
                        add('operator_and', {
                            inputs: {
                                OPERAND1: cond(
                                    add('operator_equals', {
                                        inputs: {
                                            OPERAND1: rep(sensor('studuinoIrPhotoreflector', 'A5')),
                                            OPERAND2: rep(
                                                add('operator_lt', {
                                                    inputs: { OPERAND1: txt('1'), OPERAND2: txt('2') },
                                                }),
                                            ),
                                        },
                                    }),
                                ),
                                OPERAND2: cond(
                                    add('operator_gt', {
                                        inputs: {
                                            OPERAND1: rep(sensor('studuinoTemperatureSensor', 'A7')),
                                            OPERAND2: txt('0'),
                                        },
                                    }),
                                ),
                            },
                        }),
                    ),
                    SUBSTACK: sub(buzz),
                },
            }),
        );
        ws.script(
            add('sensing_resettimer'),
            add('data_setvariableto', {
                fields: v0,
                inputs: { VALUE: rep(add('operator_random', { inputs: { FROM: num(1), TO: num(10) } })) },
            }),
            add('data_changevariableby', {
                fields: v1,
                inputs: {
                    VALUE: rep(
                        add('operator_mod', {
                            inputs: { NUM1: rep(add('data_variable', { fields: v0 })), NUM2: num(-3) },
                        }),
                    ),
                },
            }),
            add('control_repeat', {
                inputs: {
                    TIMES: rep(
                        add('operator_round', {
                            inputs: { NUM: rep(add('operator_divide', { inputs: { NUM1: num(7), NUM2: num(2) } })) },
                        }),
                    ),
                    SUBSTACK: sub(loop),
                },
            }),
            add('control_wait_until', { inputs: { CONDITION: cond(sensor('studuinoButtonPressed', 'A3')) } }),
            add('control_forever', { inputs: { SUBSTACK: sub(foreverBody) } }),
        );

        const result = build(ws, {
            variables: {
                g0: { id: 'g0', name: 'かず', type: '', value: 0 },
                g1: { id: 'g1', name: 'まつ', type: '', value: '1.5' },
            },
        });
        expect(result).toEqual({ ok: true, ir: expected, warnings: [] });
    });
});

describe('buildStuduinoIr: 文と式の表', () => {
    test.each([
        ['空の forever', (ws) => ws.add('control_forever'), [{ op: 'forever', body: [] }]],
        ['空の if（条件も空 = 偽）', (ws) => ws.add('control_if'), [{ op: 'if', cond: { bool: false }, then: [] }]],
        [
            '空の if else',
            (ws) => ws.add('control_if_else'),
            [{ op: 'if', cond: { bool: false }, then: [], else: [] }],
        ],
        [
            '空欄の待つは 0',
            (ws) => ws.add('control_wait', { inputs: { DURATION: ws.num('') } }),
            [{ op: 'wait', secs: { num: 0 } }],
        ],
        [
            '真偽を数の所に入れたら to_num',
            (ws) =>
                ws.add('control_wait', {
                    inputs: {
                        DURATION: ws.rep(ws.add('smalrubotS1_studuinoButtonPressed', { fields: { PORT: 'A3' } })),
                    },
                }),
            [{ op: 'wait', secs: { op: 'to_num', a: { op: 'button', kind: 'push_switch', port: 'A3' } } }],
        ],
        [
            'ポートが影のメニューのブロックでも読める',
            (ws) =>
                ws.add('smalrubotS1_studuinoLed', {
                    inputs: {
                        PORT: {
                            block: ws.add('smalrubotS1_menu_ledPorts', { fields: { ledPorts: 'A0' }, shadow: true }),
                            shadow: null,
                        },
                        STATE: {
                            block: ws.add('smalrubotS1_menu_ledState', { fields: { ledState: 'on' }, shadow: true }),
                            shadow: null,
                        },
                    },
                }),
            [{ op: 'led', port: 'A0', on: true }],
        ],
        [
            '影のメニューの値が数でも数として読む',
            (ws) =>
                ws.add('smalrubotS1_studuinoBuzzerOn', {
                    fields: { PORT: 'A1' },
                    inputs: {
                        PITCH: {
                            block: ws.add('smalrubotS1_menu_pitch', { fields: { pitch: '262' }, shadow: true }),
                            shadow: null,
                        },
                    },
                }),
            [{ op: 'buzzer_on', port: 'A1', pitch: { num: 262 } }],
        ],
    ])('%s', (_name, make, expected) => {
        const ws = workspace();
        ws.script(make(ws));
        expect(mainOf(ws)).toEqual(expected);
    });

    test('ローカル変数とグローバル変数を別の ID にし、使ったものだけ入れる', () => {
        const ws = workspace();
        const sprite = workspace();
        sprite.script(
            sprite.add('data_setvariableto', {
                fields: { VARIABLE: { id: 'local', value: 'x' } },
                inputs: { VALUE: sprite.txt('1') },
            }),
            sprite.add('data_changevariableby', {
                fields: { VARIABLE: { id: 'global', value: 'y' } },
                inputs: { VALUE: sprite.num(2) },
            }),
            sprite.add('data_changevariableby', {
                fields: { VARIABLE: { id: 'local', value: 'x' } },
                inputs: { VALUE: sprite.num(3) },
            }),
        );
        const result = buildStuduinoIr({
            targets: [
                stageWith(ws, {
                    global: { id: 'global', name: 'y', type: '', value: 'abc' },
                    unused: { id: 'unused', name: 'z', type: '', value: 9 },
                }),
                {
                    id: 'sprite1',
                    isStage: false,
                    blocks: sprite.blocks,
                    variables: { local: { id: 'local', name: 'x', type: '', value: '4' } },
                },
            ],
            settings: SETTINGS,
        });
        expect(result.ok).toBe(true);
        // 文字の値の変数は 0 からはじめる
        expect(result.ir.variables).toEqual([
            { id: 'v0', init: 4 },
            { id: 'v1', init: 0 },
        ]);
        expect(result.ir.main.map((s) => s.var)).toEqual(['v0', 'v1', 'v0']);
    });

    test('旗の下にない、使えるブロックだけのばらばらのスクリプトは無視する', () => {
        const ws = workspace();
        ws.script(ws.add('sensing_resettimer'));
        ws.top(ws.add('control_wait', { inputs: { DURATION: ws.num(1) } }));
        ws.top(ws.add('sensing_timer'));
        expect(mainOf(ws)).toEqual([{ op: 'timer_reset' }]);
    });

    test('設定を省いたときはロボットカーの配線', () => {
        const ws = workspace();
        ws.script(ws.add('smalrubotS1_studuinoServo', { fields: { PORT: 'D10' }, inputs: { ANGLE: ws.num(90) } }));
        const result = buildStuduinoIr({ targets: [stageWith(ws)], settings: null });
        expect(result.ok).toBe(true);
        expect(result.ir.ports.D10).toBe('servo_motor');
        expect(result.ir.calibration).toEqual({ dcMotor: {}, servoMotor: {} });
    });
});

describe('buildStuduinoIr: エラー', () => {
    const errorsOf = (ws, opts) => {
        const result = build(ws, opts);
        expect(result.ok).toBe(false);
        return result.errors;
    };

    test('旗が 0 個なら no_flag', () => {
        const ws = workspace();
        expect(errorsOf(ws)).toEqual([{ blockId: null, targetId: null, reason: 'no_flag' }]);
    });

    test('旗が 2 つ以上なら、2 つ目以降に too_many_flags', () => {
        const ws = workspace();
        const sprite = workspace();
        ws.script();
        const second = sprite.script();
        const result = buildStuduinoIr({
            targets: [stageWith(ws), { id: 's1', isStage: false, blocks: sprite.blocks, variables: {} }],
            settings: SETTINGS,
        });
        expect(result.errors).toEqual([{ blockId: second, targetId: 's1', reason: 'too_many_flags' }]);
    });

    test('使えないブロックは unsupported_block（旗の下・中の入力）', () => {
        const ws = workspace();
        const say = ws.add('looks_say', { inputs: { MESSAGE: ws.rep(ws.add('looks_size')) } });
        ws.script(say);
        const reasons = errorsOf(ws).map((e) => [e.blockId, e.reason]);
        expect(reasons).toEqual([
            [say, 'unsupported_block'],
            [ws.blocks[say].inputs.MESSAGE.block, 'unsupported_block'],
        ]);
    });

    test('旗の下に無いスクリプトは、使えないブロックがあっても検査しない（S8・コメントと同じ扱い）', () => {
        const ws = workspace();
        ws.script(ws.add('sensing_resettimer'));
        const key = ws.top(ws.add('event_whenkeypressed', { fields: { KEY_OPTION: 'space' } }));
        const list = ws.add('data_addtolist', {
            fields: { LIST: { id: 'l', value: 'リスト' } },
            inputs: { ITEM: ws.txt('a') },
        });
        ws.stack(key, list);
        ws.top(ws.add('procedures_call'));
        ws.top(ws.add('looks_say', { inputs: { MESSAGE: ws.txt('hi') } }));
        ws.top(ws.add('smalrubotS1_studuinoServo', { fields: { PORT: 'D2' }, inputs: { ANGLE: ws.num(90) } }));
        expect(mainOf(ws)).toEqual([{ op: 'timer_reset' }]);
    });

    test('旗の下に無いスクリプトの変数は数えない（変数の上限にも入らない）', () => {
        const ws = workspace();
        const variables = {};
        const loose = [];
        for (let i = 0; i <= STUDUINO_IR_LIMITS.maxVariables; i++) {
            variables[`g${i}`] = { id: `g${i}`, name: `n${i}`, type: '', value: 0 };
            loose.push(
                ws.add('data_changevariableby', {
                    fields: { VARIABLE: { id: `g${i}`, value: `n${i}` } },
                    inputs: { VALUE: ws.num(1) },
                }),
            );
        }
        ws.top(loose[0]);
        ws.stack(...loose);
        ws.script(ws.add('sensing_resettimer'));
        const result = build(ws, { variables });
        expect(result.ok).toBe(true);
        expect(result.ir.variables).toEqual([]);
    });

    test('通常モードの拡張機能のブロック（ポートが決まっているもの）は使えない', () => {
        const ws = workspace();
        const old = ws.add('smalrubotS1_ledOn');
        ws.script(old);
        expect(errorsOf(ws)).toEqual([{ blockId: old, targetId: 'stage', reason: 'unsupported_block' }]);
    });

    test('数の所に文字を入れたら string_value', () => {
        const ws = workspace();
        const set = ws.add('data_setvariableto', {
            fields: { VARIABLE: { id: 'g', value: 'あ' } },
            inputs: { VALUE: ws.txt('こんにちは') },
        });
        ws.script(set);
        expect(errorsOf(ws, { variables: { g: { id: 'g', name: 'あ', type: '', value: 0 } } })).toEqual([
            { blockId: set, targetId: 'stage', reason: 'string_value' },
        ]);
    });

    test('ばらばらのスクリプトの中の文字は検査しない', () => {
        const ws = workspace();
        ws.script(ws.add('sensing_resettimer'));
        ws.top(ws.add('operator_lt', { inputs: { OPERAND1: ws.txt('a'), OPERAND2: ws.txt('1') } }));
        expect(mainOf(ws)).toEqual([{ op: 'timer_reset' }]);
    });

    test('真偽の所に数のブロックが来たら not_boolean', () => {
        const ws = workspace();
        const v = ws.add('sensing_timer');
        ws.script(ws.add('control_if', { inputs: { CONDITION: ws.cond(v) } }));
        expect(errorsOf(ws)).toEqual([{ blockId: v, targetId: 'stage', reason: 'not_boolean' }]);
    });

    test('無い変数・リストの変数は unknown_variable', () => {
        const ws = workspace();
        const a = ws.add('data_variable', { fields: { VARIABLE: { id: 'none', value: 'x' } } });
        const b = ws.add('data_variable', { fields: { VARIABLE: { id: 'list', value: 'l' } } });
        ws.script(
            ws.add('control_wait', { inputs: { DURATION: ws.rep(a) } }),
            ws.add('control_wait', { inputs: { DURATION: ws.rep(b) } }),
        );
        expect(errorsOf(ws, { variables: { list: { id: 'list', name: 'l', type: 'list', value: [] } } })).toEqual([
            { blockId: a, targetId: 'stage', reason: 'unknown_variable' },
            { blockId: b, targetId: 'stage', reason: 'unknown_variable' },
        ]);
    });

    test.each([
        ['割り当てていないポート', { PORT: 'D2' }, 'port_not_assigned'],
        ['ポートが空', { PORT: '' }, 'port_not_assigned'],
        ['その部品でないポート', { PORT: 'A0' }, 'wrong_part'],
        ['知らないポート', { PORT: 'Z9' }, 'unknown_port'],
    ])('%s', (_name, fields, reason) => {
        const ws = workspace();
        const servo = ws.add('smalrubotS1_studuinoServo', { fields, inputs: { ANGLE: ws.num(90) } });
        ws.script(servo);
        expect(errorsOf(ws)).toEqual([{ blockId: servo, targetId: 'stage', reason }]);
    });

    test('ポートを外したセンサーは port_not_assigned', () => {
        const ws = workspace();
        const light = ws.add('smalrubotS1_studuinoLightSensor', { fields: { PORT: 'A6' } });
        ws.script(ws.add('control_wait', { inputs: { DURATION: ws.rep(light) } }));
        const settings = { ...SETTINGS, ports: { ...SETTINGS.ports } };
        delete settings.ports.A6;
        expect(errorsOf(ws, { settings })).toEqual([
            { blockId: light, targetId: 'stage', reason: 'port_not_assigned' },
        ]);
    });

    test('知らないメニューの値は unknown_value', () => {
        const ws = workspace();
        const dir = ws.add('smalrubotS1_studuinoDcMotorDirection', { fields: { PORT: 'M1', DIRECTION: 'sideways' } });
        ws.script(dir);
        expect(errorsOf(ws)).toEqual([{ blockId: dir, targetId: 'stage', reason: 'unknown_value' }]);
    });

    test('2 つのサーボが同じポートなら duplicate_port', () => {
        const ws = workspace();
        const pair = ws.add('smalrubotS1_studuinoServoPair', {
            fields: { PORT1: 'D9', PORT2: 'D9' },
            inputs: { ANGLE1: ws.num(0), ANGLE2: ws.num(90) },
        });
        ws.script(pair);
        expect(errorsOf(ws)).toEqual([{ blockId: pair, targetId: 'stage', reason: 'duplicate_port' }]);
    });

    test('変数が 32 をこえたら too_large（S1）', () => {
        const ws = workspace();
        const variables = {};
        const stmts = [];
        for (let i = 0; i <= STUDUINO_IR_LIMITS.maxVariables; i++) {
            variables[`g${i}`] = { id: `g${i}`, name: `n${i}`, type: '', value: 0 };
            stmts.push(
                ws.add('data_changevariableby', {
                    fields: { VARIABLE: { id: `g${i}`, value: `n${i}` } },
                    inputs: { VALUE: ws.num(1) },
                }),
            );
        }
        ws.script(...stmts);
        expect(errorsOf(ws, { variables })).toEqual([
            {
                blockId: stmts[STUDUINO_IR_LIMITS.maxVariables],
                targetId: 'stage',
                reason: 'too_large',
                detail: 'too_many_variables',
                limit: 32,
            },
        ]);
    });

    test('入れ子が深さの上限をこえたら too_large（いちばん近いブロックを示す）', () => {
        const ws = workspace();
        let inner = ws.add('sensing_resettimer');
        const ids = [inner];
        for (let i = 0; i < STUDUINO_IR_LIMITS.maxDepth; i++) {
            inner = ws.add('control_forever', { inputs: { SUBSTACK: ws.sub(inner) } });
            ids.push(inner);
        }
        ws.script(inner);
        const errors = errorsOf(ws);
        expect(errors).toEqual([
            { blockId: ids[0], targetId: 'stage', reason: 'too_large', detail: 'too_deep', limit: 100 },
        ]);
    });

    test('ノードの数が上限をこえたら too_large', () => {
        const ws = workspace();
        const stmts = [];
        for (let i = 0; i < STUDUINO_IR_LIMITS.maxNodes / 2 + 1; i++) {
            stmts.push(ws.add('control_wait', { inputs: { DURATION: ws.num(1) } }));
        }
        ws.script(...stmts);
        const [error] = errorsOf(ws);
        expect(error).toMatchObject({ reason: 'too_large', detail: 'too_many_nodes', limit: 10000 });
        expect(error.blockId).toBe(stmts[stmts.length - 1]);
    });
});

describe('buildStuduinoIr: 本文の大きさ', () => {
    test('ノードは上限の中でも、本文が 128KB をこえたら too_large', () => {
        const ws = workspace();
        const stmts = [];
        for (let i = 0; i < 4000; i++) {
            stmts.push(ws.add('control_wait', { inputs: { DURATION: ws.num('0.1234567890123456') } }));
        }
        ws.script(...stmts);
        const result = build(ws);
        expect(result).toEqual({
            ok: false,
            errors: [{ blockId: null, targetId: null, reason: 'too_large', detail: 'too_many_bytes', limit: 131072 }],
            warnings: [],
        });
    });
});

describe('measureStuduinoIr（Lambda の validateIr と同じ数え方）', () => {
    test('文・式・リテラル・変数をノードとして数え、main の文を深さ 1 にする', () => {
        const ir = {
            main: [
                { op: 'timer_reset' },
                {
                    op: 'repeat',
                    times: { num: 3 },
                    body: [
                        {
                            op: 'servo_multi',
                            items: [
                                { port: 'D9', angle: { op: '+', a: { var: 'v0' }, b: { num: 1 } } },
                                { port: 'D10', angle: { num: 0 } },
                            ],
                        },
                    ],
                },
            ],
        };
        // timer_reset 1・repeat 1・num 1・servo_multi 1・+ 1・var 1・num 1・num 1
        expect(measureStuduinoIr(ir)).toEqual({ nodes: 8, depth: 4, over: null });
    });
});

describe('buildStuduinoIrFromVm', () => {
    test('元のターゲットだけ（クローンを除く）から作る', () => {
        const ws = workspace();
        ws.script(ws.add('sensing_resettimer'));
        const clone = workspace();
        clone.script();
        const vm = {
            runtime: {
                targets: [
                    { id: 'stage', isStage: true, isOriginal: true, blocks: { _blocks: ws.blocks }, variables: {} },
                    {
                        id: 'clone',
                        isStage: false,
                        isOriginal: false,
                        blocks: { _blocks: clone.blocks },
                        variables: {},
                    },
                ],
            },
        };
        const result = buildStuduinoIrFromVm(vm, SETTINGS);
        expect(result.ok).toBe(true);
        expect(result.ir.main).toEqual([{ op: 'timer_reset' }]);
    });
});

describe('buildStuduinoIr: 警告と使われる旗（#2353・S7・S17）', () => {
    test('はじめの値が文字の変数は 0 にして、はじめて使ったブロックで警告する', () => {
        const ws = workspace();
        const sprite = workspace();
        const first = sprite.add('data_changevariableby', {
            fields: { VARIABLE: { id: 'global', value: 'y' } },
            inputs: { VALUE: sprite.num(1) },
        });
        sprite.script(
            first,
            sprite.add('data_changevariableby', {
                fields: { VARIABLE: { id: 'global', value: 'y' } },
                inputs: { VALUE: sprite.num(2) },
            }),
            sprite.add('data_setvariableto', {
                fields: { VARIABLE: { id: 'ok', value: 'z' } },
                inputs: { VALUE: sprite.num(2) },
            }),
        );
        const result = buildStuduinoIr({
            targets: [
                stageWith(ws, {
                    global: { id: 'global', name: 'y', type: '', value: 'abc' },
                    ok: { id: 'ok', name: 'z', type: '', value: '3' },
                }),
                { id: 'sprite1', isStage: false, blocks: sprite.blocks, variables: {} },
            ],
            settings: SETTINGS,
        });
        expect(result.ok).toBe(true);
        expect(result.ir.variables[0]).toEqual({ id: 'v0', init: 0 });
        expect(result.warnings).toEqual([
            { blockId: first, targetId: 'sprite1', reason: 'string_initial_value', variable: 'y' },
        ]);
        // 変数の名前は構文木には入れない
        expect(JSON.stringify(result.ir)).not.toMatch(/abc/);
    });

    test('旗の下にない変数は書きこまないので警告しない', () => {
        const ws = workspace();
        ws.script(ws.add('sensing_resettimer'));
        ws.top(
            ws.add('data_changevariableby', {
                fields: { VARIABLE: { id: 'g', value: 'y' } },
                inputs: { VALUE: ws.num(1) },
            }),
        );
        const result = build(ws, { variables: { g: { id: 'g', name: 'y', type: '', value: 'abc' } } });
        expect(result.warnings).toEqual([]);
    });

    test('旗が 2 つ以上なら、使われる旗（1 つ目）を usedFlag で返す', () => {
        const ws = workspace();
        const sprite = workspace();
        const first = ws.script();
        sprite.script();
        const result = buildStuduinoIr({
            targets: [stageWith(ws), { id: 's1', isStage: false, blocks: sprite.blocks, variables: {} }],
            settings: SETTINGS,
        });
        expect(result.ok).toBe(false);
        expect(result.usedFlag).toEqual({ blockId: first, targetId: 'stage' });
    });
});
