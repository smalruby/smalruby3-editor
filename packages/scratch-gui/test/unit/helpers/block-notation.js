/**
 * A short one-line notation for Scratch blocks, for tests only (issue #1828).
 *
 * It lives under `test/` and not `src/lib/`: nothing in the editor needs it, and keeping it out of
 * the bundle means it can change with the tests.
 *
 * ```
 * event_whenflagclicked
 * motion_movesteps(STEPS: 10)
 * control_repeat(TIMES: 3) { looks_say(MESSAGE: "hi") }
 * control_if_else(CONDITION: operator_gt(OPERAND1: $x, OPERAND2: 1)) { motion_movesteps(STEPS: 1) } { }
 * data_setvariableto(VARIABLE = @_a_1_, VALUE: 1) #"@ruby:lvar:a:1"
 * ```
 *
 * - `opcode(...)`: a block. The parentheses can be left out when there is nothing in them.
 * - `NAME: value`: an input. The value is a block, a number (`10`, a number shadow), a string
 *   (`"hi"`, a text shadow), or a variable (`$x` / `@x`, the `data_variable` reporter).
 * - `NAME = value`: a field. The value is a string, a number, or a variable (`$x` is a variable of
 *   the stage, `@x` of the sprite; `$"my var"` for names with spaces). Fields named `LIST` hold a
 *   list and `BROADCAST_OPTION` a message; the other variable fields hold a variable.
 * - `{ ... }` after a block: its C-shaped substacks, in order `SUBSTACK`, `SUBSTACK2`, ... (if/else
 *   is `control_if_else(...) { ... } { ... }`). `{}` is an empty substack. `NAME: { ... }` puts a
 *   stack in any other input.
 * - Statements of one script are separated by a new line or `;`. A blank line starts the next script.
 * - `#"text"` right after a block is the block's comment (where the `@ruby:*` annotations live).
 *   `#"text"` alone on a line at the top is a comment of the sprite, not of a block.
 *
 * What is compared (see `printBlockNotation`): opcodes, fields, inputs, substacks, the order of
 * scripts and comments. Not compared: ids, positions, the shadow flag, the shadow hidden behind a
 * block in an input, and which `math_*` opcode holds a number (`10` matches `math_number`,
 * `math_whole_number`, ...). Mutations (custom blocks, `procedures_*`) are not supported yet; use
 * `test/helpers/expect-to-equal-blocks.js` for them.
 */

const NUMBER_OPCODES = ['math_number', 'math_integer', 'math_whole_number', 'math_positive_number', 'math_angle'];
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const IDENT_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const SUBSTACK_RE = /^SUBSTACK(\d*)$/;

const substackName = (index) => (index === 0 ? 'SUBSTACK' : `SUBSTACK${index + 1}`);

const isShadowOpcode = (opcode) => opcode === 'text' || NUMBER_OPCODES.includes(opcode) || /menu/i.test(opcode);

const variableTypeOfField = (fieldName) => {
    if (fieldName === 'LIST') return 'list';
    if (fieldName === 'BROADCAST_OPTION') return 'broadcast_msg';
    return '';
};

// --- tokenizer ---------------------------------------------------------------------------------

const tokenize = (text) => {
    const tokens = [];
    let i = 0;
    let line = 1;
    const fail = (message) => {
        throw new Error(`block notation: ${message} at line ${line}: ${text.split('\n')[line - 1]}`);
    };
    const readString = () => {
        let j = i + 1;
        while (j < text.length && text[j] !== '"') {
            if (text[j] === '\\') j++;
            if (text[j] === '\n') fail('unterminated string');
            j++;
        }
        if (j >= text.length) fail('unterminated string');
        const value = JSON.parse(text.slice(i, j + 1));
        i = j + 1;
        return value;
    };
    while (i < text.length) {
        const c = text[i];
        if (c === '\n') {
            tokens.push({ type: 'newline', line });
            line++;
            i++;
        } else if (c === ' ' || c === '\t' || c === '\r') {
            i++;
        } else if ('(){},:=;'.includes(c)) {
            tokens.push({ type: c, line });
            i++;
        } else if (c === '#') {
            i++;
            if (text[i] !== '"') fail('`#` must be followed by a string');
            tokens.push({ type: 'comment', value: readString(), line });
        } else if (c === '"') {
            tokens.push({ type: 'string', value: readString(), line });
        } else if (c === '$' || c === '@') {
            i++;
            let name;
            if (text[i] === '"') {
                name = readString();
            } else {
                const m = text.slice(i).match(/^[\p{L}\p{N}_]+/u);
                if (!m) fail(`a variable name must follow \`${c}\``);
                name = m[0];
                i += name.length;
            }
            tokens.push({ type: 'variable', scope: c, name, line });
        } else {
            const num = text.slice(i).match(/^-?\d+(\.\d+)?/);
            if (num) {
                tokens.push({ type: 'number', value: num[0], line });
                i += num[0].length;
                continue;
            }
            const ident = text.slice(i).match(/^[A-Za-z_][\w]*/);
            if (!ident) fail(`unexpected character \`${c}\``);
            tokens.push({ type: 'ident', value: ident[0], line });
            i += ident[0].length;
        }
    }
    tokens.push({ type: 'eof', line });
    return tokens;
};

