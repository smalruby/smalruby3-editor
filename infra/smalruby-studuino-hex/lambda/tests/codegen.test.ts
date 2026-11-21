import { cppNumber, emitExpr, generateSketch, PART_ID, PORT_CONSTANT } from '../codegen';
import { PARTS_BY_PORT, validateIr, type Expr, type Program } from '../ir';

const program = (ir: Record<string, unknown>): Program => {
  const r = validateIr({ version: 1, board: 'studuino', ports: {}, main: [], ...ir });
  if (!r.ok) throw new Error(`${r.path}: ${r.reason}`);
  return r.program;
};

/** sr_main() の本体の行（字下げを取ったもの）。 */
const mainLines = (ir: Record<string, unknown>): string[] => {
  const src = generateSketch(program(ir));
  const body = src.split('static void sr_main() {\n')[1].split('\n}\n')[0];
  return body.split('\n').map(l => l.trim());
};

const ALL_PORTS = {
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
};

describe('cppNumber', () => {
  test.each([
    [0, '0.0'],
    [-0, '0.0'],
    [300, '300.0'],
    [0.5, '0.5'],
    [-3, '(-3.0)'],
    [-2.5, '(-2.5)'],
    [1e21, '1e+21'],
    [1e-7, '1e-7'],
  ])('%p → %s', (n, s) => expect(cppNumber(n)).toBe(s));

  test('有限でない数は書き出さない', () => {
    expect(() => cppNumber(Number.NaN)).toThrow();
    expect(() => cppNumber(Infinity)).toThrow();
  });
});

describe('式の書き出し（docs の「式の op と C++ の書き出し」）', () => {
  const ports = { A2: 'touch_sensor', A3: 'push_switch', A6: 'light_sensor', A4: 'sound_sensor', A5: 'ir_photoreflector', A7: 'temperature_sensor' };
  const expr = (e: unknown): string => {
    const p = program({ ports, variables: [{ id: 'v0' }], main: [{ op: 'wait', secs: e }] });
    return emitExpr((p.main[0] as { secs: Expr }).secs);
  };
  const cond = (e: unknown): string => {
    const p = program({ ports, variables: [{ id: 'v0' }], main: [{ op: 'wait_until', cond: e }] });
    return emitExpr((p.main[0] as { cond: Expr }).cond);
  };
  const a = { num: 1 };
  const b = { var: 'v0' };

  test.each([
    [{ op: '+', a, b }, '(1.0 + sr_v0)'],
    [{ op: '-', a, b }, '(1.0 - sr_v0)'],
    [{ op: '*', a, b }, '(1.0 * sr_v0)'],
    [{ op: '/', a, b }, '(1.0 / sr_v0)'],
    [{ op: '%', a, b }, 'sr_mod(1.0, sr_v0)'],
    [{ op: 'random', a, b }, 'sr_random(1.0, sr_v0)'],
    [{ op: 'round', a: b }, 'sr_round(sr_v0)'],
    [{ op: 'to_num', a: { bool: true } }, '(true ? 1.0 : 0.0)'],
    [{ op: 'timer' }, 'sr_timer()'],
    [{ op: 'sensor', kind: 'light_sensor', port: 'A6' }, '((double)board.GetLightSensorValue(PORT_A6))'],
    [{ op: 'sensor', kind: 'sound_sensor', port: 'A4' }, '((double)board.GetSoundSensorValue(PORT_A4))'],
    [{ op: 'sensor', kind: 'ir_photoreflector', port: 'A5' }, '((double)board.GetIRPhotoreflectorValue(PORT_A5))'],
    [{ op: 'sensor', kind: 'temperature_sensor', port: 'A7' }, '((double)board.GetTemperatureSensorValue(PORT_A7))'],
  ])('数の式 %j', (e, out) => expect(expr(e)).toBe(out));

  test.each([
    [{ op: '<', a, b }, '(1.0 < sr_v0)'],
    [{ op: '>', a, b }, '(1.0 > sr_v0)'],
    [{ op: '=', a, b }, '(1.0 == sr_v0)'],
    [{ op: 'and', a: { bool: true }, b: { bool: false } }, '(true && false)'],
    [{ op: 'or', a: { bool: true }, b: { bool: false } }, '(true || false)'],
    [{ op: 'not', a: { bool: true } }, '(!true)'],
    // 0 が「押した」なので反転する
    [{ op: 'button', kind: 'touch_sensor', port: 'A2' }, '(board.GetTouchSensorValue(PORT_A2) == 0)'],
    [{ op: 'button', kind: 'push_switch', port: 'A3' }, '(board.GetPushSwitchValue(PORT_A3) == 0)'],
  ].map(([e, out]) => [e, out] as const))('真偽の式 %j', (e, out) => {
    expect(cond(e)).toBe(out);
  });
});

