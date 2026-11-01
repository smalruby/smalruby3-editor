// Which blocks the AI's version adds or changes, and what they say (#1281).
// Works on the VM's block data (`{id: {opcode, next, parent, inputs, fields, ...}}`),
// which is also what the Ruby converter makes, so the same diff serves the check
// before putting the answer in and the marks in the editor after it. The block
// definitions are passed in, so this file stays free of scratch-blocks.

// Inputs that hold a stack of blocks (the inside of 「もし」「くり返す」 etc.).
const STACK_INPUT = /^SUBSTACK\d*$/;
// A block inside another one more deeply than this is not followed (broken data).
const MAX_DEPTH = 50;

const isStackInput = (name) => STACK_INPUT.test(name);

/**
 * What a block is, apart from where it is: its opcode, its fields and what is put
 * in its inputs (deeply), but not the blocks below it or inside it.
 * @param {object} block - a block.
 * @param {object} blocks - all the blocks of the target, by id.
 * @param {number} [depth] - how deep in the input chain this block is.
 * @returns {string} the same string for the same block.
 */
const blockSignature = (block, blocks, depth = 0) => {
    if (!block) return '';
    if (depth > MAX_DEPTH) return block.opcode;
    const fields = Object.keys(block.fields || {})
        .sort()
        .map((name) => `${name}=${block.fields[name].value}`);
    const inputs = Object.keys(block.inputs || {})
        .filter((name) => !isStackInput(name))
        .sort()
        .map((name) => `${name}:${blockSignature(blocks[block.inputs[name].block], blocks, depth + 1)}`);
    const proccode = block.mutation && block.mutation.proccode ? `#${block.mutation.proccode}` : '';
    return `${block.opcode}${proccode}(${fields.join(',')}|${inputs.join(',')})`;
};

/**
 * The blocks a student sees as their own (not the values put in other blocks),
 * script by script, in order from the top.
 * @param {object} blocks - all the blocks of the target, by id.
 * @returns {Array<{id: string, script: string, top: string, signature: string}>} `script`
 *     tells scripts apart (the same top block twice is two scripts), `top` is its top block.
 */
const stackBlocks = (blocks) => {
    const list = [];
    const seen = new Set();
    const tops = Object.values(blocks || {}).filter((block) => block.topLevel && !block.shadow);
    const counts = {};
    tops.forEach((top) => {
        const signature = blockSignature(top, blocks);
        counts[signature] = (counts[signature] || 0) + 1;
        const script = `${signature}#${counts[signature]}`;
        const visit = (id, depth) => {
            if (depth > MAX_DEPTH) return;
            for (let block = blocks[id]; block && !seen.has(block.id); block = blocks[block.next]) {
                seen.add(block.id);
                list.push({ id: block.id, script, top: top.id, signature: blockSignature(block, blocks) });
                Object.keys(block.inputs || {})
                    .filter(isStackInput)
                    .forEach((name) => visit(block.inputs[name].block, depth + 1));
            }
        };
        visit(top.id, 0);
    });
    return list;
};

/**
 * Compare the program now with the AI's version. A block that is the same (in the
 * same script first, then anywhere) is unchanged. Of the rest, a block of the same
 * kind in the same script is "changed"; the others are added or removed.
 * @param {object} before - the blocks now, by id.
 * @param {object} after - the blocks of the AI's version, by id.
 * @returns {object} `{added, changed, removed}`: `added` are `{id, top}` (ids in `after`),
 *     `changed` are `{id, top, beforeId}`, `removed` are `{id}` (ids in `before`).
 */
const diffBlocks = (before, after) => {
    const olds = stackBlocks(before).map((entry) => ({ ...entry, used: false }));
    const news = stackBlocks(after).map((entry) => ({ ...entry, match: null }));
    const take = (entry, test) => {
        const found = olds.find((old) => !old.used && test(old));
        if (found) {
            found.used = true;
            entry.match = found;
        }
        return found;
    };
    news.forEach((entry) => take(entry, (old) => old.signature === entry.signature && old.script === entry.script));
    news.filter((entry) => !entry.match).forEach((entry) => take(entry, (old) => old.signature === entry.signature));
    const added = [];
    const changed = [];
    const opcodeOf = (blocks, id) => blocks[id].opcode;
    news.filter((entry) => !entry.match).forEach((entry) => {
        const old = take(
            entry,
            (candidate) =>
                candidate.script === entry.script && opcodeOf(before, candidate.id) === opcodeOf(after, entry.id),
        );
        if (old) changed.push({ id: entry.id, top: entry.top, beforeId: old.id });
        else added.push({ id: entry.id, top: entry.top });
    });
    const removed = olds.filter((old) => !old.used).map((old) => ({ id: old.id }));
    return { added, changed, removed };
};

/**
 * The JSON a block definition gives to `jsonInit` (scratch-blocks defines most
 * blocks as `init () { this.jsonInit({...}) }`, with the messages of the editor
 * language already in it).
 * @param {object} definitions - `ScratchBlocks.Blocks`.
 * @param {string} opcode - the block's opcode.
 * @returns {?object} the JSON, or null when the block is not defined that way.
 */
