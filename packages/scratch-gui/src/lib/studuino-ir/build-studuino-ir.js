// ブロックから構文木（Studuino IR）を作る（純粋関数・#2217・M1 / S6）。
//
// VM のブロック（`target.blocks._blocks` の形）とポートの設定から、Lambda に送る構文木を作る。
// 形の正は docs/studuino-mode/README.md の「構文木」。出力は Lambda の検査
// （infra/smalruby-studuino-hex/lambda/ir.ts の `validateIr`）を必ず通る形にする:
// 知らないキーを入れない・変数は `v0`〜・ポートは割り当てたものだけ・型は数値と真偽だけ。
// 構文木には、ブロックの ID・座標・コメント・変数の名前（利用者の文字列）を入れない。
import {
    normalizeSettings,
    PORT_NAMES,
    STORAGE_VERSION,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import { STUDUINO_IR_LIMITS, STUDUINO_IR_VERSION } from './limits';

/** エラーの理由（機械の名前。子ども向けの文言は #2214 / #2219 で付ける）。 */
export const STUDUINO_IR_ERRORS = Object.freeze({
    NO_FLAG: 'no_flag',
    TOO_MANY_FLAGS: 'too_many_flags',
    UNSUPPORTED_BLOCK: 'unsupported_block',
    STRING_VALUE: 'string_value',
    NOT_BOOLEAN: 'not_boolean',
    UNKNOWN_VARIABLE: 'unknown_variable',
    UNKNOWN_PORT: 'unknown_port',
    PORT_NOT_ASSIGNED: 'port_not_assigned',
    WRONG_PART: 'wrong_part',
    UNKNOWN_VALUE: 'unknown_value',
    TOO_LARGE: 'too_large',
});

/**
 * 警告の理由（#2353）。書きこみは止めないが、書きこむときのモーダルで知らせる。
 * - `string_initial_value`: 変数のいまの値が数にできないので 0 からはじめる（S7）
 */
export const STUDUINO_IR_WARNINGS = Object.freeze({
    STRING_INITIAL_VALUE: 'string_initial_value',
});

const E = STUDUINO_IR_ERRORS;

const FLAG_OPCODE = 'event_whenflagclicked';
const EXT = 'smalrubotS1_';

/** 2 つの数から数を作る演算（Scratch の opcode → 構文木の op・入力の名前）。 */
const BINARY_NUM = {
    operator_add: ['+', 'NUM1', 'NUM2'],
    operator_subtract: ['-', 'NUM1', 'NUM2'],
    operator_multiply: ['*', 'NUM1', 'NUM2'],
    operator_divide: ['/', 'NUM1', 'NUM2'],
    operator_mod: ['%', 'NUM1', 'NUM2'],
    operator_random: ['random', 'FROM', 'TO'],
};

/** 2 つの数を比べる演算。 */
const COMPARE = {
    operator_lt: '<',
    operator_gt: '>',
    operator_equals: '=',
};

/** 数を返す部品のブロック（`sensor`）。 */
const SENSOR_BLOCKS = {
    [`${EXT}studuinoLightSensor`]: 'light_sensor',
    [`${EXT}studuinoSoundSensor`]: 'sound_sensor',
    [`${EXT}studuinoIrPhotoreflector`]: 'ir_photoreflector',
    [`${EXT}studuinoTemperatureSensor`]: 'temperature_sensor',
};

/** 真偽を返す部品のブロック（`button`）。 */
const BUTTON_BLOCKS = {
    [`${EXT}studuinoTouchSensorPressed`]: 'touch_sensor',
    [`${EXT}studuinoButtonPressed`]: 'push_switch',
};

const NUMBER_REPORTERS = new Set([
    ...Object.keys(BINARY_NUM),
    'operator_round',
    'sensing_timer',
    'data_variable',
    ...Object.keys(SENSOR_BLOCKS),
]);

const BOOLEAN_REPORTERS = new Set([
    ...Object.keys(COMPARE),
    'operator_and',
    'operator_or',
    'operator_not',
    ...Object.keys(BUTTON_BLOCKS),
]);

const STATEMENTS = new Set([
    'control_wait',
    'control_repeat',
    'control_forever',
    'control_if',
    'control_if_else',
    'control_wait_until',
    'control_repeat_until',
    'data_setvariableto',
    'data_changevariableby',
    'sensing_resettimer',
    `${EXT}studuinoDcMotorSpeed`,
    `${EXT}studuinoDcMotorDirection`,
    `${EXT}studuinoDcMotorStop`,
    `${EXT}studuinoServo`,
    `${EXT}studuinoServoReserve`,
    `${EXT}studuinoServoMoveReserved`,
    `${EXT}studuinoServoMoveReservedIn`,
    `${EXT}studuinoLed`,
    `${EXT}studuinoBuzzerOn`,
    `${EXT}studuinoBuzzerOff`,
]);

/**
 * 文字を数にする。Scratch と同じく空欄（空白だけを含む）は 0。数にできない文字は null（S6: 文字列は使えない）。
 * @param {*} value - フィールドの値
 * @returns {?number} 数。数にできなければ null
 */
export const toStuduinoNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === null || typeof value === 'undefined') return 0;
    const s = String(value).trim();
    if (s === '') return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const firstFieldValue = (block) => {
    const fields = block && block.fields ? Object.values(block.fields) : [];
    return fields.length > 0 ? fields[0].value : null;
};

