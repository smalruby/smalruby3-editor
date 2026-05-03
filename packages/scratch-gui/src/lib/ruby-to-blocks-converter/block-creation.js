// === Smalruby: This file is Smalruby-specific (block creation methods for RubyToBlocksConverter) ===
import * as Blockly from 'scratch-blocks';
import _ from 'lodash';

/**
 * Block creation utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const BlockCreation = {
    createComment (text, blockId, x = 0, y = 0, minimized = true) {
        return this._createComment(text, blockId, x, y, minimized);
    },

    _createComment (text, blockId, x = 0, y = 0, minimized = true) {
        const id = Blockly.utils.idGenerator.genUid();
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
            id: Blockly.utils.idGenerator.genUid(),
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

        // Map current node to block ID for line execution feature
        if (!block.shadow && this._context.currentNode) {
            this._context.nodeToBlockMap.set(this._context.currentNode, block.id);
        }

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
            let numStr;
            if (this._isPrimitive(value) && value.type === 'float' && Number.isInteger(value.value)) {
                numStr = value.value.toFixed(1);
            } else {
                numStr = value.toString();
            }
            return this._createFieldBlock(opcode, 'NUM', numStr);
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

    createRubyStatementBlock (statement, node) {
        return this._createRubyStatementBlock(statement, node);
    },

    _createRubyStatementBlock (statement, node) {
        const block = this._createBlock('ruby_statement', 'statement');
        block.node = node;
        this._addInput(block, 'STATEMENT', this._createTextBlock(statement));
        return block;
    },

    changeBlock (block, opcode, blockType) {
        return this._changeBlock(block, opcode, blockType);
    },

    _changeBlock (block, opcode, blockType) {
        block.opcode = opcode;
        this._setBlockType(block, blockType);
        return block;
    },

    _cloneBlock (block) {
        if (!this._isBlock(block)) {
            return block;
        }

        const newBlock = Object.assign({}, block, {
            id: Blockly.utils.idGenerator.genUid(),
            parent: null,
            next: null,
            inputs: {},
            fields: _.cloneDeep(block.fields)
        });
        this._context.blocks[newBlock.id] = newBlock;
        this._context.blockTypes[newBlock.id] = this._context.blockTypes[block.id];

        for (const inputName in block.inputs) {
            const input = block.inputs[inputName];
            const childBlock = this._context.blocks[input.block];
            const shadowBlock = input.shadow ? this._context.blocks[input.shadow] : null;

            const newChildBlock = this._cloneBlock(childBlock);
            let newShadowBlock = null;
            if (shadowBlock) {
                if (shadowBlock === childBlock) {
                    newShadowBlock = newChildBlock;
                } else {
                    newShadowBlock = this._cloneBlock(shadowBlock);
                }
            }
            this._addInput(newBlock, inputName, newChildBlock, newShadowBlock);
        }

        if (block.next) {
            const nextBlock = this._context.blocks[block.next];
            const newNextBlock = this._cloneBlock(nextBlock);
            newBlock.next = newNextBlock.id;
            newNextBlock.parent = newBlock.id;
        }

        return newBlock;
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

export default BlockCreation;