describe('文の書き出し（docs の「文の op と C++ の書き出し」）', () => {
  const lines = (stmt: unknown) => mainLines({ ports: ALL_PORTS, variables: [{ id: 'v0' }], main: [stmt] });

  test.each([
    [{ op: 'wait', secs: { num: 0.5 } }, ['board.Timer((float)sr_clamp(0.5, 0.0, 1000000.0));']],
    [{ op: 'forever', body: [] }, ['for (;;) {', '}']],
    [{ op: 'wait_until', cond: { bool: true } }, ['while (!true) {', '}']],
    [{ op: 'repeat_until', cond: { bool: false }, body: [{ op: 'timer_reset' }] }, ['while (!false) {', 'sr_timer_start = millis();', '}']],
    [{ op: 'if', cond: { bool: true }, then: [{ op: 'timer_reset' }] }, ['if (true) {', 'sr_timer_start = millis();', '}']],
    [
      { op: 'if', cond: { bool: true }, then: [], else: [{ op: 'timer_reset' }] },
      ['if (true) {', '} else {', 'sr_timer_start = millis();', '}'],
    ],
    [{ op: 'set', var: 'v0', value: { num: 3 } }, ['sr_v0 = 3.0;']],
    [{ op: 'change', var: 'v0', by: { num: -1 } }, ['sr_v0 += (-1.0);']],
    [{ op: 'timer_reset' }, ['sr_timer_start = millis();']],
    [{ op: 'dc_motor_speed', port: 'M2', speed: { num: 200 } }, ['board.DCMotorPower(PORT_M2, (byte)sr_round(sr_clamp(200.0, 0.0, 255.0)));']],
    [{ op: 'dc_motor_dir', port: 'M1', dir: 'normal' }, ['board.DCMotorControl(PORT_M1, NORMAL);']],
    [{ op: 'dc_motor_dir', port: 'M1', dir: 'reverse' }, ['board.DCMotorControl(PORT_M1, REVERSE);']],
    [{ op: 'dc_motor_stop', port: 'M1', mode: 'brake' }, ['board.DCMotorControl(PORT_M1, BRAKE);']],
    [{ op: 'dc_motor_stop', port: 'M1', mode: 'coast' }, ['board.DCMotorControl(PORT_M1, COAST);']],
    [{ op: 'servo', port: 'D9', angle: { num: 90 } }, ['board.Servomotor(PORT_D9, (byte)sr_round(sr_clamp(90.0, 0.0, 180.0)));']],
    [
      { op: 'servo_multi', items: [{ port: 'D9', angle: { num: 0 } }, { port: 'D10', angle: { num: 180 } }] },
      [
        '{',
        'byte sr_ports[] = { PORT_D9, PORT_D10 };',
        'byte sr_degrees[] = { (byte)sr_round(sr_clamp(0.0, 0.0, 180.0)), (byte)sr_round(sr_clamp(180.0, 0.0, 180.0)) };',
        'board.AsyncServomotors(sr_ports, sr_degrees, 2);',
        '}',
      ],
    ],
    [{ op: 'led', port: 'A0', on: true }, ['board.LED(PORT_A0, ON);']],
    [{ op: 'led', port: 'A0', on: false }, ['board.LED(PORT_A0, OFF);']],
    [{ op: 'buzzer_on', port: 'A1', pitch: { num: 440 } }, ['board.BuzzerControl(PORT_A1, ON, (word)sr_round(sr_clamp(440.0, 130.0, 4186.0)));']],
    [{ op: 'buzzer_off', port: 'A1' }, ['board.BuzzerControl(PORT_A1, OFF, 0);']],
  ])('%j', (stmt, out) => expect(lines(stmt)).toEqual(out));

  test('まとめて動かすで 1 度あたりの時間があれば SyncServomotors', () => {
    expect(lines({ op: 'servo_multi', items: [{ port: 'D9', angle: { num: 10 } }], msPerDegree: 5 })).toContain(
      'board.SyncServomotors(sr_ports, sr_degrees, 1, 5);',
    );
  });

  test('〜回繰り返すは四捨五入した回数で、入れ子でもループの変数が重ならない', () => {
    const out = lines({ op: 'repeat', times: { num: 2.5 }, body: [{ op: 'repeat', times: { num: 3 }, body: [] }] });
    expect(out).toEqual([
      'for (long sr_i0 = 0, sr_n0 = (long)sr_round(2.5); sr_i0 < sr_n0; sr_i0++) {',
      'for (long sr_i1 = 0, sr_n1 = (long)sr_round(3.0); sr_i1 < sr_n1; sr_i1++) {',
      '}',
      '}',
    ]);
  });
});

