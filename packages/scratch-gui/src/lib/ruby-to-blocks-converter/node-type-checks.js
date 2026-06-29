// === Smalruby: This file is Smalruby-specific (type-checking methods for RubyToBlocksConverter) ===
import _ from 'lodash';

import {normalizeColorString} from './color-utils';

/**
 * Type-checking utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const NodeTypeChecks = {
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
            return value.type === 'str' || value.type === 'string';
        }
        return value &&
            (value.constructor.name === 'StringNode' ||
                value.constructor.name === 'InterpolatedStringNode');
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

    // === Smalruby: Start of regex type support ===
    _isRegexp (value) {
        if (this._isPrimitive(value)) {
            return value.type === 'regexp';
        }
        return value && value.constructor.name === 'RegularExpressionNode';
    },

    _isRegexpOrBlock (regexpOrBlock) {
        return this._isRegexp(regexpOrBlock) || this._isValueBlock(regexpOrBlock);
    },
    // === Smalruby: End of regex type support ===

    _isConst (value) {
        if (this._isPrimitive(value)) {
            return value.type === 'const';
        }
        return value &&
            (value.constructor.name === 'ConstantReadNode' || value.constructor.name === 'ConstantPathNode');
    },

    _isSymbol (value) {
        if (this._isPrimitive(value)) {
            return value.type === 'sym';
        }
        if (this._isBlock(value) && value.comment) {
            const comment = this._context.comments[value.comment];
            return comment && comment.text.startsWith('@ruby:symbol:');
        }
        return value && value.constructor.name === 'SymbolNode';
    },

    /**
     * Get the string value of a symbol node.
     * Works for Prism SymbolNode instances ({unescaped: {value: '...'}}),
     * Primitive('sym', value), and blocks with `@ruby`:symbol: comments.
     * @param {object} node - A symbol node.
     * @returns {string|null} The symbol value, or null if not a symbol.
     */
    _getSymbolValue (node) {
        if (!node) return null;
        if (this._isPrimitive(node) && node.type === 'sym') {
            return node.value;
        }
        if (this._isBlock(node) && node.comment) {
            const comment = this._context.comments[node.comment];
            if (comment && comment.text.startsWith('@ruby:symbol:')) {
                return comment.text.slice('@ruby:symbol:'.length);
            }
        }
        if (node.constructor && node.constructor.name === 'SymbolNode') {
            return node.unescaped ? node.unescaped.value : null;
        }
        return null;
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
        return this._isBlock(colorOrBlock) ||
            (this._isString(colorOrBlock) && normalizeColorString(colorOrBlock) !== null);
    },

    // Normalize a color string (named color, #rgb, rgb(), #rrggbb) into the `#rrggbb`
    // form the `colour_picker` field expects. Returns the input unchanged if it is not a
    // recognized color string (callers only pass strings that `_isColorOrBlock` accepted).
    normalizeColor (colorString) {
        return normalizeColorString(colorString);
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

    _isRubyStatement (block) {
        return this._isBlock(block) && block.opcode === 'ruby_statement';
    },

    _isRubyBlock (block) {
        return this._isBlock(block) && block.opcode.match(/^ruby_/);
    }
};

export default NodeTypeChecks;
