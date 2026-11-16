// === Smalruby: This file is Smalruby-specific (the finish stage of the Ruby-to-blocks converter) ===
import _ from 'lodash';
import { messages, getExtensionIdForOpcode } from './converter-errors';
import { RubyToBlocksConverterError } from './errors';
import Primitive from './primitive';

/**
 * The finish stage (docs/ruby-editor/converter-stages.md): what is decided or checked only after
 * the whole code is converted. It runs after the conversion of the root and before the blocks are
 * written into the target (`target-applier.js`). An error thrown here is reported by
 * `targetCodeToBlocks` in the same way as an error of the conversion.
 */
const Finish = {
    /**
     * Finish the blocks of the root.
     * @param {Array} blocks - The blocks (and primitives) of the statements of the root.
     * @param {object} parseResult - The result of prism (its comments are put on the blocks).
     * @param {string} code - The Ruby code.
     */
    _finish(blocks, parseResult, code) {
        const topBlocks = this._convertBareLiterals(blocks);
        this._markTopLevelBlocks(topBlocks);
        this._rejectRubyBlocksAndCollectExtensions();

        this._dropUnusedHashVariables();
        this._rejectVariableAndListOfSameName();

        // Create $_symbols_ list if symbols were collected
        this._createSymbolsList();

        // Associate source comments with blocks
        this._associateSourceComments(parseResult, code);
    },

    // === Smalruby: Start of bare literal to temp variable ===
    /**
     * Convert bare Primitive literals to temp variable assignments so they become valid blocks
     * (e.g. "Jimmy" → _lit_1_ = "Jimmy"). A symbol stays, and is rejected by `_markTopLevelBlocks`.
     * @param {Array} blocks - The blocks (and primitives) of the statements of the root.
     * @returns {Array} The blocks with the literals made into assignments.
     */
    _convertBareLiterals(blocks) {
        const newBlocks = [];
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (block instanceof Primitive && block.type !== 'sym') {
                const converted = this._convertBareLiteralToAssignment(block);
                const arr = _.isArray(converted) ? converted : [converted];
                // Link converted blocks into a chain
                for (let j = 0; j < arr.length - 1; j++) {
                    arr[j].next = arr[j + 1].id;
                    arr[j + 1].parent = arr[j].id;
                }
                // Link last converted block to the previous block's chain
                if (newBlocks.length > 0) {
                    const prev = newBlocks[newBlocks.length - 1];
                    if (this._isBlock(prev) && !prev.next) {
                        prev.next = arr[0].id;
                        arr[0].parent = prev.id;
                    }
                }
                newBlocks.push(...arr);
            } else {
                newBlocks.push(block);
            }
        }
        return newBlocks;
    },
    // === Smalruby: End of bare literal to temp variable ===

    /**
     * Convert a bare Primitive literal to a temp variable assignment block.
     * e.g. "Jimmy" → _lit_1_ = "Jimmy" with `@ruby`:literal:string comment
     * @param {object} primitive - The Primitive instance.
     * @returns {object|Array} The assignment block(s).
     */
    _convertBareLiteralToAssignment(primitive) {
        const items = primitive.type === 'array' ? primitive.value : null;
        // An item that is not a number, a string or a value (`[(@a = 1)]`, `[:a]`) used to be put in
        // the list as its text ("[object Object]", "a"): the error of a wrong instruction instead (#1865).
        // Check before the list is made and the number of `_lit_` goes on.
        if (items && !items.every((item) => this._isNumberOrStringOrBlock(item))) {
            throw new RubyToBlocksConverterError(
                primitive.node,
                this._translator(messages.wrongInstruction, {
                    SOURCE: this._truncateSource(this._getSource(primitive.node)),
                }),
            );
        }
        const index = (this._context.literalCallIndices._lit_ || 0) + 1;
        this._context.literalCallIndices._lit_ = index;
        const varName = `_lit_${index}_`;

        if (primitive.type === 'array') {
            // Array literal: create list variable + add items
            const prefixedName = varName;
            const listVar = this._lookupOrCreateList(prefixedName);
            const clearBlock = this._createBlock('data_deletealloflist', 'statement');
            clearBlock.node = primitive.node;
            clearBlock.fields = {
                LIST: { name: 'LIST', id: listVar.id, value: listVar.name, variableType: listVar.type },
            };
            clearBlock.comment = this._createComment(`@ruby:literal:array`, clearBlock.id);

            const addBlocks = [];
            items.forEach((item) => {
                const addBlock = this._createBlock('data_addtolist', 'statement');
                addBlock.node = primitive.node;
                addBlock.fields = {
                    LIST: { name: 'LIST', id: listVar.id, value: listVar.name, variableType: listVar.type },
                };
                if (this._isValueBlock(item)) {
                    this._addTextInput(addBlock, 'ITEM', item, '');
                } else {
                    const val = this._isPrimitive(item) ? item.value : item;
                    this._addTextInput(addBlock, 'ITEM', String(val), '');
                }
                addBlocks.push(addBlock);
            });

            return [clearBlock, ...addBlocks];
        }

        // String, integer, float: create scalar variable assignment
        let commentType;
        if (primitive.type === 'str') {
            commentType = 'string';
        } else if (primitive.type === 'int') {
            commentType = 'integer';
        } else if (primitive.type === 'float') {
            commentType = 'float';
        } else {
            commentType = primitive.type;
        }

        const variable = this._lookupOrCreateVariable(varName);
        const block = this._createBlock('data_setvariableto', 'statement');
        block.node = primitive.node;
        block.fields = {
            VARIABLE: { name: 'VARIABLE', id: variable.id, value: variable.name, variableType: variable.type },
        };
        this._addTextInput(block, 'VALUE', String(primitive.value), '0');
        block.comment = this._createComment(`@ruby:literal:${commentType}`, block.id);

        return block;
    },

    /**
     * Mark the blocks of the root without a parent as the top of a script. A primitive that is
     * left (a symbol, or a value that cannot be a block) is an error.
     * @param {Array} blocks - The blocks of the statements of the root.
     */
    _markTopLevelBlocks(blocks) {
        blocks.forEach((block) => {
            if (this._isBlock(block)) {
                if (!block.parent) {
                    block.topLevel = true;
                }
            } else if (block instanceof Primitive) {
                if (block.type === 'sym') {
                    const source = this._truncateSource(this._getSource(block.node));
                    const suggestion = `${source}.to_s`;
                    throw new RubyToBlocksConverterError(
                        block.node,
                        this._translator(messages.symbolNeedsToS, { SOURCE: source, SUGGESTION: suggestion }),
                    );
                }
                throw new RubyToBlocksConverterError(
                    block.node,
                    this._translator(messages.couldNotConvertPrimitive, {
                        SOURCE: this._truncateSource(this._getSource(block.node)),
                    }),
                );
            } else {
                throw new Error(`invalid block: ${block}`);
            }
        });
    },

    /**
     * Reject the ruby blocks (ruby_statement, ruby_expression, ruby_range, etc.) and collect the
     * IDs of the extensions of the blocks, in the order of the blocks.
     */
    _rejectRubyBlocksAndCollectExtensions() {
        Object.keys(this._context.blocks).forEach((blockId) => {
            const block = this._context.blocks[blockId];

            // Reject ruby blocks UNLESS they have @ruby:return comment (legitimate fallback for procedures)
            if (this._isRubyBlock(block)) {
                const hasReturnComment =
                    block.comment &&
                    this._context.comments[block.comment] &&
                    this._context.comments[block.comment].text.startsWith('@ruby:return');
                if (!hasReturnComment) {
                    // Quote the statement on one line that holds the expression, also when the
                    // expression is inside another; the marker stays on the expression (issue #1704)
                    const sourceNode = this._sourceNodeForError(block.node);
                    throw new RubyToBlocksConverterError(
                        block.node,
                        this._translator(messages.wrongInstruction, {
                            SOURCE: this._truncateSource(this._getSource(sourceNode)),
                        }),
                    );
                }
            }

            const extensionID = getExtensionIdForOpcode(block.opcode);
            if (extensionID) {
                this._context.extensionIDs.add(extensionID);
            }
        });
    },
};

export default Finish;
