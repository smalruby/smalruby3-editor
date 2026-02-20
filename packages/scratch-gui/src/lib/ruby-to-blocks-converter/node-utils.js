import _ from 'lodash';
import {RubyToBlocksConverterError} from './errors';

/**
 * Node and block judgment utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const NodeUtils = {
    _checkNumChildren (node, length) {
        // Prism node children are named properties, not an array.
    },

    _isPrimitive (value) {
        return value && (value._isPrimitive || value.constructor.name === 'Primitive' || value._type);
    },

    _isSelf (block) {
        return this._isPrimitive(block) && block.type === 'self';
    },

    _isStage () {
        return this._context.target && this._context.target.isStage;
    },

    isString (value) {
        return this._isString(value);
    },

    _isString (value) {
        if (_.isString(value)) return true;
        if (this._isPrimitive(value)) {
            return value.type === 'str';
        }
        return value && value.constructor.name === 'StringNode';
    },

    isNumber (value) {
        return this._isNumber(value);
    },

    _isNumber (value) {
        if (_.isNumber(value)) return true;
        if (this._isPrimitive(value)) {
            return value.type === 'int' || value.type === 'float';
        }
        return value &&
            (value.constructor.name === 'IntegerNode' || value.constructor.name === 'FloatNode');
    },

    isTrue (value) {
        return this._isTrue(value);
    },

    _isTrue (value) {
        if (value === true) return true;
        if (this._isPrimitive(value)) {
            return value.type === 'true';
        }
        if (value && value.constructor.name === 'TrueNode') {
            return true;
        }
        if (this._isBlock(value) && value.opcode === 'operator_equals' && value.comment) {
            const comment = this._context.comments[value.comment];
            return comment && comment.text.startsWith('@ruby:literal:true:');
        }
        return false;
    },

    isFalse (value) {
        return this._isFalse(value);
    },

    _isFalse (value) {
        if (value === false) return true;
        if (this._isPrimitive(value)) {
            return value.type === 'false';
        }
        if (value && value.constructor.name === 'FalseNode') {
            return true;
        }
        if (this._isBlock(value) && value.opcode === 'operator_lt' && value.comment) {
            const comment = this._context.comments[value.comment];
            return comment && comment.text.startsWith('@ruby:literal:false:');
        }
        return false;
    },

    isNil (value) {
        if (value === null) return true;
        if (this._isPrimitive(value)) {
            return value.type === 'nil';
        }
        return value && value.constructor.name === 'NilNode';
    },

    _isArray (value) {
        if (_.isArray(value)) return true;
        if (this._isPrimitive(value)) {
            return value.type === 'array';
        }
        return value && value.constructor.name === 'ArrayNode';
    },

    _isHash (value) {
        if (this._isPrimitive(value)) {
            return value.type === 'hash';
        }
        return value && value.constructor.name === 'HashNode';
    },

    _isConst (value) {
        if (this._isPrimitive(value)) {
            return value.type === 'const';
        }
        return value &&
            (value.constructor.name === 'ConstantReadNode' || value.constructor.name === 'ConstantPathNode');
    },

    isBlock (block) {
        try {
            return Object.prototype.hasOwnProperty.call(block, 'opcode');
        } catch (e) {
            return false;
        }
    },

    _isBlock (block) {
        return this.isBlock(block);
    },

    _isStatementBlock (block) {
        const blockType = this._getBlockType(block);
        return blockType === 'statement' || blockType === 'terminate';
    },

    _isValueBlock (block) {
        if (!this._isBlock(block)) {
            return false;
        }
        return /^value/.test(this._getBlockType(block));
    },

    isNumberOrBlock (numberOrBlock) {
        return this._isNumberOrBlock(numberOrBlock);
    },

    _isNumberOrBlock (numberOrBlock) {
        return this._isNumber(numberOrBlock) || this._isValueBlock(numberOrBlock);
    },

    isStringOrBlock (stringOrBlock) {
        return this._isStringOrBlock(stringOrBlock);
    },

    _isStringOrBlock (stringOrBlock) {
        return this._isString(stringOrBlock) || this._isValueBlock(stringOrBlock);
    },

    _isNumberOrStringOrBlock (block) {
        return this._isNumber(block) || this._isString(block) || this._isValueBlock(block);
    },

    isColorOrBlock (colorOrBlock) {
        return this._isColorOrBlock(colorOrBlock);
    },

    _isColorOrBlock (colorOrBlock) {
        const ColorRegexp = /^#[0-9a-fA-F]{6}$/;
        return this._isBlock(colorOrBlock) || (this._isString(colorOrBlock) && ColorRegexp.test(colorOrBlock));
    },

    _isFalseOrBooleanBlock (block) {
        if (this._isFalse(block)) {
            return true;
        }
        if (!this._isBlock(block)) {
            return false;
        }
        if (this._getBlockType(block) === 'value_boolean') {
            return true;
        }
        if (block.opcode === 'argument_reporter_string_number') {
            const varName = block.fields.VALUE.value;
            if (this._changeToBooleanArgument(varName)) {
                block.opcode = 'argument_reporter_boolean';
                this._setBlockType(block, 'value_boolean');
                return true;
            }
        }
        return false;
    },

    isVariableBlockType (block) {
        return /_variable$/.test(this._getBlockType(block));
    },

    isVariableBlock (block) {
        return this.isVariableBlockType(block) && block.opcode === 'data_variable';
    },

    isListBlock (block) {
        return this.getBlockType(block) === 'value_variable' && block.opcode === 'data_listcontents';
    },

    isRubyExpression (block) {
        return this._isRubyExpression(block);
    },

    _isRubyExpression (block) {
        return this._isBlock(block) && block.opcode === 'ruby_expression';
    },

    getRubyExpression (block) {
        return this._getRubyExpression(block);
    },

    _getRubyExpression (block) {
        if (this._isRubyExpression(block)) {
            const textBlock = this._context.blocks[block.inputs.EXPRESSION.block];
            return textBlock.fields.TEXT.value;
        }
        return null;
    },

    _isRubyStatement (block) {
        return this._isBlock(block) && block.opcode === 'ruby_statement';
    },

    _isRubyBlock (block) {
        return this._isBlock(block) && block.opcode.match(/^ruby_/);
    },

    _getRubyStatement (block) {
        if (this._isRubyStatement(block)) {
            const textBlock = this._context.blocks[block.inputs.STATEMENT.block];
            return textBlock.fields.TEXT.value;
        }
        return null;
    },

    _matchRubyExpression (block, regexp) {
        if (!this._isBlock(block) || block.opcode !== 'ruby_expression') {
            return false;
        }
        const textBlock = this._context.blocks[block.inputs.EXPRESSION.block];
        return regexp.test(textBlock.fields.TEXT.value);
    },

    _equalRubyExpression (block, expression) {
        if (!this._isBlock(block) || block.opcode !== 'ruby_expression') {
            return false;
        }
        const textBlock = this._context.blocks[block.inputs.EXPRESSION.block];
        return expression.toString() === textBlock.fields.TEXT.value;
    },

    _getSource (node) {
        if (!node || !node.location) {
            return '';
        }
        const {startOffset, length} = node.location;
        return this._context.sourceCode.slice(startOffset, startOffset + length);
    },

    _getLoc (node) {
        if (!node || !node.location) {
            return {line: 1, column: 0};
        }
        // Prism's location in JS binding has startLine/startColumn
        return {
            line: node.location.startLine || 1,
            column: node.location.startColumn || 0
        };
    },

    _toErrorAnnotation (row, column, message, source) {
        if (typeof row === 'undefined' || row === null) {
            row = 0;
        } else {
            row -= 1;
        }
        if (typeof column === 'undefined' || column === null) {
            column = 0;
        }
        return {
            row: row,
            column: column,
            type: 'error',
            text: message,
            source: source
        };
    }
};

export default NodeUtils;
