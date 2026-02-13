import {Variable} from './constants';
import Blockly from 'scratch-blocks';
import {RubyToBlocksConverterError} from './errors';

/**
 * Variable, list, and broadcast message utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const VariableUtils = {
    // Helper function to convert argument names to snake_case lowercase
    _toSnakeCaseLowercase (name) {
        return name
            // Replace any sequence of non-alphanumeric characters except underscores with underscore
            .replace(/[^a-zA-Z0-9_]+/g, '_')
            // Convert camelCase to snake_case: insert underscore before uppercase letters
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            // Convert to lowercase
            .toLowerCase();
    },

    _lookupOrCreateVariableOrList (name, type, isArgument = false) {
        name = name.toString();
        // eslint-disable-next-line no-console
        console.log(
            `[VARUTIL DEBUG] _lookupOrCreateVariableOrList called: ` +
            `name="${name}", type="${type}", isArgument=${isArgument}`
        );

        let scope;
        let varName;
        let scopeIndex = null;

        if (name[0] === '$') {
            varName = name.slice(1);
            scope = 'global';
            // eslint-disable-next-line no-console
            console.log(`[VARUTIL DEBUG] Detected global variable: varName="${varName}"`);
        } else if (name[0] === '@') {
            varName = name.slice(1);
            scope = 'instance';
            // eslint-disable-next-line no-console
            console.log(`[VARUTIL DEBUG] Detected instance variable: varName="${varName}"`);
        } else {
            // Local variable - transform to pseudo-local
            varName = name;
            scope = 'local';
            scopeIndex = this._getScopeIndex();
            // eslint-disable-next-line no-console
            console.log(
                `[VARUTIL DEBUG] Detected local variable: ` +
                `varName="${varName}", scopeIndex=${scopeIndex}`
            );

            // Check if already exists in current scope
            const currentScope = this._getCurrentScope();
            if (currentScope && currentScope.localVars[varName]) {
                const existingVar = currentScope.localVars[varName];
                const sName = type === Variable.SCALAR_TYPE ? 'localVariables' : 'lists';
                // eslint-disable-next-line no-console
                console.log(
                    `[VARUTIL DEBUG] Local variable already exists in current scope, ` +
                    `returning from ${sName}[${existingVar.transformedName}]`
                );
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
        // eslint-disable-next-line no-console
        console.log(`[VARUTIL DEBUG] Selected storeName: ${storeName}`);

        let variable = this._context[storeName][varName];

        if (scope === 'local') {
            // Create transformed name - arguments DO NOT get indexed
            const transformedName = isArgument ? varName : `_${varName}_${scopeIndex}_`;
            // eslint-disable-next-line no-console
            console.log(`[VARUTIL DEBUG] Transformed name: "${transformedName}"`);

            // Check if this transformed name already exists in global store
            variable = this._context[storeName][transformedName];

            if (variable) {
                // eslint-disable-next-line no-console
                console.log(
                    `[VARUTIL DEBUG] Found EXISTING local variable in ` +
                    `${storeName}[${transformedName}] with ID: ${variable.id}`
                );
            } else {
                // eslint-disable-next-line no-console
                console.log(
                    `[VARUTIL DEBUG] Creating NEW local variable in ${storeName}[${transformedName}]`
                );
                variable = {
                    id: Blockly.utils.genUid(),
                    name: transformedName,
                    originalName: varName,
                    scope: 'local', // Mark as local for internal tracking
                    scopeIndex: scopeIndex,
                    type: type,
                    isArgument: isArgument
                };
                this._context[storeName][transformedName] = variable;
                // eslint-disable-next-line no-console
                console.log(`[VARUTIL DEBUG] Created with ID: ${variable.id}`);
            }

            // Track in current scope
            const currentScope = this._getCurrentScope();
            if (currentScope) {
                currentScope.localVars[varName] = {
                    transformedName: transformedName,
                    variable: variable
                };
                // eslint-disable-next-line no-console
                console.log(`[VARUTIL DEBUG] Tracked in current scope`);
            }
        } else if (variable) {
            // eslint-disable-next-line no-console
            console.log(
                `[VARUTIL DEBUG] Found EXISTING ${scope} variable in ` +
                `${storeName}[${varName}] with ID: ${variable.id}`
            );
            // Check for variable scope change - only for global/instance variables
            if (variable.scope !== scope) {
                throw new RubyToBlocksConverterError(
                    this._context.currentNode,
                    `"${name}", can't change variable scope`
                );
            }
        } else {
            // eslint-disable-next-line no-console
            console.log(
                `[VARUTIL DEBUG] Creating NEW ${scope} variable in ${storeName}[${varName}]`
            );
            variable = {
                id: Blockly.utils.genUid(),
                name: varName,
                scope: scope,
                type: type
            };
            this._context[storeName][varName] = variable;
            // eslint-disable-next-line no-console
            console.log(`[VARUTIL DEBUG] Created with ID: ${variable.id}`);
        }

        // eslint-disable-next-line no-console
        console.log(
            `[VARUTIL DEBUG] Returning variable: ` +
            `name="${variable.name}", id="${variable.id}", scope="${variable.scope}"`
        );
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
                id: Blockly.utils.genUid(),
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

    _createProcedure (name) {
        name = name.toString();
        let procedure = this._context.procedures[name];
        if (procedure) {
            throw new RubyToBlocksConverterError(
                this._context.currentNode,
                `already defined My Block "${name}".`
            );
        }
        procedure = {
            id: Blockly.utils.genUid(),
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