/**
 * 1 回の生成の状態。エラーを集め、使った変数に `v0` から番号を付ける。
 * @param {Array<object>} targets - ステージとスプライト
 * @param {object} settings - ポートの設定（normalizeSettings したもの）
 * @returns {object} 状態
 */
const createContext = (targets, settings) => {
    const stage = targets.find((t) => t.isStage) || null;
    return {
        targets,
        stage,
        ports: settings.ports,
        errors: [],
        errorKeys: new Set(),
        // 書きこみは止めない知らせ（#2353）。構文木には入れず、GUI だけが使う
        warnings: [],
        variables: [],
        variableIds: new Map(),
        // 利用者の変数の数（上限 32 は利用者の変数だけで数える。サーボの予約のための変数は数えない）
        userVariableCount: 0,
        // サーボモーターの予約（#2352）。prepareServoReservations が旗の下を見て決める
        servo: { ports: [], timed: false, target: {}, current: {}, start: null, duration: null },
        // 1 つ目の旗の下の木を作るときだけ変数を登録する（2 つ目以降の旗の下は検査だけ）
        registerVariables: true,
        // 構文木のノード → ブロック（上限をこえた場所を GUI で示すため）
        nodeBlocks: new Map(),
    };
};

const addError = (ctx, target, blockId, reason, extra) => {
    const key = `${target ? target.id : ''}:${blockId || ''}:${reason}`;
    if (ctx.errorKeys.has(key)) return;
    ctx.errorKeys.add(key);
    ctx.errors.push({ blockId: blockId || null, targetId: target ? target.id : null, reason, ...extra });
};

const mark = (ctx, node, blockId) => {
    if (node && typeof node === 'object' && blockId) ctx.nodeBlocks.set(node, blockId);
    return node;
};

/**
 * 入力につながったブロックの ID（影でないものがあればそれ、なければ影）。
 * @param {object} block - ブロック
 * @param {string} name - 入力の名前
 * @returns {?string} ブロックの ID
 */
const inputBlockId = (block, name) => {
    const input = block.inputs && block.inputs[name];
    if (!input) return null;
    return input.block || input.shadow || null;
};

/**
 * メニューの値を読む。フィールドに直接ある形と、影のメニューのブロックにある形の両方を読む
 * （部品のブロックの `PORT` がどちらになるかは #2216 次第のため）。
 * @param {object} target - ターゲット
 * @param {object} block - ブロック
 * @param {string} name - 引数の名前
 * @returns {*} 値（無ければ null）
 */
const readMenu = (target, block, name) => {
    if (block.fields && block.fields[name]) return block.fields[name].value;
    const id = inputBlockId(block, name);
    const menu = id ? target.blocks[id] : null;
    if (!menu) return null;
    if (menu.fields && menu.fields[name]) return menu.fields[name].value;
    return firstFieldValue(menu);
};

const isPortName = (v) => typeof v === 'string' && /^(D(2|4|7|8|9|10|11|12)|M[12]|A[0-7])$/.test(v);

/**
 * ポートを読み、その部品として割り当てられているかを確かめる（S5。#2214 の印と同じ理由）。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {object} block - ブロック
 * @param {string} name - 引数の名前
 * @param {string} kind - 部品の内部の名前
 * @returns {?string} ポート名。使えなければ null
 */
const readPort = (ctx, target, block, name, kind) => {
    const value = readMenu(target, block, name);
    if (value === null || typeof value === 'undefined' || value === '') {
        addError(ctx, target, block.id, E.PORT_NOT_ASSIGNED);
        return null;
    }
    if (!isPortName(value)) {
        addError(ctx, target, block.id, E.UNKNOWN_PORT);
        return null;
    }
    const assigned = ctx.ports[value];
    if (!assigned) {
        addError(ctx, target, block.id, E.PORT_NOT_ASSIGNED);
        return null;
    }
    if (assigned !== kind) {
        addError(ctx, target, block.id, E.WRONG_PART);
        return null;
    }
    return value;
};

const readChoice = (ctx, target, block, name, values) => {
    const value = readMenu(target, block, name);
    if (!values.includes(value)) {
        addError(ctx, target, block.id, E.UNKNOWN_VALUE);
        return null;
    }
    return value;
};

