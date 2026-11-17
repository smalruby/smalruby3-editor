import { defineMessages } from 'react-intl';
import * as Blockly from 'scratch-blocks';
import { blockNameOfRubyMethodName, rubyMethodNameOfProccode } from '../ruby-method-name';
import { Variable } from './constants';
import { RubyToBlocksConverterError } from './errors';

// How the code uses a name (`variables.uses` of the analysis, `analysis.js`). `string` / `notString`:
// set to a String / to another value.
const EMPTY_USE = { list: false, scalar: false, hash: false, string: false, notString: false };
// List blocks of Ruby that a String also has (`length` / `[i]` / `include?`), and the read of a list.
const LIST_OPCODES_ALSO_FOR_STRINGS = new Set([
    'data_lengthoflist',
    'data_itemoflist',
    'data_listcontainsitem',
    'data_listcontents',
]);
// The Ruby name of a list beside a variable of the same name: `@_a_list_` is the list `a` (issue #1622).
// `@_a_list2_`, `@_a_list3_`, ... are the same list when the sprite has `_a_list_` too (issue #1707).
const LIST_BESIDE_VARIABLE_PATTERN = /^([$@])_(.+)_list(?:([2-9]|[1-9]\d+))?_$/;

/**
 * The Ruby name before `@_a_list<n>_` in the order the generator tries the names (issue #1707).
 * @param {string} prefix - `@` or `$`.
 * @param {string} name - The name of the list (`a`).
 * @param {number} n - The number of the name (1 for `@_a_list_`).
 * @returns {string} The Ruby name.
 */
