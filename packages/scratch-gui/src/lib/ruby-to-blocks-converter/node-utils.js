import _ from 'lodash';
import {RubyToBlocksConverterError} from './errors';

const Opal = global.Opal || window.Opal;

/**
 * Node and block judgment utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const NodeUtils = {
    _checkNumChildren (node, length) {
        if (_.isArray(length)) {
            if (length.indexOf(node.children.length) < 0) {
                // eslint-disable-next-line no-console
                console.error(`'${node.type}' node.children.length !== ${length.join(' or ')}: `, node.children);
            }
        } else if (node.children.length !== length) {
            // eslint-disable-next-line no-console
            console.error(`'${node.type}' node.children.length !== ${length}: `, node.children);
        }
    },

    _isSelf (block) {
        const Primitive = require('./primitive').default;
        return block instanceof Primitive && block.type === 'self';
    },

    _isStage () {
        return this._context.target && this._context.target.isStage;
    },

    isString (value) {
        return this._isString(value);
    },

    _isString (value) {
        return _.isString(value) || (value && value.type === 'str');
    },

    isNumber (value) {
        return this._isNumber(value);
    },

    _isNumber (value) {
        return _.isNumber(value) || (value && (value.type === 'int' || value.type === 'float'));
    },

    isTrue (value) {
        return this._isTrue(value);
    },

    _isTrue (value) {
        if (value === true || (value && value.type === 'true')) {
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
        if (value === false || (value && value.type === 'false')) {
            return true;
        }
        if (this._isBlock(value) && value.opcode === 'operator_lt' && value.comment) {
            const comment = this._context.comments[value.comment];
            return comment && comment.text.startsWith('@ruby:literal:false:');
        }
        return false;
    },

    isNil (value) {
        return value === Opal.nil || (value && value.type === 'nil');
    },

    _isArray (value) {
        return _.isArray(value) || (value && value.type === 'array');
    },

    _isHash (value) {
        return value && value.type === 'hash';
    },

    _isConst (value) {
        return value && value.type === 'const';
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
        const expression = node.$loc().$expression();
        if (expression === Opal.nil) {
            return '';
        }
        return expression.$source().toString();
    },

    _toErrorAnnotation (row, column, message, source) {
        if (row === Opal.nil) {
            row = 0;
        } else {
            row -= 1;
        }
        if (column === Opal.nil) {
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
