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
        return value && value.constructor.name === 'SymbolNode';
    },

    /**
     * Get the string value of a symbol node.
     * Works for Prism SymbolNode instances ({unescaped: {value: '...'}}).
     * @param {object} node - A symbol node.
     * @returns {string|null} The symbol value, or null if not a symbol.
     */
    _getSymbolValue (node) {
        if (!node) return null;
        if (this._isPrimitive(node) && node.type === 'sym') {
            return node.value;
        }
        if (node.constructor.name === 'SymbolNode') {
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

    /**
     * Infer the data type of a value (literal or block).
     * Returns null if the type cannot be determined statically.
     * @param {*} value - A literal value or block object
     * @returns {'string'|'number'|'boolean'|null}
     */
    _inferDataType (value) {
        if (this._isString(value)) return 'string';
        if (this._isNumber(value)) return 'number';
        if (this._isTrue(value) || this._isFalse(value)) return 'boolean';
        if (this._isBlock(value)) return this._getBlockDataType(value);
        return null;
    },

    /**
     * Determine the data type ('string', 'number', 'boolean') of a block's return value.
     * Returns null if the type cannot be determined statically.
     * @param {object} block - The block object
     * @returns {'string'|'number'|'boolean'|null}
     */
    _getBlockDataType (block) {
        if (!this._isBlock(block)) return null;

        const comment = block.comment ? this._context.comments[block.comment] : null;
        const commentText = comment ? comment.text : '';

        if (commentText === '@ruby:method:to_s') return 'string';
        if (commentText === '@ruby:method:to_i') return 'number';

        const STRING_OPCODES = [
            'operator_join',
            'operator_letter_of'
        ];
        const NUMBER_OPCODES = [
            'operator_add',
            'operator_subtract',
            'operator_multiply',
            'operator_divide',
            'operator_mod',
            'operator_round',
            'operator_mathop',
            'operator_random',
            'operator_length'
        ];
        const BOOLEAN_OPCODES = [
            'operator_and',
            'operator_or',
            'operator_not',
            'operator_equals',
            'operator_gt',
            'operator_lt',
            'operator_contains'
        ];

        if (STRING_OPCODES.includes(block.opcode)) return 'string';
        if (NUMBER_OPCODES.includes(block.opcode)) return 'number';
        if (BOOLEAN_OPCODES.includes(block.opcode)) return 'boolean';

        return null;
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

    _truncateSource (src, maxLength = 40) {
        if (!src) return src;
        const newlineIndex = src.indexOf('\n');
        if (newlineIndex >= 0) {
            src = `${src.slice(0, newlineIndex)}...`;
        }
        if (src.length > maxLength) {
            src = `${src.slice(0, maxLength)}...`;
        }
        return src;
    },

    _getLineForOffset (byteOffset) {
        if (typeof byteOffset !== 'number' || !this._context.sourceCode) {
            return 1;
        }
        // Prism uses UTF-8 byte offsets. Walk the JS string counting UTF-8 bytes
        // so we handle multibyte characters (e.g. Japanese) correctly.
        const source = this._context.sourceCode;
        let line = 1;
        let bytesConsumed = 0;
        for (let i = 0; i < source.length && bytesConsumed < byteOffset; i++) {
            const cp = source.codePointAt(i);
            let byteLen;
            if (cp < 0x80) {
                byteLen = 1;
            } else if (cp < 0x800) {
                byteLen = 2;
            } else if (cp < 0x10000) {
                byteLen = 3;
            } else {
                byteLen = 4;
                i++; // surrogate pair: skip extra char in JS
            }
            bytesConsumed += byteLen;
            if (bytesConsumed <= byteOffset && source[i] === '\n') {
                line++;
            }
        }
        return line;
    },

    _getNodeStartLine (node) {
        if (!node || !node.location) return null;
        if (typeof node.location.startLine !== 'undefined') {
            return node.location.startLine || null;
        }
        if (typeof node.location.startOffset === 'number') {
            return this._getLineForOffset(node.location.startOffset);
        }
        return null;
    },

    _getNodeEndLine (node) {
        if (!node || !node.location) return null;
        if (typeof node.location.endLine !== 'undefined') {
            return node.location.endLine || null;
        }
        if (typeof node.location.startOffset === 'number' && typeof node.location.length === 'number') {
            return this._getLineForOffset(node.location.startOffset + node.location.length);
        }
        return null;
    },

    _getLoc (node) {
        if (!node || !node.location) {
            return {line: 1, column: 0};
        }
        // Prism's JS binding location has startOffset/length (byte offsets), not startLine/startColumn.
        // Compute line/column from startOffset and the stored source code.
        if (typeof node.location.startLine !== 'undefined') {
            return {
                line: node.location.startLine || 1,
                column: node.location.startColumn || 0
            };
        }
        const offset = node.location.startOffset;
        if (typeof offset !== 'number' || !this._context.sourceCode) {
            return {line: 1, column: 0};
        }
        const source = this._context.sourceCode;
        let line = 1;
        let column = 0;
        for (let i = 0; i < offset && i < source.length; i++) {
            if (source[i] === '\n') {
                line++;
                column = 0;
            } else {
                column++;
            }
        }
        return {line, column};
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
            source: this._truncateSource(source)
        };
    }
};

export default NodeUtils;
