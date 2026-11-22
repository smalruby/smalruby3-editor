/**
 * 検査した構文木（Studuino IR）を C++（Arduino のスケッチ）に書き出す（純粋関数・#2210）。
 *
 * validateIr を通った Program だけを受け取る。書き出すのは、op ごとの決まった形・ポートの定数の表・
 * `v0` などの変数の ID・数値のリテラルだけで、利用者の文字列は入らない（S8 = A）。
 * 表の正は docs/studuino-mode/README.md の「文の op と C++ の書き出し」。
 */
import {
  DC_MOTOR_CALIBRATION_ORDER,
  SERVO_CALIBRATION_ORDER,
  type Expr,
  type PartKind,
  type PortName,
  type Program,
  type Stmt,
} from './ir';

/** スケッチのフォルダとファイルの名前（`<name>/<name>.ino`）。 */
export const IR_SKETCH_NAME = 'studuino_program';

/**
 * 構文木のポート名 → ライブラリの定数の名前。定数は種類ごとに番号が重なる
 * （PORT_D9 = PORT_M1 = PORT_A0 = 0）ので、数値ではなく名前で書き出す。
 */
export const PORT_CONSTANT: Record<PortName, string> = {
  D2: 'PORT_D2',
  D4: 'PORT_D4',
  D7: 'PORT_D7',
  D8: 'PORT_D8',
  D9: 'PORT_D9',
  D10: 'PORT_D10',
  D11: 'PORT_D11',
  D12: 'PORT_D12',
  M1: 'PORT_M1',
  M2: 'PORT_M2',
  A0: 'PORT_A0',
  A1: 'PORT_A1',
  A2: 'PORT_A2',
  A3: 'PORT_A3',
  A4: 'PORT_A4',
  A5: 'PORT_A5',
  A6: 'PORT_A6',
  A7: 'PORT_A7',
};

/** `InitSensorPort` に渡す部品 ID（サーボ・DC モーターは別の初期化）。 */
export const PART_ID: Partial<Record<PartKind, string>> = {
  led: 'PIDLED',
  buzzer: 'PIDBUZZER',
  light_sensor: 'PIDLIGHTSENSOR',
  sound_sensor: 'PIDSOUNDSENSOR',
  ir_photoreflector: 'PIDIRPHOTOREFLECTOR',
  temperature_sensor: 'PIDTEMPERATURESENSOR',
  touch_sensor: 'PIDTOUCHSENSOR',
  push_switch: 'PIDPUSHSWITCH',
};

const SENSOR_FUNCTION: Partial<Record<PartKind, string>> = {
  light_sensor: 'GetLightSensorValue',
  sound_sensor: 'GetSoundSensorValue',
  ir_photoreflector: 'GetIRPhotoreflectorValue',
  temperature_sensor: 'GetTemperatureSensorValue',
};

const BUTTON_FUNCTION: Partial<Record<PartKind, string>> = {
  touch_sensor: 'GetTouchSensorValue',
  push_switch: 'GetPushSwitchValue',
};

/** 本体が include するので、使わない部品のものも含めてすべて並べる（リファレンスの組み合わせ）。 */
const INCLUDES = [
  'Arduino.h',
  'Servo.h',
  'Wire.h',
  'MMA8653.h',
  'MPU6050.h',
  'IRremoteForStuduino.h',
  'ColorSensor.h',
  'Studuino.h',
];

/**
 * Scratch の計算の決まりに合わせる補助関数。
 * - sr_mod: 余りの符号を割る数にそろえる（Scratch の「〜を〜で割った余り」）
 * - sr_round: 0.5 は切り上げ（JavaScript の Math.round と同じ）
 * - sr_random: 両方が整数なら整数、そうでなければ小数（Scratch の「〜から〜までの乱数」）
 */
const HELPERS = `static unsigned long sr_timer_start = 0;

static double sr_clamp(double v, double lo, double hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

static double sr_round(double v) {
  return floor(v + 0.5);
}

static double sr_mod(double a, double b) {
  double r = fmod(a, b);
  if (r != 0 && ((r < 0) != (b < 0))) r += b;
  return r;
}

static double sr_random(double a, double b) {
  double lo = a < b ? a : b;
  double hi = a < b ? b : a;
  if (lo == floor(lo) && hi == floor(hi)) {
    return lo + (double)random((long)(hi - lo) + 1);
  }
  return lo + (hi - lo) * ((double)random(0x7FFFFFFFL) / 2147483647.0);
}

static double sr_timer() {
  return (millis() - sr_timer_start) / 1000.0;
}`;

/**
 * 数値のリテラルを C++ の double のリテラルにする（検査で有限の数だけが来る）。
 * @param n - 数値
 * @returns C++ のリテラル
 */
