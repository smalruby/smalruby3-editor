import _ from 'lodash';
import {RubyToBlocksConverterError} from '../errors';

const Opal = global.Opal || window.Opal;

/**
 * Core AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const CoreHandlers = {
    _process (node, isValue = true) {
        if (!node) {
            return null;
        }
        if (node === Opal.nil) {
            return Opal.nil;
        }
        node = node.$to_ast();
        this._context.currentNode = node;

        const savedIsValue = this._context.isValue;
        this._context.isValue = isValue;

        if (!isValue) {
            this._context.methodCallCounts = this._countMethodCalls(node);
            this._context.methodCallIndices = {};
        }

        const handlerName = '_' + _.camelCase(`on_${node.type}`); // eslint-disable-line prefer-template
        let result;
        if (_.isFunction(this[handlerName])) {
            result = this[handlerName](node);
        } else {
            throw new RubyToBlocksConverterError(node, `not supported node type: ${node.type}`);
        }

        this._context.isValue = savedIsValue;
        return result;
    },

    _processStatement (node, inMyBlockDefinition = null) {
        const savedInMyBlockDefinition = this._context.inMyBlockDefinition;
        if (inMyBlockDefinition !== null) {
            this._context.inMyBlockDefinition = inMyBlockDefinition;
        }
        let blocks = this._process(node, false);
        if (!_.isArray(blocks)) {
            blocks = [blocks];
        }
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
        if (block !== Opal.nil && !this._isStatementBlock(block)) {
            if (!(this._context.inMyBlockDefinition && block.opcode === 'data_setvariableto')) {
                this._context.inMyBlockDefinition = savedInMyBlockDefinition;
                throw new RubyToBlocksConverterError(node, 'include not statement blocks');
            }
        }
        this._context.inMyBlockDefinition = savedInMyBlockDefinition;
        return block;
    },

    _processCondition (node) {
        let cond = this._process(node, true);
        const split = this._splitPreBlocksAndValue(cond);
        if (split.preBlocks.length > 0) {
            if (!this._isFalseOrBooleanBlock(split.value)) {
                throw new RubyToBlocksConverterError(
                    node,
                    `condition is not boolean: ${this._getSource(node)}`
                );
            }
            return [...split.preBlocks, split.value];
        }
        cond = split.value;
        if (!this._isFalseOrBooleanBlock(cond)) {
            throw new RubyToBlocksConverterError(
                node,
                `condition is not boolean: ${this._getSource(node)}`
            );
        }
        return cond;
    },

    _onBegin (node) {
        const savedInMyBlockDefinition = this._context.inMyBlockDefinition;
        this._context.inMyBlockDefinition = false;
        const blocks = [];
        node.children.forEach(childNode => {
            const block = this._process(childNode, false);
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

    _onBlock (node) {
        this._checkNumChildren(node, 3);

        return this._onSend(node.children[0], node.children[1], node.children[2]);
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
