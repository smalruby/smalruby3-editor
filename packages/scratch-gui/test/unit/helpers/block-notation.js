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
 * - `NAME: value`: an input. The value is a block, a number (`10`, `1e3`, `.5`: a number shadow), a
 *   string (`"hi"`, a text shadow), or a variable (`$x` / `@x`, the `data_variable` reporter).
 * - `NAME = value`: a field. The value is a string, a number, or a variable (`$x` is a variable of
 *   the stage, `@x` of the sprite; `$"my var"` for names with spaces). Fields named `LIST` hold a
 *   list and `BROADCAST_OPTION` a message; the other variable fields hold a variable.
 * - `{ ... }` after a block: its C-shaped substacks, in order `SUBSTACK`, `SUBSTACK2`, ... (if/else
 *   is `control_if_else(...) { ... } { ... }`). `{}` is an empty substack. `NAME: { ... }` puts a
 *   stack in any other input. Giving an input twice (also `SUBSTACK: ...` together with `{}`) is an
 *   error.
 * - Statements of one script are separated by a new line or `;`. A blank line starts the next script.
 * - `#"text"` right after a block is the block's comment (where the `@ruby:*` annotations live).
 *   `#"text"` alone on a line at the top is a comment of the sprite, not of a block.
 *
 * Shadows and literal opcodes:
 *
 * - Numbers, strings, and blocks whose opcode is `text`, `math_*` or contains `menu` are shadows;
 *   every other block is not. This is compared: a menu that came out as a normal block prints as
 *   `noshadow motion_goto_menu(...)`, and `shadow <block>` / `noshadow <block>` states the other case.
 * - A bare `10` matches a number shadow of any `math_*` opcode, and `"hi"` a `text` shadow. When the
 *   opcode matters, write it: `math_angle(90)`, `math_whole_number(3)`, `text("hi")` (or
 *   `math_angle(NUM = 90)`). Then the opcode is compared too.
 *
 * What is compared (see `printBlockNotation` and `printBlockNotationLike`): opcodes, fields
 * (variables by name and by where they live), inputs, substacks, shadows, the order of scripts and
 * comments. Not compared: ids, positions, the shadow hidden behind a block in an input, and the
 * `math_*` opcode of a bare number. `readBlocks` fails on what the notation cannot show: blocks no
 * script reaches, fields pointing at a variable that does not exist or has another name, and an
 * input whose shadow block is not its `shadow`. Mutations (custom blocks, `procedures_*`) are not
 * supported yet; use `test/helpers/expect-to-equal-blocks.js` for them.
 */

const NUMBER_OPCODES = ['math_number', 'math_integer', 'math_whole_number', 'math_positive_number', 'math_angle'];
const NUMBER_SOURCE = '-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const NUMBER_RE = new RegExp(`^${NUMBER_SOURCE}$`);
const NUMBER_PREFIX_RE = new RegExp(`^${NUMBER_SOURCE}`);
const IDENT_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const SUBSTACK_RE = /^SUBSTACK(\d*)$/;

const substackName = (index) => (index === 0 ? 'SUBSTACK' : `SUBSTACK${index + 1}`);

const LITERAL_FIELD = { text: 'TEXT' };
NUMBER_OPCODES.forEach((opcode) => {
    LITERAL_FIELD[opcode] = 'NUM';
});

const isShadowOpcode = (opcode) => Object.hasOwn(LITERAL_FIELD, opcode) || /menu/i.test(opcode);

/**
 * Where a message about the notation points: the line, the column and a caret under it.
 * @param {string} text - The whole notation.
 * @param {number} index - The offset of the mistake.
 * @returns {string} `at line L, column C:` and the line with a caret.
 */
const whereIn = (text, index) => {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    let lineEnd = text.indexOf('\n', index);
    if (lineEnd < 0) lineEnd = text.length;
    const lineText = text.slice(lineStart, lineEnd);
    const line = text.slice(0, lineStart).split('\n').length;
    // Keep the tabs before the caret, so it lines up under the mistake.
    const pad = lineText.slice(0, index - lineStart).replace(/[^\t]/g, ' ');
    return `at line ${line}, column ${index - lineStart + 1}:\n${lineText}\n${pad}^`;
};

const notationError = (text, index, message) => new Error(`block notation: ${message} ${whereIn(text, index)}`);

const variableTypeOfField = (fieldName) => {
    if (fieldName === 'LIST') return 'list';
    if (fieldName === 'BROADCAST_OPTION') return 'broadcast_msg';
    return '';
};

// --- tokenizer ---------------------------------------------------------------------------------

