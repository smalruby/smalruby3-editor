import { DEFAULT_IR_LIMITS, PARTS_BY_PORT, validateIr } from '../ir';

/** docs/studuino-mode/README.md の「構文木」の例。 */
const docExample = () => ({
  version: 1,
  board: 'studuino',
  ports: { M1: 'dc_motor', D9: 'servo_motor', A0: 'led', A6: 'light_sensor', A2: 'touch_sensor' },
  calibration: { dcMotor: { M1: 100, M2: 100 }, servoMotor: { D9: 0 } },
  variables: [{ id: 'v0', init: 0 }],
  main: [
    {
      op: 'forever',
      body: [
        {
          op: 'if',
          cond: { op: '<', a: { op: 'sensor', kind: 'light_sensor', port: 'A6' }, b: { num: 300 } },
          then: [{ op: 'led', port: 'A0', on: true }],
          else: [{ op: 'led', port: 'A0', on: false }],
        },
        { op: 'change', var: 'v0', by: { num: 1 } },
        { op: 'wait', secs: { num: 0.5 } },
      ],
    },
  ],
});

const withMain = (main: unknown[], over: Record<string, unknown> = {}) => ({ ...docExample(), main, ...over });

const rejected = (ir: unknown) => {
  const r = validateIr(ir);
  if (r.ok) throw new Error('expected rejection');
  return r;
};

describe('validateIr: 通るもの', () => {
  test('docs の例が通り、ノードの数と深さを数える', () => {
    const r = validateIr(docExample());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.program.ports).toEqual(docExample().ports);
    expect(r.program.variables).toEqual([{ id: 'v0', init: 0 }]);
    expect(r.nodes).toBe(11);
    expect(r.depth).toBe(4);
  });

  test('calibration と variables は省略できる', () => {
    const r = validateIr({ version: 1, board: 'studuino', ports: {}, main: [] });
    expect(r).toMatchObject({ ok: true, program: { calibration: { dcMotor: {}, servoMotor: {} }, variables: [] } });
  });

  test('第 1 弾の op がすべて通る', () => {
    const ir = {
      version: 1,
      board: 'studuino',
      ports: { M1: 'dc_motor', D9: 'servo_motor', D10: 'servo_motor', A0: 'led', A1: 'buzzer', A2: 'touch_sensor', A3: 'push_switch', A6: 'light_sensor', A7: 'temperature_sensor', A4: 'sound_sensor', A5: 'ir_photoreflector' },
      variables: [{ id: 'v0', init: 1.5 }, { id: 'v12' }],
      main: [
        { op: 'timer_reset' },
        { op: 'set', var: 'v0', value: { op: 'random', a: { num: 1 }, b: { num: 10 } } },
        { op: 'change', var: 'v12', by: { op: '%', a: { var: 'v0' }, b: { num: -3 } } },
        { op: 'repeat', times: { op: 'round', a: { op: '/', a: { num: 7 }, b: { num: 2 } } }, body: [{ op: 'wait', secs: { op: 'timer' } }] },
        { op: 'wait_until', cond: { op: 'button', kind: 'push_switch', port: 'A3' } },
        {
          op: 'repeat_until',
          cond: { op: 'or', a: { op: 'not', a: { op: 'button', kind: 'touch_sensor', port: 'A2' } }, b: { bool: false } },
          body: [
            { op: 'dc_motor_speed', port: 'M1', speed: { op: '*', a: { num: 2 }, b: { op: '-', a: { num: 100 }, b: { op: '+', a: { num: 1 }, b: { num: 2 } } } } },
            { op: 'dc_motor_dir', port: 'M1', dir: 'reverse' },
            { op: 'dc_motor_stop', port: 'M1', mode: 'coast' },
            { op: 'servo', port: 'D9', angle: { num: 90 } },
            { op: 'servo_multi', items: [{ port: 'D9', angle: { num: 0 } }, { port: 'D10', angle: { num: 180 } }], msPerDegree: 3 },
            { op: 'servo_multi', items: [{ port: 'D10', angle: { num: 45 } }] },
            { op: 'buzzer_on', port: 'A1', pitch: { op: 'sensor', kind: 'sound_sensor', port: 'A4' } },
            { op: 'buzzer_off', port: 'A1' },
            { op: 'if', cond: { op: 'and', a: { op: '>', a: { op: 'sensor', kind: 'temperature_sensor', port: 'A7' }, b: { num: 0 } }, b: { op: '=', a: { op: 'sensor', kind: 'ir_photoreflector', port: 'A5' }, b: { op: 'to_num', a: { bool: true } } } }, then: [] },
          ],
        },
      ],
    };
    expect(validateIr(ir)).toMatchObject({ ok: true });
  });
});

