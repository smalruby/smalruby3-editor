import {Variable, LOCAL_VARIABLE_PATTERN} from './constants';

/**
 * Context and state management utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ContextUtils = {
    reset () {
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
            literalCallIndices: {},
            elsifCounter: 0,
            caseCounter: 0,
            variableHint: null,
            isValue: false,
            inMyBlockDefinition: false,
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
            symbols: new Set()
        };
        if (this.vm && this.vm.runtime && this.vm.runtime.getTargetForStage) {
            this._loadVariables(this.vm.runtime.getTargetForStage());
        }
    },

    _loadVariables (target) {
        if (!target || !target.variables) {
            return;
        }

        let scope;
        if (target.isStage) {
            scope = 'global';
        } else {
            scope = 'instance';
        }
        Object.keys(target.variables).forEach(blockId => {
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
            this._context[storeName][variable.name] = Object.assign({}, variable, {
                scope: scope
            });
        });
    },

    _countMethodCalls (node) {
        const counts = {};
        if (!node) return counts;

        const queue = [node];
        while (queue.length > 0) {
            const ast = queue.shift();
            if (!ast) continue;

            if (ast.constructor.name === 'CallNode') {
                const name = ast.name;
                const procedure = this._lookupProcedure(name);
                if (procedure && procedure.hasReturnValue) {
                    counts[name] = (counts[name] || 0) + 1;
                }
            }
            if (ast.compactChildNodes) {
                ast.compactChildNodes().forEach(child => {
                    queue.push(child);
                });
            }
        }
        return counts;
    },

    _saveContext () {
        const includes = [
            'blocks',
            'blockTypes',
            'localVariables',
            'variables',
            'lists',
            'broadcastMsgs',
            'procedures'
        ];

        const saved = {};
        Object.keys(this._context).filter(k => includes.indexOf(k) >= 0)
            .forEach(k => {
                saved[k] = Object.assign({}, this._context[k]);
            });
        return saved;
    },

    // could not restore attributes.
    _restoreContext (saved) {
        if (!saved) {
            return;
        }

        Object.keys(saved).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(this._context, key)) {
                Object.keys(this._context[key]).forEach(id => {
                    if (!Object.prototype.hasOwnProperty.call(saved[key], id)) {
                        delete this._context[key][id];
                    }
                });
                Object.keys(saved[key]).forEach(id => {
                    if (!Object.prototype.hasOwnProperty.call(saved[key], id)) {
                        this._context[key][id] = saved[key][id];
                    }
                });
            }
        });
    },

    _setTarget (target) {
        this._context.target = target;
    },

    _getReceiverName (receiver) {
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

    _anyReceiverNames () {
        return ['sprite', 'stage', 'variable', 'string', 'number', 'array', 'hash', 'boolean', 'nil', 'block'];
    },

    _getSpriteCallName (receiver) {
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

    _isSpriteCall (receiver) {
        return this._getSpriteCallName(receiver) !== null;
    },

    getBlockType (block) {
        if (this.isBlock(block)) {
            return this._context.blockTypes[block.id];
        }
        return 'primitive';
    },

    _getBlockType (block) {
        return this.getBlockType(block);
    },

    _setBlockType (block, type) {
        this._context.blockTypes[block.id] = type;
    },

    isValueContext () {
        return this._context.isValue;
    },

    /**
     * Pre-pass to count how many times each procedure/method is called
     * in value (argument) contexts. Used by my-blocks to generate evacuation blocks.
     * @param {object} node - AST node to traverse
     */
    _countProcedureCallsInNode (node) {
        if (!node || typeof node !== 'object') return;
        const nodeType = node.constructor && node.constructor.name;
        if (!nodeType) return;

        if (nodeType === 'CallNode') {
            // Count calls in argument positions (value context)
            // Use _countCallsInValueNode which fully recurses into nested calls;
            // do NOT also call _countProcedureCallsInNode on args to avoid double-counting.
            if (node.arguments_ && node.arguments_.arguments_) {
                node.arguments_.arguments_.forEach(argNode => {
                    this._countCallsInValueNode(argNode);
                });
            }
            // Also traverse block body if present
            if (node.block && node.block.body) {
                this._countProcedureCallsInNode(node.block.body);
            }
            // Traverse receiver
            this._countProcedureCallsInNode(node.receiver);
        } else {
            // For other node types, traverse children generically
            const childKeys = ['statements', 'body', 'then', 'else', 'value', 'left', 'right',
                'condition', 'consequent', 'alternative', 'elements', 'requireds',
                'parameters', 'arguments_'];
            childKeys.forEach(key => {
                const child = node[key];
                if (!child) return;
                if (typeof child === 'object' && child.constructor) {
                    if (child.constructor.name.endsWith('Node')) {
                        this._countProcedureCallsInNode(child);
                    } else if (Array.isArray(child) || typeof child.forEach === 'function') {
                        child.forEach(c => this._countProcedureCallsInNode(c));
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
    _countCallsInValueNode (node) {
        if (!node || typeof node !== 'object') return;
        const nodeType = node.constructor && node.constructor.name;
        if (!nodeType) return;

        if (nodeType === 'CallNode') {
            const name = node.name && node.name.toString();
            if (name) {
                this._context.methodCallCounts[name] = (this._context.methodCallCounts[name] || 0) + 1;
            }
            // Recurse into arguments
            if (node.arguments_ && node.arguments_.arguments_) {
                node.arguments_.arguments_.forEach(argNode => {
                    this._countCallsInValueNode(argNode);
                });
            }
        } else {
            // Traverse relevant children
            const childKeys = ['value', 'left', 'right', 'condition', 'body'];
            childKeys.forEach(key => {
                const child = node[key];
                if (child && typeof child === 'object' && child.constructor &&
                    child.constructor.name.endsWith('Node')) {
                    this._countCallsInValueNode(child);
                }
            });
        }
    }
};

export default ContextUtils;
