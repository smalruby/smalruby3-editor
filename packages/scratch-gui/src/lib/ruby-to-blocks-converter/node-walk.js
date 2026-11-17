// === Smalruby: This file is Smalruby-specific (one way to walk the prism tree, docs/ruby-editor/converter-stages.md) ===

// The type name of each class of prism node, found once per class (see `nodeTypeName`).
const typeNameOfClass = new WeakMap();

/**
 * Find the type name of a prism node by `accept()`: the node calls `visitXxxNode` of the visitor.
 * `constructor.name` cannot be used, since the production build renames the classes.
 * @param {object} node - A prism node.
 * @returns {?string} The type name, e.g. 'CallNode'.
 */
const sniffTypeName = (node) => {
    let handlerName = null;
    const sniffer = new Proxy(
        {},
        {
            get(_target, prop) {
                if (typeof prop === 'string' && prop.startsWith('visit')) {
                    handlerName = prop;
                }
                return () => {};
            },
        },
    );
    node.accept(sniffer);
    return handlerName ? handlerName.slice('visit'.length) : null;
};

/**
 * The type name of a prism node (e.g. 'CallNode'), or null for anything else.
 * It is found once for each class of node and kept, since all the nodes of a class have the same.
 * @param {*} value - A value.
 * @returns {?string} The type name.
 */
const nodeTypeName = (value) => {
    if (!value || typeof value.accept !== 'function') return null;
    const klass = value.constructor;
    if (typeof klass !== 'function') return sniffTypeName(value);
    if (typeNameOfClass.has(klass)) return typeNameOfClass.get(klass);
    const name = sniffTypeName(value);
    typeNameOfClass.set(klass, name);
    return name;
};

/**
 * The child nodes of a prism node, without the empty ones. Every child is here (the `when` of a
 * `case`, the conditions of a `when`, ...): `compactChildNodes()` of `@ruby/prism` 1.9.0 drops the
 * children in an array (issue #1813).
 * @param {object} node - A prism node.
 * @returns {Array<object>} The child nodes, in the order of the source.
 */
const childNodesOf = (node) => {
    if (!node || typeof node.childNodes !== 'function') return [];
    return node.childNodes().filter(Boolean);
};

/**
 * Walk every node of a prism tree once, in the order of the source (a node before its children).
 * This is the one way the stages walk the tree, so that no walk forgets the children of a kind of
 * node. It does not recurse, so a long program does not run out of the stack.
 * @param {object} root - The root prism node.
 * @param {object} handlers - What to do at each node.
 * @param {function(object, string, ?object): void} [handlers.enter] - Called with the node, its
 *   type name and its parent before the children.
 * @param {function(object, string, ?object): void} [handlers.leave] - Called after the children.
 */
const forEachNode = (root, { enter, leave } = {}) => {
    const rootType = nodeTypeName(root);
    if (!rootType) return;
    // [node, type, parent, whether the children are already on the stack]
    const stack = [[root, rootType, null, false]];
    while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        const [node, type, parent, entered] = frame;
        if (entered) {
            stack.pop();
            if (leave) leave(node, type, parent);
            continue;
        }
        frame[3] = true;
        if (enter) enter(node, type, parent);
        const children = childNodesOf(node);
        for (let i = children.length - 1; i >= 0; i--) {
            const childType = nodeTypeName(children[i]);
            if (childType) stack.push([children[i], childType, node, false]);
        }
    }
};

export { nodeTypeName, childNodesOf, forEachNode };