/**
 * 変数のブロック（フィールド `VARIABLE`）の変数を `v0` などの ID にする。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {object} block - ブロック
 * @returns {?string} 変数の ID
 */
const variableRef = (ctx, target, block) => {
    const field = block.fields && block.fields.VARIABLE;
    const varId = field && field.id;
    let owner = null;
    let variable = null;
    if (varId && target.variables && target.variables[varId]) {
        owner = target;
        variable = target.variables[varId];
    } else if (varId && ctx.stage && ctx.stage.variables && ctx.stage.variables[varId]) {
        owner = ctx.stage;
        variable = ctx.stage.variables[varId];
    }
    // リスト・メッセージは第 1 弾では使えない（data_variable は数の変数だけ）
    if (!variable || (variable.type && variable.type !== '')) {
        addError(ctx, target, block.id, E.UNKNOWN_VARIABLE);
        return null;
    }
    const key = `${owner.id}\u0000${varId}`;
    if (ctx.variableIds.has(key)) return ctx.variableIds.get(key);
    if (!ctx.registerVariables) return 'v0';
    const id = `v${ctx.variables.length}`;
    if (ctx.userVariableCount >= STUDUINO_IR_LIMITS.maxVariables) {
        addError(ctx, target, block.id, E.TOO_LARGE, {
            detail: 'too_many_variables',
            limit: STUDUINO_IR_LIMITS.maxVariables,
        });
        return null;
    }
    ctx.variableIds.set(key, id);
    ctx.userVariableCount += 1;
    // はじめの値: いまの値が数にできればそれ、できなければ 0（書きこむときの値を使う。文字の値は 0）
    const init = toStuduinoNumber(variable.value);
    ctx.variables.push({ id, init: init === null ? 0 : init });
    if (init === null) {
        // はじめて使ったブロックを指す（変数そのものはワークスペースに無いので）
        ctx.warnings.push({
            blockId: block.id,
            targetId: target.id,
            reason: STUDUINO_IR_WARNINGS.STRING_INITIAL_VALUE,
            variable: variable.name,
        });
    }
    return id;
};

/**
 * 使えないブロック。中の入力につながったブロックも検査する（そこにある別のエラーも示すため）。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {object} block - ブロック
 */
const unsupported = (ctx, target, block) => {
    addError(ctx, target, block.id, E.UNSUPPORTED_BLOCK);
    for (const input of Object.values(block.inputs || {})) {
        const child = input.block && target.blocks[input.block];
        if (child && !child.shadow) checkAny(ctx, target, child.id);
    }
};

/**
 * ブロックを、それ自身の種類（文か式か）として検査する（結果は捨てる）。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {string} blockId - ブロックの ID
 */
const checkAny = (ctx, target, blockId) => {
    const block = target.blocks[blockId];
    if (!block) return;
    if (NUMBER_REPORTERS.has(block.opcode)) {
        buildExpr(ctx, target, block.id, 'number', new Set());
    } else if (BOOLEAN_REPORTERS.has(block.opcode)) {
        buildExpr(ctx, target, block.id, 'bool', new Set());
    } else {
        buildStack(ctx, target, block.id, new Set());
    }
};

/**
 * 数の入力（影のリテラルか、つながったブロック）を式にする。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {object} block - 入力を持つブロック
 * @param {string} name - 入力の名前
 * @param {Set<string>} seen - たどったブロック（壊れた作品の輪を避ける）
 * @returns {?object} 式
 */
const numberInput = (ctx, target, block, name, seen) => {
    const id = inputBlockId(block, name);
    const child = id ? target.blocks[id] : null;
    // 入力が無い・壊れているときは、Scratch と同じく 0
    if (!child) return { num: 0 };
    if (child.shadow) {
        const n = toStuduinoNumber(firstFieldValue(child));
        if (n === null) {
            addError(ctx, target, block.id, E.STRING_VALUE);
            return null;
        }
        return { num: n };
    }
    if (BOOLEAN_REPORTERS.has(child.opcode)) {
        // 真偽のブロックを数の所に入れたとき（真 = 1・偽 = 0）
        const a = buildExpr(ctx, target, child.id, 'bool', seen);
        return a ? mark(ctx, { op: 'to_num', a }, child.id) : null;
    }
    return buildExpr(ctx, target, child.id, 'number', seen);
};

/**
 * 真偽の入力を式にする。空なら偽。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {object} block - 入力を持つブロック
 * @param {string} name - 入力の名前
 * @param {Set<string>} seen - たどったブロック
 * @returns {?object} 式
 */
