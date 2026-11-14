// アクティビティ図の箱に書く文（ブロックの文）を、VM 形式のブロック（Ruby → ブロック変換の出力
// `converter.blocks`）から作る純粋関数。文言は `format(id, values)` で引く（GUI では intl.formatMessage、
// テストでは locale の表）。対応していないブロックは `blockName(opcode)`（scratch-blocks の Msg の
// テンプレート「%1 歩動かす」など）に穴の値を入れ、それも無ければ opcode を書く。

const P = 'gui.lessons.activityDiagram.';

/**
 * locale の表（`activity-diagram.locale.js` の ja など）から `format` を作る。`{name}` を値で置きかえる。
 * @param {object} table - id → 文言。
 * @returns {function(string, object=): string} format。
 */
export const formatFromTable =
    (table) =>
    (id, values = {}) =>
        String(Object.prototype.hasOwnProperty.call(table, id) ? table[id] : id).replace(
            /\{(\w+)\}/g,
            (match, key) => (Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match),
        );

// 数の穴のシャドウ（値をそのまま書く）
const NUMBER_SHADOWS = ['math_number', 'math_whole_number', 'math_positive_number', 'math_integer', 'math_angle'];

// キーの名前（▼の値）→ 文言
const KEY_MESSAGES = {
    space: 'key.space',
    'up arrow': 'key.upArrow',
    'down arrow': 'key.downArrow',
    'left arrow': 'key.leftArrow',
    'right arrow': 'key.rightArrow',
    any: 'key.any',
};

// 触れた の相手の特別な名前 → 文言
const OBJECT_MESSAGES = {
    _mouse_: 'mousePointer',
    _edge_: 'edge',
};

// 記号で書く演算（どの locale でも同じ）
// opcode → [記号, 左の穴, 右の穴]
const SYMBOL_OPERATORS = {
    operator_equals: ['=', 'OPERAND1', 'OPERAND2'],
    operator_lt: ['<', 'OPERAND1', 'OPERAND2'],
    operator_gt: ['>', 'OPERAND1', 'OPERAND2'],
    operator_add: ['+', 'NUM1', 'NUM2'],
    operator_subtract: ['-', 'NUM1', 'NUM2'],
    operator_multiply: ['×', 'NUM1', 'NUM2'],
    operator_divide: ['÷', 'NUM1', 'NUM2'],
    operator_mod: ['mod', 'NUM1', 'NUM2'],
};

/**
 * 帽子のブロックか（スクリプトの始まりのきっかけ）。
 * @param {string} opcode - opcode。
 * @returns {boolean} 帽子か。
 */
export const isHatOpcode = (opcode) => /^event_when/.test(opcode) || opcode === 'control_start_as_clone';

const firstFieldValue = (block) => {
    const names = Object.keys(block.fields || {});
    return names.length > 0 ? block.fields[names[0]].value : '';
};

/**
 * ブロックの文を作る道具をまとめて作る。
 * @param {object} options - 作り方。
 * @param {function(string, object=): string} options.format - 文言を引く関数（id は接頭辞を除いた名前でなく完全な id）。
 * @param {?function(string): ?string} [options.blockName] - 対応していないブロックの名前のテンプレート（%1 などの穴つき）。
 * @returns {object} `{hat, statement, value, condition}`。どれも `(blocks, id)` を受ける。
 */