// --- parser ------------------------------------------------------------------------------------

const numberNode = (value) => ({ opcode: 'math_number', fields: { NUM: { value } }, inputs: {}, shadow: true });
const textNode = (value) => ({ opcode: 'text', fields: { TEXT: { value } }, inputs: {}, shadow: true });
const variableNode = (variable) => ({
    opcode: 'data_variable',
    fields: { VARIABLE: { variable } },
    inputs: {},
});

/**
 * Parse the notation.
 * @param {string} text - The notation.
 * @returns {{scripts: Array<object>, targetComments: Array<string>}} The scripts as trees of nodes
 *     (`{opcode, fields, inputs, comment?, next?}`) and the comments of the sprite.
 */
const parseBlockNotation = (text) => {
    const tokens = tokenize(text);
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const fail = (message) => {
        const t = peek();
        throw new Error(`block notation: ${message} at line ${t.line}: ${text.split('\n')[t.line - 1]}`);
    };
    const expect = (type) => {
        if (peek().type !== type) fail(`expected \`${type}\` but got \`${peek().type}\``);
        return next();
    };
    // Inside parentheses new lines mean nothing.
    const skipNewlines = () => {
        while (peek().type === 'newline') next();
    };

    let parseStack; // eslint-disable-line prefer-const

    const parseComment = (node) => {
        if (peek().type === 'comment') node.comment = next().value;
        return node;
    };

    const parseBlock = () => {
        const opcode = expect('ident').value;
        const node = { opcode, fields: {}, inputs: {} };
        if (isShadowOpcode(opcode)) node.shadow = true;
        if (peek().type === '(') {
            next();
            skipNewlines();
            while (peek().type !== ')') {
                const name = expect('ident').value;
                const sep = next();
                skipNewlines();
                if (sep.type === '=') {
                    const t = next();
                    if (t.type === 'string' || t.type === 'number') {
                        node.fields[name] = { value: t.value };
                    } else if (t.type === 'variable') {
                        node.fields[name] = { variable: { scope: t.scope, name: t.name } };
                    } else {
                        pos--;
                        fail(`field ${name} needs a string, a number or a variable`);
                    }
                } else if (sep.type === ':') {
                    if (peek().type === '{') {
                        const stack = parseStack();
                        if (stack) node.inputs[name] = stack;
                    } else {
                        // eslint-disable-next-line no-use-before-define
                        node.inputs[name] = parseTerm();
                    }
                } else {
                    pos--;
                    fail(`expected \`:\` (input) or \`=\` (field) after ${name}`);
                }
                skipNewlines();
                if (peek().type === ',') {
                    next();
                    skipNewlines();
                } else if (peek().type !== ')') {
                    fail('expected `,` or `)`');
                }
            }
            next();
        }
        let index = 0;
        while (peek().type === '{') {
            const stack = parseStack();
            if (stack) node.inputs[substackName(index)] = stack;
            index++;
        }
        return node;
    };

    const parseTerm = () => {
        const t = peek();
        let node;
        if (t.type === 'number') {
            next();
            node = numberNode(t.value);
        } else if (t.type === 'string') {
            next();
            node = textNode(t.value);
        } else if (t.type === 'variable') {
            next();
            node = variableNode({ scope: t.scope, name: t.name });
        } else if (t.type === 'ident') {
            node = parseBlock();
        } else {
            fail(`expected a block, a number, a string or a variable but got \`${t.type}\``);
        }
        return parseComment(node);
    };

    // A sequence of statements up to `}` or a blank line (at the top). Returns the first node.
    const parseSequence = (topLevel, targetComments) => {
        let first = null;
        let last = null;
        for (;;) {
            const t = peek();
            if (t.type === ';') {
                next();
                continue;
            }
            if (t.type === 'newline') {
                next();
                if (topLevel && peek().type === 'newline' && first) break;
                continue;
            }
            if (t.type === 'eof' || t.type === '}') break;
            if (t.type === 'comment' && topLevel) {
                targetComments.push(next().value);
                continue;
            }
            const node = parseTerm();
            if (last) {
                last.next = node;
            } else {
                first = node;
            }
            last = node;
            const after = peek().type;
            if (!['newline', ';', '}', 'eof'].includes(after)) fail('expected a new line or `;` after a block');
        }
        return first;
    };

    parseStack = () => {
        expect('{');
        const first = parseSequence(false);
        expect('}');
        return first;
    };

    const scripts = [];
    const targetComments = [];
    while (peek().type !== 'eof') {
        const script = parseSequence(true, targetComments);
        if (script) scripts.push(script);
        if (peek().type === '}') fail('unexpected `}`');
    }
    return { scripts, targetComments };
};