const boolInput = (ctx, target, block, name, seen) => {
    const input = block.inputs && block.inputs[name];
    const child = input && input.block ? target.blocks[input.block] : null;
    if (!child || child.shadow) return { bool: false };
    if (NUMBER_REPORTERS.has(child.opcode)) {
        // Scratch では起きないが、来たらエラー（型が合わない）
        addError(ctx, target, child.id, E.NOT_BOOLEAN);
        buildExpr(ctx, target, child.id, 'number', seen);
        return null;
    }
    return buildExpr(ctx, target, child.id, 'bool', seen);
};

/**
 * 値のブロックを式にする。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {string} blockId - ブロックの ID
 * @param {string} type - 求める型（`number` / `bool`）
 * @param {Set<string>} seen - たどったブロック
 * @returns {?object} 式。エラーがあれば null
 */
const buildExpr = (ctx, target, blockId, type, seen) => {
    const block = target.blocks[blockId];
    if (!block || seen.has(blockId)) return null;
    seen.add(blockId);
    const op = block.opcode;
    const num = (name) => numberInput(ctx, target, block, name, seen);
    const bool = (name) => boolInput(ctx, target, block, name, seen);
    const all = (node, parts) => (parts.every((p) => p !== null) ? mark(ctx, node, block.id) : null);

    if (BINARY_NUM[op]) {
        const [irOp, an, bn] = BINARY_NUM[op];
        const a = num(an);
        const b = num(bn);
        return all({ op: irOp, a, b }, [a, b]);
    }
    if (COMPARE[op]) {
        const a = num('OPERAND1');
        const b = num('OPERAND2');
        return all({ op: COMPARE[op], a, b }, [a, b]);
    }
    switch (op) {
        case 'operator_and':
        case 'operator_or': {
            const a = bool('OPERAND1');
            const b = bool('OPERAND2');
            return all({ op: op === 'operator_and' ? 'and' : 'or', a, b }, [a, b]);
        }
        case 'operator_not': {
            const a = bool('OPERAND');
            return all({ op: 'not', a }, [a]);
        }
        case 'operator_round': {
            const a = num('NUM');
            return all({ op: 'round', a }, [a]);
        }
        case 'sensing_timer':
            return mark(ctx, { op: 'timer' }, block.id);
        case 'data_variable': {
            const v = variableRef(ctx, target, block);
            return v ? mark(ctx, { var: v }, block.id) : null;
        }
        default:
            break;
    }
    if (SENSOR_BLOCKS[op]) {
        const kind = SENSOR_BLOCKS[op];
        const port = readPort(ctx, target, block, 'PORT', kind);
        return port ? mark(ctx, { op: 'sensor', kind, port }, block.id) : null;
    }
    if (BUTTON_BLOCKS[op]) {
        const kind = BUTTON_BLOCKS[op];
        const port = readPort(ctx, target, block, 'PORT', kind);
        return port ? mark(ctx, { op: 'button', kind, port }, block.id) : null;
    }
    unsupported(ctx, target, block);
    return null;
};

// --- サーボモーターの予約（#2352・S6） ---------------------------------------------------------
//
// 「角度を予約する」「予約したサーボモーターを動かす」「M 秒で予約したサーボモーターを動かす」は、
// Lambda の構文木に新しい命令を足さず、いまの命令（変数・もし・まで繰り返す・タイマー・サーボ）の
// 組み合わせで書く（infra を変えずに済み、いまの Lambda がそのまま検査・書き出しできるため）。
//
// - 旗の下で予約するポートごとに、利用者に見えない変数を 1 つ持つ: 予約した角度（0〜180 にそろえる。
//   予約が無いときは -1）。予約は積み重なり、同じポートをもう一度予約したら、あとの角度になる。
// - 「動かす」は、予約のあるポートだけを予約の角度にし、予約を -1 にもどす（全部を続けて書くので、
//   いっしょに動きはじめる）。予約が無ければ何もしない。
// - 「M 秒で動かす」があるときは、ポートごとに「いまの角度」の変数も持ち（はじめは 90 度。サーボの
//   はじめの位置）、そのポートを動かすブロックで更新する。動かすときは、いまの角度から予約の角度へ、
//   全部のサーボを同じ M 秒で、タイマーで測りながら少しずつ動かす（通常モードの「M 秒でアームを
//   曲げる」と同じ、時間に比例した動き方）。予約が無ければ待たずに何もしない。

/** 予約が無いことを表す値（角度は 0〜180 にそろえるので、負の数は予約にならない）。 */
const NO_RESERVATION = -1;

/** サーボのはじめの角度（ライブラリのサーボはつないだときに 90 度の位置）。 */
const SERVO_INITIAL_ANGLE = 90;

const RESERVE_OPCODE = `${EXT}studuinoServoReserve`;
const MOVE_IN_OPCODE = `${EXT}studuinoServoMoveReservedIn`;