export const createBlockLabeler = ({ format, blockName = null }) => {
    const f = (key, values) => format(`${P}${key}`, values);
    const empty = () => f('empty');
    const literal = (text) => f('literal', { text });

    // 値の穴（ブロック・シャドウ）の文
    const value = (blocks, id) => {
        const block = id ? blocks[id] : null;
        if (!block) return empty();
        const { opcode } = block;
        if (NUMBER_SHADOWS.includes(opcode)) return String(firstFieldValue(block));
        if (opcode === 'text') {
            const text = String(firstFieldValue(block));
            if (text === '') return empty();
            // 文字の穴に入った数（「答え = 7」の 7）は数として書く
            return /^-?\d+(\.\d+)?$/.test(text) ? text : literal(text);
        }
        const input = (name) => inputValue(blocks, block, name);
        if (SYMBOL_OPERATORS[opcode]) {
            const [symbol, left, right] = SYMBOL_OPERATORS[opcode];
            return `${input(left)} ${symbol} ${input(right)}`;
        }
        switch (opcode) {
            case 'data_variable':
            case 'data_listcontents':
                return String(firstFieldValue(block));
            case 'sensing_answer':
                return f('answer');
            case 'sensing_timer':
                return f('timer');
            case 'operator_and':
                return f('and', { a: input('OPERAND1'), b: input('OPERAND2') });
            case 'operator_or':
                return f('or', { a: input('OPERAND1'), b: input('OPERAND2') });
            case 'operator_not':
                return f('not', { a: input('OPERAND') });
            case 'operator_join':
                return f('join', { a: input('STRING1'), b: input('STRING2') });
            case 'operator_random':
                return f('random', { from: input('FROM'), to: input('TO') });
            case 'meshV2_getSensorValue':
                return f('sensorValue', { name: input('NAME') });
            case 'sensing_touchingobject':
                return f('touching', { object: input('TOUCHINGOBJECTMENU') });
            case 'sensing_keypressed':
                return f('keyPressed', { key: input('KEY_OPTION') });
            default:
                break;
        }
        if (block.shadow) return menuValue(opcode, String(firstFieldValue(block)));
        return generic(blocks, block);
    };

    // ▼のメニューのシャドウの値（メッセージ・キー・触れる相手など）
    const menuValue = (opcode, raw) => {
        if (OBJECT_MESSAGES[raw]) return f(OBJECT_MESSAGES[raw]);
        if (/key/i.test(opcode) && KEY_MESSAGES[raw]) return f(KEY_MESSAGES[raw]);
        if (raw === '') return empty();
        return literal(raw);
    };

    const inputValue = (blocks, block, name) => {
        const input = block.inputs && block.inputs[name];
        if (!input) return empty();
        return value(blocks, input.block || input.shadow);
    };

    const keyName = (raw) => (KEY_MESSAGES[raw] ? f(KEY_MESSAGES[raw]) : raw);

    // 対応していないブロック: テンプレートの %n に穴（入力 → フィールドの順）の値を入れる
    const generic = (blocks, block) => {
        const template = blockName ? blockName(block.opcode) : null;
        if (!template) return block.opcode;
        const args = [
            ...Object.keys(block.inputs || {})
                .filter((name) => !/^SUBSTACK/.test(name))
                .map((name) => inputValue(blocks, block, name)),
            ...Object.keys(block.fields || {}).map((name) => String(block.fields[name].value)),
        ];
        return template
            .replace(/%(\d+)/g, (match, n) => (Number(n) > args.length ? empty() : args[Number(n) - 1]))
            .replace(/\s+/g, ' ')
            .trim();
    };

    const fieldValue = (block, name) => {
        const field = block.fields && block.fields[name];
        return field ? String(field.value) : '';
    };

    // 帽子のブロックの文。帽子でなければ null
    const hat = (blocks, id) => {
        const block = blocks[id];
        if (!block || !isHatOpcode(block.opcode)) return null;
        switch (block.opcode) {
            case 'event_whenflagclicked':
                return f('hat.flag');
            case 'event_whenkeypressed':
                return f('hat.key', { key: keyName(fieldValue(block, 'KEY_OPTION')) });
            case 'event_whenthisspriteclicked':
                return f('hat.spriteClicked');
            case 'event_whenstageclicked':
                return f('hat.stageClicked');
            case 'event_whenbroadcastreceived':
                return f('hat.receive', { name: literal(fieldValue(block, 'BROADCAST_OPTION')) });
            case 'control_start_as_clone':
                return f('hat.clone');
            case 'event_whenbackdropswitchesto':
                return f('hat.backdrop', { name: literal(fieldValue(block, 'BACKDROP')) });
            default:
                return generic(blocks, block);
        }
    };

    // 「処理」の箱に書くブロックの文
    const statement = (blocks, id) => {
        const block = blocks[id];
        const input = (name) => inputValue(blocks, block, name);
        switch (block.opcode) {
            case 'looks_say':
                return f('say', { message: input('MESSAGE') });
            case 'looks_sayforsecs':
                return f('sayForSecs', { message: input('MESSAGE'), secs: input('SECS') });
            case 'looks_think':
                return f('think', { message: input('MESSAGE') });
            case 'looks_thinkforsecs':
                return f('thinkForSecs', { message: input('MESSAGE'), secs: input('SECS') });
            case 'sensing_askandwait':
                return f('ask', { question: input('QUESTION') });
            case 'event_broadcast':
                return f('broadcast', { name: input('BROADCAST_INPUT') });
            case 'event_broadcastandwait':
                return f('broadcastAndWait', { name: input('BROADCAST_INPUT') });
            case 'data_setvariableto':
                return f('setVariable', { variable: fieldValue(block, 'VARIABLE'), value: input('VALUE') });
            case 'data_changevariableby':
                return f('changeVariable', { variable: fieldValue(block, 'VARIABLE'), value: input('VALUE') });
            case 'control_wait':
                return f('wait', { secs: input('DURATION') });
            case 'control_wait_until':
                return f('waitUntil', { condition: input('CONDITION') });
            default:
                return generic(blocks, block);
        }
    };

    // 分岐・くり返しの条件の文
    const condition = (blocks, id) => inputValue(blocks, blocks[id], 'CONDITION');

    return { hat, statement, value, condition, format: f };
};