const listAliasName = (prefix, name, n) => `${prefix}_${name}_list${n > 1 ? n : ''}_`;

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

        if (type === Variable.LIST_TYPE && scope !== 'local') {
            const listName = this._listNameOfAlias(name);
            if (listName !== null) varName = listName;
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
        const procName = rubyMethodNameOfProccode(proccode);
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
            // The block name of a method name such as `_1_文字えらぶ` is `1_文字えらぶ` (issue #2116).
            procCode: [blockNameOfRubyMethodName(name)],
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
     * How the code uses each variable name and where it uses each local, decided by the analysis
     * stage before converting (`analysis.js`): `variables` and `locals` of the `Analysis`, or null
     * before `targetCodeToBlocks` has analyzed the code.
     *
     * A name is used as a list when it is set to an array literal or a list-only method is called
     * on it, as a hash when it is set to a hash literal, and as a scalar when it is set to anything
     * else, so that a method of both String and Array (`length` / `include?` / `empty?` / `[i]`)
     * does not depend on the order in which the code is converted (issue #1613). A local is also
     * collected by where it is used (issue #1630): a method is a unit of its own; a block of the
     * script is a unit too, but it sees the locals of the script (see `_variableUsesOf` and
     * `_localScopeIndex`).
     * @returns {?object} `{variables, locals}` of the analysis.
     */
    _variableAnalysis() {
        return this._context.analysis;
    },

    /**
     * The target that keeps the variables of a scope: the stage for `$a`, the sprite for `@a`.
     * @param {string} scope - 'global' or 'instance'.
     * @returns {?object} The target.
     */
    _ownerOfScope(scope) {
        if (scope === 'global') {
            const stage = this.vm && this.vm.runtime && this.vm.runtime.getTargetForStage();
            return stage || (this._context.target && this._context.target.isStage ? this._context.target : null);
        }
        if (scope === 'instance') return this._context.target || null;
        return null;
    },

    /**
     * Whether the sprite (or the stage) already has a variable or a list of a name.
     * @param {string} scope - 'global' or 'instance'.
     * @param {string} name - The name in Scratch.
     * @param {?string} type - The type (a variable or a list), or null for either.
     * @returns {boolean} true if it has one.
     */
    _ownerHasVariable(scope, name, type) {
        const owner = this._ownerOfScope(scope);
        return Object.values((owner && owner.variables) || {}).some(
            (v) =>
                v.name === name &&
                (type === null ? v.type === Variable.SCALAR_TYPE || v.type === Variable.LIST_TYPE : v.type === type),
        );
    },

    /**
     * The list that a Ruby name of the form `@_a_list_` (`$_a_list_`) means (issue #1622). The
     * generator names the list `a` so when the sprite (or the stage) also has the variable `a`.
     * The name means the list `a` when the list `a` or the variable `a` is there, or the code uses
     * `@a`. It is the name itself (a variable or a list that the user named `_a_list_`) when the
     * sprite already has something of that name, when the code sets it to a number or a string,
     * or when nothing named `a` is there.
     * When `_a_list_` is itself, the generator names the list `@_a_list2_` (then `@_a_list3_`, ...,
     * issue #1707): `@_a_list3_` is the list `a` only when `@_a_list_` and `@_a_list2_` are both
     * the user's own, so a name that the user wrote for a variable of its own keeps meaning that
     * variable.
     * @param {string} rubyName - The Ruby name (`@_a_list_`, `$_a_list_`, `@_a_list2_`).
     * @returns {?string} The name of the list in Scratch (`a`), or null when the name is itself.
     */
    _listNameOfAlias(rubyName) {
        const match = String(rubyName).match(LIST_BESIDE_VARIABLE_PATTERN);
        if (!match) return null;
        const aliases = this._context.listAliases || (this._context.listAliases = {});
        if (Object.prototype.hasOwnProperty.call(aliases, rubyName)) return aliases[rubyName];
        const [, prefix, name, number] = match;
        const n = number ? Number(number) : 1;
        const scope = prefix === '$' ? 'global' : 'instance';
        const analysis = this._variableAnalysis();
        const names = analysis ? analysis.variables.rubyNames : [];
        const uses = analysis ? analysis.variables.uses : {};
        // A name is the user's own when the sprite has it or the code sets it to a number or a string.
        const isTaken = (k) => {
            const aliasName = listAliasName(prefix, name, k);
            const use = uses[aliasName];
            return Boolean(use && use.scalar && !use.list) || this._ownerHasVariable(scope, aliasName.slice(1), null);
        };
        let listName = null;
        if (this._ownerHasVariable(scope, name, null) || names.includes(`${prefix}${name}`)) {
            // The list is the first name that is not taken, as the generator chooses it. The loop
            // stops there, so a large number (`@_a_list99999_`) does not try every name before it.
            let k = 1;
            while (k < n && isTaken(k)) k++;
            if (k === n && !isTaken(n)) listName = name;
        }
        aliases[rubyName] = listName;
        return listName;
    },

    /**
     * Whether `@a` (`$a`) is a variable or a list, from everything that is known (issue #1622):
     * `@_a_list_` is a list; then how the code uses the name (`@a = []` / `push` are a list,
     * `@a = 0` / `+= 1` a variable); then what the sprite (or the stage) has: a variable (even
     * with a list of the same name beside it, which is `@_a_list_`), or only a list.
     * @param {string} rubyName - The Ruby name (`@a`, `$a`).
     * @returns {?string} 'list', 'scalar', or null when nothing tells (or the code uses a hash).
     */
    _kindOfRubyName(rubyName) {
        rubyName = String(rubyName);
        const prefix = rubyName[0];
        if (prefix !== '$' && prefix !== '@') return null;
        if (this._listNameOfAlias(rubyName) !== null) return 'list';
        const analysis = this._variableAnalysis();
        const use = analysis && analysis.variables.uses[rubyName];
        if (use && use.list) return 'list';
        if (use && use.hash) return null;
        if (use && use.scalar) return 'scalar';
        const scope = prefix === '$' ? 'global' : 'instance';
        const name = rubyName.slice(1);
        // The code also uses `@_a_list_` for the list `a` beside: `@a` is the variable `a`, even when
        // the code only reads it (`say(@a)` and `say(@_a_list_)`).
        if (analysis) {
            const names = analysis.variables.rubyNames;
            for (const other of names) {
                const match = other.match(LIST_BESIDE_VARIABLE_PATTERN);
                if (match && match[1] === prefix && match[2] === name && this._listNameOfAlias(other) === name) {
                    return 'scalar';
                }
            }
        }
        if (this._ownerHasVariable(scope, name, Variable.SCALAR_TYPE)) return 'scalar';
        if (this._ownerHasVariable(scope, name, Variable.LIST_TYPE)) return 'list';
        return null;
    },

    /**
     * Whether a variable of the converter's stores is a variable or a list (see `_kindOfRubyName`).
     * @param {object} variable - The variable in the converter's stores.
     * @returns {?string} 'list', 'scalar', or null (always null for a local).
     */
    _kindOfVariable(variable) {
        if (!variable || variable.isArgument) return null;
        if (variable.scope === 'global') return this._kindOfRubyName(`$${variable.name}`);
        if (variable.scope === 'instance') return this._kindOfRubyName(`@${variable.name}`);
        return null;
    },

    /**
     * Reject Ruby code that uses one `@a` (`$a`) as both a variable and a list (issue #1593):
     * `@a = 0` and `@a.push(1)`. `@a` and `@_a_list_` are two names (issue #1622). Throws on the
     * earliest line that uses the name as a variable.
     */
    _rejectRubyNameOfVariableAndList() {
        const analysis = this._variableAnalysis();
        const conflict = analysis && analysis.errors.find((error) => error.kind === 'variableAndList');
        if (!conflict) return;
        throw new RubyToBlocksConverterError(
            conflict.node,
            this._translator(messages.variableAndListSameName, {
                NAME: conflict.name,
                LIST_LINE: conflict.listLine,
                VARIABLE_LINE: conflict.variableLine,
            }),
        );
    },

    /**
     * Enter the unit of local variables (see `_variableAnalysis`) that a node starts.
     * @param {object} node - The prism node being converted.
     * @returns {?number} The unit to go back to after the node, or null when the node starts none.
     */
    _enterLocalUnit(node) {
        const analysis = this._variableAnalysis();
        const units = analysis && analysis.locals;
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
        const analysis = this._variableAnalysis();
        const units = analysis && analysis.locals;
        const unit = this._context.currentLocalUnit || 0;
        if (
            this._context.scopeStack.length > 0 ||
            !units ||
            unit === 0 ||
            units.groups[unit] !== 0 ||
            !units.splitNames.includes(varName)
        ) {
            return scopeIndex;
        }
        // Decided while converting (in the order of the scopes), so not in the frozen analysis.
        const scopeIndexes = this._context.localScopeIndexes;
        if (!scopeIndexes[unit]) {
            this._context.scopeCounter++;
            scopeIndexes[unit] = this._context.scopeCounter;
        }
        return scopeIndexes[unit];
    },

    /**
     * How the code uses a variable (see `_variableAnalysis`). For a local, only the uses where
     * it is the same variable: in its method, or in the script and its blocks (only in its block
     * when the blocks use the name as different things).
     * @param {object} variable - The variable (or list) in the converter's stores.
     * @returns {?object} `{list, scalar, hash}`, or null when the code does not set the name.
     */
    _variableUsesOf(variable) {
        const analysis = this._variableAnalysis();
        if (!variable || !analysis) return null;
        const uses = analysis.variables.uses;
        if (variable.scope === 'global') return uses[`$${variable.name}`] || null;
        if (variable.scope === 'instance') return uses[`@${variable.name}`] || null;
        const name = variable.originalName || variable.name;
        const units = analysis.locals;
        const unit = this._context.currentLocalUnit || 0;
        if (units.groups[unit] !== 0 || (unit !== 0 && units.splitNames.includes(name))) {
            return units.uses[unit][name] || null;
        }
        let found = null;
        Object.keys(units.uses).forEach((u) => {
            const use = units.groups[u] === 0 && units.uses[u][name];
            if (!use) return;
            if (!found) found = { ...EMPTY_USE };
            Object.keys(EMPTY_USE).forEach((kind) => {
                found[kind] = found[kind] || use[kind];
            });
        });
        return found;
    },

    /**
     * Whether the code uses a variable only as a scalar (see `_variableAnalysis`).
     * @param {object} variable - The variable (or list) in the converter's stores.
     * @returns {boolean} true if the code sets the name to a scalar and never uses it as a list.
     */
    _isUsedOnlyAsScalar(variable) {
        if (!variable || variable.isArgument) return false;
        const use = this._variableUsesOf(variable);
        return Boolean(use) && use.scalar && !use.list;
    },

    /**
     * Whether the code sets a variable only to Strings (see `_variableAnalysis`), so that
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
     * (issue #1659). The operand must be clearly a String: a string literal, a block of a String
     * (`to_s`, `join`) or a variable the converter has seen holding a String. After `a = gets`,
     * `a + 1` and `a + b` stay the number `+`, as before: children write
     * `a = gets; b = gets; a + b` to add two numbers, and a program that runs as an addition
     * must not turn into a join ("3" + "4" → "34") by converting it to blocks.
     * @param {object} operand - The right-hand side of `+` (a value or a block).
     * @returns {boolean} true if the operand is clearly a String.
     */
    _isStringOperand(operand) {
        if (this._isString(operand)) return true;
        if (!this._isBlock(operand)) return false;
        if (this.isVariableBlock(operand)) {
            const variable = this.lookupVariableFromVariableBlock(operand);
            return Boolean(variable) && variable.dataType === 'string';
        }
        return this._getBlockDataType(operand) === 'string';
    },

    /**
     * Leave out the variables that were made only to be set to a hash literal and that no block uses.
     * A hash is kept in two lists (`_hash_h_keys_` / `_hash_h_values_`), but `_onVasgn` makes the
     * variable `h` before it sees that the value is a hash, and the variable would be left in the
     * project, unused (issue #1666). A variable that the project already has stays as it is.
     */
    _dropUnusedHashVariables() {
        const madeForHash = [];
        ['variables', 'localVariables'].forEach((storeName) => {
            Object.keys(this._context[storeName]).forEach((name) => {
                const variable = this._context[storeName][name];
                if (variable.madeForHash && !variable.fromTarget && !variable.isArgument) {
                    madeForHash.push({ storeName, name, id: variable.id });
                }
            });
        });
        if (madeForHash.length === 0) return;

        const usedIds = new Set();
        Object.values(this._context.blocks).forEach((block) => {
            Object.values(block.fields || {}).forEach((field) => {
                if (field && field.id) usedIds.add(field.id);
            });
        });
        madeForHash.forEach(({ storeName, name, id }) => {
            if (!usedIds.has(id)) {
                delete this._context[storeName][name];
            }
        });
    },

    /**
     * Reject Ruby code that uses one name as both a variable and a list (e.g. `@a = 0` and `@a = []`),
     * from the blocks that it made (`_rejectRubyNameOfVariableAndList` rejects `@a` / `$a` from the
     * code before converting).
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

        // The list `a` of `@_a_list_` is beside the variable `a` (issue #1622): `@a` and `@_a_list_`
        // are two names, so a list and a variable of the same name are not a conflict there. Whether
        // the code uses one `@a` as both is in `_rejectRubyNameOfVariableAndList`.
        const aliasedKeys = new Set();
        Object.keys(this._context.listAliases || {}).forEach((rubyName) => {
            const listName = this._context.listAliases[rubyName];
            if (listName !== null) aliasedKeys.add(`${rubyName[0] === '$' ? 'global' : 'instance'}:${listName}`);
        });
        const scalarIds = {};
        ['variables', 'localVariables'].forEach((storeName) => {
            Object.values(this._context[storeName]).forEach((variable) => {
                const key = keyOf(variable);
                if (!variable.isArgument && listKeys.has(key) && !aliasedKeys.has(key)) {
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
