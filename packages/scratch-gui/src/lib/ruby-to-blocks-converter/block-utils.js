import _ from 'lodash';
import BlockCreation from './block-creation';

/**
 * Block operation utilities for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const BlockUtils = {
    ...BlockCreation,

    setParent (block, parent) {
        return this._setParent(block, parent);
    },

    _setParent (block, parent) {
        if (this._isBlock(block)) {
            block.parent = parent.id;
            parent.next = block.id;
        }
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
        const previousNode = this._context.currentNode;
        this._context.currentNode = null;

        let shadowBlock;
        if (!this._isNumber(inputValue)) {
            shadowBlock = this._createNumberBlock(opcode, shadowValue);
        }
        this._addInput(block, name, this._createNumberBlock(opcode, inputValue), shadowBlock);

        this._context.currentNode = previousNode;
    },

    addNoteInput (block, name, inputValue, shadowValue) {
        return this._addNoteInput(block, name, inputValue, shadowValue);
    },

    _addNoteInput (block, name, inputValue, shadowValue) {
        const previousNode = this._context.currentNode;
        this._context.currentNode = null;

        let shadowBlock;
        const opcode = 'note';
        if (!this._isNumber(inputValue)) {
            shadowBlock = this._createNoteBlock(opcode, shadowValue);
        }
        this._addInput(block, name, this._createNoteBlock(opcode, inputValue), shadowBlock);

        this._context.currentNode = previousNode;
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
        const previousNode = this._context.currentNode;
        this._context.currentNode = null;

        let shadowBlock;
        if (!this._isString(inputValue)) {
            shadowBlock = this._createTextBlock(shadowValue);
        }
        this._addInput(block, name, this._createTextBlock(inputValue), shadowBlock);

        this._context.currentNode = previousNode;
    },

    addFieldInput (block, name, opcode, fieldName, inputValue, shadowValue) {
        return this._addFieldInput(block, name, opcode, fieldName, inputValue, shadowValue);
    },

    _addFieldInput (block, name, opcode, fieldName, inputValue, shadowValue) {
        const previousNode = this._context.currentNode;
        this._context.currentNode = null;

        let shadowBlock;
        if (!this._isString(inputValue)) {
            shadowBlock = this._createFieldBlock(opcode, fieldName, shadowValue);
        }
        this._addInput(block, name, this._createFieldBlock(opcode, fieldName, inputValue), shadowBlock);

        this._context.currentNode = previousNode;
    },

    addColorFieldInput (block, name, inputValue, shadowValue) {
        return this._addColorFieldInput(block, name, inputValue, shadowValue);
    },

    // Like _addFieldInput for a `colour_picker` field, but normalizes string color
    // values (named colors, #rgb, rgb()) into `#rrggbb` so AI-generated/hand-written
    // color code does not error. Non-string inputs (e.g. variable blocks) pass through.
    _addColorFieldInput (block, name, inputValue, shadowValue) {
        const normalized = this._isString(inputValue) ?
            (this.normalizeColor(inputValue) || inputValue) :
            inputValue;
        return this._addFieldInput(block, name, 'colour_picker', 'COLOUR', normalized, shadowValue);
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
        if (!block) {
            this._hadWaitInLastRemove = false;
            return null;
        }

        let firstBlock = null;
        let hadWait = false;
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
                hadWait = true;
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
        this._hadWaitInLastRemove = hadWait;
        return firstBlock;
    },

    _linkBlocks (blocks) {
        if (!_.isArray(blocks) || blocks.length < 2) {
            return blocks;
        }
        let prevBlock = null;
        const result = [];
        blocks.forEach(block => {
            if (!this._isBlock(block)) {
                prevBlock = null;
                return;
            }

            const blockType = this._getBlockType(block);
            if (blockType === 'statement') {
                if (prevBlock && !block.parent) {
                    prevBlock.next = block.id;
                    block.parent = prevBlock.id;
                } else if (!block.parent) {
                    result.push(block);
                }
                prevBlock = block;
            } else if (blockType === 'terminate') {
                if (prevBlock && !block.parent) {
                    prevBlock.next = block.id;
                    block.parent = prevBlock.id;
                } else if (!block.parent) {
                    result.push(block);
                }
                prevBlock = null;
            } else {
                result.push(block);
                prevBlock = null;
            }
        });
        return result;
    }
};

export default BlockUtils;
