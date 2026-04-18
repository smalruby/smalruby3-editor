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
            if (!this._isFalseOrBooleanBlock(split.value)) {
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(messages.conditionIsNotBoolean, {SOURCE: this._getSource(node)})
                );
            }
            return [...split.preBlocks, split.value];
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
        if (blocks.length >= 2 && this._isBlock(blocks[0])) {
            // It's a multi-block result, link them
            for (let i = 0; i < blocks.length - 1; i++) {
                if (this._isBlock(blocks[i]) && this._isBlock(blocks[i + 1])) {
                    blocks[i].next = blocks[i + 1].id;
                    blocks[i + 1].parent = blocks[i].id;
                }
            }
        }
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
