// === Smalruby: This file is Smalruby-specific (the convert stage, docs/ruby-editor/converter-stages.md) ===
import {
    ProgramNode,
    StatementsNode,
    BlockNode,
    BeginNode,
    DefNode,
    ClassNode,
    ModuleNode,
} from '@ruby/prism/src/nodes.js';
import _ from 'lodash';
import { nodeTypeName } from './node-walk';

/**
 * The convert stage: `visit` calls `visitXxxNode` of each node, which makes its blocks (the parts
 * in `stages.js`). Mixed into RubyToBlocksConverter.prototype by `stages.js`.
 * @type {object}
 */
const ConvertStage = {
    /**
     * The convert stage: make the blocks of the root node.
     * @param {object} root - The root node.
     * @returns {Array|null} The blocks (and primitives) of the statements of the root, or null when
     * the code has no statement.
     */
    _convert(root) {
        let blocks = this.visit(root);
        if (blocks === null || typeof blocks === 'undefined') {
            return null;
        }
        if (!_.isArray(blocks)) {
            blocks = [blocks];
        }
        // Link blocks if root is not a begin node (begin nodes handle linking internally)
        // This is needed for cases like "text = gets" where a single statement returns
        // multiple blocks
        const rootType = nodeTypeName(root);
        if (rootType !== 'StatementsNode' && rootType !== 'ProgramNode' && rootType !== 'BeginNode') {
            blocks = this._linkBlocks(blocks);
        }
        return blocks;
    },

    visit(node) {
        if (!node) {
            return null;
        }

        // Track depth for lineToNodeMap
        const depth = this._context.processDepth || 0;
        this._context.processDepth = depth + 1;

        const startLine = this._getNodeStartLine(node);
        const endLine = this._getNodeEndLine(node) || startLine;

        if (startLine !== null && endLine !== null) {
            const isContainerNode =
                node instanceof ProgramNode ||
                node instanceof StatementsNode ||
                node instanceof BlockNode ||
                node instanceof BeginNode ||
                node instanceof DefNode ||
                node instanceof ClassNode ||
                node instanceof ModuleNode;

            if (isContainerNode) {
                const rangeEntry = {
                    type: nodeTypeName(node),
                    startLine,
                    endLine,
                    depth,
                };
                // Store module name for comment association
                if (node instanceof ModuleNode) {
                    rangeEntry.moduleName = node.name;
                }
                this._context.containerNodeRanges.push(rangeEntry);
            } else {
                for (let line = startLine; line <= endLine; line++) {
                    const existingEntry = this._context.lineToNodeMap.get(line);
                    if (!existingEntry || depth < existingEntry.depth) {
                        this._context.lineToNodeMap.set(line, { node, depth });
                    }
                }
            }
        }

        const previousNode = this._context.currentNode;
        this._context.currentNode = node;
        // A method or a block of the script has its own local variables (issue #1630)
        const previousLocalUnit = this._enterLocalUnit(node);

        // The type name is found by node.accept() once for each class of node (`nodeTypeName`):
        // constructor.name is mangled by esbuild/terser in production builds.
        const typeName = nodeTypeName(node);
        const handlerName = typeName ? `visit${typeName}` : null;

        let result;
        try {
            if (handlerName && typeof this[handlerName] === 'function') {
                result = this[handlerName](node);
            } else {
                throw new Error(`not supported node type: ${typeName}`);
            }
        } finally {
            if (previousLocalUnit !== null) this._context.currentLocalUnit = previousLocalUnit;
        }

        if (result && !this._context.nodeToBlockMap.has(node)) {
            const blockId = this._getBlockIdFromResult(result);
            if (blockId) {
                this._context.nodeToBlockMap.set(node, blockId);
            }
        }

        this._context.currentNode = previousNode;
        this._context.processDepth = depth;
        return result;
    },
};

export default ConvertStage;