// --- printer -----------------------------------------------------------------------------------

const quote = (s) => JSON.stringify(s);
const printVariable = ({ scope, name }) => `${scope}${IDENT_RE.test(name) ? name : quote(name)}`;
const printFieldValue = (field) => (field.variable ? printVariable(field.variable) : quote(field.value));

const isNumberLiteral = (node) =>
    NUMBER_OPCODES.includes(node.opcode) &&
    Object.keys(node.fields).length === 1 &&
    node.fields.NUM &&
    NUMBER_RE.test(node.fields.NUM.value) &&
    Object.keys(node.inputs).length === 0;
const isTextLiteral = (node) =>
    node.opcode === 'text' &&
    Object.keys(node.fields).length === 1 &&
    node.fields.TEXT &&
    !node.fields.TEXT.variable &&
    Object.keys(node.inputs).length === 0;
const isVariableShorthand = (node) =>
    node.opcode === 'data_variable' &&
    Object.keys(node.fields).length === 1 &&
    node.fields.VARIABLE &&
    node.fields.VARIABLE.variable &&
    Object.keys(node.inputs).length === 0;

const printComment = (node) =>
    node.comment !== undefined && node.comment !== null ? ` #${quote(node.comment)}` : '';

const indentLines = (text, indent) =>
    text
        .split('\n')
        .map((l) => (l ? indent + l : l))
        .join('\n');

let printStack; // eslint-disable-line prefer-const

/**
 * Print one block (without its `next`).
 * @param {object} node - The node.
 * @returns {string} The notation of the block.
 */
const printNode = (node) => {
    let head;
    if (isNumberLiteral(node)) {
        head = node.fields.NUM.value;
    } else if (isTextLiteral(node)) {
        head = quote(node.fields.TEXT.value);
    } else if (isVariableShorthand(node)) {
        head = printVariable(node.fields.VARIABLE.variable);
    } else {
        const args = [];
        Object.keys(node.fields)
            .sort()
            .forEach((name) => args.push(`${name} = ${printFieldValue(node.fields[name])}`));
        const substacks = [];
        Object.keys(node.inputs)
            .sort()
            .forEach((name) => {
                const input = node.inputs[name];
                const m = name.match(SUBSTACK_RE);
                if (m) {
                    substacks[m[1] ? Number(m[1]) - 1 : 0] = input;
                } else if (input.next) {
                    args.push(`${name}: {\n${indentLines(printStack(input), '  ')}\n}`);
                } else {
                    args.push(`${name}: ${printNode(input)}`);
                }
            });
        head = node.opcode + (args.length ? `(${args.join(', ')})` : '');
        for (let i = 0; i < substacks.length; i++) {
            head += substacks[i] ? ` {\n${indentLines(printStack(substacks[i]), '  ')}\n}` : ' {}';
        }
    }
    return head + printComment(node);
};

printStack = (node) => {
    const lines = [];
    for (let n = node; n; n = n.next) lines.push(printNode(n));
    return lines.join('\n');
};

/**
 * Print blocks in the one canonical form, so two sets of blocks can be compared as strings (and a
 * failure shows a readable line diff).
 * @param {{scripts: Array<object>, targetComments: Array<string>}} parsed - What `parseBlockNotation`
 *     or `readBlocks` returns.
 * @returns {string} The canonical notation.
 */
const printBlockNotation = (parsed) => {
    const chunks = [];
    if (parsed.targetComments.length) chunks.push(parsed.targetComments.map((c) => `#${quote(c)}`).join('\n'));
    parsed.scripts.forEach((s) => chunks.push(printStack(s)));
    return chunks.join('\n\n');
};

/**
 * Parse and print again: the canonical form of a notation.
 * @param {string} text - The notation.
 * @returns {string} The canonical notation.
 */
const normalizeBlockNotation = (text) => printBlockNotation(parseBlockNotation(text));

// --- to and from the VM blocks -----------------------------------------------------------------

