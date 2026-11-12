// === Smalruby: This file is Smalruby-specific (return values saved in instance variables, issue #1725) ===
import _ from 'lodash';

const RETURN_VALUE_OPCODE = 'smalrubyRuby_returnValue';
const TEMP_PREFIX = '@_ret';
const TEMP_NAME_PATTERN = /@_ret(\d+)(?![\w?!])/g;

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
     * The next name for a saved return value. A name the code already uses is skipped, so the value of
     * a variable written by the user is not overwritten.
     * @param {Set<number>} usedInStatement - The numbers already given in this statement.
     * @returns {string} The Ruby name (`@_ret1`).
     */
    _nextReturnValueTempName(usedInStatement) {
        if (!this._context.returnValueTempsInSource) {
            const source = this._context.rootNode ? this._getSource(this._context.rootNode) : '';
            const numbers = new Set();
            let match;
            TEMP_NAME_PATTERN.lastIndex = 0;
            while ((match = TEMP_NAME_PATTERN.exec(source)) !== null) {
                numbers.add(Number(match[1]));
            }
            this._context.returnValueTempsInSource = numbers;
        }
        let n = 1;
        while (usedInStatement.has(n) || this._context.returnValueTempsInSource.has(n)) n++;
        usedInStatement.add(n);
        return `${TEMP_PREFIX}${n}`;
    },

    /**
     * Save the return values of a statement in instance variables where a reporter would give the value
     * of another call (see `ReturnValueTemps`).
     * @param {Array|object} result - What visiting one statement returned: the blocks put before it, then
     *     the statement (or the value of the last line of a method).
     * @returns {Array|object} The blocks, with a "set variable" block after each call whose value is saved.
     */
    _saveReturnValuesUsedTwice(result) {
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

        const blocks = result.slice();
        const usedInStatement = new Set();
        saved.forEach(({ reporter, sourceId }) => {
            const variable = this._lookupOrCreateVariable(this._nextReturnValueTempName(usedInStatement));
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
};

export default ReturnValueTemps;