export const cppNumber = (n: number): string => {
  if (!Number.isFinite(n)) throw new Error('not a finite number');
  const v = Object.is(n, -0) ? 0 : n;
  let s = String(v);
  if (!/[.e]/.test(s)) s += '.0';
  return v < 0 ? `(${s})` : s;
};

const varName = (id: string): string => {
  // 検査済み（v0〜v9999）。念のため形を確かめてから使う
  if (!/^v\d{1,4}$/.test(id)) throw new Error(`invalid variable id: ${id}`);
  return `sr_${id}`;
};

const port = (p: PortName): string => {
  const c = PORT_CONSTANT[p];
  if (!c) throw new Error(`unknown port: ${p}`);
  return c;
};

/**
 * 式を書き出す。
 * @param e - 式
 * @returns C++ の式
 */
export const emitExpr = (e: Expr): string => {
  if ('num' in e) return cppNumber(e.num);
  if ('bool' in e) return e.bool ? 'true' : 'false';
  if ('var' in e) return varName(e.var);
  switch (e.op) {
    case '+':
    case '-':
    case '*':
    case '/':
      return `(${emitExpr(e.a)} ${e.op} ${emitExpr(e.b)})`;
    case '%':
      return `sr_mod(${emitExpr(e.a)}, ${emitExpr(e.b)})`;
    case 'random':
      return `sr_random(${emitExpr(e.a)}, ${emitExpr(e.b)})`;
    case '<':
    case '>':
      return `(${emitExpr(e.a)} ${e.op} ${emitExpr(e.b)})`;
    case '=':
      return `(${emitExpr(e.a)} == ${emitExpr(e.b)})`;
    case 'and':
      return `(${emitExpr(e.a)} && ${emitExpr(e.b)})`;
    case 'or':
      return `(${emitExpr(e.a)} || ${emitExpr(e.b)})`;
    case 'not':
      return `(!${emitExpr(e.a)})`;
    case 'round':
      return `sr_round(${emitExpr(e.a)})`;
    case 'to_num':
      return `(${emitExpr(e.a)} ? 1.0 : 0.0)`;
    case 'sensor': {
      const fn = SENSOR_FUNCTION[e.kind];
      if (!fn) throw new Error(`unknown sensor: ${e.kind}`);
      return `((double)board.${fn}(${port(e.port)}))`;
    }
    case 'button': {
      const fn = BUTTON_FUNCTION[e.kind];
      if (!fn) throw new Error(`unknown button: ${e.kind}`);
      // ライブラリは 0 が「押した」・1 が「離した」なので反転する
      return `(board.${fn}(${port(e.port)}) == 0)`;
    }
    case 'timer':
      return 'sr_timer()';
    default:
      throw new Error(`unknown expression op: ${(e as { op: string }).op}`);
  }
};

/** 書き出しの途中の状態（ループの変数の名前を重ねないための番号）。 */
interface Emitter {
  lines: string[];
  loops: number;
}

const emitBlock = (em: Emitter, body: Stmt[], indent: string): void => {
  for (const s of body) emitStmt(em, s, indent);
};

/**
 * 文を書き出す。
 * @param em - 状態
 * @param s - 文
 * @param indent - 字下げ
 */