const definitionJson = (definitions, opcode) => {
    const definition = definitions && definitions[opcode];
    if (!definition || typeof definition.init !== 'function') return null;
    let json = null;
    // Some definitions read the workspace first (「旗が押されたとき」 finds its flag image there).
    const probe = {
        workspace: { options: { pathToMedia: '' } },
        jsonInit: (value) => {
            json = value;
        },
    };
    try {
        definition.init.call(probe);
    } catch {
        // A definition doing more than jsonInit: what it gave so far is enough.
    }
    return json;
};

// The label of a dropdown value (「色」 for 'COLOR'), or the value itself.
// A menu made when it opens (「端」「マウスのポインター」 and the sprites) gives its options
// from a function; one that needs the block on the editor fails here and shows the value.
const optionLabel = (arg, value) => {
    let options = arg && arg.options;
    if (typeof options === 'function') {
        try {
            options = options();
        } catch {
            options = null;
        }
    }
    const option = Array.isArray(options) && options.find((pair) => Array.isArray(pair) && pair[1] === value);
    return option && typeof option[0] === 'string' ? option[0] : value;
};

/**
 * What a block says, as on the block: 「(ニャー) の音を鳴らす」. Values put in it are in
 * ( ) and a menu of the block itself (a variable, a message) is in [ ].
 * @param {object} block - a block.
 * @param {object} blocks - all the blocks of the target, by id.
 * @param {object} definitions - `ScratchBlocks.Blocks`.
 * @param {number} [depth] - how deep in the input chain this block is.
 * @returns {string} the words of the block.
 */
const blockText = (block, blocks, definitions, depth = 0) => {
    if (!block) return '';
    const json = definitionJson(definitions, block.opcode);
    const fieldOf = (name) => (block.fields && block.fields[name] ? block.fields[name].value : '');
    const inputOf = (name) => {
        const input = block.inputs && block.inputs[name];
        const inner = input && blocks[input.block];
        if (!inner) return '( )';
        if (depth >= MAX_DEPTH) return '(…)';
        if (inner.shadow) {
            // A shadow is a number, a text or a menu: its only field is what it shows.
            const names = Object.keys(inner.fields || {});
            const innerJson = definitionJson(definitions, inner.opcode);
            const arg = innerJson && (innerJson.args0 || []).find((a) => a.name === names[0]);
            return `(${names.length > 0 ? optionLabel(arg, inner.fields[names[0]].value) : ''})`;
        }
        return `(${blockText(inner, blocks, definitions, depth + 1)})`;
    };
    if (!json || typeof json.message0 !== 'string') {
        // A block of the student's own (「定義」 blocks): its words are in the mutation.
        const proccode = block.mutation && block.mutation.proccode;
        if (proccode) return proccode.replace(/%[snb]/g, '( )').trim();
        return block.opcode;
    }
    const text = json.message0.replace(/%(\d+)/g, (whole, index) => {
        const arg = (json.args0 || [])[Number(index) - 1];
        if (!arg) return '';
        if (arg.type === 'input_value') return inputOf(arg.name);
        // The flag of 「(旗) が押されたとき」 is the only picture that says something.
        if (arg.type === 'field_image') return /green-flag/.test(arg.src || '') ? '🏁' : '';
        if (arg.type === 'input_statement' || arg.type === 'input_dummy') return '';
        if (typeof arg.type === 'string' && arg.type.startsWith('field_')) {
            return `[${optionLabel(arg, fieldOf(arg.name))}]`;
        }
        return '';
    });
    return text.replace(/\s+/g, ' ').trim();
};

/**
 * The changes of a diff in the words of the blocks, for the list in the panel.
 * @param {object} diff - from diffBlocks.
 * @param {object} before - the blocks now, by id.
 * @param {object} after - the blocks of the AI's version, by id.
 * @param {object} definitions - `ScratchBlocks.Blocks`.
 * @returns {Array<object>} `{kind, id, text, beforeText, scriptText}`: `kind` is
 *     'added', 'changed' or 'removed'; `scriptText` is the top block of the script it
 *     is in (null for the top block itself); `id` is in `after` (in `before` when removed).
 */
const describeChanges = (diff, before, after, definitions) => {
    const scriptOf = (entry) => (entry.top === entry.id ? null : blockText(after[entry.top], after, definitions));
    return [
        ...diff.added.map((entry) => ({
            kind: 'added',
            id: entry.id,
            text: blockText(after[entry.id], after, definitions),
            beforeText: null,
            scriptText: scriptOf(entry),
        })),
        ...diff.changed.map((entry) => ({
            kind: 'changed',
            id: entry.id,
            text: blockText(after[entry.id], after, definitions),
            beforeText: blockText(before[entry.beforeId], before, definitions),
            scriptText: scriptOf(entry),
        })),
        ...diff.removed.map((entry) => ({
            kind: 'removed',
            id: entry.id,
            text: blockText(before[entry.id], before, definitions),
            beforeText: null,
            scriptText: null,
        })),
    ];
};

export { blockSignature, blockText, definitionJson, describeChanges, diffBlocks, stackBlocks };