describe('validateIr: 拒否するもの', () => {
  test.each([
    ['オブジェクトでない', [], '', 'not_an_object'],
    ['知らない版', { ...docExample(), version: 2 }, 'version', 'unknown_version'],
    ['知らない基板', { ...docExample(), board: 'arduino' }, 'board', 'unknown_board'],
    ['第 2 弾の lists', { ...docExample(), lists: [] }, 'lists', 'unknown_key'],
    ['第 2 弾の functions', { ...docExample(), functions: [] }, 'functions', 'unknown_key'],
    ['main が無い', { version: 1, board: 'studuino', ports: {} }, 'main', 'missing_key'],
    ['知らないポート', { ...docExample(), ports: { A8: 'led' } }, 'ports.A8', 'unknown_port'],
    ['ポートに合わない部品', { ...docExample(), ports: { A6: 'led' } }, 'ports.A6', 'unknown_part'],
    ['A4 のボタン（十字ボタンは A0〜A3 だけ）', { ...docExample(), ports: { A4: 'push_switch' } }, 'ports.A4', 'unknown_part'],
    ['知らない部品', { ...docExample(), ports: { A0: 'laser' } }, 'ports.A0', 'unknown_part'],
    ['DC モーターの補正値の範囲', { ...docExample(), calibration: { dcMotor: { M1: 101 } } }, 'calibration.dcMotor.M1', 'out_of_range'],
    ['サーボの補正値の範囲', { ...docExample(), calibration: { servoMotor: { D9: -16 } } }, 'calibration.servoMotor.D9', 'out_of_range'],
    ['サーボの補正値は整数', { ...docExample(), calibration: { servoMotor: { D9: 1.5 } } }, 'calibration.servoMotor.D9', 'out_of_range'],
    ['補正値の知らないポート', { ...docExample(), calibration: { servoMotor: { M1: 0 } } }, 'calibration.servoMotor.M1', 'unknown_port'],
    ['変数の ID の形', { ...docExample(), variables: [{ id: 'score' }] }, 'variables[0].id', 'invalid_variable_id'],
    ['変数の ID の重なり', { ...docExample(), variables: [{ id: 'v0' }, { id: 'v0' }] }, 'variables[1].id', 'duplicate_variable'],
    ['変数の初期値が文字列', { ...docExample(), variables: [{ id: 'v0', init: '1' }] }, 'variables[0].init', 'not_a_number'],
  ])('%s', (_name, ir, path, reason) => {
    expect(rejected(ir)).toMatchObject({ error: 'invalid_ir', path, reason });
  });

  test.each([
    ['知らない文の op', [{ op: 'say', text: 'hi' }], 'main[0].op', 'unknown_op'],
    ['プロトタイプの名前の op', [{ op: 'constructor' }], 'main[0].op', 'unknown_op'],
    ['文の知らないキー', [{ op: 'timer_reset', name: 'x' }], 'main[0].name', 'unknown_key'],
    ['文のキーが足りない', [{ op: 'wait' }], 'main[0].secs', 'missing_key'],
    ['式の知らない op', [{ op: 'wait', secs: { op: 'sqrt', a: { num: 4 } } }], 'main[0].secs.op', 'unknown_op'],
    ['文字列のリテラル', [{ op: 'wait', secs: { str: '1' } }], 'main[0].secs.op', 'unknown_op'],
    ['数の所に文字列', [{ op: 'wait', secs: { num: '1' } }], 'main[0].secs.num', 'not_a_number'],
    ['数の所に真偽', [{ op: 'wait', secs: { bool: true } }], 'main[0].secs', 'type_mismatch:number'],
    ['真偽の所に数', [{ op: 'if', cond: { num: 1 }, then: [] }], 'main[0].cond', 'type_mismatch:bool'],
    ['かつに数', [{ op: 'if', cond: { op: 'and', a: { num: 1 }, b: { bool: true } }, then: [] }], 'main[0].cond.a', 'type_mismatch:bool'],
    ['比べるに真偽', [{ op: 'if', cond: { op: '<', a: { bool: true }, b: { num: 1 } }, then: [] }], 'main[0].cond.a', 'type_mismatch:number'],
    ['宣言していない変数', [{ op: 'set', var: 'v9', value: { num: 1 } }], 'main[0].var', 'unknown_variable'],
    ['変数の名前（利用者の文字列）', [{ op: 'set', var: 'x; system("rm")', value: { num: 1 } }], 'main[0].var', 'invalid_variable_id'],
    ['割り当てていないポート', [{ op: 'led', port: 'A1', on: true }], 'main[0].port', 'port_not_assigned'],
    ['部品の違うポート', [{ op: 'servo', port: 'A0', angle: { num: 1 } }], 'main[0].port', 'wrong_part'],
    ['センサーの種類とポートの部品が違う', [{ op: 'wait', secs: { op: 'sensor', kind: 'sound_sensor', port: 'A6' } }], 'main[0].secs.port', 'wrong_part'],
    ['センサーの知らない種類', [{ op: 'wait', secs: { op: 'sensor', kind: 'led', port: 'A0' } }], 'main[0].secs.kind', 'unknown_part'],
    ['向きの知らない値', [{ op: 'dc_motor_dir', port: 'M1', dir: 'left' }], 'main[0].dir', 'unknown_value'],
    ['LED のオンが真偽でない', [{ op: 'led', port: 'A0', on: 1 }], 'main[0].on', 'not_a_bool'],
    ['まとめて動かすのポートの重なり', [{ op: 'servo_multi', items: [{ port: 'D9', angle: { num: 0 } }, { port: 'D9', angle: { num: 1 } }] }], 'main[0].items[1].port', 'duplicate_port'],
    ['まとめて動かすが空', [{ op: 'servo_multi', items: [] }], 'main[0].items', 'out_of_range'],
    ['1 度あたりの時間が 3 ms より短い', [{ op: 'servo_multi', items: [{ port: 'D9', angle: { num: 0 } }], msPerDegree: 2 }], 'main[0].msPerDegree', 'out_of_range'],
    ['body が配列でない', [{ op: 'forever', body: {} }], 'main[0].body', 'not_a_list'],
  ])('%s', (_name, main, path, reason) => {
    expect(rejected(withMain(main))).toMatchObject({ error: 'invalid_ir', path, reason });
  });

  test('ノードの数の上限をこえたら too_large', () => {
    const main = Array.from({ length: 6 }, () => ({ op: 'timer_reset' }));
    const r = validateIr(withMain(main), { ...DEFAULT_IR_LIMITS, maxNodes: 5 });
    expect(r).toMatchObject({ ok: false, error: 'too_large', reason: 'too_many_nodes', limit: 5, path: 'main[5]' });
  });

  test('入れ子の深さの上限をこえたら too_large', () => {
    let stmt: Record<string, unknown> = { op: 'timer_reset' };
    for (let i = 0; i < 4; i++) stmt = { op: 'forever', body: [stmt] };
    expect(validateIr(withMain([stmt]), { ...DEFAULT_IR_LIMITS, maxDepth: 4 })).toMatchObject({
      ok: false,
      error: 'too_large',
      reason: 'too_deep',
      limit: 4,
    });
    expect(validateIr(withMain([stmt]), { ...DEFAULT_IR_LIMITS, maxDepth: 5 })).toMatchObject({ ok: true });
  });

  test('変数の数の上限をこえたら too_large', () => {
    const variables = Array.from({ length: 3 }, (_, i) => ({ id: `v${i}` }));
    expect(validateIr(withMain([], { variables }), { ...DEFAULT_IR_LIMITS, maxVariables: 2 })).toMatchObject({
      ok: false,
      error: 'too_large',
      reason: 'too_many_variables',
    });
  });

  test('既定の上限は S12 の値（ノード 10,000・深さ 100）', () => {
    expect(DEFAULT_IR_LIMITS).toMatchObject({ maxNodes: 10_000, maxDepth: 100 });
  });

  test('とても深い入れ子でもスタックをあふれさせずに拒否する', () => {
    let expr: Record<string, unknown> = { num: 1 };
    for (let i = 0; i < 5000; i++) expr = { op: 'round', a: expr };
    expect(rejected(withMain([{ op: 'wait', secs: expr }]))).toMatchObject({ error: 'too_large', reason: 'too_deep' });
  });
});

describe('PARTS_BY_PORT（docs の「ポートごとに選べる部品」）', () => {
  test('ボタンは A0〜A3 だけ、A6・A7 はアナログのセンサーだけ', () => {
    expect(PARTS_BY_PORT.A3).toContain('push_switch');
    expect(PARTS_BY_PORT.A4).not.toContain('push_switch');
    expect(PARTS_BY_PORT.A6).toEqual(['light_sensor', 'sound_sensor', 'ir_photoreflector', 'temperature_sensor']);
    expect(PARTS_BY_PORT.D12).toEqual(['servo_motor']);
    expect(PARTS_BY_PORT.M2).toEqual(['dc_motor']);
  });
});
