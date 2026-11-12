// === Smalruby: This file is Smalruby-specific (return values saved in instance variables, issue #1725) ===
import _ from 'lodash';
import { RubyToBlocksConverterError } from './errors';
import { myBlocksMessages } from './my-blocks';

const RETURN_VALUE_OPCODE = 'smalrubyRuby_returnValue';
const TEMP_PREFIX = '@_ret';
const RETURN_VALUE_TEMP_TYPE = '';
const TEMP_NAME_PATTERN = /[@$]_ret(\d+)(?![\w?!])/g;

/**
 * A call of a method block (`"cd".reverse`) used as a value becomes the method block before the statement
 * and a "return value" reporter in its place (`smalrubyRuby_returnValue`). The reporter gives the value of
 * the method block that ran last, so it is right only when its method block is the statement just before
 * the one that holds it, and that statement holds no other return value.
 *
 * `say(("ab" * 3).length + "cd".reverse.length)` breaks both: the two reporters gave the value of
 * `"cd".reverse`. Each of those calls now saves its return value in an instance variable of its own
 * (`@_ret1 = "ab" * 3`), and the statement reads the variables (issue #1725). A return value used once,
 * just after its call (`say("ab".reverse.upcase)`), stays a reporter.
 * @mixes RubyToBlocksConverter
 */
