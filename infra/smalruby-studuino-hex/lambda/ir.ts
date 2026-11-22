/**
 * 構文木（Studuino IR）の検査（純粋関数・#2210）。
 *
 * ブラウザが送った構文木を厳密に検査する。知らない op・知らないポート・知らない部品・知らないキーは
 * すべて拒否する（S8 = A）。利用者の文字列は C++ に入らない: 変数は `v0` `v1` … の ID だけを受け付け、
 * 値は数値と真偽だけ（S6 = A）。形の正は docs/studuino-mode/README.md の「構文木」。
 */

/** 検査の上限（S12 = C。環境変数で変えられる）。 */
export interface IrLimits {
  /** ノード（op を持つオブジェクト・リテラル・変数の参照）の数。 */
  maxNodes: number;
  /** 入れ子の深さ。 */
  maxDepth: number;
  /** 変数の数（ATmega168PA の RAM は 1KB しかない）。 */
  maxVariables: number;
}

export const DEFAULT_IR_LIMITS: IrLimits = {
  maxNodes: 10_000,
  maxDepth: 100,
  maxVariables: 64,
};

/** 構文木の版（知らない版は拒否する）。 */
export const IR_VERSION = 1;

/** ポートごとに選べる部品（docs の「ポートごとに選べる部品」）。 */
const SERVO_PORTS = ['D2', 'D4', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'] as const;
const DC_MOTOR_PORTS = ['M1', 'M2'] as const;
const ANALOG_SENSORS = ['light_sensor', 'sound_sensor', 'ir_photoreflector', 'temperature_sensor'] as const;
const DIGITAL_PARTS = ['touch_sensor', 'led', 'buzzer'] as const;

export type PortName =
  | (typeof SERVO_PORTS)[number]
  | (typeof DC_MOTOR_PORTS)[number]
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'A6'
  | 'A7';

export type PartKind =
  | 'servo_motor'
  | 'dc_motor'
  | 'led'
  | 'buzzer'
  | 'light_sensor'
  | 'sound_sensor'
  | 'ir_photoreflector'
  | 'temperature_sensor'
  | 'touch_sensor'
  | 'push_switch';

const A0_TO_A3: readonly PartKind[] = [...ANALOG_SENSORS, ...DIGITAL_PARTS, 'push_switch'];
const A4_A5: readonly PartKind[] = [...ANALOG_SENSORS, ...DIGITAL_PARTS];
const A6_A7: readonly PartKind[] = ANALOG_SENSORS;
const SERVO_ONLY: readonly PartKind[] = ['servo_motor'];
const DC_MOTOR_ONLY: readonly PartKind[] = ['dc_motor'];

export const PARTS_BY_PORT: Record<PortName, readonly PartKind[]> = {
  D2: SERVO_ONLY,
  D4: SERVO_ONLY,
  D7: SERVO_ONLY,
  D8: SERVO_ONLY,
  D9: SERVO_ONLY,
  D10: SERVO_ONLY,
  D11: SERVO_ONLY,
  D12: SERVO_ONLY,
  M1: DC_MOTOR_ONLY,
  M2: DC_MOTOR_ONLY,
  // A0〜A3 は基板の十字ボタンとつながっている
  A0: A0_TO_A3,
  A1: A0_TO_A3,
  A2: A0_TO_A3,
  A3: A0_TO_A3,
  A4: A4_A5,
  A5: A4_A5,
  // A6・A7 はアナログ入力専用のピン
  A6: A6_A7,
  A7: A6_A7,
};

/** サーボモーターの補正値を並べる順（`SetServomotorCalibration` の配列の順）。 */
export const SERVO_CALIBRATION_ORDER = SERVO_PORTS;
/** DC モーターの補正値を並べる順（`SetDCMotorCalibration` の配列の順）。 */
export const DC_MOTOR_CALIBRATION_ORDER = DC_MOTOR_PORTS;

export type Expr =
  | { num: number }
  | { bool: boolean }
  | { var: string }
  | { op: '+' | '-' | '*' | '/' | '%' | 'random'; a: Expr; b: Expr }
  | { op: '<' | '>' | '='; a: Expr; b: Expr }
  | { op: 'and' | 'or'; a: Expr; b: Expr }
  | { op: 'not' | 'round' | 'to_num'; a: Expr }
  | { op: 'sensor'; kind: PartKind; port: PortName }
  | { op: 'button'; kind: PartKind; port: PortName }
  | { op: 'timer' };

export type Stmt =
  | { op: 'wait'; secs: Expr }
  | { op: 'repeat'; times: Expr; body: Stmt[] }
  | { op: 'forever'; body: Stmt[] }
  | { op: 'if'; cond: Expr; then: Stmt[]; else?: Stmt[] }
  | { op: 'wait_until'; cond: Expr }
  | { op: 'repeat_until'; cond: Expr; body: Stmt[] }
  | { op: 'set'; var: string; value: Expr }
  | { op: 'change'; var: string; by: Expr }
  | { op: 'timer_reset' }
  | { op: 'dc_motor_speed'; port: PortName; speed: Expr }
  | { op: 'dc_motor_dir'; port: PortName; dir: 'normal' | 'reverse' }
  | { op: 'dc_motor_stop'; port: PortName; mode: 'brake' | 'coast' }
  | { op: 'servo'; port: PortName; angle: Expr }
  | { op: 'servo_multi'; items: { port: PortName; angle: Expr }[]; msPerDegree?: number }
  | { op: 'led'; port: PortName; on: boolean }
  | { op: 'buzzer_on'; port: PortName; pitch: Expr }
  | { op: 'buzzer_off'; port: PortName };

export interface Program {
  version: 1;
  board: 'studuino';
  ports: Partial<Record<PortName, PartKind>>;
  calibration: {
    dcMotor: Partial<Record<'M1' | 'M2', number>>;
    servoMotor: Partial<Record<(typeof SERVO_PORTS)[number], number>>;
  };
  variables: { id: string; init: number }[];
  main: Stmt[];
}

export type IrCheck =
  | { ok: true; program: Program; nodes: number; depth: number }
  | {
      ok: false;
      /** 400 invalid_ir か 413 too_large か。 */
      error: 'invalid_ir' | 'too_large';
      /** どこがおかしいか（例 `main[0].body[2].cond.a`）。 */
      path: string;
      /** 機械が読む理由（計測のログにも出す）。 */
      reason: string;
      /** too_large のときの上限。 */
      limit?: number;
    };

type ValueType = 'number' | 'bool';

class IrError extends Error {
  constructor(
    readonly path: string,
    readonly reason: string,
    readonly tooLarge?: { limit: number },
  ) {
    super(`${path}: ${reason}`);
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const VARIABLE_ID = /^v(0|[1-9]\d{0,3})$/;
const ALL_PORTS = Object.keys(PARTS_BY_PORT) as PortName[];

const SENSOR_KINDS: readonly PartKind[] = ANALOG_SENSORS;
const BUTTON_KINDS: readonly PartKind[] = ['touch_sensor', 'push_switch'];

/** 文の op ごとの、許すキー（op を除く）と省略してよいキー。 */
const STMT_KEYS: Record<Stmt['op'], { keys: string[]; optional?: string[] }> = {
  wait: { keys: ['secs'] },
  repeat: { keys: ['times', 'body'] },
  forever: { keys: ['body'] },
  if: { keys: ['cond', 'then', 'else'], optional: ['else'] },
  wait_until: { keys: ['cond'] },
  repeat_until: { keys: ['cond', 'body'] },
  set: { keys: ['var', 'value'] },
  change: { keys: ['var', 'by'] },
  timer_reset: { keys: [] },
  dc_motor_speed: { keys: ['port', 'speed'] },
  dc_motor_dir: { keys: ['port', 'dir'] },
  dc_motor_stop: { keys: ['port', 'mode'] },
  servo: { keys: ['port', 'angle'] },
  servo_multi: { keys: ['items', 'msPerDegree'], optional: ['msPerDegree'] },
  led: { keys: ['port', 'on'] },
  buzzer_on: { keys: ['port', 'pitch'] },
  buzzer_off: { keys: ['port'] },
};

const BINARY_NUM_OPS = ['+', '-', '*', '/', '%', 'random'];
const COMPARE_OPS = ['<', '>', '='];
const LOGIC_OPS = ['and', 'or'];

/** 検査の途中の状態。 */
interface Walker {
  limits: IrLimits;
  ports: Partial<Record<PortName, PartKind>>;
  variables: Set<string>;
  nodes: number;
  maxDepth: number;
}

const visit = (w: Walker, path: string, depth: number): void => {
  w.nodes += 1;
  if (w.nodes > w.limits.maxNodes) throw new IrError(path, 'too_many_nodes', { limit: w.limits.maxNodes });
  if (depth > w.limits.maxDepth) throw new IrError(path, 'too_deep', { limit: w.limits.maxDepth });
  if (depth > w.maxDepth) w.maxDepth = depth;
};

const exactKeys = (obj: Record<string, unknown>, path: string, allowed: string[], optional: string[] = []) => {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new IrError(`${path}.${key}`, 'unknown_key');
  }
  for (const key of allowed) {
    if (!optional.includes(key) && !(key in obj)) throw new IrError(`${path}.${key}`, 'missing_key');
  }
};

const finiteNumber = (v: unknown, path: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new IrError(path, 'not_a_number');
  return v;
};

const intInRange = (v: unknown, path: string, min: number, max: number): number => {
  const n = finiteNumber(v, path);
  if (!Number.isInteger(n) || n < min || n > max) throw new IrError(path, 'out_of_range');
  return n;
};

/**
 * ポートが、その部品として割り当てられているかを確かめる。
 * @param w - 状態
 * @param v - ポート名
 * @param path - 場所
 * @param kinds - 許す部品
 * @returns ポート名と、割り当てた部品
 */
const assignedPort = (
  w: Walker,
  v: unknown,
  path: string,
  kinds: readonly PartKind[],
): { port: PortName; kind: PartKind } => {
  if (typeof v !== 'string' || !ALL_PORTS.includes(v as PortName)) throw new IrError(path, 'unknown_port');
  const kind = w.ports[v as PortName];
  if (!kind) throw new IrError(path, 'port_not_assigned');
  if (!kinds.includes(kind)) throw new IrError(path, 'wrong_part');
  return { port: v as PortName, kind };
};

const variableRef = (w: Walker, v: unknown, path: string): string => {
  if (typeof v !== 'string' || !VARIABLE_ID.test(v)) throw new IrError(path, 'invalid_variable_id');
  if (!w.variables.has(v)) throw new IrError(path, 'unknown_variable');
  return v;
};

/**
 * 式を検査する。
 * @param w - 状態
 * @param v - 式
 * @param path - 場所
 * @param depth - 深さ
 * @param expected - 求める型
 * @returns 検査した式
 */
const checkExpr = (w: Walker, v: unknown, path: string, depth: number, expected: ValueType): Expr => {
  if (!isPlainObject(v)) throw new IrError(path, 'not_an_expression');
  visit(w, path, depth);
  const typed = (actual: ValueType) => {
    if (actual !== expected) throw new IrError(path, `type_mismatch:${expected}`);
  };
  if ('num' in v) {
    exactKeys(v, path, ['num']);
    typed('number');
    return { num: finiteNumber(v.num, `${path}.num`) };
  }
  if ('bool' in v) {
    exactKeys(v, path, ['bool']);
    typed('bool');
    if (typeof v.bool !== 'boolean') throw new IrError(`${path}.bool`, 'not_a_bool');
    return { bool: v.bool };
  }
  if ('var' in v) {
    exactKeys(v, path, ['var']);
    typed('number');
    return { var: variableRef(w, v.var, `${path}.var`) };
  }
  const op = v.op;
  if (typeof op !== 'string') throw new IrError(`${path}.op`, 'unknown_op');
  const sub = (key: string, type: ValueType) => checkExpr(w, v[key], `${path}.${key}`, depth + 1, type);
  if (BINARY_NUM_OPS.includes(op)) {
    exactKeys(v, path, ['op', 'a', 'b']);
    typed('number');
    return { op: op as '+', a: sub('a', 'number'), b: sub('b', 'number') };
  }
  if (COMPARE_OPS.includes(op)) {
    exactKeys(v, path, ['op', 'a', 'b']);
    typed('bool');
    return { op: op as '<', a: sub('a', 'number'), b: sub('b', 'number') };
  }
  if (LOGIC_OPS.includes(op)) {
    exactKeys(v, path, ['op', 'a', 'b']);
    typed('bool');
    return { op: op as 'and', a: sub('a', 'bool'), b: sub('b', 'bool') };
  }
  switch (op) {
    case 'not':
      exactKeys(v, path, ['op', 'a']);
      typed('bool');
      return { op, a: sub('a', 'bool') };
    case 'round':
      exactKeys(v, path, ['op', 'a']);
      typed('number');
      return { op, a: sub('a', 'number') };
    case 'to_num':
      // Scratch で真偽のブロックを数の所に入れたとき（真 = 1・偽 = 0）。
      exactKeys(v, path, ['op', 'a']);
      typed('number');
      return { op, a: sub('a', 'bool') };
    case 'sensor': {
      exactKeys(v, path, ['op', 'kind', 'port']);
      typed('number');
      if (typeof v.kind !== 'string' || !SENSOR_KINDS.includes(v.kind as PartKind)) {
        throw new IrError(`${path}.kind`, 'unknown_part');
      }
      const { port } = assignedPort(w, v.port, `${path}.port`, [v.kind as PartKind]);
      return { op, kind: v.kind as PartKind, port };
    }
    case 'button': {
      exactKeys(v, path, ['op', 'kind', 'port']);
      typed('bool');
      if (typeof v.kind !== 'string' || !BUTTON_KINDS.includes(v.kind as PartKind)) {
        throw new IrError(`${path}.kind`, 'unknown_part');
      }
      const { port } = assignedPort(w, v.port, `${path}.port`, [v.kind as PartKind]);
      return { op, kind: v.kind as PartKind, port };
    }
    case 'timer':
      exactKeys(v, path, ['op']);
      typed('number');
      return { op };
    default:
      throw new IrError(`${path}.op`, 'unknown_op');
  }
};

const checkBlock = (w: Walker, v: unknown, path: string, depth: number): Stmt[] => {
  if (!Array.isArray(v)) throw new IrError(path, 'not_a_list');
  return v.map((s, i) => checkStmt(w, s, `${path}[${i}]`, depth));
};

/**
 * 文を検査する。
 * @param w - 状態
 * @param v - 文
 * @param path - 場所
 * @param depth - 深さ
 * @returns 検査した文
 */
const checkStmt = (w: Walker, v: unknown, path: string, depth: number): Stmt => {
  if (!isPlainObject(v)) throw new IrError(path, 'not_a_statement');
  visit(w, path, depth);
  const op = v.op;
  if (typeof op !== 'string' || !Object.prototype.hasOwnProperty.call(STMT_KEYS, op)) {
    throw new IrError(`${path}.op`, 'unknown_op');
  }
  const spec = STMT_KEYS[op as Stmt['op']];
  exactKeys(v, path, ['op', ...spec.keys], spec.optional);
  const num = (key: string) => checkExpr(w, v[key], `${path}.${key}`, depth + 1, 'number');
  const bool = (key: string) => checkExpr(w, v[key], `${path}.${key}`, depth + 1, 'bool');
  const block = (key: string) => checkBlock(w, v[key], `${path}.${key}`, depth + 1);
  const port = (kinds: readonly PartKind[]) => assignedPort(w, v.port, `${path}.port`, kinds).port;
  const oneOf = <T extends string>(key: string, values: readonly T[]): T => {
    if (typeof v[key] !== 'string' || !values.includes(v[key] as T)) throw new IrError(`${path}.${key}`, 'unknown_value');
    return v[key] as T;
  };

  switch (op as Stmt['op']) {
    case 'wait':
      return { op: 'wait', secs: num('secs') };
    case 'repeat':
      return { op: 'repeat', times: num('times'), body: block('body') };
    case 'forever':
      return { op: 'forever', body: block('body') };
    case 'if':
      return 'else' in v
        ? { op: 'if', cond: bool('cond'), then: block('then'), else: block('else') }
        : { op: 'if', cond: bool('cond'), then: block('then') };
    case 'wait_until':
      return { op: 'wait_until', cond: bool('cond') };
    case 'repeat_until':
      return { op: 'repeat_until', cond: bool('cond'), body: block('body') };
    case 'set':
      return { op: 'set', var: variableRef(w, v.var, `${path}.var`), value: num('value') };
    case 'change':
      return { op: 'change', var: variableRef(w, v.var, `${path}.var`), by: num('by') };
    case 'timer_reset':
      return { op: 'timer_reset' };
    case 'dc_motor_speed':
      return { op: 'dc_motor_speed', port: port(['dc_motor']), speed: num('speed') };
    case 'dc_motor_dir':
      return { op: 'dc_motor_dir', port: port(['dc_motor']), dir: oneOf('dir', ['normal', 'reverse']) };
    case 'dc_motor_stop':
      return { op: 'dc_motor_stop', port: port(['dc_motor']), mode: oneOf('mode', ['brake', 'coast']) };
    case 'servo':
      return { op: 'servo', port: port(['servo_motor']), angle: num('angle') };
    case 'servo_multi': {
      const items = v.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > SERVO_PORTS.length) {
        throw new IrError(`${path}.items`, 'out_of_range');
      }
      const seen = new Set<string>();
      const checked = items.map((item, i) => {
        const ip = `${path}.items[${i}]`;
        if (!isPlainObject(item)) throw new IrError(ip, 'not_an_item');
        exactKeys(item, ip, ['port', 'angle']);
        const p = assignedPort(w, item.port, `${ip}.port`, ['servo_motor']).port;
        if (seen.has(p)) throw new IrError(`${ip}.port`, 'duplicate_port');
        seen.add(p);
        return { port: p, angle: checkExpr(w, item.angle, `${ip}.angle`, depth + 1, 'number') };
      });
      if ('msPerDegree' in v) {
        // ライブラリの決まり: 1 度あたり 3 ms 以上（引数は byte なので 255 まで）
        return {
          op: 'servo_multi',
          items: checked,
          msPerDegree: intInRange(v.msPerDegree, `${path}.msPerDegree`, 3, 255),
        };
      }
      return { op: 'servo_multi', items: checked };
    }
    case 'led':
      if (typeof v.on !== 'boolean') throw new IrError(`${path}.on`, 'not_a_bool');
      return { op: 'led', port: port(['led']), on: v.on };
    case 'buzzer_on':
      return { op: 'buzzer_on', port: port(['buzzer']), pitch: num('pitch') };
    case 'buzzer_off':
      return { op: 'buzzer_off', port: port(['buzzer']) };
    default:
      throw new IrError(`${path}.op`, 'unknown_op');
  }
};

const checkPorts = (v: unknown): Partial<Record<PortName, PartKind>> => {
  if (!isPlainObject(v)) throw new IrError('ports', 'not_an_object');
  const ports: Partial<Record<PortName, PartKind>> = {};
  for (const [name, kind] of Object.entries(v)) {
    if (!ALL_PORTS.includes(name as PortName)) throw new IrError(`ports.${name}`, 'unknown_port');
    if (typeof kind !== 'string' || !PARTS_BY_PORT[name as PortName].includes(kind as PartKind)) {
      throw new IrError(`ports.${name}`, 'unknown_part');
    }
    ports[name as PortName] = kind as PartKind;
  }
  return ports;
};

const checkCalibration = (v: unknown): Program['calibration'] => {
  const result: Program['calibration'] = { dcMotor: {}, servoMotor: {} };
  if (v === undefined) return result;
  if (!isPlainObject(v)) throw new IrError('calibration', 'not_an_object');
  exactKeys(v, 'calibration', ['dcMotor', 'servoMotor'], ['dcMotor', 'servoMotor']);
  if (v.dcMotor !== undefined) {
    if (!isPlainObject(v.dcMotor)) throw new IrError('calibration.dcMotor', 'not_an_object');
    for (const [port, rate] of Object.entries(v.dcMotor)) {
      const p = `calibration.dcMotor.${port}`;
      if (!(DC_MOTOR_PORTS as readonly string[]).includes(port)) throw new IrError(p, 'unknown_port');
      result.dcMotor[port as 'M1'] = intInRange(rate, p, 0, 100);
    }
  }
  if (v.servoMotor !== undefined) {
    if (!isPlainObject(v.servoMotor)) throw new IrError('calibration.servoMotor', 'not_an_object');
    for (const [port, offset] of Object.entries(v.servoMotor)) {
      const p = `calibration.servoMotor.${port}`;
      if (!(SERVO_PORTS as readonly string[]).includes(port)) throw new IrError(p, 'unknown_port');
      result.servoMotor[port as 'D9'] = intInRange(offset, p, -15, 15);
    }
  }
  return result;
};

const checkVariables = (v: unknown, limits: IrLimits): Program['variables'] => {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new IrError('variables', 'not_a_list');
  if (v.length > limits.maxVariables) {
    throw new IrError('variables', 'too_many_variables', { limit: limits.maxVariables });
  }
  const seen = new Set<string>();
  return v.map((item, i) => {
    const p = `variables[${i}]`;
    if (!isPlainObject(item)) throw new IrError(p, 'not_a_variable');
    exactKeys(item, p, ['id', 'init'], ['init']);
    if (typeof item.id !== 'string' || !VARIABLE_ID.test(item.id)) throw new IrError(`${p}.id`, 'invalid_variable_id');
    if (seen.has(item.id)) throw new IrError(`${p}.id`, 'duplicate_variable');
    seen.add(item.id);
    return { id: item.id, init: item.init === undefined ? 0 : finiteNumber(item.init, `${p}.init`) };
  });
};

/**
 * 構文木を検査する。
 * @param ir - ブラウザが送った構文木（JSON を読んだもの）
 * @param limits - 上限
 * @returns 検査した構文木、または拒否の理由
 */
export const validateIr = (ir: unknown, limits: IrLimits = DEFAULT_IR_LIMITS): IrCheck => {
  try {
    if (!isPlainObject(ir)) throw new IrError('', 'not_an_object');
    // lists / functions は第 2 弾。第 1 弾は知らないキーとして拒否する
    exactKeys(ir, '', ['version', 'board', 'ports', 'calibration', 'variables', 'main'], ['calibration', 'variables']);
    if (ir.version !== IR_VERSION) throw new IrError('version', 'unknown_version');
    if (ir.board !== 'studuino') throw new IrError('board', 'unknown_board');
    const ports = checkPorts(ir.ports);
    const calibration = checkCalibration(ir.calibration);
    const variables = checkVariables(ir.variables, limits);
    const w: Walker = { limits, ports, variables: new Set(variables.map(x => x.id)), nodes: 0, maxDepth: 0 };
    const main = checkBlock(w, ir.main, 'main', 1);
    return {
      ok: true,
      program: { version: 1, board: 'studuino', ports, calibration, variables, main },
      nodes: w.nodes,
      depth: w.maxDepth,
    };
  } catch (err) {
    if (!(err instanceof IrError)) throw err;
    const path = err.path.replace(/^\./, '');
    return err.tooLarge
      ? { ok: false, error: 'too_large', path, reason: err.reason, limit: err.tooLarge.limit }
      : { ok: false, error: 'invalid_ir', path, reason: err.reason };
  }
};
