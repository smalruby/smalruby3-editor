/**
 * The shape of a Ruby program to compare two programs by (J1 of
 * docs/ruby-editor/converter-roadmap.md): its prism syntax tree without
 * positions and flags, with parentheses taken off (they only group), and its
 * comments. Two programs with the same shape differ only in spaces and
 * parentheses.
 */
import { nodeTypeName } from '../../../../src/lib/ruby-to-blocks-converter/node-walk';

/** Fields of the prism nodes that only say where a node is or how it was written. */
const isPositionKey = (key) => key === 'location' || key === 'flags' || key === 'nodeID' || /Loc$/.test(key);

/**
 * The shape of a prism node.
 * @param {*} node - The node (`toJSON()` of prism) or a value of one.
 * @returns {*} The shape.
 */
const shapeOf = (node) => {
    if (Array.isArray(node)) return node.map(shapeOf);
    if (!node || typeof node !== 'object') return node;
    const type = nodeTypeName(node);
    if (type === 'ParenthesesNode' && node.body && nodeTypeName(node.body) === 'StatementsNode') {
        if (node.body.body.length === 1) return shapeOf(node.body.body[0]);
    }
    const out = type ? { type } : {};
    Object.keys(node)
        .filter((key) => !isPositionKey(key))
        .forEach((key) => {
            out[key] = shapeOf(node[key]);
        });
    return out;
};

/**
 * The shape of a Ruby program, or its syntax errors.
 * @param {object} prism - The loaded prism (`loadPrism()`).
 * @param {string} ruby - The Ruby.
 * @returns {object} `{tree, comments}` or `{errors}`.
 */
const rubyShape = (prism, ruby) => {
    const result = prism.parse(ruby);
    if (result.errors.length > 0) return { errors: result.errors.map((e) => e.message) };
    const bytes = Buffer.from(ruby, 'utf8');
    const comments = result.comments.map((c) =>
        bytes
            .subarray(c.location.startOffset, c.location.startOffset + c.location.length)
            .toString('utf8')
            .trim(),
    );
    return { tree: shapeOf(result.value), comments };
};

export { rubyShape };
