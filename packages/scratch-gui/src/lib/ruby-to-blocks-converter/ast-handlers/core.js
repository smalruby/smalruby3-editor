import {defineMessages} from 'react-intl';
import _ from 'lodash';
import {RubyToBlocksConverterError} from '../errors';

const messages = defineMessages({
    conditionIsNotBoolean: {
        defaultMessage: 'condition is not boolean: {SOURCE}.' +
            '\nUse a comparison operator (==, <, >, etc.).',
        description: 'Error message when if/until condition is not a boolean expression',
        id: 'gui.smalruby3.rubyToBlocksConverter.conditionIsNotBoolean'
    },
    includeNotStatementBlocks: {
        defaultMessage: 'include not statement blocks.' +
            '\nOnly use statement blocks (commands) inside a block definition.',
        description: 'Error message when non-statement blocks are included in My Block definition body',
        id: 'gui.smalruby3.rubyToBlocksConverter.includeNotStatementBlocks'
    },
    eventInsideBlock: {
        defaultMessage: '"{ SOURCE }" is an event, so it cannot be placed inside another block.' +
            '\nMove it out of the block so that it starts a script of its own.',
        description: 'Error message when an event (hat) block is written inside a block body (do ... end)',
        id: 'gui.smalruby3.rubyToBlocksConverter.eventInsideBlock'
    },
    valueAsStatement: {
        defaultMessage: '"{ SOURCE }" is a value, so it cannot be written as a command by itself.' +
            '\nUse it in a command (e.g. say({ SOURCE })) or set it to a variable.',
        description: 'Error message when a value (reporter) is written as a line by itself inside a block body',
        id: 'gui.smalruby3.rubyToBlocksConverter.valueAsStatement'
    }
});

