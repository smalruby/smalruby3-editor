import {Variable} from './constants';

const Opal = global.Opal || window.Opal;

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
            isValue: false,
            inMyBlockDefinition: false,
            scopeStack: [],
            scopeCounter: 1,
            currentScopeIndex: 1,
            nodeToBlockMap: new Map(),
            rootNode: null
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
        if (!node || node === Opal.nil) return counts;

        const queue = [node.$to_ast ? node.$to_ast() : node];
        while (queue.length > 0) {
            const ast = queue.shift();
            if (!ast || typeof ast.type !== 'string' || !ast.children) continue;

            if (ast.type === 'send') {
                const name = ast.children[1].toString();
                const procedure = this._lookupProcedure(name);
                if (procedure && procedure.hasReturnValue) {
                    counts[name] = (counts[name] || 0) + 1;
                }
            }
            ast.children.forEach(child => {
                if (child && typeof child.type === 'string' && child.children) {
                    queue.push(child);
                }
            });
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
        if (this._isSelf(receiver) || receiver === Opal.nil) {
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
    }
};

export default ContextUtils;