describe('スケッチの全体', () => {
  test('include・board・変数・setup の初期化と補正値・main を 1 回・空の loop', () => {
    const src = generateSketch(
      program({
        ports: { A6: 'light_sensor', M1: 'dc_motor', D9: 'servo_motor', A0: 'led' },
        calibration: { dcMotor: { M2: 90 }, servoMotor: { D9: -5, D12: 3 } },
        variables: [{ id: 'v0', init: 0 }, { id: 'v1', init: -1.5 }],
        main: [{ op: 'led', port: 'A0', on: true }],
      }),
    );
    expect(src).toContain('#include <Studuino.h>');
    expect(src.indexOf('#include <Arduino.h>')).toBeLessThan(src.indexOf('#include <Studuino.h>'));
    expect(src).toContain('Studuino board;');
    expect(src).toContain('double sr_v0 = 0.0;');
    expect(src).toContain('double sr_v1 = (-1.5);');
    // ポートは表の順に初期化する（構文木のキーの順に左右されない）
    const setup = src.split('void setup() {\n')[1].split('\n}\n')[0].split('\n').map(l => l.trim());
    expect(setup).toEqual([
      'board.InitServomotorPort(PORT_D9);',
      'board.InitDCMotorPort(PORT_M1);',
      'board.InitSensorPort(PORT_A0, PIDLED);',
      'board.InitSensorPort(PORT_A6, PIDLIGHTSENSOR);',
      '{ byte sr_rate[] = { 100, 90 }; board.SetDCMotorCalibration(sr_rate); }',
      '{ char sr_offsets[] = { 0, 0, 0, 0, -5, 0, 0, 3 }; board.SetServomotorCalibration(sr_offsets); }',
      'randomSeed(analogRead(7) ^ micros());',
      'sr_timer_start = millis();',
      'sr_main();',
    ]);
    expect(src).toMatch(/void loop\(\) \{\n\}\n$/);
  });

  test('補正値がはじめの値（省略）なら補正の行を出さない', () => {
    const src = generateSketch(program({ ports: { M1: 'dc_motor' } }));
    expect(src).not.toContain('SetDCMotorCalibration');
    expect(src).not.toContain('SetServomotorCalibration');
  });

  test('すべてのポート・部品に定数と部品 ID がある', () => {
    for (const [p, kinds] of Object.entries(PARTS_BY_PORT)) {
      expect(PORT_CONSTANT[p as keyof typeof PORT_CONSTANT]).toBe(`PORT_${p}`);
      for (const k of kinds) {
        if (k !== 'servo_motor' && k !== 'dc_motor') expect(PART_ID[k]).toMatch(/^PID[A-Z]+$/);
      }
    }
  });

  test('利用者の文字列が入りうる値は C++ に出ない（ID・数・決まった名前だけ）', () => {
    const src = generateSketch(
      program({
        ports: ALL_PORTS,
        variables: [{ id: 'v0' }],
        main: [{ op: 'set', var: 'v0', value: { num: 1 } }],
      }),
    );
    // 識別子は sr_ / board / ライブラリの名前だけ。文字列リテラルは出さない
    expect(src).not.toMatch(/"/);
  });
});

describe('fixtures/all-ops.request.json（stg で第 1 弾の op がすべてコンパイルできるかを試す本文）', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const request = require('./fixtures/all-ops.request.json') as { ir: unknown };

  test('検査を通り、第 1 弾の文と式の op をすべて使っている', () => {
    const r = validateIr(request.ir);
    expect(r.ok).toBe(true);
    const json = JSON.stringify(request.ir);
    const ops = new Set([...json.matchAll(/"op":"([^"]+)"/g)].map(m => m[1]));
    for (const op of [
      'wait', 'repeat', 'forever', 'if', 'wait_until', 'repeat_until', 'set', 'change', 'timer_reset',
      'dc_motor_speed', 'dc_motor_dir', 'dc_motor_stop', 'servo', 'servo_multi', 'led', 'buzzer_on', 'buzzer_off',
      '+', '-', '*', '/', '%', 'random', 'round', 'to_num', '<', '>', '=', 'and', 'or', 'not', 'sensor', 'button', 'timer',
    ]) {
      expect(ops).toContain(op);
    }
    if (r.ok) expect(generateSketch(r.program)).toContain('sr_main();');
  });
});