/**
 * 利用者に見えない変数を足す（予約・いまの角度・時間）。利用者の変数の上限（32）には数えない
 * （予約で増えるのは多くても 8 ポート × 2 + 2 = 18 個なので、Lambda の 64 には収まる）。
 * @param {object} ctx - 状態
 * @param {number} init - はじめの値
 * @returns {string} 変数の ID
 */
const addHiddenVariable = (ctx, init) => {
    const id = `v${ctx.variables.length}`;
    ctx.variables.push({ id, init });
    return id;
};

/**
 * 旗の下のブロックをたどり、予約するポートと「M 秒で動かす」を使うかを決め、変数を用意する。
 * ポートは、入出力の設定でサーボモーターを割り当てたものだけ（ほかは文を作るときにエラーになる）。
 * @param {object} ctx - 状態
 * @param {object} target - 旗のあるターゲット
 * @param {?string} firstId - 旗の下の最初のブロック
 */
const prepareServoReservations = (ctx, target, firstId) => {
    const ports = new Set();
    let timed = false;
    const seen = new Set();
    const queue = firstId ? [firstId] : [];
    while (queue.length > 0) {
        const id = queue.pop();
        const block = target.blocks[id];
        if (!block || seen.has(id)) continue;
        seen.add(id);
        if (block.opcode === RESERVE_OPCODE) {
            const value = readMenu(target, block, 'PORT');
            if (ctx.ports[value] === 'servo_motor') ports.add(value);
        } else if (block.opcode === MOVE_IN_OPCODE) {
            timed = true;
        }
        if (block.next) queue.push(block.next);
        Object.values(block.inputs || {}).forEach((input) => {
            if (input.block) queue.push(input.block);
        });
    }
    const servo = ctx.servo;
    servo.ports = PORT_NAMES.filter((port) => ports.has(port));
    servo.timed = timed && servo.ports.length > 0;
    servo.ports.forEach((port) => {
        servo.target[port] = addHiddenVariable(ctx, NO_RESERVATION);
        if (servo.timed) servo.current[port] = addHiddenVariable(ctx, SERVO_INITIAL_ANGLE);
    });
    if (servo.timed) {
        servo.start = addHiddenVariable(ctx, 0);
        servo.duration = addHiddenVariable(ctx, 0);
    }
};

const varRef = (id) => ({ var: id });
const setVar = (id, value) => ({ op: 'set', var: id, value });
const isReserved = (ctx, port) => ({ op: '>', a: varRef(ctx.servo.target[port]), b: { num: NO_RESERVATION } });

/**
 * 変数に値を入れ、サーボの角度の範囲（0〜180）にそろえる文。
 * @param {string} id - 変数の ID
 * @param {object} value - 式
 * @returns {Array<object>} 文
 */
const setClamped = (id, value) => [
    setVar(id, value),
    { op: 'if', cond: { op: '<', a: varRef(id), b: { num: 0 } }, then: [setVar(id, { num: 0 })] },
    { op: 'if', cond: { op: '>', a: varRef(id), b: { num: 180 } }, then: [setVar(id, { num: 180 })] },
];

/**
 * 予約のあるサーボを予約の角度にし、予約を消す文（ポートごと）。
 * @param {object} ctx - 状態
 * @returns {Array<object>} 文
 */
const finishReserved = (ctx) =>
    ctx.servo.ports.map((port) => {
        const target = ctx.servo.target[port];
        const then = [{ op: 'servo', port, angle: varRef(target) }];
        if (ctx.servo.timed) then.push(setVar(ctx.servo.current[port], varRef(target)));
        then.push(setVar(target, { num: NO_RESERVATION }));
        return { op: 'if', cond: isReserved(ctx, port), then };
    });

/**
 * 「予約したサーボモーターを動かす」の文。予約するブロックが無ければ何もしない（文が無い）。
 * @param {object} ctx - 状態
 * @returns {Array<object>} 文
 */
const moveReservedNow = (ctx) => finishReserved(ctx);

/**
 * 「M 秒で予約したサーボモーターを動かす」の文。
 * @param {object} ctx - 状態
 * @param {object} secs - 秒の式
 * @returns {Array<object>} 文
 */