const tokenize = (text) => {
    const tokens = [];
    let i = 0;
    const fail = (message, at = i) => {
        throw notationError(text, at, message);
    };
    const readString = () => {
        const start = i;
        let j = i + 1;
        while (j < text.length && text[j] !== '"') {
            if (text[j] === '\\') j++;
            if (text[j] === '\n') fail('unterminated string', start);
            j++;
        }
        if (j >= text.length) fail('unterminated string', start);
        let value;
        try {
            value = JSON.parse(text.slice(i, j + 1));
        } catch (e) {
            fail(`a string must be a JSON string (no raw tabs, no \\'): ${e.message}`, start);
        }
        i = j + 1;
        return value;
    };
    const push = (token, at) => tokens.push({ ...token, index: at });
    while (i < text.length) {
        const c = text[i];
        const at = i;
        if (c === '\n') {
            push({ type: 'newline' }, at);
            i++;
        } else if (c === ' ' || c === '\t' || c === '\r') {
            i++;
        } else if ('(){},:=;'.includes(c)) {
            push({ type: c }, at);
            i++;
        } else if (c === '#') {
            i++;
            if (text[i] !== '"') fail('`#` must be followed by a string', at);
            push({ type: 'comment', value: readString() }, at);
        } else if (c === '"') {
            push({ type: 'string', value: readString() }, at);
        } else if (c === '$' || c === '@') {
            i++;
            let name;
            if (text[i] === '"') {
                name = readString();
            } else {
                const m = text.slice(i).match(/^[\p{L}\p{N}_]+/u);
                if (!m) fail(`a variable name must follow \`${c}\``, at);
                name = m[0];
                i += name.length;
            }
            push({ type: 'variable', scope: c, name }, at);
        } else {
            const num = text.slice(i).match(NUMBER_PREFIX_RE);
            if (num) {
                push({ type: 'number', value: num[0] }, at);
                i += num[0].length;
                continue;
            }
            const ident = text.slice(i).match(/^[A-Za-z_][\w]*/);
            if (!ident) fail(`unexpected character \`${c}\``, at);
            push({ type: 'ident', value: ident[0] }, at);
            i += ident[0].length;
        }
    }
    push({ type: 'eof' }, text.length);
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
    const fail = (message, token = peek()) => {
        throw notationError(text, token.index, message);
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
        const opcodeToken = expect('ident');
        const opcode = opcodeToken.value;
        const node = { opcode, fields: {}, inputs: {} };
        if (isShadowOpcode(opcode)) node.shadow = true;
        if (Object.hasOwn(LITERAL_FIELD, opcode)) node.explicitOpcode = true;
        const given = new Set();
        const claim = (name, token) => {
            if (given.has(name)) fail(`${name} is given twice`, token);
            given.add(name);
        };
        if (peek().type === '(') {
            next();
            skipNewlines();
            // `math_angle(90)` / `text("hi")`: the value of a literal without its field name.
            const first = peek();
            if (Object.hasOwn(LITERAL_FIELD, opcode) && (first.type === 'number' || first.type === 'string')) {
                next();
                node.fields[LITERAL_FIELD[opcode]] = { value: first.value };
                skipNewlines();
                expect(')');
            } else {
                while (peek().type !== ')') {
                    const nameToken = expect('ident');
                    const name = nameToken.value;
                    claim(name, nameToken);
                    const sep = next();
                    skipNewlines();
                    if (sep.type === '=') {
                        const t = next();
                        if (t.type === 'string' || t.type === 'number') {
                            node.fields[name] = { value: t.value };
                        } else if (t.type === 'variable') {
                            node.fields[name] = { variable: { scope: t.scope, name: t.name } };
                        } else {
                            fail(`field ${name} needs a string, a number or a variable`, t);
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
                        fail(`expected \`:\` (input) or \`=\` (field) after ${name}`, sep);
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
        }
        let index = 0;
        while (peek().type === '{') {
            const name = substackName(index);
            if (given.has(name)) fail(`${name} is given twice (by name and by \`{}\`)`);
            given.add(name);
            const stack = parseStack();
            if (stack) node.inputs[name] = stack;
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
        } else if (t.type === 'ident' && (t.value === 'shadow' || t.value === 'noshadow')) {
            next();
            node = parseTerm();
            node.shadow = t.value === 'shadow';
            return node;
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

// A literal: `math_*` / `text` with only its value field (and no variable in it).
const isLiteral = (node) => {
    const field = LITERAL_FIELD[node.opcode];
    return (
        Boolean(field) &&
        Object.keys(node.fields).length === 1 &&
        Boolean(node.fields[field]) &&
        !node.fields[field].variable &&
        Object.keys(node.inputs).length === 0
    );
};
const isNumberLiteral = (node) =>
    isLiteral(node) && LITERAL_FIELD[node.opcode] === 'NUM' && NUMBER_RE.test(node.fields.NUM.value);
const isTextLiteral = (node) => isLiteral(node) && node.opcode === 'text';
const defaultShadow = (node) => isShadowOpcode(node.opcode);
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
    if (isLiteral(node) && (node.explicitOpcode || !(isNumberLiteral(node) || isTextLiteral(node)))) {
        // The opcode is stated, or the value is no number (`math_number("")`): `math_angle(90)`.
        const value = node.fields[LITERAL_FIELD[node.opcode]].value;
        head = `${node.opcode}(${isNumberLiteral(node) ? value : quote(value)})`;
    } else if (isNumberLiteral(node)) {
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
    const shadow = node.shadow === true;
    if (shadow !== defaultShadow(node)) head = `${shadow ? 'shadow' : 'noshadow'} ${head}`;
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

/**
 * Copy which literals state their opcode from `expected` to the same places in `actual`, so a bare
 * `10` in the expectation matches any `math_*` opcode and `math_angle(90)` matches only that one.
 * @param {object} actual - Nodes read from blocks (`readBlocks`); changed in place.
 * @param {object} expected - Nodes parsed from the expected notation.
 */
const alignExplicitOpcodes = (actual, expected) => {
    const align = (a, e) => {
        for (; a && e; a = a.next, e = e.next) {
            if (e.explicitOpcode) a.explicitOpcode = true;
            Object.keys(a.inputs).forEach((name) => align(a.inputs[name], e.inputs[name]));
        }
    };
    actual.scripts.forEach((script, i) => align(script, expected.scripts[i]));
};

/**
 * Print `actual` and `expected` for comparison: both canonical, with `actual`'s literals stating
 * their opcode where `expected` does.
 * @param {object} actual - Nodes read from blocks.
 * @param {string} expectedText - The expected notation.
 * @returns {{actual: string, expected: string}} The two canonical notations.
 */
const printBlockNotationLike = (actual, expectedText) => {
    const expected = parseBlockNotation(expectedText);
    alignExplicitOpcodes(actual, expected);
    return { actual: printBlockNotation(actual), expected: printBlockNotation(expected) };
};

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
    const reached = new Set();
    const fail = (block, message) => {
        throw new Error(`readBlocks: ${block.opcode} (${block.id}): ${message}`);
    };
    const variableOf = (block, field) => {
        const own = target.variables[field.id];
        const v = own || (stage && stage.variables[field.id]);
        if (!v)
            fail(block, `field ${field.name} points to variable ${field.id} (${field.value}), which does not exist`);
        if (v.name !== field.value) {
            fail(block, `field ${field.name} says "${field.value}" but variable ${field.id} is named "${v.name}"`);
        }
        if (field.variableType !== undefined && v.type !== field.variableType) {
            fail(block, `field ${field.name} is of type "${field.variableType}" but the variable is "${v.type}"`);
        }
        return { variable: v, onStage: target.isStage || !own };
    };
    const read = (id) => {
        const block = blocks[id];
        if (!block) return null;
        reached.add(id);
        const node = { opcode: block.opcode, fields: {}, inputs: {} };
        if (block.shadow) node.shadow = true;
        Object.keys(block.fields || {}).forEach((name) => {
            const field = block.fields[name];
            if (field.id) {
                const { onStage } = variableOf(block, field);
                node.fields[name] =
                    field.variableType === 'broadcast_msg'
                        ? { value: String(field.value) }
                        : { variable: { scope: onStage ? '$' : '@', name: field.value } };
            } else {
                node.fields[name] = { value: String(field.value) };
            }
        });
        Object.keys(block.inputs || {}).forEach((name) => {
            const input = block.inputs[name];
            const child = read(input.block);
            if (input.shadow && blocks[input.shadow]) reached.add(input.shadow);
            if (!child) return;
            if (child.shadow && input.shadow !== input.block) {
                fail(block, `input ${name} holds the shadow ${child.opcode} but its shadow is ${input.shadow}`);
            }
            node.inputs[name] = child;
        });
        if (block.comment && target.comments[block.comment]) node.comment = target.comments[block.comment].text;
        const nextNode = read(block.next);
        if (nextNode) node.next = nextNode;
        return node;
    };
    const scripts = Object.keys(blocks)
        .filter((id) => blocks[id].topLevel && !blocks[id].shadow)
        .map(read);
    const lost = Object.keys(blocks).filter((id) => !reached.has(id));
    if (lost.length) {
        const list = lost.map((id) => `${blocks[id].opcode} (${id})`).join(', ');
        throw new Error(`readBlocks: blocks that no script reaches: ${list}`);
    }
    const targetComments = Object.values(target.comments)
        .filter((c) => !c.blockId)
        .map((c) => c.text);
    return { scripts, targetComments };
};

export {
    parseBlockNotation,
    printBlockNotation,
    printBlockNotationLike,
    normalizeBlockNotation,
    buildBlocks,
    readBlocks,
};
