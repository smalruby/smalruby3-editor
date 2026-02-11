import Blockly from 'scratch-blocks';
import _ from 'lodash';

const Opal = global.Opal || window.Opal;

/**
 * Block operation utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const BlockUtils = {
    setParent (block, parent) {
        return this._setParent(block, parent);
    },

    _setParent (block, parent) {
        if (this._isBlock(block)) {
            block.parent = parent.id;
            parent.next = block.id;
        }
    },

    createComment (text, blockId, x = 0, y = 0, minimized = true) {
        return this._createComment(text, blockId, x, y, minimized);
    },

    _createComment (text, blockId, x = 0, y = 0, minimized = true) {
        const id = Blockly.utils.genUid();
        this._context.comments[id] = {
            id: id,
            text: text,
            blockId: blockId,
            x: x,
            y: y,
            width: 200,
            height: 200,
            minimized: minimized
        };
        return id;
    },

    createBlock (opcode, type, attributes = {}) {
        return this._createBlock(opcode, type, attributes);
    },

    _createBlock (opcode, type, attributes = {}) {
        const block = Object.assign({
            id: Blockly.utils.genUid(),
            opcode: opcode,
            inputs: {},
            fields: {},
            next: null,
            topLevel: false,
            parent: null,
            shadow: false,
            x: void 0,
            y: void 0
        }, attributes);
        if (attributes.comment) {
            block.comment = this._createComment(attributes.comment, block.id);
        }
        this._context.blocks[block.id] = block;
        this._context.blockTypes[block.id] = type;
        return block;
    },

    createFieldBlock (opcode, fieldName, value) {
        return this._createFieldBlock(opcode, fieldName, value);
    },

    _createFieldBlock (opcode, fieldName, value) {
        if (this._isBlock(value)) {
            return value;
        }
        return this._createBlock(opcode, 'value', {
            fields: {
                [fieldName]: {
                    name: fieldName,
                    id: void 0,
                    value: value.toString()
                }
            },
            shadow: true
        });
    },

    createTextBlock (value) {
        return this._createTextBlock(value);
    },

    _createTextBlock (value) {
        if (this._isString(value)) {
            return this._createFieldBlock('text', 'TEXT', value.toString());
        }
        return value;
    },

    _createNumberBlock (opcode, value) {
        if (this._isNumber(value) || value === '') {
            return this._createFieldBlock(opcode, 'NUM', value.toString());
        }
        return value;
    },

    createRubyExpressionBlock (expression, node) {
        return this._createRubyExpressionBlock(expression, node);
    },

    _createRubyExpressionBlock (expression, node) {
        const block = this._createBlock('ruby_expression', 'value_boolean');
        block.node = node;
        this._addInput(block, 'EXPRESSION', this._createTextBlock(expression));
        return block;
    },

    _createRubyStatementBlock (statement, node) {
        const block = this._createBlock('ruby_statement', 'statement');
        block.node = node;
        this._addInput(block, 'STATEMENT', this._createTextBlock(statement));
        return block;
    },

    addField (block, name, value, attributes = {}) {
        return this._addField(block, name, value, attributes);
    },

    _addField (block, name, value, attributes = {}) {
        if (!this._isBlock(block)) {
            return;
        }
        block.fields[name] = Object.assign({
            name: name,
            value: value.toString()
        }, attributes);
    },

    addInput (block, name, inputBlock, shadowBlock) {
        return this._addInput(block, name, inputBlock, shadowBlock);
    },

    _addInput (block, name, inputBlock, shadowBlock) {
        if (!name) {
            name = inputBlock.id;
        }
        inputBlock.parent = block.id;
        let shadowBlockId;
        if (shadowBlock) {
            shadowBlockId = shadowBlock.id;
            shadowBlock.parent = block.id;
        } else {
            shadowBlockId = null;
        }
        block.inputs[name] = {
            name: name,
            block: inputBlock.id,
            shadow: inputBlock.shadow ? inputBlock.id : shadowBlockId
        };
    },

    addNumberInput (block, name, opcode, inputValue, shadowValue) {
        return this._addNumberInput(block, name, opcode, inputValue, shadowValue);
    },

    _addNumberInput (block, name, opcode, inputValue, shadowValue) {
        let shadowBlock;
        if (!this._isNumber(inputValue)) {
            shadowBlock = this._createNumberBlock(opcode, shadowValue);
        }
        this._addInput(block, name, this._createNumberBlock(opcode, inputValue), shadowBlock);
    },

    addNoteInput (block, name, inputValue, shadowValue) {
        return this._addNoteInput(block, name, inputValue, shadowValue);
    },

    _addNoteInput (block, name, inputValue, shadowValue) {
        let shadowBlock;
        const opcode = 'note';
        if (!this._isNumber(inputValue)) {
            shadowBlock = this._createNoteBlock(opcode, shadowValue);
        }
        this._addInput(block, name, this._createNoteBlock(opcode, inputValue), shadowBlock);
    },

    _createNoteBlock (opcode, value) {
        if (this._isNumber(value) || value === '') {
            return this._createFieldBlock(opcode, 'NOTE', value.toString());
        }
        return value;
    },

    addTextInput (block, name, inputValue, shadowValue) {
        return this._addTextInput(block, name, inputValue, shadowValue);
    },

    _addTextInput (block, name, inputValue, shadowValue) {
        let shadowBlock;
        if (!this._isString(inputValue)) {
            shadowBlock = this._createTextBlock(shadowValue);
        }
        this._addInput(block, name, this._createTextBlock(inputValue), shadowBlock);
    },

    addFieldInput (block, name, opcode, fieldName, inputValue, shadowValue) {
        return this._addFieldInput(block, name, opcode, fieldName, inputValue, shadowValue);
    },

    _addFieldInput (block, name, opcode, fieldName, inputValue, shadowValue) {
        let shadowBlock;
        if (!this._isString(inputValue)) {
            shadowBlock = this._createFieldBlock(opcode, fieldName, shadowValue);
        }
        this._addInput(block, name, this._createFieldBlock(opcode, fieldName, inputValue), shadowBlock);
    },

    _addSubstack (block, substackBlock, num = 1) {
        let name = 'SUBSTACK';
        if (num > 1) {
            name = `${name}${num}`;
        }
        let substackBlockId = null;
        if (this._isBlock(substackBlock)) {
            substackBlock.parent = block.id;
            substackBlockId = substackBlock.id;
        }
        block.inputs[name] = {
            name: name,
            block: substackBlockId,
            shadow: null
        };
    },

    _lastBlock (block) {
        let b = block;
        while (b.next) {
            b = this._context.blocks[b.next];
        }
        return b;
    },

    removeBlock (block) {
        if (this.isNil(block)) {
            return;
        }

        const previousBlockId = block.parent;
        if (previousBlockId) {
            const previousBlock = this._context.blocks[previousBlockId];
            previousBlock.next = block.next;
        }

        delete this._context.blocks[block.id];
    },

    _removeWaitBlocks (block) {
        if (!block || block === Opal.nil) {
            return null;
        }

        let firstBlock = null;
        let b = block;
        let prev = b.parent;
        while (b) {
            let isWaitBlock = false;
            if (b.opcode === 'ruby_statement') {
                const textBlock = this._context.blocks[b.inputs.STATEMENT.block];
                if (textBlock.fields.TEXT.value === 'wait') {
                    isWaitBlock = true;
                }
            }
            if (isWaitBlock) {
                delete this._context.blocks[b.id];
                if (prev) {
                    this._context.blocks[prev].next = null;
                }
            } else {
                if (firstBlock === null) {
                    firstBlock = b;
                }
                b.parent = prev;
                if (prev) {
                    this._context.blocks[prev].next = b.id;
                }
                prev = b.id;
            }
            b = this._context.blocks[b.next];
        }
        return firstBlock;
    },

    changeBlock (block, opcode, blockType) {
        return this._changeBlock(block, opcode, blockType);
    },

    _changeBlock (block, opcode, blockType) {
        block.opcode = opcode;
        this._setBlockType(block, blockType);
        return block;
    },

    changeRubyExpression (block, node, source = null) {
        block.node = node;
        const expressionBlock = this._context.blocks[block.inputs.EXPRESSION.block];
        expressionBlock.fields.TEXT.value = source || this._getSource(node);
        return block;
    },

    changeRubyExpressionBlock (block, opcode, blockType) {
        return this._changeRubyExpressionBlock(block, opcode, blockType);
    },

    _changeRubyExpressionBlock (block, opcode, blockType) {
        this._changeBlock(block, opcode, blockType);

        delete this._context.blocks[block.inputs.EXPRESSION.block];
        delete block.inputs.EXPRESSION;

        return block;
    }
};

export default BlockUtils;