/**
 * Write the blocks of a notation to a target, with the variables, lists, messages and comments they
 * use, so the generator can turn them into Ruby.
 * @param {string|object} notation - The notation, or what `parseBlockNotation` returns.
 * @param {object} target - The target (sprite or stage) to write to.
 * @param {object} stage - The stage, for `$` variables and messages.
 */
const buildBlocks = (notation, target, stage) => {
    const parsed = typeof notation === 'string' ? parseBlockNotation(notation) : notation;
    let seq = 0;
    const newId = (prefix) => `${prefix}${++seq}`;

    const ownerOf = (scope) => (scope === '$' || target.isStage ? stage : target);
    const lookupOrCreate = (owner, name, type) => {
        const found = Object.values(owner.variables).find((v) => v.name === name && v.type === type);
        if (found) return found;
        const id = newId('var');
        owner.createVariable(id, name, type);
        return owner.variables[id];
    };
    const addComment = (blockId, text) => {
        const id = newId('comment');
        target.createComment(id, blockId, text, 0, 0, 200, 200, true);
        return id;
    };

    const build = (node, parent, topLevel) => {
        const id = newId('block');
        const block = {
            id,
            opcode: node.opcode,
            inputs: {},
            fields: {},
            next: null,
            parent,
            topLevel,
            shadow: node.shadow === true,
            x: topLevel ? 0 : undefined,
            y: topLevel ? 0 : undefined,
        };
        Object.keys(node.fields).forEach((name) => {
            const field = node.fields[name];
            const type = variableTypeOfField(name);
            if (field.variable) {
                const v = lookupOrCreate(ownerOf(field.variable.scope), field.variable.name, type);
                block.fields[name] = { name, id: v.id, value: v.name, variableType: type };
            } else if (type === 'broadcast_msg') {
                const v = lookupOrCreate(stage, field.value, type);
                block.fields[name] = { name, id: v.id, value: v.name, variableType: type };
            } else {
                block.fields[name] = { name, value: field.value };
            }
        });
        // Children first in the input, so `createBlock` of the parent sees ids that exist.
        const children = [];
        Object.keys(node.inputs).forEach((name) => {
            const childId = build(node.inputs[name], id, false);
            const child = target.blocks.getBlock(childId);
            block.inputs[name] = { name, block: childId, shadow: child.shadow ? childId : null };
            children.push(childId);
        });
        if (node.comment !== undefined && node.comment !== null) block.comment = addComment(id, node.comment);
        target.blocks.createBlock(block);
        if (node.next) {
            const nextId = build(node.next, id, false);
            target.blocks.getBlock(id).next = nextId;
        }
        return id;
    };

    parsed.targetComments.forEach((text) => addComment(null, text));
    parsed.scripts.forEach((script) => build(script, null, true));
};

/**
 * Read the blocks of a target back as notation nodes (the inverse of `buildBlocks`).
 * @param {object} target - The target whose blocks to read.
 * @param {object} stage - The stage, to tell `$` variables from `@` ones.
 * @returns {{scripts: Array<object>, targetComments: Array<string>}} Same shape as `parseBlockNotation`.
 */
const readBlocks = (target, stage) => {
    const blocks = target.blocks._blocks;
    const scopeOf = (id, name, type) => {
        if (target.isStage) return '$';
        if (target.variables[id]) return '@';
        if (stage && stage.variables[id]) return '$';
        const onStage = stage && Object.values(stage.variables).some((v) => v.name === name && v.type === type);
        return onStage ? '$' : '@';
    };
    const read = (id) => {
        const block = blocks[id];
        if (!block) return null;
        const node = { opcode: block.opcode, fields: {}, inputs: {} };
        if (block.shadow) node.shadow = true;
        Object.keys(block.fields || {}).forEach((name) => {
            const field = block.fields[name];
            if (field.id && field.variableType !== 'broadcast_msg') {
                node.fields[name] = {
                    variable: { scope: scopeOf(field.id, field.value, field.variableType), name: field.value },
                };
            } else {
                node.fields[name] = { value: String(field.value) };
            }
        });
        Object.keys(block.inputs || {}).forEach((name) => {
            const child = read(block.inputs[name].block);
            if (child) node.inputs[name] = child;
        });
        if (block.comment && target.comments[block.comment]) node.comment = target.comments[block.comment].text;
        const nextNode = read(block.next);
        if (nextNode) node.next = nextNode;
        return node;
    };
    const scripts = Object.keys(blocks)
        .filter((id) => blocks[id].topLevel && !blocks[id].shadow)
        .map(read);
    const targetComments = Object.values(target.comments)
        .filter((c) => !c.blockId)
        .map((c) => c.text);
    return { scripts, targetComments };
};

export { parseBlockNotation, printBlockNotation, normalizeBlockNotation, buildBlocks, readBlocks };
