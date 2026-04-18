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
        const blocks = [];
        node.body.forEach(childNode => {
            // Reset per-statement operator indices so each statement's operators are independently indexed.
            // This ensures `1 != 50\n2 != 60` produces two blocks both with index :1, while
            // `1 != 50 && 2 != 60` (a single expression) produces indices :1 and :2.
            // Note: literalCallIndices are NOT reset per-statement - they accumulate across statements.
            this._context.methodCallIndices = {};
            const block = this.visit(childNode);
            if (_.isArray(block)) {
                block.forEach(b => {
                    blocks.push(b);
                });
            } else {
                blocks.push(block);
            }
        });
        this._context.inMyBlockDefinition = savedInMyBlockDefinition;

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
        let blocks = this.visit(node);
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
                        blocks[prevIdx].next = blocks[i].id;
                        blocks[i].parent = blocks[prevIdx].id;
                    }
                    prevIdx = i;
                }
            }
        }
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