const moveReservedIn = (ctx, secs) => {
    const { ports, current, target, start, duration } = ctx.servo;
    if (ports.length === 0) return [];
    const elapsed = { op: '-', a: { op: 'timer' }, b: varRef(start) };
    const step = ports.map((port) => ({
        op: 'if',
        cond: isReserved(ctx, port),
        then: [
            {
                op: 'servo',
                port,
                // いまの角度 + (予約の角度 − いまの角度) × (たった時間 ÷ M 秒)
                angle: {
                    op: '+',
                    a: varRef(current[port]),
                    b: {
                        op: '*',
                        a: { op: '-', a: varRef(target[port]), b: varRef(current[port]) },
                        b: { op: '/', a: elapsed, b: varRef(duration) },
                    },
                },
            },
        ],
    }));
    const anyReserved = ports
        .slice(1)
        .reduce((cond, port) => ({ op: 'or', a: cond, b: isReserved(ctx, port) }), isReserved(ctx, ports[0]));
    return [
        {
            op: 'if',
            cond: anyReserved,
            then: [
                setVar(duration, secs),
                setVar(start, { op: 'timer' }),
                // M 秒たつまで（0 秒以下ならすぐに）少しずつ動かす
                {
                    op: 'repeat_until',
                    cond: { op: 'not', a: { op: '<', a: elapsed, b: varRef(duration) } },
                    body: step,
                },
                ...finishReserved(ctx),
            ],
        },
    ];
};

/**
 * 1 つのブロックから作った文（いくつか）のそれぞれを、そのブロックに結びつける。
 * @param {object} ctx - 状態
 * @param {Array<object>} stmts - 文
 * @param {string} blockId - ブロックの ID
 * @returns {Array<object>} 文
 */
const markAll = (ctx, stmts, blockId) => stmts.map((s) => mark(ctx, s, blockId));

/**
 * 文のブロックを 1 つ文にする。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {object} block - ブロック
 * @param {Set<string>} seen - たどったブロック
 * @returns {?(object|Array<object>)} 文（予約のブロックなどは文の配列）。エラーがあれば null
 */
const buildStatement = (ctx, target, block, seen) => {
    const op = block.opcode;
    const num = (name) => numberInput(ctx, target, block, name, seen);
    const bool = (name) => boolInput(ctx, target, block, name, seen);
    const body = (name) => {
        const input = block.inputs && block.inputs[name];
        return input && input.block ? buildStack(ctx, target, input.block, seen) : [];
    };
    const all = (node, parts) => (parts.every((p) => p !== null) ? mark(ctx, node, block.id) : null);
    const port = (kind, name = 'PORT') => readPort(ctx, target, block, name, kind);

    switch (op) {
        case 'control_wait': {
            const secs = num('DURATION');
            return all({ op: 'wait', secs }, [secs]);
        }
        case 'control_repeat': {
            const times = num('TIMES');
            const b = body('SUBSTACK');
            return all({ op: 'repeat', times, body: b }, [times, b]);
        }
        case 'control_forever': {
            const b = body('SUBSTACK');
            return all({ op: 'forever', body: b }, [b]);
        }
        case 'control_if': {
            const cond = bool('CONDITION');
            const then = body('SUBSTACK');
            return all({ op: 'if', cond, then }, [cond, then]);
        }
        case 'control_if_else': {
            const cond = bool('CONDITION');
            const then = body('SUBSTACK');
            const otherwise = body('SUBSTACK2');
            return all({ op: 'if', cond, then, else: otherwise }, [cond, then, otherwise]);
        }
        case 'control_wait_until': {
            const cond = bool('CONDITION');
            return all({ op: 'wait_until', cond }, [cond]);
        }
        case 'control_repeat_until': {
            const cond = bool('CONDITION');
            const b = body('SUBSTACK');
            return all({ op: 'repeat_until', cond, body: b }, [cond, b]);
        }
        case 'data_setvariableto': {
            const v = variableRef(ctx, target, block);
            const value = num('VALUE');
            return all({ op: 'set', var: v, value }, [v, value]);
        }
        case 'data_changevariableby': {
            const v = variableRef(ctx, target, block);
            const by = num('VALUE');
            return all({ op: 'change', var: v, by }, [v, by]);
        }
        case 'sensing_resettimer':
            return mark(ctx, { op: 'timer_reset' }, block.id);
        case `${EXT}studuinoDcMotorSpeed`: {
            const p = port('dc_motor');
            const speed = num('SPEED');
            return all({ op: 'dc_motor_speed', port: p, speed }, [p, speed]);
        }
        case `${EXT}studuinoDcMotorDirection`: {
            const p = port('dc_motor');
            const dir = readChoice(ctx, target, block, 'DIRECTION', ['normal', 'reverse']);
            return all({ op: 'dc_motor_dir', port: p, dir }, [p, dir]);
        }
        case `${EXT}studuinoDcMotorStop`: {
            const p = port('dc_motor');
            const mode = readChoice(ctx, target, block, 'MODE', ['brake', 'coast']);
            return all({ op: 'dc_motor_stop', port: p, mode }, [p, mode]);
        }
        case `${EXT}studuinoServo`: {
            const p = port('servo_motor');
            const angle = num('ANGLE');
            if (p === null || angle === null) return null;
            const current = ctx.servo.current[p];
            // M 秒で動かすときに「いまの角度」から動かせるよう、予約するポートの角度を覚えておく
            if (!current) return mark(ctx, { op: 'servo', port: p, angle }, block.id);
            return markAll(
                ctx,
                setClamped(current, angle).concat({ op: 'servo', port: p, angle: { var: current } }),
                block.id,
            );
        }
        case `${EXT}studuinoServoReserve`: {
            const p = port('servo_motor');
            const angle = num('ANGLE');
            if (p === null || angle === null) return null;
            return markAll(ctx, setClamped(ctx.servo.target[p], angle), block.id);
        }
        case `${EXT}studuinoServoMoveReserved`:
            return markAll(ctx, moveReservedNow(ctx), block.id);
        case `${EXT}studuinoServoMoveReservedIn`: {
            const secs = num('SECS');
            if (secs === null) return null;
            return markAll(ctx, moveReservedIn(ctx, secs), block.id);
        }
        case `${EXT}studuinoLed`: {
            const p = port('led');
            const state = readChoice(ctx, target, block, 'STATE', ['on', 'off']);
            return all({ op: 'led', port: p, on: state === 'on' }, [p, state]);
        }
        case `${EXT}studuinoBuzzerOn`: {
            const p = port('buzzer');
            const pitch = num('PITCH');
            return all({ op: 'buzzer_on', port: p, pitch }, [p, pitch]);
        }
        case `${EXT}studuinoBuzzerOff`: {
            const p = port('buzzer');
            return all({ op: 'buzzer_off', port: p }, [p]);
        }
        default:
            unsupported(ctx, target, block);
            return null;
    }
};

