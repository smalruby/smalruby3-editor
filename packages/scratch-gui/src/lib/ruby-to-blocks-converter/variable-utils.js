import {defineMessages} from 'react-intl';
import {Variable} from './constants';
import * as Blockly from 'scratch-blocks';
import {RubyToBlocksConverterError} from './errors';

const messages = defineMessages({
    cannotChangeVariableScope: {
        defaultMessage: '"{VARIABLE}", can\'t change variable scope.' +
            '\nDelete the variable first, then recreate it with the correct scope.',
        description: 'Error message when trying to change variable scope from global to instance or vice versa',
        id: 'gui.smalruby3.rubyToBlocksConverter.cannotChangeVariableScope'
    },
    alreadyDefinedMyBlock: {
        defaultMessage: 'already defined My Block "{NAME}".' +
            '\nUse a different name.',
        description: 'Error message when defining a My Block with a name that already exists',
        id: 'gui.smalruby3.rubyToBlocksConverter.alreadyDefinedMyBlock'
    }
});

/**
 * Variable, list, and broadcast message utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const VariableUtils = {
    // Helper function to convert argument names to snake_case lowercase
    _toSnakeCaseLowercase (name) {
        return name
            // Replace ASCII non-alphanumeric characters (except underscores) with underscore.
            // Unicode characters (Japanese kana/kanji, etc.) are preserved as-is.
            .replace(/[^a-zA-Z0-9_\u0100-\uFFFF]+/g, '_')
            // Convert camelCase to snake_case: insert underscore before uppercase letters
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            // Convert to lowercase
            .toLowerCase();
    },

    _lookupOrCreateVariableOrList (name, type, isArgument = false) {
        name = name.toString();
        let scope;
        let varName;
        let scopeIndex = null;

        if (name[0] === '$') {
            varName = name.slice(1);
            scope = 'global';
        } else if (name[0] === '@') {
            varName = name.slice(1);
            scope = 'instance';
        } else {
            // Local variable - transform to pseudo-local
            varName = name;
            scope = 'local';
            scopeIndex = this._getScopeIndex();

            // Check if already exists in current scope
            const currentScope = this._getCurrentScope();
            if (currentScope && currentScope.localVars[varName]) {
                const existingVar = currentScope.localVars[varName];
                const sName = type === Variable.SCALAR_TYPE ? 'localVariables' : 'lists';
                return this._context[sName][existingVar.transformedName];
            }
        }

        let storeName;
        if (type === Variable.SCALAR_TYPE) {
            if (scope === 'local') {
                storeName = 'localVariables';
            } else {
                storeName = 'variables';
            }
        } else {
            storeName = 'lists';
        }

        let variable = this._context[storeName][varName];

        if (scope === 'local') {
            // Create transformed name - arguments DO NOT get indexed
            const transformedName = isArgument ? varName : `_${varName}_${scopeIndex}_`;

            // Check if this transformed name already exists in global store
            variable = this._context[storeName][transformedName];

            if (!variable) {
                variable = {
                    id: Blockly.utils.idGenerator.genUid(),
                    name: transformedName,
                    originalName: varName,
                    scope: 'local', // Mark as local for internal tracking
                    scopeIndex: scopeIndex,
                    type: type,
                    isArgument: isArgument,
                    dataType: null
                };
                this._context[storeName][transformedName] = variable;
            }

            // Track in current scope
            const currentScope = this._getCurrentScope();
            if (currentScope) {
                currentScope.localVars[varName] = {
                    transformedName: transformedName,
                    variable: variable
                };
            }
        } else if (variable) {
            // Check for variable scope change - only for global/instance variables
            if (variable.scope !== scope) {
                throw new RubyToBlocksConverterError(
                    this._context.currentNode,
                    this._translator(messages.cannotChangeVariableScope, {VARIABLE: name})
                );
            }
        } else {
            variable = {
                id: Blockly.utils.idGenerator.genUid(),
                name: varName,
                scope: scope,
                type: type,
                dataType: null
            };
            this._context[storeName][varName] = variable;
        }
        return variable;
    },

    _lookupOrCreateVariable (name, isArgument = false) {
        return this._lookupOrCreateVariableOrList(name, Variable.SCALAR_TYPE, isArgument);
    },

    _lookupOrCreateList (name, isArgument = false) {
        return this._lookupOrCreateVariableOrList(name, Variable.LIST_TYPE, isArgument);
    },

    lookupVariableFromVariableBlock (block) {
        if (!this.isVariableBlock(block)) return null;

        return this._context.variables[block.fields.VARIABLE.value] ||
            this._context.localVariables[block.fields.VARIABLE.value];
    },

    lookupListFromListBlock (block) {
        if (!this.isListBlock(block)) return null;

        return this._context.lists[block.fields.LIST.value];
    },

    lookupOrCreateBroadcastMsg (name) {
        return this._lookupOrCreateBroadcastMsg(name);
    },

    _lookupOrCreateBroadcastMsg (name) {
        name = name.toString();
        const key = name.toLowerCase();
        let broadcastMsg = this._context.broadcastMsgs[key];
        if (!broadcastMsg) {
            broadcastMsg = {
                id: Blockly.utils.idGenerator.genUid(),
                name: name,
                scope: 'global'
            };
            this._context.broadcastMsgs[key] = broadcastMsg;
        }
        return broadcastMsg;
    },

    defaultBroadcastMsg () {
        return this._defaultBroadcastMsg();
    },

    _defaultBroadcastMsg () {
        const defaultName = 'message1';
        const keys = Object.keys(this._context.broadcastMsgs);
        if (keys.length === 0) {
            return this._lookupOrCreateBroadcastMsg(defaultName);
        }
        if (Object.prototype.hasOwnProperty.call(this._context.broadcastMsgs, defaultName)) {
            return this._context.broadcastMsgs[defaultName];
        }
        return this._context.broadcastMsgs[keys[0]];
    },

    _lookupProcedure (name) {
        name = name.toString();
        return this._context.procedures[name];
    },

    /**
     * Check if a procedures_call block calls a procedure that has a return value.
     * @param {object} block - A procedures_call block
     * @returns {boolean} true if the called procedure has hasReturnValue
     */
    _isProcedureCallWithReturnValue (block) {
        if (!block || block.opcode !== 'procedures_call' || !block.mutation) return false;
        const proccode = block.mutation.proccode;
        if (!proccode) return false;
        // Extract procedure name from proccode (name is the first part before any %s/%b)
        const procName = proccode.split(' ')
            .filter(i => !/^%[sb]$/.test(i))
            .join('_');
        const procedure = this._lookupProcedure(procName);
        return procedure && procedure.hasReturnValue;
    },

    _createProcedure (name) {
        name = name.toString();
        let procedure = this._context.procedures[name];
        if (procedure) {
            throw new RubyToBlocksConverterError(
                this._context.currentNode,
                this._translator(messages.alreadyDefinedMyBlock, {NAME: name})
            );
        }
        procedure = {
            id: Blockly.utils.idGenerator.genUid(),
            name: name,
            procCode: [name],
            argumentNames: [],
            argumentDefaults: [],
            argumentIds: [],
            argumentVariables: [],
            argumentBlocks: []
        };
        this._context.procedures[name] = procedure;
        return procedure;
    },

    _collectSymbol (name) {
        this._context.symbols.add(`:${name}`);
    },

    _createSymbolsList () {
        if (this._context.symbols.size === 0) return;
        this._lookupOrCreateList('$_symbols_');
    },

    _symbolToBlock (symbolName, node) {
        this._collectSymbol(symbolName);
        const list = this._lookupOrCreateList('$_symbols_');
        const block = this._createBlock('data_itemnumoflist', 'value', {
            fields: {
                LIST: {
                    name: 'LIST',
                    id: list.id,
                    value: list.name,
                    variableType: list.type
                }
            }
        });
        block.node = node;
        this._addTextInput(block, 'ITEM', symbolName, 'thing');
        block.comment = this._createComment(`@ruby:symbol:${symbolName}`, block.id);
        return block;
    },

    _resolveSymbolVariable (value) {
        if (!this._isBlock(value)) return null;
        const variable = this.lookupVariableFromVariableBlock(value);
        if (!variable || variable.dataType !== 'symbol') return null;

        const list = this._lookupOrCreateList('$_symbols_');
        const block = this._createBlock('data_itemoflist', 'value', {
            fields: {
                LIST: {
                    name: 'LIST',
                    id: list.id,
                    value: list.name,
                    variableType: list.type
                }
            }
        });
        this._addNumberInput(block, 'INDEX', 'math_integer', value, 1);
        block.comment = this._createComment('@ruby:symbol:var', block.id);
        return block;
    },

    /**
     * Get the keys list name for a hash variable.
     * @param {string} prefixedName - The prefixed variable name (e.g. '$a', '@a', 'a').
     * @returns {string} The keys list name (e.g. '$_hash_a_keys_').
     */
    _hashKeysListName (prefixedName) {
        let prefix = '';
        let varName = prefixedName;
        if (prefixedName[0] === '$') {
            prefix = '$';
            varName = prefixedName.slice(1);
        } else if (prefixedName[0] === '@') {
            prefix = '@';
            varName = prefixedName.slice(1);
        }
        return `${prefix}_hash_${varName}_keys_`;
    },

    /**
     * Get the values list name for a hash variable.
     * @param {string} prefixedName - The prefixed variable name (e.g. '$a', '@a', 'a').
     * @returns {string} The values list name (e.g. '$_hash_a_values_').
     */
    _hashValuesListName (prefixedName) {
        let prefix = '';
        let varName = prefixedName;
        if (prefixedName[0] === '$') {
            prefix = '$';
            varName = prefixedName.slice(1);
        } else if (prefixedName[0] === '@') {
            prefix = '@';
            varName = prefixedName.slice(1);
        }
        return `${prefix}_hash_${varName}_values_`;
    },

    _changeToBooleanArgument (varName) {
        varName = varName.toString();
        const variable = this._context.localVariables[varName];
        if (!variable) {
            return false;
        }

        variable.isBoolean = true;

        if (Object.prototype.hasOwnProperty.call(this._context.argumentBlocks, variable.id)) {
            this._context.argumentBlocks[variable.id].forEach(id => {
                const b = this._context.blocks[id];
                b.opcode = 'argument_reporter_boolean';
                this._setBlockType(b, 'value_boolean');
            });
        }
        return true;
    }
};

export default VariableUtils;
