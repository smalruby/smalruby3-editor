import { defineMessages } from 'react-intl';
import * as Blockly from 'scratch-blocks';
import { Variable } from './constants';
import { RubyToBlocksConverterError } from './errors';

// Methods that this converter turns into list blocks only (a String has no such block here), so
// calling one is evidence that the name is a list (issue #1613).
const LIST_ONLY_METHODS = new Set(['push', '<<', 'delete_at', 'clear', 'insert', '[]=']);
// Nodes that set a variable, whose `name` is the Ruby name (`@a`, `$a`, `a`) and `value` the value.
const VARIABLE_WRITE_NODE_TYPES = new Set(
    ['InstanceVariable', 'GlobalVariable', 'LocalVariable'].flatMap((kind) =>
        ['WriteNode', 'OperatorWriteNode', 'OrWriteNode', 'AndWriteNode'].map((suffix) => `${kind}${suffix}`),
    ),
);
// List blocks of Ruby that a String also has (`length` / `[i]` / `include?`), and the read of a list.
const LIST_OPCODES_ALSO_FOR_STRINGS = new Set([
    'data_lengthoflist',
    'data_itemoflist',
    'data_listcontainsitem',
    'data_listcontents',
]);
const VARIABLE_READ_NODE_TYPES = new Set([
    'InstanceVariableReadNode',
    'GlobalVariableReadNode',
    'LocalVariableReadNode',
]);
// Calls whose value is always a String (issue #1659): `gets` / `answer` (no receiver), and `x.to_s`.
const STRING_CALLS_WITHOUT_RECEIVER = new Set(['gets', 'answer']);
// How the code uses a name (see `_collectVariableUses`). `string` / `notString`: set to a String /
// to another value.
const EMPTY_USE = { list: false, scalar: false, hash: false, string: false, notString: false };
const STRING_VALUE_NODE_TYPES = new Set(['StringNode', 'InterpolatedStringNode']);

const messages = defineMessages({
    cannotChangeVariableScope: {
        defaultMessage:
            '"{VARIABLE}", can\'t change variable scope.' +
            '\nDelete the variable first, then recreate it with the correct scope.',
        description: 'Error message when trying to change variable scope from global to instance or vice versa',
        id: 'gui.smalruby3.rubyToBlocksConverter.cannotChangeVariableScope',
    },
    alreadyDefinedMyBlock: {
        defaultMessage: 'already defined My Block "{NAME}".\nUse a different name.',
        description: 'Error message when defining a My Block with a name that already exists',
        id: 'gui.smalruby3.rubyToBlocksConverter.alreadyDefinedMyBlock',
    },
    variableAndListSameName: {
        defaultMessage:
            '"{NAME}" is used as a list on line {LIST_LINE} and as a variable on line {VARIABLE_LINE}.' +
            '\nIn Ruby, one name cannot be both a variable and a list. Rename one of them.',
        description: 'Error message when one Ruby variable name is used as both a variable and a list',
        id: 'gui.smalruby3.rubyToBlocksConverter.variableAndListSameName',
    },
});

