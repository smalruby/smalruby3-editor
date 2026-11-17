// === Smalruby: This file is Smalruby-specific (`without_screen_refresh def`, issue #2114) ===
import { forEachNode, nodeTypeName } from './node-walk';

const WITHOUT_SCREEN_REFRESH = 'without_screen_refresh';

/**
 * The `def` of `without_screen_refresh def foo ... end`, or null for any other node.
 * @param {object} node - A statement.
 * @returns {?object} The DefNode.
 */
const wrappedDefOf = (node) => {
    if (nodeTypeName(node) !== 'CallNode' || node.name !== WITHOUT_SCREEN_REFRESH) return null;
    if (node.receiver || node.block) return null;
    const args = node.arguments_ ? node.arguments_.arguments_ : [];
    if (args.length !== 1 || nodeTypeName(args[0]) !== 'DefNode') return null;
    return args[0];
};

/**
 * "Run without screen refresh" of a custom block is written `without_screen_refresh def foo ... end`
 * (as `private def foo`). The parse stage puts the `def` in the place of the call, so the rest of
 * the converter (the analysis, class / module, comments, the check of `def` in a block body) sees
 * an ordinary `def`, and returns the `def`s that were wrapped. The tree is changed in place.
 * A program that defines its own `without_screen_refresh` method keeps the calls as they are.
 * @param {object} root - The root of the prism tree.
 * @returns {Set<object>} The DefNodes that run without screen refresh.
 */
const unwrapWithoutScreenRefreshDefs = (root) => {
    const defs = new Set();
    let definesOwn = false;
    forEachNode(root, {
        enter(node, type) {
            if (type === 'DefNode' && node.name === WITHOUT_SCREEN_REFRESH) definesOwn = true;
        },
    });
    if (definesOwn) return defs;
    forEachNode(root, {
        enter(node, type) {
            if (type !== 'StatementsNode' || !Array.isArray(node.body)) return;
            node.body.forEach((statement, i) => {
                const def = wrappedDefOf(statement);
                if (def) {
                    node.body[i] = def;
                    defs.add(def);
                }
            });
        },
    });
    return defs;
};

export { unwrapWithoutScreenRefreshDefs };
