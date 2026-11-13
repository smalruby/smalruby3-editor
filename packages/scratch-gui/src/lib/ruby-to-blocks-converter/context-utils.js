import { Variable, LOCAL_VARIABLE_PATTERN } from './constants';

// Assignments whose value is visited as a value (see `_onVasgn`).
const VALUE_WRITE_NODE_TYPES = ['LocalVariableWriteNode', 'InstanceVariableWriteNode', 'GlobalVariableWriteNode'];
// Nodes with a condition (`predicate`) and the lines run by it (see `_countProcedureCallsInNode`).
const CONDITION_NODE_TYPES = ['IfNode', 'UnlessNode', 'WhileNode', 'UntilNode'];

/**
 * Context and state management utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ContextUtils = {
    reset() {
        this._context = {
            currentNode: null,
            errors: [],
            argumentBlocks: {},
            procedureCallBlocks: {},
            extensionIDs: new Set(),

            blocks: {},
            comments: {},
            blockTypes: {},
            localVariables: {},
            variables: {},
            lists: {},
            broadcastMsgs: {},
            procedures: {},
            methodCallCounts: {},
            methodCallIndices: {},
            // Whether a return value of a call is saved in a variable in the current statement (issue #1556)
            savedReturnValueInStatement: false,
            // return value reporter id -> id of the method block it gives the value of (issue #1725)
            returnValueSources: {},
            // the numbers of `@_retN` the code already uses (issue #1725), found when first needed
            returnValueTempsInSource: null,
            literalCallIndices: {},
            elsifCounter: 0,
            caseCounter: 0,
            isValue: false,
            inMyBlockDefinition: false,
            // what the statements being converted are the body of (#1544): 'block' for a block
            // body (`do ... end`, `if`, ...), where neither an event nor a value written as a line
            // by itself can be placed; 'method' for a method body (`def`), where an event cannot
            // be placed but a value can (it is the return value); null for a script or a class.
            statementBodyKind: null,
            scopeStack: [],
            scopeCounter: 1,
            currentScopeIndex: 1,
            currentProcedureName: null,
            nodeToBlockMap: new Map(),
            lineToNodeMap: new Map(),
            containerNodeRanges: [], // Store {startLine, endLine} for container nodes (block, begin, kwbegin)
            processDepth: 0,
            rootNode: null,
            modules: {},
            currentModuleName: null,
            superMethodMap: {},
            superRenameTarget: null,
            symbols: new Set(),
            // How the code uses each variable name, collected before converting (issue #1613)
            variableUses: {},
            // Where the code uses each local variable, and the unit being converted (issue #1630)
            localVariableUnits: null,
            // The list blocks that read `@a` / `$a` of Ruby version 2 (issue #1622)
            listReadBlockIds: new Set(),
            currentLocalUnit: 0,
        };
        if (this.vm && this.vm.runtime && this.vm.runtime.getTargetForStage) {
            this._loadVariables(this.vm.runtime.getTargetForStage());
        }
    },

    _loadVariables(target) {
        if (!target || !target.variables) {
            return;
        }

        let scope;
        if (target.isStage) {
            scope = 'global';
        } else {
            scope = 'instance';
        }
        Object.keys(target.variables).forEach((blockId) => {
            const variable = target.variables[blockId];

            // Skip local variables - they should not be loaded from target
            // Local variables are scope-specific and temporary
            if (LOCAL_VARIABLE_PATTERN.test(variable.name)) {
                return;
            }

            let storeName;
            if (variable.type === Variable.SCALAR_TYPE) {
                storeName = 'variables';
            } else if (variable.type === Variable.BROADCAST_MESSAGE_TYPE) {
                storeName = 'broadcastMsgs';
            } else {
                storeName = 'lists';
            }
            // `fromTarget` marks what the project already has, so that a list left behind by
            // earlier code can give way to a variable of the same name (issue #1612).
            this._context[storeName][variable.name] = Object.assign({}, variable, {
                scope: scope,
                fromTarget: true,
            });
        });
    },

    _countMethodCalls(node) {
        const counts = {};
        if (!node) return counts;

        const queue = [node];
        while (queue.length > 0) {
            const ast = queue.shift();
            if (!ast) continue;

            if (this._prismNodeType(ast) === 'CallNode') {
                const name = ast.name;
                const procedure = this._lookupProcedure(name);
                if (procedure && procedure.hasReturnValue) {
                    counts[name] = (counts[name] || 0) + 1;
                }
            }
            if (ast.compactChildNodes) {
                ast.compactChildNodes().forEach((child) => {
                    queue.push(child);
                });
            }
        }
        return counts;
    },

    _saveContext() {
        const includes = [
            'blocks',
            'blockTypes',
            'localVariables',
            'variables',
            'lists',
            'broadcastMsgs',
            'procedures',
            'comments',
            'literalCallIndices',
        ];

        const saved = {};
        Object.keys(this._context)
            .filter((k) => includes.indexOf(k) >= 0)
            .forEach((k) => {
                saved[k] = Object.assign({}, this._context[k]);
            });
        return saved;
    },

    /**
     * Roll the context back to a `_saveContext` snapshot: drop the entries (blocks, comments,
     * variables, ...) made since then and put back the ones removed or replaced since then,
     * so that a conversion attempt that was given up leaves no orphan block or comment behind.
     * The attributes of an entry that was kept (e.g. a block's `parent`) are not restored.
     * @param {object} saved - The snapshot returned by `_saveContext`.
     */
    _restoreContext(saved) {
        if (!saved) {
            return;
        }

        Object.keys(saved).forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(this._context, key)) {
                Object.keys(this._context[key]).forEach((id) => {
                    if (!Object.prototype.hasOwnProperty.call(saved[key], id)) {
                        delete this._context[key][id];
                    }
                });
                Object.keys(saved[key]).forEach((id) => {
                    this._context[key][id] = saved[key][id];
                });
            }
        });

        if (!saved.blocks) {
            return;
        }
        const exists = (blockId) => Object.prototype.hasOwnProperty.call(this._context.blocks, blockId);
        const nodeToBlockMap = this._context.nodeToBlockMap;
        if (nodeToBlockMap) {
            nodeToBlockMap.forEach((blockId, node) => {
                if (!exists(blockId)) {
                    nodeToBlockMap.delete(node);
                }
            });
        }
        // A kept block may have been given a comment that was dropped above.
        Object.values(this._context.blocks).forEach((block) => {
            if (block.comment && !Object.prototype.hasOwnProperty.call(this._context.comments, block.comment)) {
                delete block.comment;
            }
        });
        // These are not snapshotted, so drop the IDs of the blocks removed above; otherwise a later
        // pass (e.g. turning an argument into a boolean one) looks the block up and gets undefined.
        ['argumentBlocks', 'procedureCallBlocks'].forEach((key) => {
            const byId = this._context[key];
            if (!byId) return;
            Object.keys(byId).forEach((id) => {
                byId[id] = byId[id].filter(exists);
            });
        });
    },

    _setTarget(target) {
        this._context.target = target;
    },

    _getReceiverName(receiver) {
        if (this._isSelf(receiver) || receiver === null) {
            if (this._context.target && this._context.target.isStage) {
                return 'stage';
            }
            return 'sprite';
        }

        if (this.isVariableBlockType(receiver)) {
            return 'variable';
        }

        if (this._isString(receiver)) {
            return 'string';
        }

        if (this._isNumber(receiver)) {
            return 'number';
        }

        if (this._isArray(receiver)) {
            return 'array';
        }

        if (this._isHash(receiver)) {
            return 'hash';
        }

        if (this._isTrue(receiver) || this._isFalse(receiver)) {
            return 'boolean';
        }

        if (this.isNil(receiver)) {
            return 'nil';
        }

        if (this._isSymbol(receiver)) {
            return 'symbol';
        }

        // === Smalruby: Start of regex receiver support ===
        if (this._isRegexp(receiver)) {
            return 'regexp';
        }
        // === Smalruby: End of regex receiver support ===

        if (this._isConst(receiver)) {
            return receiver.toString();
        }

        if (this._isBlock(receiver) && receiver.opcode === 'ruby_expression') {
            const textBlock = this._context.blocks[receiver.inputs.EXPRESSION.block];
            const text = textBlock.fields.TEXT.value;

            // Sprite call pattern detection
            const SpriteCallRe = /^sprite\("(.*)"\)$/;
            if (SpriteCallRe.test(text)) {
                return 'sprite_call';
            }

            return text;
        }

        if (this._isBlock(receiver)) {
            return 'block';
        }

        return null;
    },

    _anyReceiverNames() {
        // === Smalruby: 'regexp' added for regex match operators ===
        return [
            'sprite',
            'stage',
            'variable',
            'string',
            'number',
            'array',
            'hash',
            'boolean',
            'nil',
            'block',
            'regexp',
        ];
    },

    _getSpriteCallName(receiver) {
        if (this._isBlock(receiver) && receiver.opcode === 'ruby_expression') {
            const textBlock = this._context.blocks[receiver.inputs.EXPRESSION.block];
            const text = textBlock.fields.TEXT.value;
            const SpriteCallRe = /^sprite\("(.*)"\)$/;
            const match = SpriteCallRe.exec(text);
            if (match) {
                return match[1];
            }
        }
        return null;
    },

    _isSpriteCall(receiver) {
        return this._getSpriteCallName(receiver) !== null;
    },

    getBlockType(block) {
        if (this.isBlock(block)) {
            return this._context.blockTypes[block.id];
        }
        return 'primitive';
    },

    _getBlockType(block) {
        return this.getBlockType(block);
    },

    _setBlockType(block, type) {
        this._context.blockTypes[block.id] = type;
    },

    isValueContext() {
        return this._context.isValue;
    },

    /**
     * Pre-pass to count how many times each procedure/method is called
     * in value (argument) contexts. Used by my-blocks to generate evacuation blocks.
     * @param {object} node - AST node to traverse
     */
    _countProcedureCallsInNode(node) {
        if (!node || typeof node !== 'object') return;
        // Not `constructor.name`: the production build renames the classes.
        const nodeType = this._prismNodeType(node);
        if (!nodeType) return;

        if (nodeType === 'CallNode') {
            // Count calls in argument positions (value context)
            // Use _countCallsInValueNode which fully recurses into nested calls;
            // do NOT also call _countProcedureCallsInNode on args to avoid double-counting.
            if (node.arguments_ && node.arguments_.arguments_) {
                node.arguments_.arguments_.forEach((argNode) => {
                    this._countCallsInValueNode(argNode);
                });
            }
            // Also traverse block body if present
            if (node.block && node.block.body) {
                this._countProcedureCallsInNode(node.block.body);
            }
            // The receiver is visited as a value (e.g. `bar(1)` of `bar(1) + bar(2)`) (issue #1568)
            this._countCallsInValueNode(node.receiver);
        } else if (CONDITION_NODE_TYPES.includes(nodeType)) {
            // The condition is visited as a value (e.g. `bar(1)` and `bar(2)` of `while bar(1) < bar(2)`),
            // then the body and the other branches as lines (issue #1606).
            this._countCallsInValueNode(node.predicate);
            [node.statements, node.subsequent, node.elseClause].forEach((child) => {
                if (this._prismNodeType(child)) {
                    this._countProcedureCallsInNode(child);
                }
            });
        } else if (VALUE_WRITE_NODE_TYPES.includes(nodeType)) {
            // The value of an assignment is visited as a value too (e.g. `x = bar(1) + bar(2)`) (issue #1568).
            this._countCallsInValueNode(node.value);
        } else if (nodeType === 'ReturnNode') {
            // The value of `return` is used as a value too (issue #1556).
            if (node.arguments_ && node.arguments_.arguments_) {
                node.arguments_.arguments_.forEach((argNode) => {
                    this._countCallsInValueNode(argNode);
                });
            }
        } else {
            // For other node types, traverse children generically
            const childKeys = [
                'statements',
                'body',
                'then',
                'else',
                'value',
                'left',
                'right',
                'condition',
                'consequent',
                'alternative',
                'elements',
                'requireds',
                'parameters',
                'arguments_',
            ];
            childKeys.forEach((key) => {
                const child = node[key];
                if (!child) return;
                if (typeof child === 'object' && child.constructor) {
                    if (this._prismNodeType(child)) {
                        this._countProcedureCallsInNode(child);
                    } else if (Array.isArray(child) || typeof child.forEach === 'function') {
                        child.forEach((c) => this._countProcedureCallsInNode(c));
                    }
                }
            });
        }
    },

    /**
     * Count CallNode calls within a value (argument) context node.
     * This increments methodCallCounts for procedure calls found as arguments.
     * @param {object} node - AST node to traverse
     */
    _countCallsInValueNode(node) {
        if (!node || typeof node !== 'object') return;
        // Not `constructor.name`: the production build renames the classes.
        const nodeType = this._prismNodeType(node);
        if (!nodeType) return;

        if (nodeType === 'CallNode') {
            const name = node.name && node.name.toString();
            if (name) {
                this._context.methodCallCounts[name] = (this._context.methodCallCounts[name] || 0) + 1;
            }
            // Recurse into the receiver (e.g. `bar(1)` of `bar(1) + bar(2)`) and the arguments
            this._countCallsInValueNode(node.receiver);
            if (node.arguments_ && node.arguments_.arguments_) {
                node.arguments_.arguments_.forEach((argNode) => {
                    this._countCallsInValueNode(argNode);
                });
            }
        } else if (nodeType === 'StatementsNode') {
            // The inside of parentheses, e.g. `(bar + 1)`
            node.body.forEach((child) => this._countCallsInValueNode(child));
        } else {
            // Traverse relevant children
            const childKeys = ['value', 'left', 'right', 'condition', 'body'];
            childKeys.forEach((key) => {
                const child = node[key];
                if (this._prismNodeType(child)) {
                    this._countCallsInValueNode(child);
                }
            });
        }
    },
};

export default ContextUtils;