/**
 * Variable, list, and broadcast message utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const VariableUtils = {
    // Helper function to convert argument names to snake_case lowercase
    _toSnakeCaseLowercase(name) {
        return (
            name
                // Replace ASCII non-alphanumeric characters (except underscores) with underscore.
                // Unicode characters (Japanese kana/kanji, etc.) are preserved as-is.
                .replace(/[^a-zA-Z0-9_\u0100-\uFFFF]+/g, '_')
                // Convert camelCase to snake_case: insert underscore before uppercase letters
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                // Convert to lowercase
                .toLowerCase()
        );
    },

    _lookupOrCreateVariableOrList(name, type, isArgument = false) {
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
            scopeIndex = this._localScopeIndex(varName);

            // Check if already exists in current scope
            const currentScope = this._getCurrentScope();
            if (currentScope && currentScope.localVars[varName]) {
                const existingVar = currentScope.localVars[varName];
                const sName = type === Variable.SCALAR_TYPE ? 'localVariables' : 'lists';
                // The scope knows the name, but maybe only as a variable: `a = []` in a method
                // makes the variable first, then the list of the same name (issue #1630).
                const existing = this._context[sName][existingVar.transformedName];
                if (existing) return existing;
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
                    dataType: null,
                };
                this._context[storeName][transformedName] = variable;
            }

            // Track in current scope (the first entry stays: it tells an argument of the method)
            const currentScope = this._getCurrentScope();
            if (currentScope && !currentScope.localVars[varName]) {
                currentScope.localVars[varName] = {
                    transformedName: transformedName,
                    variable: variable,
                };
            }
        } else if (variable) {
            // Check for variable scope change - only for global/instance variables
            if (variable.scope !== scope) {
                throw new RubyToBlocksConverterError(
                    this._context.currentNode,
                    this._translator(messages.cannotChangeVariableScope, { VARIABLE: name }),
                );
            }
        } else {
            variable = {
                id: Blockly.utils.idGenerator.genUid(),
                name: varName,
                scope: scope,
                type: type,
                dataType: null,
            };
            this._context[storeName][varName] = variable;
        }
        return variable;
    },

    _lookupOrCreateVariable(name, isArgument = false) {
        return this._lookupOrCreateVariableOrList(name, Variable.SCALAR_TYPE, isArgument);
    },

    _lookupOrCreateList(name, isArgument = false) {
        return this._lookupOrCreateVariableOrList(name, Variable.LIST_TYPE, isArgument);
    },

    lookupVariableFromVariableBlock(block) {
        if (!this.isVariableBlock(block)) return null;

        return (
            this._context.variables[block.fields.VARIABLE.value] ||
            this._context.localVariables[block.fields.VARIABLE.value]
        );
    },

    lookupListFromListBlock(block) {
        if (!this.isListBlock(block)) return null;

        return this._context.lists[block.fields.LIST.value];
    },

    lookupOrCreateBroadcastMsg(name) {
        return this._lookupOrCreateBroadcastMsg(name);
    },

    _lookupOrCreateBroadcastMsg(name) {
        name = name.toString();
        const key = name.toLowerCase();
        let broadcastMsg = this._context.broadcastMsgs[key];
        if (!broadcastMsg) {
            broadcastMsg = {
                id: Blockly.utils.idGenerator.genUid(),
                name: name,
                scope: 'global',
            };
            this._context.broadcastMsgs[key] = broadcastMsg;
        }
        return broadcastMsg;
    },

    defaultBroadcastMsg() {
        return this._defaultBroadcastMsg();
    },

    _defaultBroadcastMsg() {
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

    _lookupProcedure(name) {
        name = name.toString();
        return this._context.procedures[name];
    },

    /**
     * Check if a procedures_call block calls a procedure that has a return value.
     * @param {object} block - A procedures_call block
     * @returns {boolean} true if the called procedure has hasReturnValue
     */
    _isProcedureCallWithReturnValue(block) {
        if (!block || block.opcode !== 'procedures_call' || !block.mutation) return false;
        const proccode = block.mutation.proccode;
        if (!proccode) return false;
        // Extract procedure name from proccode (name is the first part before any %s/%b)
        const procName = proccode
            .split(' ')
            .filter((i) => !/^%[sb]$/.test(i))
            .join('_');
        const procedure = this._lookupProcedure(procName);
        return procedure && procedure.hasReturnValue;
    },

    _createProcedure(name) {
        name = name.toString();
        let procedure = this._context.procedures[name];
        if (procedure) {
            throw new RubyToBlocksConverterError(
                this._context.currentNode,
                this._translator(messages.alreadyDefinedMyBlock, { NAME: name }),
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
            argumentBlocks: [],
        };
        this._context.procedures[name] = procedure;
        return procedure;
    },

    _collectSymbol(name) {
        this._context.symbols.add(`:${name}`);
    },

    _createSymbolsList() {
        if (this._context.symbols.size === 0) return;
        this._lookupOrCreateList('$_symbols_');
    },

    _symbolToBlock(symbolName, node) {
        this._collectSymbol(symbolName);
        const list = this._lookupOrCreateList('$_symbols_');
        const block = this._createBlock('data_itemnumoflist', 'value', {
            fields: {
                LIST: {
                    name: 'LIST',
                    id: list.id,
                    value: list.name,
                    variableType: list.type,
                },
            },
        });
        block.node = node;
        this._addTextInput(block, 'ITEM', symbolName, 'thing');
        block.comment = this._createComment(`@ruby:symbol:${symbolName}`, block.id);
        return block;
    },

    _resolveSymbolVariable(value) {
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
                    variableType: list.type,
                },
            },
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
    _hashKeysListName(prefixedName) {
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
    _hashValuesListName(prefixedName) {
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

    _changeToBooleanArgument(varName) {
        varName = varName.toString();
        const variable = this._context.localVariables[varName];
        if (!variable) {
            return false;
        }

        variable.isBoolean = true;

        if (Object.prototype.hasOwnProperty.call(this._context.argumentBlocks, variable.id)) {
            this._context.argumentBlocks[variable.id].forEach((id) => {
                const b = this._context.blocks[id];
                b.opcode = 'argument_reporter_boolean';
                this._setBlockType(b, 'value_boolean');
            });
        }
        return true;
    },

    /**
     * Collect, before converting, how the code uses each variable name, so that a method of both
     * String and Array (`length` / `include?` / `empty?` / `[i]`) does not depend on the order in
     * which the code is converted (issue #1613): `@a.length` in a method or an event before
     * `@a = "abc"`, `@a = gets`, or a number set last.
     * A name is used as a list when it is set to an array literal or a list-only method is called
     * on it, as a hash when it is set to a hash literal, and as a scalar when it is set to anything else.
     * The result is in `_context.variableUses`, keyed by the Ruby name (`@a`, `$a`, `a`).
     *
     * A local variable is also collected by where it is used (issue #1630), since `a` in one
     * method, or in one block of the script (an event `when_flag_clicked do`), is not `a` in
     * another. A method is a unit of its own. A block of the script (a call with `do ... end`
     * outside any method or other block) is a unit too, but it sees the locals of the script
     * outside the blocks (unit 0). The units are in `_context.localVariableUnits` (see
     * `_variableUsesOf` and `_localScopeIndex`).
     * @param {object} root - The root prism node.
     */
    _collectVariableUses(root) {
        const uses = {};
        // unit id -> Ruby name of a local -> use
        const localUses = { 0: {} };
        // unit id -> the unit whose locals it sees: itself for a method, 0 for a block of the script
        const unitGroups = { 0: 0 };
        const unitOfNode = new Map();
        let nextUnit = 1;
        const newUnit = (node, ownGroup) => {
            const unit = nextUnit++;
            unitGroups[unit] = ownGroup ? unit : 0;
            localUses[unit] = {};
            unitOfNode.set(node, unit);
            return unit;
        };
        const mark = (name, use, unit) => {
            if (!name) return;
            const key = String(name);
            if (!uses[key]) uses[key] = { ...EMPTY_USE };
            uses[key][use] = true;
            if (key[0] !== '$' && key[0] !== '@') {
                if (!localUses[unit][key]) localUses[unit][key] = { ...EMPTY_USE };
                localUses[unit][key][use] = true;
            }
        };
        const queue = [[root, 0]];
        while (queue.length > 0) {
            const [node, outerUnit] = queue.pop();
            // Not `constructor.name`: the production build renames the classes.
            const nodeType = this._prismNodeType(node);
            if (!nodeType) continue;
            let unit = outerUnit;
            if (nodeType === 'DefNode') {
                unit = newUnit(node, true);
            } else if (
                nodeType === 'CallNode' &&
                outerUnit === 0 &&
                node.block &&
                this._prismNodeType(node.block) === 'BlockNode'
            ) {
                unit = newUnit(node, false);
            }
            if (VARIABLE_WRITE_NODE_TYPES.has(nodeType)) {
                const valueType = this._prismNodeType(node.value);
                if (valueType === 'ArrayNode') {
                    mark(node.name, 'list', unit);
                } else if (valueType === 'HashNode') {
                    mark(node.name, 'hash', unit);
                } else {
                    mark(node.name, 'scalar', unit);
                    // Whether the value is a String, for the string `+` (issue #1659).
                    mark(node.name, this._isStringValueNode(node.value) ? 'string' : 'notString', unit);
                }
            } else if (
                nodeType === 'CallNode' &&
                LIST_ONLY_METHODS.has(String(node.name)) &&
                VARIABLE_READ_NODE_TYPES.has(this._prismNodeType(node.receiver))
            ) {
                const args = node.arguments_ ? node.arguments_.arguments_ : [];
                const keyType = args.length > 0 ? this._prismNodeType(args[0]) : null;
                // `@a[:key] = 1` and `@a["key"] = 1` are a hash.
                if (!(node.name === '[]=' && (keyType === 'SymbolNode' || keyType === 'StringNode'))) {
                    mark(node.receiver.name, 'list', unit);
                }
            }
            if (typeof node.compactChildNodes === 'function') {
                node.compactChildNodes().forEach((child) => queue.push([child, unit]));
            }
        }

        // A local that the script outside the blocks does not use, and that its blocks use as
        // different things (a string in one event, a list in another), is a separate local in
        // each block: it gets a scope index for each block (`_localScopeIndex`).
        const kindOf = (use) => {
            if (use.list) return 'list';
            if (use.hash) return 'hash';
            return 'scalar';
        };
        const kindsOfName = {};
        Object.keys(localUses).forEach((unit) => {
            if (Number(unit) === 0 || unitGroups[unit] !== 0) return;
            Object.keys(localUses[unit]).forEach((name) => {
                if (!kindsOfName[name]) kindsOfName[name] = new Set();
                kindsOfName[name].add(kindOf(localUses[unit][name]));
            });
        });
        const splitNames = new Set(
            Object.keys(kindsOfName).filter((name) => kindsOfName[name].size > 1 && !localUses[0][name]),
        );

        this._context.variableUses = uses;
        this._context.localVariableUnits = { unitOfNode, localUses, unitGroups, splitNames, scopeIndexes: {} };
        this._context.currentLocalUnit = 0;
    },

    /**
     * Enter the unit of local variables (see `_collectVariableUses`) that a node starts.
     * @param {object} node - The prism node being converted.
     * @returns {?number} The unit to go back to after the node, or null when the node starts none.
     */
    _enterLocalUnit(node) {
        const units = this._context.localVariableUnits;
        if (!units || !units.unitOfNode.has(node)) return null;
        const previous = this._context.currentLocalUnit || 0;
        this._context.currentLocalUnit = units.unitOfNode.get(node);
        return previous;
    },

    /**
     * The scope index of a local variable being made (the `1` of `_a_1_`). A method has its own
     * (`_enterScope`). In the script, a local that blocks use as different things gets one for
     * each block (issue #1630); any other local of the script is `1`, shared by its blocks.
     * @param {string} varName - The Ruby name of the local.
     * @returns {number} The scope index.
     */
    _localScopeIndex(varName) {
        const scopeIndex = this._getScopeIndex();
        const units = this._context.localVariableUnits;
        const unit = this._context.currentLocalUnit || 0;
        if (
            this._context.scopeStack.length > 0 ||
            !units ||
            unit === 0 ||
            units.unitGroups[unit] !== 0 ||
            !units.splitNames.has(varName)
        ) {
            return scopeIndex;
        }
        if (!units.scopeIndexes[unit]) {
            this._context.scopeCounter++;
            units.scopeIndexes[unit] = this._context.scopeCounter;
        }
        return units.scopeIndexes[unit];
    },

    /**
     * How the code uses a variable (see `_collectVariableUses`). For a local, only the uses where
     * it is the same variable: in its method, or in the script and its blocks (only in its block
     * when the blocks use the name as different things).
     * @param {object} variable - The variable (or list) in the converter's stores.
     * @returns {?object} `{list, scalar, hash}`, or null when the code does not set the name.
     */
    _variableUsesOf(variable) {
        if (!variable || !this._context.variableUses) return null;
        if (variable.scope === 'global') return this._context.variableUses[`$${variable.name}`] || null;
        if (variable.scope === 'instance') return this._context.variableUses[`@${variable.name}`] || null;
        const name = variable.originalName || variable.name;
        const units = this._context.localVariableUnits;
        if (!units) return this._context.variableUses[name] || null;
        const unit = this._context.currentLocalUnit || 0;
        if (units.unitGroups[unit] !== 0 || (unit !== 0 && units.splitNames.has(name))) {
            return units.localUses[unit][name] || null;
        }
        let found = null;
        Object.keys(units.localUses).forEach((u) => {
            const use = units.unitGroups[u] === 0 && units.localUses[u][name];
            if (!use) return;
            if (!found) found = { ...EMPTY_USE };
            Object.keys(EMPTY_USE).forEach((kind) => {
                found[kind] = found[kind] || use[kind];
            });
        });
        return found;
    },

    /**
     * Whether the code uses a variable only as a scalar (see `_collectVariableUses`).
     * @param {object} variable - The variable (or list) in the converter's stores.
     * @returns {boolean} true if the code sets the name to a scalar and never uses it as a list.
     */
    _isUsedOnlyAsScalar(variable) {
        if (!variable || variable.isArgument) return false;
        const use = this._variableUsesOf(variable);
        return Boolean(use) && use.scalar && !use.list;
    },

    /**
     * Whether a prism node is a value that is always a String (see `_collectVariableUses`):
     * a string literal, `gets`, `answer` or `x.to_s`.
     * @param {object} node - The prism node of the value.
     * @returns {boolean} true if the value is a String.
     */
    _isStringValueNode(node) {
        const nodeType = this._prismNodeType(node);
        if (STRING_VALUE_NODE_TYPES.has(nodeType)) return true;
        if (nodeType !== 'CallNode') return false;
        const name = String(node.name);
        const args = node.arguments_ ? node.arguments_.arguments_ : [];
        if (args.length > 0 || node.block) return false;
        if (name === 'to_s') return true;
        return !node.receiver && STRING_CALLS_WITHOUT_RECEIVER.has(name);
    },

    /**
     * Whether the code sets a variable only to Strings (see `_collectVariableUses`), so that
     * `@a + x` is the string `+` even where the converter has not seen the string yet (issue #1659).
     * @param {object} variable - The variable in the converter's stores.
     * @returns {boolean} true if every value the code sets the name to is a String.
     */
    _isUsedOnlyAsString(variable) {
        if (!variable || variable.isArgument) return false;
        const use = this._variableUsesOf(variable);
        return Boolean(use) && use.string && !use.notString && !use.list && !use.hash;
    },

    /**
     * Whether `+` on a variable is the string `+` (`operator_join`): the variable holds a String
     * where it is converted, or the code sets it only to Strings (issue #1659).
     * @param {object} variable - The variable in the converter's stores.
     * @returns {boolean} true if `+` on the variable joins strings.
     */
    _isStringVariable(variable) {
        if (!variable) return false;
        if (variable.dataType === 'string') return true;
        return !variable.dataType && this._isUsedOnlyAsString(variable);
    },

    /**
     * Whether `x + operand` is the string `+` when `x` is a String only by `_isUsedOnlyAsString`
     * (issue #1659). The operand must be a String too: after `@a = gets`, adding a number or a
     * name not known to be a String (`@a + 1`) stays the number `+`, as it was before.
     * @param {object} operand - The right-hand side of `+` (a value or a block).
     * @returns {boolean} true if the operand is a String.
     */
    _isStringOperand(operand) {
        if (this._isString(operand)) return true;
        if (!this._isBlock(operand)) return false;
        if (this.isVariableBlock(operand)) {
            return this._isStringVariable(this.lookupVariableFromVariableBlock(operand));
        }
        return this._getBlockDataType(operand) === 'string';
    },

    /**
     * Whether a list that the project already has gives way to a variable of the same name.
     * The VM keeps a list after the code that made it is rewritten (`@a = []` → `@a = 0`), so the
     * code is converted with the list still there. When this code sets the variable and never uses
     * the list, the variable is what the code means: Scratch can have both, so the variable is
     * made and the list is left as it is (issue #1612). Only reading the name (`say(@a)`) still
     * reads the list (issue #1567).
     * @param {object} list - The list in `_context.lists`.
     * @returns {boolean} true if the list should be left out of this conversion.
     */
    _isListShadowedByVariable(list) {
        if (!list || !list.fromTarget || list.isArgument) return false;
        const variable = this._context.variables[list.name];
        if (!variable || variable.isArgument || variable.scope !== list.scope) return false;
        let written = false;
        const used = Object.values(this._context.blocks).some((block) => {
            const fields = block.fields || {};
            if (fields.LIST && fields.LIST.id === list.id) return true;
            if (block.opcode !== 'data_variable' && fields.VARIABLE && fields.VARIABLE.id === variable.id) {
                written = true;
            }
            return false;
        });
        return written && !used;
    },

    /**
     * Leave out the lists that give way to a variable of the same name (see
     * `_isListShadowedByVariable`), so that the target applier makes the variable instead of
     * dropping it with the script that sets it (issue #1612). The list stays in the project.
     */
    _dropListsShadowedByVariables() {
        Object.keys(this._context.lists).forEach((name) => {
            if (this._isListShadowedByVariable(this._context.lists[name])) {
                delete this._context.lists[name];
            }
        });
    },

    /**
     * Reject Ruby code that uses one name as both a variable and a list (e.g. `@a = 0` and `@a = []`).
     * Scratch can have a variable and a list of the same name, but Ruby has one `@a`, and the target
     * applier keeps only the list: a block that sets or changes the dropped variable would point at
     * nothing, and the script would disappear on the way back to Ruby (issue #1593).
     * Reading the name (a data_variable block) is not such a use: the applier reads the list itself
     * there, including a read in a method before the list is made (issues #634 / #1567).
     * Throws on the earliest line that uses the name as a variable.
     */
    _rejectVariableAndListOfSameName() {
        const keyOf = (variable) => `${variable.scope}:${variable.name}`;
        // A block whose node is not known still counts (so the script never disappears silently);
        // it is placed after the blocks whose lines are known.
        const lineOf = (node) => (node ? this._getLoc(node).line : Infinity);
        const earlier = (line, other) => typeof other === 'undefined' || line < other;

        const listKeys = new Set();
        const listIds = {};
        Object.values(this._context.lists).forEach((list) => {
            if (list.isArgument) return;
            listKeys.add(keyOf(list));
            listIds[list.id] = list;
        });
        if (listKeys.size === 0) return;

        // A variable that the sprite (or the stage) already has keeps working: the applier skips
        // creating it, but its id is the existing one. A Scratch project can have a variable and a
        // list of the same name, and its Ruby (`$a = 0` and `$a.push(1)`) must still convert.
        const existsInTarget = (variable) => {
            let owner = null;
            if (variable.scope === 'global') {
                owner = this.vm && this.vm.runtime && this.vm.runtime.getTargetForStage();
            } else if (variable.scope === 'instance') {
                owner = this._context.target;
            }
            const existing = owner && owner.variables && owner.variables[variable.id];
            return Boolean(existing) && existing.type === Variable.SCALAR_TYPE;
        };
        const scalarIds = {};
        ['variables', 'localVariables'].forEach((storeName) => {
            Object.values(this._context[storeName]).forEach((variable) => {
                if (!variable.isArgument && listKeys.has(keyOf(variable)) && !existsInTarget(variable)) {
                    scalarIds[variable.id] = variable;
                }
            });
        });
        if (Object.keys(scalarIds).length === 0) return;

        const firstListLine = {};
        // A line that uses the name only as a list (`@a.push(1)`, `@a = []`) is the one to show: a
        // `length` / `include?` / `[i]` / read of the name is a list only because of such a line
        // (issue #1613).
        const firstListOnlyLine = {};
        const firstScalarUse = {};
        Object.values(this._context.blocks).forEach((block) => {
            const fields = block.fields || {};
            const list = fields.LIST && listIds[fields.LIST.id];
            const scalar = block.opcode !== 'data_variable' && fields.VARIABLE && scalarIds[fields.VARIABLE.id];
            if (!list && !scalar) return;
            const node = this._nodeOfBlock(block);
            const line = lineOf(node);
            if (list) {
                const key = keyOf(list);
                if (earlier(line, firstListLine[key])) firstListLine[key] = line;
                if (!LIST_OPCODES_ALSO_FOR_STRINGS.has(block.opcode) && earlier(line, firstListOnlyLine[key])) {
                    firstListOnlyLine[key] = line;
                }
            }
            if (scalar) {
                const key = keyOf(scalar);
                if (!firstScalarUse[key] || earlier(line, firstScalarUse[key].line)) {
                    firstScalarUse[key] = { line, node, variable: scalar };
                }
            }
        });

        const conflicts = Object.keys(firstScalarUse)
            .filter((key) => typeof firstListLine[key] !== 'undefined')
            .map((key) => firstScalarUse[key])
            .sort((a, b) => a.line - b.line);
        if (conflicts.length === 0) return;

        const { line, node, variable } = conflicts[0];
        const lineText = (n) => (n === Infinity ? '?' : n);
        let name = variable.name;
        if (variable.scope === 'global') {
            name = `$${variable.name}`;
        } else if (variable.scope === 'instance') {
            name = `@${variable.name}`;
        } else if (variable.originalName) {
            name = variable.originalName;
        }
        throw new RubyToBlocksConverterError(
            node,
            this._translator(messages.variableAndListSameName, {
                NAME: name,
                LIST_LINE: lineText(
                    typeof firstListOnlyLine[keyOf(variable)] === 'undefined'
                        ? firstListLine[keyOf(variable)]
                        : firstListOnlyLine[keyOf(variable)],
                ),
                VARIABLE_LINE: lineText(line),
            }),
        );
    },
};

export default VariableUtils;