/**
 * つながった文のブロック（`next` をたどる）を文の配列にする。
 * @param {object} ctx - 状態
 * @param {object} target - ターゲット
 * @param {?string} firstId - 先頭のブロックの ID
 * @param {Set<string>} seen - たどったブロック
 * @returns {?Array<object>} 文の配列。エラーがあれば null
 */
const buildStack = (ctx, target, firstId, seen) => {
    const out = [];
    let ok = true;
    let id = firstId;
    while (id) {
        const block = target.blocks[id];
        if (!block || seen.has(id)) break;
        seen.add(id);
        if (STATEMENTS.has(block.opcode)) {
            const stmt = buildStatement(ctx, target, block, seen);
            if (Array.isArray(stmt)) out.push(...stmt);
            else if (stmt) out.push(stmt);
            else ok = false;
        } else if (NUMBER_REPORTERS.has(block.opcode) || BOOLEAN_REPORTERS.has(block.opcode)) {
            // 値のブロックが文の所にある（ばらばらの値のブロック）。値として検査だけする
            seen.delete(id);
            checkAny(ctx, target, id);
        } else {
            unsupported(ctx, target, block);
            ok = false;
        }
        id = block.next;
    }
    return ok ? out : null;
};

const isExpr = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * 構文木のノードの数と深さを、Lambda の `validateIr` と同じ数え方で数える。
 * 上限をこえたところで止め、そのノードを返す。
 * @param {object} ir - 構文木
 * @param {object} limits - 上限
 * @returns {{nodes: number, depth: number, over: ?{detail: string, limit: number, nodes: Array<object>}}}
 *   結果（`over.nodes` は、こえたノードとその祖先。根から順）
 */
export const measureStuduinoIr = (ir, limits = STUDUINO_IR_LIMITS) => {
    const state = { nodes: 0, depth: 0, over: null };
    // いまたどっているノードの祖先（上限をこえた場所を、いちばん近いブロックで示すため）
    const ancestors = [];
    const visit = (node, depth) => {
        if (state.over) return false;
        state.nodes += 1;
        if (state.nodes > limits.maxNodes) {
            state.over = { detail: 'too_many_nodes', limit: limits.maxNodes, nodes: [...ancestors, node] };
            return false;
        }
        if (depth > limits.maxDepth) {
            state.over = { detail: 'too_deep', limit: limits.maxDepth, nodes: [...ancestors, node] };
            return false;
        }
        if (depth > state.depth) state.depth = depth;
        return true;
    };
    const walk = (node, depth, children) => {
        if (!visit(node, depth)) return;
        ancestors.push(node);
        children();
        ancestors.pop();
    };
    const expr = (e, depth) =>
        walk(e, depth, () => {
            ['a', 'b'].forEach((key) => {
                if (isExpr(e[key])) expr(e[key], depth + 1);
            });
        });
    const stmt = (s, depth) =>
        walk(s, depth, () => {
            ['secs', 'times', 'cond', 'value', 'by', 'speed', 'angle', 'pitch'].forEach((key) => {
                if (isExpr(s[key])) expr(s[key], depth + 1);
            });
            ['body', 'then', 'else'].forEach((key) => {
                if (Array.isArray(s[key])) s[key].forEach((child) => stmt(child, depth + 1));
            });
            if (Array.isArray(s.items)) s.items.forEach((item) => expr(item.angle, depth + 1));
        });
    ir.main.forEach((s) => stmt(s, 1));
    return state;
};