const ReturnValueTemps = {
    /**
     * Remember which method block a return value reporter gives the value of.
     * @param {object} returnValueBlock - The smalrubyRuby_returnValue block.
     * @param {object} methodBlock - The method block that is put before the statement.
     */
    _recordReturnValueSource(returnValueBlock, methodBlock) {
        if (!this._context.returnValueSources) this._context.returnValueSources = {};
        this._context.returnValueSources[returnValueBlock.id] = methodBlock.id;
    },

    /**
     * The return value reporters in the inputs of a block, not those in the statements of a C block.
     * @param {object} block - A block of the statement.
     * @returns {Array<object>} The reporters, in the order of the inputs.
     */
    _returnValueBlocksIn(block) {
        const found = [];
        const walk = (b) => {
            if (!b) return;
            if (b.opcode === RETURN_VALUE_OPCODE) {
                found.push(b);
                return;
            }
            Object.keys(b.inputs || {}).forEach((name) => {
                if (name.startsWith('SUBSTACK')) return;
                const input = b.inputs[name];
                if (input && input.block) walk(this._context.blocks[input.block]);
            });
        };
        if (this._isBlock(block)) walk(block);
        return found;
    },

    /**
     * Whether a number of a saved return value must not be used. A name the code already uses is
     * skipped, so the value of a variable written by the user is not overwritten. On a sprite, the name
     * of a variable of the stage is skipped too, and on the stage the name of a variable of a sprite:
     * `@_ret1` of the stage is a variable for all sprites, so `@_ret1` of a sprite would be an error.
     * @param {number} n - The number.
     * @returns {boolean} Whether `@_retN` is taken.
     */
    _returnValueTempTaken(n) {
        const context = this._context;
        if (!context.returnValueTempsInSource) {
            const source = context.rootNode ? this._getSource(context.rootNode) : '';
            const numbers = new Set();
            let match;
            TEMP_NAME_PATTERN.lastIndex = 0;
            while ((match = TEMP_NAME_PATTERN.exec(source)) !== null) {
                numbers.add(Number(match[1]));
            }
            context.returnValueTempsInSource = numbers;
        }
        if (context.returnValueTempsInSource.has(n) || this._returnValueTemps().reserved.has(n)) return true;
        const name = `${TEMP_PREFIX.slice(1)}${n}`;
        const known = context.variables && context.variables[name];
        if (known && known.scope !== (this._isStage() ? 'global' : 'instance')) return true;
        if (this._isStage() && this.vm && this.vm.runtime && this.vm.runtime.targets) {
            return this.vm.runtime.targets.some(
                (t) =>
                    !t.isStage &&
                    Object.values(t.variables || {}).some(
                        (v) => v.name === name && v.type === RETURN_VALUE_TEMP_TYPE,
                    ),
            );
        }
        return false;
    },

    /**
     * The numbers given so far in the code, and the numbers no other statement may use.
     * @returns {{given: Set<number>, reserved: Set<number>}} The two sets of the context.
     */
    _returnValueTemps() {
        const context = this._context;
        if (!context.returnValueTempsGiven) context.returnValueTempsGiven = new Set();
        if (!context.returnValueTempsReserved) context.returnValueTempsReserved = new Set();
        return { given: context.returnValueTempsGiven, reserved: context.returnValueTempsReserved };
    },

    /**
     * The next name for a saved return value.
     * @param {Set<number>} usedInStatement - The numbers already given in this statement.
     * @param {boolean} exclusive - Whether the statement calls a method of its own between saving a value
     *     and reading it: the method may run a statement that saves values too, so the numbers of this
     *     statement are used by no other statement.
     * @returns {string} The Ruby name (`@_ret1`).
     */
    _nextReturnValueTempName(usedInStatement, exclusive) {
        const { given, reserved } = this._returnValueTemps();
        let n = 1;
        const skipped = exclusive ? given : new Set();
        while (usedInStatement.has(n) || skipped.has(n) || this._returnValueTempTaken(n)) n++;
        usedInStatement.add(n);
        given.add(n);
        if (exclusive) reserved.add(n);
        return `${TEMP_PREFIX}${n}`;
    },

    /**
     * Save the return values of a statement in instance variables where a reporter would give the value
     * of another call (see `ReturnValueTemps`).
     * @param {Array|object} result - What visiting one statement returned: the blocks put before it, then
     *     the statement (or the value of the last line of a method).
     * @param {object} node - The node of the statement, for an error.
     * @returns {Array|object} The blocks, with a "set variable" block after each call whose value is saved.
     */
    _saveReturnValuesUsedTwice(result, node) {
        if (!_.isArray(result) || result.length < 2) return result;
        const sources = this._context.returnValueSources || {};
        const indexIn = (list, id) => list.findIndex((b) => this._isBlock(b) && b.id === id);
        const saved = [];
        result.forEach((consumer, i) => {
            const reporters = this._returnValueBlocksIn(consumer);
            reporters.forEach((reporter) => {
                const sourceId = sources[reporter.id];
                const sourceIndex = sourceId ? indexIn(result, sourceId) : -1;
                if (sourceIndex < 0) return;
                if (reporters.length >= 2 || sourceIndex !== i - 1) {
                    saved.push({ reporter, sourceId });
                }
            });
        });
        if (saved.length === 0) return result;

        // A call of a method of the program (`foo`) after a saved value, before the statement reads it.
        const firstSaved = Math.min(...saved.map(({ sourceId }) => indexIn(result, sourceId)));
        const callsAfterSaved = result
            .slice(firstSaved + 1, -1)
            .filter((b) => this._isBlock(b) && b.opcode === 'procedures_call');
        const procedureName = this._context.currentProcedureName;
        const recursive =
            procedureName && callsAfterSaved.find((b) => this._procedureNameOfCall(b) === procedureName);
        if (recursive) {
            // The call of the method itself would run this statement again and overwrite the values.
            throw new RubyToBlocksConverterError(
                node || this._context.currentNode,
                this._translator(myBlocksMessages.recursiveCallAfterSavedValue, {
                    SOURCE: this._getSource(node || this._context.currentNode),
                    NAME: procedureName,
                }),
            );
        }
        const exclusive = callsAfterSaved.length > 0;

        const blocks = result.slice();
        const usedInStatement = new Set();
        saved.forEach(({ reporter, sourceId }) => {
            const variable = this._lookupOrCreateVariable(this._nextReturnValueTempName(usedInStatement, exclusive));
            const variableField = {
                name: 'VARIABLE',
                id: variable.id,
                value: variable.name,
                variableType: variable.type,
            };
            const value = this._createBlock(RETURN_VALUE_OPCODE, 'value');
            const setBlock = this._createBlock('data_setvariableto', 'statement', {
                fields: { VARIABLE: { ...variableField } },
                inputs: { VALUE: { name: 'VALUE', block: value.id } },
            });
            value.parent = setBlock.id;
            blocks.splice(indexIn(blocks, sourceId) + 1, 0, setBlock);
            // The reporter keeps its place in the statement and reads the variable instead.
            reporter.opcode = 'data_variable';
            reporter.fields = { VARIABLE: { ...variableField } };
            reporter.inputs = {};
            this._context.blockTypes[reporter.id] = 'value_variable';
            delete sources[reporter.id];
        });
        return blocks;
    },

    /**
     * The name of the method a `procedures_call` block calls.
     * @param {object} block - The procedures_call block.
     * @returns {string} The name (the first word of its proccode).
     */
    _procedureNameOfCall(block) {
        const proccode = (block.mutation && block.mutation.proccode) || '';
        return proccode.split(' ')[0];
    },

    /**
     * Run a function and forget the numbers of saved return values it gave. The calls of the condition
     * of a loop made again at the end of its body save the values in the same variables as the
     * statement of the loop, which gives its numbers after them.
     * @param {Function} fn - The function.
     * @returns {*} What the function returned.
     */
    _withReturnValueTempsKept(fn) {
        const { given, reserved } = this._returnValueTemps();
        const keptGiven = new Set(given);
        const keptReserved = new Set(reserved);
        try {
            return fn();
        } finally {
            this._context.returnValueTempsGiven = keptGiven;
            this._context.returnValueTempsReserved = keptReserved;
        }
    },
};

export default ReturnValueTemps;