const emitStmt = (em: Emitter, s: Stmt, indent: string): void => {
  const out = (line: string) => em.lines.push(indent + line);
  const inner = `${indent}  `;
  switch (s.op) {
    case 'wait':
      out(`board.Timer((float)sr_clamp(${emitExpr(s.secs)}, 0.0, 1000000.0));`);
      return;
    case 'repeat': {
      const n = em.loops++;
      out(`for (long sr_i${n} = 0, sr_n${n} = (long)sr_round(${emitExpr(s.times)}); sr_i${n} < sr_n${n}; sr_i${n}++) {`);
      emitBlock(em, s.body, inner);
      out('}');
      return;
    }
    case 'forever':
      out('for (;;) {');
      emitBlock(em, s.body, inner);
      out('}');
      return;
    case 'if':
      out(`if (${emitExpr(s.cond)}) {`);
      emitBlock(em, s.then, inner);
      if (s.else && s.else.length > 0) {
        out('} else {');
        emitBlock(em, s.else, inner);
      }
      out('}');
      return;
    case 'wait_until':
      out(`while (!${emitExpr(s.cond)}) {`);
      out('}');
      return;
    case 'repeat_until':
      out(`while (!${emitExpr(s.cond)}) {`);
      emitBlock(em, s.body, inner);
      out('}');
      return;
    case 'set':
      out(`${varName(s.var)} = ${emitExpr(s.value)};`);
      return;
    case 'change':
      out(`${varName(s.var)} += ${emitExpr(s.by)};`);
      return;
    case 'timer_reset':
      out('sr_timer_start = millis();');
      return;
    case 'dc_motor_speed':
      out(`board.DCMotorPower(${port(s.port)}, (byte)sr_round(sr_clamp(${emitExpr(s.speed)}, 0.0, 255.0)));`);
      return;
    case 'dc_motor_dir':
      out(`board.DCMotorControl(${port(s.port)}, ${s.dir === 'normal' ? 'NORMAL' : 'REVERSE'});`);
      return;
    case 'dc_motor_stop':
      out(`board.DCMotorControl(${port(s.port)}, ${s.mode === 'brake' ? 'BRAKE' : 'COAST'});`);
      return;
    case 'servo':
      out(`board.Servomotor(${port(s.port)}, (byte)sr_round(sr_clamp(${emitExpr(s.angle)}, 0.0, 180.0)));`);
      return;
    case 'servo_multi': {
      const ports = s.items.map(i => port(i.port)).join(', ');
      const degrees = s.items.map(i => `(byte)sr_round(sr_clamp(${emitExpr(i.angle)}, 0.0, 180.0))`).join(', ');
      out('{');
      out(`  byte sr_ports[] = { ${ports} };`);
      out(`  byte sr_degrees[] = { ${degrees} };`);
      out(
        s.msPerDegree === undefined
          ? `  board.AsyncServomotors(sr_ports, sr_degrees, ${s.items.length});`
          : `  board.SyncServomotors(sr_ports, sr_degrees, ${s.items.length}, ${s.msPerDegree});`,
      );
      out('}');
      return;
    }
    case 'led':
      out(`board.LED(${port(s.port)}, ${s.on ? 'ON' : 'OFF'});`);
      return;
    case 'buzzer_on':
      out(`board.BuzzerControl(${port(s.port)}, ON, (word)sr_round(sr_clamp(${emitExpr(s.pitch)}, 130.0, 4186.0)));`);
      return;
    case 'buzzer_off':
      out(`board.BuzzerControl(${port(s.port)}, OFF, 0);`);
      return;
    default:
      throw new Error(`unknown statement op: ${(s as { op: string }).op}`);
  }
};

/**
 * ポートの初期化と補正値の行を作る。
 * @param program - 検査した構文木
 * @returns setup() の中の行
 */
const emitSetup = (program: Program): string[] => {
  const lines: string[] = [];
  // ポートは決まった順（表の順）に初期化する（構文木のキーの順に左右されない）
  for (const p of Object.keys(PORT_CONSTANT) as PortName[]) {
    const kind = program.ports[p];
    if (!kind) continue;
    if (kind === 'dc_motor') lines.push(`  board.InitDCMotorPort(${port(p)});`);
    else if (kind === 'servo_motor') lines.push(`  board.InitServomotorPort(${port(p)});`);
    else {
      const id = PART_ID[kind];
      if (!id) throw new Error(`unknown part: ${kind}`);
      lines.push(`  board.InitSensorPort(${port(p)}, ${id});`);
    }
  }
  const dc = program.calibration.dcMotor;
  if (DC_MOTOR_CALIBRATION_ORDER.some(p => dc[p] !== undefined)) {
    const rates = DC_MOTOR_CALIBRATION_ORDER.map(p => String(dc[p] ?? 100)).join(', ');
    lines.push(`  { byte sr_rate[] = { ${rates} }; board.SetDCMotorCalibration(sr_rate); }`);
  }
  const servo = program.calibration.servoMotor;
  if (SERVO_CALIBRATION_ORDER.some(p => servo[p] !== undefined)) {
    const offsets = SERVO_CALIBRATION_ORDER.map(p => String(servo[p] ?? 0)).join(', ');
    lines.push(`  { char sr_offsets[] = { ${offsets} }; board.SetServomotorCalibration(sr_offsets); }`);
  }
  return lines;
};

/**
 * 構文木から Arduino のスケッチ（.ino）を作る。
 *
 * `setup()` でポートと補正値を設定し、「旗が押されたとき」の下（main）を 1 回だけ実行する。
 * `loop()` は空（main が終われば、Scratch のスクリプトが終わったのと同じく止まる）。
 * @param program - validateIr を通った構文木
 * @returns スケッチの中身
 */
export const generateSketch = (program: Program): string => {
  const em: Emitter = { lines: [], loops: 0 };
  emitBlock(em, program.main, '  ');
  const vars = program.variables.map(v => `double ${varName(v.id)} = ${cppNumber(v.init)};`);
  return [
    '// Generated by Smalruby (Studuino mode). Do not edit.',
    ...INCLUDES.map(h => `#include <${h}>`),
    '',
    'Studuino board;',
    '',
    HELPERS,
    '',
    ...(vars.length > 0 ? [...vars, ''] : []),
    'static void sr_main() {',
    ...em.lines,
    '}',
    '',
    'void setup() {',
    ...emitSetup(program),
    '  randomSeed(analogRead(7) ^ micros());',
    '  sr_timer_start = millis();',
    '  sr_main();',
    '}',
    '',
    'void loop() {',
    '}',
    '',
  ].join('\n');
};
