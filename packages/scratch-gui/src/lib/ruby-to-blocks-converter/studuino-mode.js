// Studuino モードの Ruby → ブロック（#2218・S3）。形の正は docs/studuino-mode/README.md の「Ruby」。
//
// - `class Studuino ... end`（ステージの先頭に 1 つだけ）を読んで、ポートの設定と補正値を作る。
//   ブロックには出さず、ブロックを書きこむとき（applyTargetBlocks）に設定を置きかえ、
//   Studuino モードにする。
// - `studuino.<部品>_<ポート>` の呼び出しを部品のブロックにする。宣言していないポートの部品は
//   エラー。class が無いコード（スプライト・通常モード）は、いまの設定を宣言とみなす。
// - Studuino モードのコードでは、通常モードの呼び出し（`studuino.action(...)` など）はエラー。
import {
    MODE_STUDUINO,
    PORT_NAMES,
    getStuduinoSettings,
    setStuduinoSettings,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import {
    MENU_FORM,
    PART_CALIBRATIONS,
    PART_CALLS,
    PART_KINDS,
    MOVE_RESERVED_SERVO_MOTORS_METHOD,
    STUDUINO_CLASS_NAME,
    STUDUINO_OPCODES,
    STUDUINO_RECEIVER,
    allPartMethodNames,
    isPartAllowedAtPort,
    parsePartMethodName,
    partMethodName,
} from '../studuino-ruby/studuino-ruby';
import { messages } from './converter-errors';
import { RubyToBlocksConverterError } from './errors';
import { nodeTypeName } from './node-walk';

const unescapedOf = (unescaped) =>
    typeof unescaped === 'object' && unescaped !== null ? unescaped.value : unescaped;

const isStuduinoClassNode = (node) =>
    nodeTypeName(node) === 'ClassNode' &&
    nodeTypeName(node.constantPath) === 'ConstantReadNode' &&
    String(node.constantPath.name) === STUDUINO_CLASS_NAME;

/**
 * The value of an integer literal (`90`, `-5`), or null.
 * @param {object} node - A prism node.
 * @returns {?number} The integer.
 */
const integerOf = (node) => {
    const type = nodeTypeName(node);
    if (type === 'IntegerNode') return Number(node.value);
    if (type === 'CallNode' && String(node.name) === '-@' && node.receiver && !node.arguments_) {
        const inner = integerOf(node.receiver);
        return inner === null ? null : -inner;
    }
    return null;
};

/**
 * The methods mixed into RubyToBlocksConverter.prototype (stages.js).
 * @type {object}
 */
const StuduinoMode = {
    _studuinoError(node, message, values) {
        return new RubyToBlocksConverterError(node, this._translator(messages[message], values));
    },

    /**
     * Read `class Studuino` of the code before converting, so that a call of a part anywhere in the
     * code knows the declarations. Without the class, the declarations are the port settings of
     * the project (a sprite, or a program of normal mode).
     * @param {object} root - The ProgramNode.
     */
    _analyzeStuduino(root) {
        const runtime = this.vm && this.vm.runtime;
        const current = getStuduinoSettings(runtime);
        const statements = root && root.statements && Array.isArray(root.statements.body) ? root.statements.body : [];
        const classNodes = statements.filter(isStuduinoClassNode);
        const studuino = {
            declared: false,
            classNode: null,
            mode: current.mode,
            ports: current.ports,
            calibration: current.calibration,
        };
        this._context.studuino = studuino;
        if (classNodes.length === 0) return;

        const target = this._context.target;
        if (!target || !target.isStage) {
            throw this._studuinoError(classNodes[0], 'studuinoClassOnlyInStage');
        }
        if (classNodes.length > 1) {
            throw this._studuinoError(classNodes[1], 'studuinoClassDuplicated');
        }
        const parsed = this._parseStuduinoClass(classNodes[0]);
        Object.assign(studuino, parsed, { declared: true, classNode: classNodes[0], mode: MODE_STUDUINO });
    },

    /**
     * The port settings that `class Studuino` declares.
     * @param {object} node - The ClassNode.
     * @returns {{ports: object, calibration: object}} The ports and the calibration.
     */
    _parseStuduinoClass(node) {
        if (node.superclass) {
            throw this._studuinoError(node, 'studuinoWrongDeclaration', {
                SOURCE: this._firstLineSource(node),
            });
        }
        const body = node.body;
        if (body && nodeTypeName(body) !== 'StatementsNode') {
            throw this._studuinoError(node, 'studuinoWrongDeclaration', { SOURCE: this._firstLineSource(node) });
        }
        const ports = {};
        const calibration = { dcMotor: {}, servoMotor: {} };
        (body ? body.body : []).forEach((stmt) => {
            const source = this._truncateSource(this._getSource(stmt));
            const args = stmt.arguments_ ? stmt.arguments_.arguments_ : [];
            if (nodeTypeName(stmt) !== 'CallNode' || stmt.receiver || stmt.block || args.length === 0) {
                throw this._studuinoError(stmt, 'studuinoWrongDeclaration', { SOURCE: source });
            }
            const kind = String(stmt.name);
            if (!PART_KINDS.includes(kind)) {
                throw this._studuinoError(stmt, 'studuinoUnknownPart', {
                    SOURCE: source,
                    PARTS: PART_KINDS.join(', '),
                });
            }
            const [portNode, ...rest] = args;
            if (nodeTypeName(portNode) !== 'SymbolNode') {
                throw this._studuinoError(stmt, 'studuinoWrongDeclaration', { SOURCE: source });
            }
            const port = String(unescapedOf(portNode.unescaped));
            if (!PORT_NAMES.includes(port)) {
                throw this._studuinoError(stmt, 'studuinoUnknownPort', { PORT: port });
            }
            if (!isPartAllowedAtPort(kind, port)) {
                throw this._studuinoError(stmt, 'studuinoPartNotForPort', { PART: kind, PORT: port });
            }
            if (ports[port]) {
                throw this._studuinoError(stmt, 'studuinoPortDuplicated', { PORT: port });
            }
            ports[port] = kind;

            if (rest.length === 0) return;
            const options = rest[0];
            const elements = nodeTypeName(options) === 'KeywordHashNode' ? options.elements : null;
            const cal = PART_CALIBRATIONS[kind];
            if (rest.length > 1 || !elements) {
                throw this._studuinoError(stmt, 'studuinoWrongDeclaration', { SOURCE: source });
            }
            elements.forEach((element) => {
                const keyOk =
                    nodeTypeName(element) === 'AssocNode' &&
                    nodeTypeName(element.key) === 'SymbolNode' &&
                    unescapedOf(element.key.unescaped) === 'calibration';
                if (!keyOk) {
                    throw this._studuinoError(stmt, 'studuinoWrongDeclaration', { SOURCE: source });
                }
                const value = integerOf(element.value);
                if (!cal) {
                    throw this._studuinoError(stmt, 'studuinoNoCalibration', { PART: kind });
                }
                if (value === null || value < cal.range.min || value > cal.range.max) {
                    throw this._studuinoError(stmt, 'studuinoBadCalibration', {
                        PART: kind,
                        MIN: cal.range.min,
                        MAX: cal.range.max,
                    });
                }
                if (value !== cal.range.default) calibration[cal.key][port] = value;
            });
        });
        return { ports, calibration };
    },

    /**
     * `class Studuino` makes no blocks: it was read by `_analyzeStuduino`. A `class Studuino` that
     * it did not read (inside another class or a block) is an error.
     * @param {object} node - The ClassNode.
     * @returns {?Array} An empty list for the class that was read, or null for another class.
     */
    _visitStuduinoClass(node) {
        if (!isStuduinoClassNode(node)) return null;
        const studuino = this._context.studuino;
        if (!studuino || studuino.classNode !== node) {
            throw this._studuinoError(node, 'studuinoClassNotAtTop');
        }
        return [];
    },

    /**
     * Whether the code is a program of Studuino mode: it has `class Studuino`, or the project is
     * in Studuino mode.
     * @returns {boolean} true in Studuino mode.
     */
    _isStuduinoModeCode() {
        const studuino = this._context.studuino;
        return !!studuino && studuino.mode === MODE_STUDUINO;
    },

    /**
     * Write the port settings that `class Studuino` declared into the project (from
     * applyTargetBlocks). Without the class, the settings are left as they are.
     */
    _applyStuduinoSettings() {
        const studuino = this._context.studuino;
        const runtime = this.vm && this.vm.runtime;
        if (!studuino || !studuino.declared || !runtime) return;
        const current = getStuduinoSettings(runtime);
        setStuduinoSettings(runtime, {
            ...current,
            mode: MODE_STUDUINO,
            ports: { ...studuino.ports },
            calibration: {
                dcMotor: { ...studuino.calibration.dcMotor },
                servoMotor: { ...studuino.calibration.servoMotor },
            },
        });
    },
};

/**
 * Put the value of a menu argument on a block, in the form of `MENU_FORM` (a field now; a menu
 * block when #2216 makes the menus shadows).
 * @param {object} converter - The converter.
 * @param {object} block - The block.
 * @param {string} name - The name of the argument.
 * @param {string} value - The value.
 */
const putMenu = (converter, block, name, value) => {
    const opcode = MENU_FORM.opcodes[name];
    if (MENU_FORM.form === 'shadow' && opcode) {
        converter.addFieldInput(block, name, opcode, name, value, value);
    } else {
        converter.addField(block, name, value);
    }
};

/**
 * Check that a part is declared at a port, or throw the error of the conversion.
 * @param {object} converter - The converter.
 * @param {object} node - The node of the call.
 * @param {string} kind - The part.
 * @param {string} port - The port.
 */
const checkDeclared = (converter, node, kind, port) => {
    if (!isPartAllowedAtPort(kind, port)) {
        throw converter._studuinoError(node, 'studuinoPartNotForPort', { PART: kind, PORT: port });
    }
    const studuino = converter._context.studuino;
    const ports = (studuino && studuino.ports) || {};
    if (ports[port] !== kind) {
        throw converter._studuinoError(node, 'studuinoPartNotDeclared', {
            SOURCE: `${STUDUINO_RECEIVER}.${partMethodName(kind, port)}`,
            PART: kind,
            PORT: port,
            DECLARATION: `${kind} :${port}`,
        });
    }
};

/**
 * Change the text of the Ruby expression block of the receiver (`studuino` → `studuino.led_a0`),
 * so that the method after it (`.on`) finds the part by the receiver name.
 * @param {object} converter - The converter.
 * @param {object} receiver - The Ruby expression block of `studuino`.
 * @param {string} text - The new text.
 * @returns {object} The block.
 */
const renameExpression = (converter, receiver, text) => {
    const textBlock = converter._context.blocks[receiver.inputs.EXPRESSION.block];
    textBlock.fields.TEXT.value = text;
    return receiver;
};

/**
 * Register the calls of the parts on `studuino`.
 * @param {object} converter - The converter.
 */
const registerStuduinoParts = (converter) => {
    const valueCalls = new Map(PART_CALLS.filter((c) => !c.method).map((c) => [c.kind, c]));

    // `studuino.<part>_<port>`: a sensor is a value block; another part is the receiver of a method
    allPartMethodNames().forEach((name) => {
        const { kind, port } = parsePartMethodName(name);
        converter.registerOnSend(STUDUINO_RECEIVER, name, 0, (params) => {
            const { receiver, node } = params;
            checkDeclared(converter, node, kind, port);
            const valueCall = valueCalls.get(kind);
            if (valueCall) {
                const block = converter.changeRubyExpressionBlock(receiver, valueCall.opcode, valueCall.type);
                putMenu(converter, block, 'PORT', port);
                return block;
            }
            return renameExpression(converter, receiver, `${STUDUINO_RECEIVER}.${name}`);
        });
    });

    // `studuino.<part>_<port>.<method>`
    PART_CALLS.filter((c) => c.method).forEach((call) => {
        PORT_NAMES.filter((port) => isPartAllowedAtPort(call.kind, port)).forEach((port) => {
            const receiverName = `${STUDUINO_RECEIVER}.${partMethodName(call.kind, port)}`;
            converter.registerOnSend(receiverName, call.method, call.arg ? 1 : 0, (params) => {
                const { receiver, args } = params;
                if (call.arg && !converter.isNumberOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(receiver, call.opcode, call.type || 'statement');
                putMenu(converter, block, 'PORT', port);
                if (call.fields) {
                    Object.entries(call.fields).forEach(([field, value]) => putMenu(converter, block, field, value));
                }
                if (call.arg) {
                    converter.addNumberInput(block, call.arg.name, 'math_number', args[0], call.arg.default);
                }
                return block;
            });
        });
    });

    // `studuino.move_reserved_servo_motors` / `studuino.move_reserved_servo_motors(1)`: move the
    // reserved servo motors together, at once or in some seconds (#2352). No port, so nothing to declare
    converter.registerOnSend(STUDUINO_RECEIVER, MOVE_RESERVED_SERVO_MOTORS_METHOD, 0, (params) =>
        converter.changeRubyExpressionBlock(params.receiver, STUDUINO_OPCODES.servoMoveReserved, 'statement'),
    );
    converter.registerOnSend(STUDUINO_RECEIVER, MOVE_RESERVED_SERVO_MOTORS_METHOD, 1, (params) => {
        const { receiver, args } = params;
        if (!converter.isNumberOrBlock(args[0])) return null;
        const block = converter.changeRubyExpressionBlock(
            receiver,
            STUDUINO_OPCODES.servoMoveReservedIn,
            'statement',
        );
        converter.addNumberInput(block, 'SECS', 'math_number', args[0], 1);
        return block;
    });
};

export { StuduinoMode as default, registerStuduinoParts, isStuduinoClassNode };