/**
 * Core AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const CoreHandlers = {
    visitProgramNode (node) {
        return this.visit(node.statements);
    },

    visitStatementsNode (node) {
        const savedInMyBlockDefinition = this._context.inMyBlockDefinition;
        this._context.inMyBlockDefinition = false;
        // Only the statements directly in a block body are checked: a nested body sets it again.
        const bodyKind = this._context.statementBodyKind;
        this._context.statementBodyKind = null;
        const blocks = [];
        node.body.forEach(childNode => {
            // Reset per-statement operator indices so each statement's operators are independently indexed.
            // This ensures `1 != 50\n2 != 60` produces two blocks both with index :1, while
            // `1 != 50 && 2 != 60` (a single expression) produces indices :1 and :2.
            // Note: literalCallIndices are NOT reset per-statement - they accumulate across statements.
            this._context.methodCallIndices = {};
            const block = this.visit(childNode);
            if (bodyKind) {
                this._checkStatementInBody(childNode, block, bodyKind);
            }
            if (_.isArray(block)) {
                block.forEach(b => {
                    blocks.push(b);
                });
            } else {
                blocks.push(block);
            }
        });
        this._context.inMyBlockDefinition = savedInMyBlockDefinition;
        this._context.statementBodyKind = bodyKind;

        let prevBlock = null;
        const result = [];
        blocks.forEach(block => {
            switch (this._getBlockType(block)) {
            case 'statement':
                if (prevBlock) {
                    prevBlock.next = block.id;
                    block.parent = prevBlock.id;
                } else {
                    result.push(block);
                }

                if (block.next) {
                    const b = this._lastBlock(block);
                    if (this._getBlockType(b) === 'statement') {
                        prevBlock = b;
                    } else {
                        prevBlock = null;
                    }
                } else {
                    prevBlock = block;
                }
                break;
            case 'terminate':
                if (prevBlock) {
                    prevBlock.next = block.id;
                    block.parent = prevBlock.id;
                } else {
                    result.push(block);
                }
                prevBlock = null;
                break;
            case 'value':
            case 'value_boolean':
            case 'value_variable':
            case 'value_boolean_variable':
            case 'hat':
            case 'primitive':
                result.push(block);
                prevBlock = null;
            }
        });
        return result;
    },

    /**
     * Throw an error for a statement in a block body (`do ... end`, `if`, ...) that cannot be
     * placed there, instead of leaving it as a block attached to nothing (#1544):
     * - an event (hat), e.g. `when_clicked do ... end` inside `when_flag_clicked do ... end`;
     *   it is neither linked in the body nor a script of its own, so it and its body would be lost.
     * - in a block body (not in a method body, where it is the return value), a value written as
     *   a line by itself, e.g. `x` or `1 + 2`; it cannot be linked either.
     * A method definition (`def`) is left as before: it is placed as a script of its own.
     * A value made by splitting one statement (e.g. the return value of `"a".reverse`, which
     * comes as an array after its command) is not checked.
     * @param {object} node - The statement node.
     * @param {object|Array} result - What visiting the statement returned.
     * @param {string} bodyKind - 'block' or 'method' (see `statementBodyKind` of the context).
     */
    _checkStatementInBody (node, result, bodyKind) {
        const blocks = _.isArray(result) ? result : [result];
        const source = () => this._getSource(node).split('\n')[0].trim();
        if (blocks.some(b => this._isBlock(b) && this._getBlockType(b) === 'hat' &&
            b.opcode !== 'procedures_definition')) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.eventInsideBlock, {SOURCE: source()})
            );
        }
        if (bodyKind === 'block' && blocks.length === 1 && this._isValueBlock(blocks[0]) &&
            blocks[0].opcode !== 'data_setvariableto') {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.valueAsStatement, {SOURCE: source()})
            );
        }
    },

    visitBeginNode (node) {
        return this.visit(node.statements);
    },

    _processCondition (node) {
        let cond = this.visit(node);
        const split = this._splitPreBlocksAndValue(cond);
        if (split.preBlocks.length > 0) {
            // === Smalruby: Start of returnValue to returnValueTruthy conversion ===
            // When a smalrubyRuby method is used in a boolean context (if/unless
            // condition), replace the returnValue REPORTER with returnValueTruthy
            // BOOLEAN so it can be used as a condition input.
            let value = split.value;
            if (this._isBlock(value) &&
                value.opcode === 'smalrubyRuby_returnValue') {
                this._discardBlock(value);
                value = this._createBlock('smalrubyRuby_returnValueTruthy', 'value_boolean');
            }
            // === Smalruby: End of returnValue to returnValueTruthy conversion ===
            if (!this._isFalseOrBooleanBlock(value)) {
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(messages.conditionIsNotBoolean, {SOURCE: this._getSource(node)})
                );
            }
            return [...split.preBlocks, value];
        }
        cond = split.value;
        if (!this._isFalseOrBooleanBlock(cond)) {
            if (this._isBlock(cond) && cond.opcode === 'data_variable') {
                this._context.variableHint = this._getRubyVariableName(cond);
                cond = this._wrapVariableAsBooleanCondition(cond);
            } else {
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(messages.conditionIsNotBoolean, {SOURCE: this._getSource(node)})
                );
            }
        }
        return cond;
    },

    _processStatement (node, inMyBlockDefinition = null) {
        const savedInMyBlockDefinition = this._context.inMyBlockDefinition;
        if (inMyBlockDefinition !== null) {
            this._context.inMyBlockDefinition = inMyBlockDefinition;
        }
        const savedBodyKind = this._context.statementBodyKind;
        this._context.statementBodyKind = 'block';
        let blocks;
        try {
            blocks = this.visit(node);
        } finally {
            this._context.statementBodyKind = savedBodyKind;
        }
        if (!_.isArray(blocks)) {
            blocks = [blocks];
        }
        // === Smalruby: Start of bare literal in statement context ===
        const Primitive = require('../primitive').default;
        blocks = blocks.map(b => {
            if (b instanceof Primitive && b.type !== 'sym') {
                return this._convertBareLiteralToAssignment(b);
            }
            return b;
        });
        blocks = blocks.flat();
        // === Smalruby: End of bare literal in statement context ===
        // === Smalruby: Start of statement-only linking ===
        // Link only statement/terminate blocks, skipping value blocks (e.g.,
        // orphan returnValue REPORTERs from auto-split). Value blocks in a
        // next-chain corrupt the generator output because blockToCode returns
        // [code, order] tuples that get string-concatenated as garbage.
        if (blocks.length >= 2 && this._isBlock(blocks[0])) {
            let prevIdx = this._isStatementBlock(blocks[0]) ? 0 : -1;
            for (let i = 1; i < blocks.length; i++) {
                if (this._isBlock(blocks[i]) && this._isStatementBlock(blocks[i])) {
                    if (prevIdx >= 0) {
                        // Link to the end of the previous chain: it can already have statements
                        // after it (e.g. `move(10)` → the `"a".reverse` command), and linking to
                        // its head would cut them off.
                        const tail = this._lastBlock(blocks[prevIdx]);
                        tail.next = blocks[i].id;
                        blocks[i].parent = tail.id;
                    }
                    prevIdx = i;
                }
            }
        }
        // A value block after the first one is not linked nor used (e.g. the returnValue
        // REPORTER of `"a".reverse` written as a statement): drop it, or it is left as an orphan.
        // A method definition (a hat) is kept: it is placed as a script of its own. An event (hat) does
        // not come here: `_checkStatementInBody` has already thrown an error for it (#1544).
        blocks.slice(1).forEach(b => {
            if (this._isBlock(b) && !this._isStatementBlock(b) && this._getBlockType(b) !== 'hat' &&
                !b.parent) {
                this._discardBlock(b);
            }
        });
        // === Smalruby: End of statement-only linking ===
        const block = blocks[0];
        if (block !== null && typeof block !== 'undefined' && !this._isStatementBlock(block)) {
            if (!(this._context.inMyBlockDefinition && block.opcode === 'data_setvariableto')) {
                this._context.inMyBlockDefinition = savedInMyBlockDefinition;
                throw new RubyToBlocksConverterError(node, this._translator(messages.includeNotStatementBlocks));
            }
        }
        this._context.inMyBlockDefinition = savedInMyBlockDefinition;
        return block;
    },

    _getBlockIdFromResult (result) {
        if (this._isBlock(result)) {
            return result.id;
        }
        if (_.isArray(result) && result.length > 0 && this._isBlock(result[result.length - 1])) {
            return result[result.length - 1].id;
        }
        return null;
    },

    _splitPreBlocksAndValue (result) {
        if (_.isArray(result) && result.length === 1) {
            // Single element array - extract the value
            return {
                preBlocks: [],
                value: result[0]
            };
        }
        if (_.isArray(result) && result.length > 0 && this._isBlock(result[0])) {
            return {
                preBlocks: result.slice(0, result.length - 1),
                value: result[result.length - 1]
            };
        }
        return {
            preBlocks: [],
            value: result
        };
    }
};

export default CoreHandlers;