/**
 * 構文木を作る。
 * @param {object} options - 入力
 * @param {Array<object>} options.targets - ステージとスプライト。各要素は
 *   `{id, isStage, blocks: {<id>: block}, variables: {<id>: {id, name, type, value}}}`
 *   （`blocks` は VM の `target.blocks._blocks` の形）
 * @param {object} options.settings - ポートの設定（`getStuduinoSettings` の形。`ports` と `calibration`）
 * @returns {{ok: true, ir: object, warnings: Array<object>} | {ok: false, errors: Array<{blockId: ?string,
 *   targetId: ?string, reason: string}>, warnings: Array<object>, usedFlag?: object}} 構文木、または
 *   使えないブロックの一覧。`warnings` は書きこみを止めない知らせ（`{blockId, targetId, reason, variable}`）。
 *   旗が 2 つ以上なら `usedFlag`（動く 1 つ目の旗の `{blockId, targetId}`）
 */
export const buildStuduinoIr = ({ targets, settings }) => {
    const list = (targets || []).filter(Boolean);
    const normalized = normalizeSettings({ ...(settings || {}), version: STORAGE_VERSION });
    const ctx = createContext(list, normalized);

    const flags = [];
    for (const target of list) {
        for (const block of Object.values(target.blocks || {})) {
            if (block.topLevel && !block.shadow && block.opcode === FLAG_OPCODE) flags.push({ target, block });
        }
    }

    let main = null;
    if (flags.length === 0) {
        addError(ctx, null, null, E.NO_FLAG);
    } else {
        prepareServoReservations(ctx, flags[0].target, flags[0].block.next);
        main = buildStack(ctx, flags[0].target, flags[0].block.next, new Set());
    }
    // 旗の下の木のあとは、変数を登録しない（検査だけ）
    ctx.registerVariables = false;
    flags.slice(1).forEach(({ target, block }) => {
        addError(ctx, target, block.id, E.TOO_MANY_FLAGS);
        buildStack(ctx, target, block.next, new Set());
    });
    // ほかのスクリプト（ほかのハット・ばらばらのブロック）は、コメントと同じ扱い（S8）。
    // 検査しない・印も数も付けない・書きこまない。

    const failed = () => {
        const result = { ok: false, errors: ctx.errors, warnings: ctx.warnings };
        // 旗が 2 つ以上のとき、電源を入れて動くのは 1 つ目（#2353・S17。どれが使われないかを示すため）
        if (flags.length > 1) result.usedFlag = { blockId: flags[0].block.id, targetId: flags[0].target.id };
        return result;
    };
    if (ctx.errors.length > 0 || !main) return failed();

    const ir = {
        version: STUDUINO_IR_VERSION,
        board: 'studuino',
        ports: { ...normalized.ports },
        calibration: {
            dcMotor: { ...normalized.calibration.dcMotor },
            servoMotor: { ...normalized.calibration.servoMotor },
        },
        variables: ctx.variables,
        main,
    };

    const measured = measureStuduinoIr(ir);
    if (measured.over) {
        const owner = [...measured.over.nodes].reverse().find((node) => ctx.nodeBlocks.has(node));
        const blockId = owner ? ctx.nodeBlocks.get(owner) : null;
        const target = blockId ? list.find((t) => t.blocks && t.blocks[blockId]) : null;
        addError(ctx, target, blockId, E.TOO_LARGE, {
            detail: measured.over.detail,
            limit: measured.over.limit,
        });
        return failed();
    }
    // 構文木には利用者の文字列が入らないので、文字の数 = UTF-8 のバイト数
    const bytes = JSON.stringify({ ir }).length;
    if (bytes > STUDUINO_IR_LIMITS.maxRequestBytes) {
        addError(ctx, null, null, E.TOO_LARGE, {
            detail: 'too_many_bytes',
            limit: STUDUINO_IR_LIMITS.maxRequestBytes,
        });
        return failed();
    }
    return { ok: true, ir, warnings: ctx.warnings };
};

/**
 * VM から構文木を作る（ステージと、各スプライトの元の target。クローンは除く）。
 * @param {object} vm - VM
 * @param {object} settings - ポートの設定（`getStuduinoSettings(vm.runtime)`）
 * @returns {object} `buildStuduinoIr` の結果
 */
export const buildStuduinoIrFromVm = (vm, settings) =>
    buildStuduinoIr({
        targets: vm.runtime.targets
            .filter((t) => t.isOriginal)
            .map((t) => ({
                id: t.id,
                isStage: t.isStage,
                blocks: t.blocks._blocks,
                variables: t.variables,
            })),
        settings,
    });
