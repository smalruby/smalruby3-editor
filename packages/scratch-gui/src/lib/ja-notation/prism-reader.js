// SPDX-License-Identifier: MIT
// ja-notation: the one place that reads the nodes of prism (the Ruby parser).
// See ./LICENSE and docs/ruby-editor/converter-roadmap.md (the risk of a new
// version of prism).
//
// prism is not imported: its parse function is given by the caller. Of a node,
// only its kind (`type` of `toJSON()`, e.g. `CallNode`) and the fields the
// reading needs are read, through these functions. The class names cannot be
// used, as a production build renames them.

/** The fields of each node, read once. */
const fieldsOfNode = new WeakMap();

/**
 * The fields of a prism node (`toJSON()`: `type`, `location` and its children).
 * @param {object} node - The node.
 * @returns {object} The fields.
 */
const fieldsOf = (node) => {
    let fields = fieldsOfNode.get(node);
    if (!fields) {
        fields = node.toJSON();
        fieldsOfNode.set(node, fields);
    }
    return fields;
};

/**
 * The kind of a prism node (`CallNode`, `IfNode`, ...), or null for anything else.
 * @param {*} node - A value.
 * @returns {?string} The kind.
 */
const typeOf = (node) => (node && typeof node.toJSON === 'function' ? fieldsOf(node).type : null);

/**
 * A field of a prism node.
 * @param {object} node - The node.
 * @param {string} name - The field (`receiver`, `statements`, ...).
 * @returns {*} Its value (null when the node has no such field).
 */
const field = (node, name) => {
    const value = fieldsOf(node)[name];
    return typeof value === 'undefined' ? null : value;
};

/**
 * Whether a flag of a node is set (`isVariableCall`, `isBeginModifier`, `isExcludeEnd`).
 * @param {object} node - The node.
 * @param {string} method - The method of the flag.
 * @returns {boolean} True if it is set.
 */
const hasFlag = (node, method) => typeof node[method] === 'function' && Boolean(node[method]());

/**
 * The statements of a `StatementsNode` (none for null).
 * @param {?object} node - The node.
 * @returns {Array<object>} The statements.
 */
const statementsOf = (node) => (node && typeOf(node) === 'StatementsNode' ? field(node, 'body') : []);

/**
 * The child nodes of a node, in the order of the source.
 * @param {object} node - The node.
 * @returns {Array<object>} The children.
 */
const childrenOf = (node) => (typeof node.childNodes === 'function' ? node.childNodes().filter(Boolean) : []);

/**
 * A call as the reading sees it: `receiver.name(args)` and its block.
 * @param {object} node - A node.
 * @returns {?object} `{node, name, receiver, args, hasParens, block, isVariableCall}`, or null
 *   when the node is not a call. `args` is null when an argument is not a plain value
 *   (`*a`, `k: 1`, `&b`).
 */
const callOf = (node) => {
    if (typeOf(node) !== 'CallNode') return null;
    const argumentsNode = field(node, 'arguments');
    let args = argumentsNode ? field(argumentsNode, 'arguments') : [];
    const plain = (arg) => !/^(?:Splat|KeywordHash|BlockArgument|Forwarding)/.test(typeOf(arg) || '');
    if (!args.every(plain)) args = null;
    return {
        node,
        name: field(node, 'name'),
        receiver: field(node, 'receiver'),
        args,
        hasParens: field(node, 'openingLoc') !== null,
        block: field(node, 'block'),
        isVariableCall: hasFlag(node, 'isVariableCall'),
    };
};

/**
 * The node inside `( ... )` when it holds one statement, else the node itself.
 * @param {object} node - The node.
 * @returns {object} The node.
 */
const unwrap = (node) => {
    let inner = node;
    while (typeOf(inner) === 'ParenthesesNode') {
        const body = statementsOf(field(inner, 'body'));
        if (body.length !== 1) break;
        inner = body[0];
    }
    return inner;
};

/**
 * Where each character of the source is: prism gives byte offsets in UTF-8,
 * and the JaAST lines and columns of characters.
 */
class SourceIndex {
    /**
     * @param {string} source - The Ruby source.
     */
    constructor(source) {
        this.source = source;
        this.charOfByte = [];
        let byte = 0;
        for (let i = 0; i < source.length; i++) {
            const code = source.codePointAt(i);
            const size = code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
            for (let k = 0; k < size; k++) this.charOfByte[byte + k] = i;
            byte += size;
            if (code >= 0x10000) i++;
        }
        this.charOfByte[byte] = source.length;
        this.lineStarts = [0];
        for (let i = 0; i < source.length; i++) if (source[i] === '\n') this.lineStarts.push(i + 1);
    }

    /**
     * The character index of a byte offset.
     * @param {number} byte - The byte offset.
     * @returns {number} The index.
     */
    charAt(byte) {
        const found = this.charOfByte[byte];
        return typeof found === 'number' ? found : this.source.length;
    }

    /**
     * The line (1-based) and column (0-based) of a character index.
     * @param {number} index - The index.
     * @returns {{line: number, column: number}} The place.
     */
    place(index) {
        let low = 0;
        let high = this.lineStarts.length - 1;
        while (low < high) {
            const mid = (low + high + 1) >> 1;
            if (this.lineStarts[mid] <= index) low = mid;
            else high = mid - 1;
        }
        return { line: low + 1, column: index - this.lineStarts[low] };
    }

    /**
     * The start and end (character indexes) of a location.
     * @param {{startOffset: number, length: number}} loc - The location.
     * @returns {{start: number, end: number}} The span.
     */
    span(loc) {
        return { start: this.charAt(loc.startOffset), end: this.charAt(loc.startOffset + loc.length) };
    }

    /**
     * The text of a location.
     * @param {{startOffset: number, length: number}} loc - The location.
     * @returns {string} The text.
     */
    text(loc) {
        const { start, end } = this.span(loc);
        return this.source.substring(start, end);
    }

    /**
     * The text of a line.
     * @param {number} line - The line (1-based).
     * @returns {string} The text.
     */
    lineText(line) {
        const start = this.lineStarts[line - 1];
        const next = this.lineStarts[line];
        return this.source.substring(start, typeof next === 'number' ? next - 1 : this.source.length);
    }

    /**
     * How many lines the source has.
     * @returns {number} The count.
     */
    get lineCount() {
        return this.lineStarts.length;
    }
}

export { callOf, childrenOf, field, hasFlag, SourceIndex, statementsOf, typeOf, unwrap };
