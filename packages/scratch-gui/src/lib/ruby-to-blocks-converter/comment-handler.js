// === Smalruby: This file is Smalruby-specific (comment extraction and association for Ruby-to-blocks converter) ===
import { rubyMarkersOf } from '../ruby-markers.js';

/** The marker of a comment whose user lines are all the trailing comment of the line of the block. */
const INLINE_MARKER = '@ruby:comment_position:inline';

/** The marker of a comment whose last user line is the trailing comment, and the others are before. */
const INLINE_LAST_MARKER = '@ruby:comment_position:inline:last';

/**
 * The marker of a trailing comment on the first line of a block with commands in it (`loop do # c`).
 * Without it the generator writes the trailing comment on the last line (`end # c`), as the comments
 * of the projects saved before it was added.
 */
const START_MARKER = '@ruby:comment_position:start';

/**
 * The markers of the blocks that the block before them writes in Ruby (see `_isWrittenByPreviousBlock`).
 * @type {Array<RegExp>}
 */
const WRITTEN_BY_PREVIOUS_MARKERS = [
    /^@ruby:array:literal:element$/,
    /^@ruby:hash:literal:values$/,
    /^@ruby:hash:literal:key:/,
    /^@ruby:hash:literal:value$/,
    /^@ruby:hash:set:push:/,
    /^@ruby:return:[^:]+:initialize$/,
];

/**
 * Mixin methods for handling source comments in the Ruby-to-blocks converter.
 * These methods are mixed into RubyToBlocksConverter.prototype via Object.assign.
 * @type {object}
 */
const CommentHandler = {
    /**
     * Extract comments from prism parse result and return structured data.
     * @param {object} parseResult - The prism parse result
     * @param {string} sourceCode - The original source code
     * @returns {Array<object>} Array of comment objects with type, text, line, isTrailing
     */
    _extractSourceComments(parseResult, sourceCode) {
        if (!parseResult.comments || parseResult.comments.length === 0) {
            return [];
        }

        // Ensure sourceCode and byteToChar map are available for _byteOffsetToCharOffset
        if (this._context.sourceCode !== sourceCode) {
            this._context.sourceCode = sourceCode;
            this._context.byteToChar = null; // force rebuild
        }

        // Build char-offset-to-line mapping
        const lineStarts = [0]; // line 1 starts at char offset 0
        for (let i = 0; i < sourceCode.length; i++) {
            if (sourceCode[i] === '\n') {
                lineStarts.push(i + 1);
            }
        }
        const offsetToLine = (offset) => {
            for (let i = lineStarts.length - 1; i >= 0; i--) {
                if (offset >= lineStarts[i]) {
                    return i + 1; // 1-based line numbers
                }
            }
            return 1;
        };

        return parseResult.comments.map((comment) => {
            const startByte = comment.location.startOffset;
            const lengthBytes = comment.location.length;
            // Convert byte offsets to char offsets using shared mapping
            const startCharOffset = this._byteOffsetToCharOffset(startByte);
            const endCharOffset = this._byteOffsetToCharOffset(startByte + lengthBytes);
            const rawText = sourceCode.substring(startCharOffset, endCharOffset);
            const line = offsetToLine(startCharOffset);
            const lineStart = lineStarts[line - 1];

            // Check if there's non-whitespace before this comment on the same line
            const textBeforeOnLine = sourceCode.substring(lineStart, startCharOffset);
            const isTrailing = textBeforeOnLine.trim().length > 0;

            let type;
            let text;
            if (comment.type === 1) {
                // EmbDocComment: =begin\n...\n=end\n
                type = 'embdoc';
                text = rawText.replace(/^=begin\n?/, '').replace(/\n?=end\n?$/, '');
            } else {
                // InlineComment: # ...
                type = 'inline';
                // Strip '# ' or '#' prefix
                text = rawText.replace(/^#/, '');
                if (text.startsWith(' ')) {
                    text = text.substring(1);
                }
            }

            return { type, text, line, startOffset: startCharOffset, endOffset: endCharOffset, isTrailing };
        });
    },

    /**
     * Associate extracted source comments with blocks or create workspace comments.
     * Called after all blocks have been created in targetCodeToBlocks.
     * @param {object} parseResult - The prism parse result
     * @param {string} sourceCode - The original source code
     */
    _associateSourceComments(parseResult, sourceCode) {
        const sourceComments = this._extractSourceComments(parseResult, sourceCode);
        if (sourceComments.length === 0) {
            return;
        }

        const { lineStartBlockMap, lineEndBlockMap } = this._commentLineBlockMaps(parseResult.value);
        const findBlockForLine = (line) => {
            const entry = lineStartBlockMap.get(line);
            return entry ? entry.blockId : null;
        };

        // Group consecutive non-trailing comments that share adjacent lines
        const groups = [];
        let currentGroup = null;
        for (const comment of sourceComments) {
            if (comment.isTrailing) {
                // Trailing comments are always individual
                groups.push({ comments: [comment], isTrailing: true });
                currentGroup = null;
            } else if (currentGroup && comment.line === currentGroup.endLine + 1) {
                // Consecutive comment on next line
                currentGroup.comments.push(comment);
                currentGroup.endLine = comment.line;
            } else {
                currentGroup = { comments: [comment], isTrailing: false, endLine: comment.line };
                groups.push(currentGroup);
            }
        }

        for (const group of groups) {
            const text = group.comments.map((c) => c.text).join('\n');

            if (group.isTrailing) {
                // Trailing (inline) comment: attach to block on the same line
                const comment = group.comments[0];
                // A comment on the last line of a node over more lines (`end # c`) goes to that node and
                // stays on the last line. One on the first line of a block with commands in it goes on
                // its first line (`loop do # c`).
                let blockId = lineEndBlockMap.get(comment.line) || null;
                let atStart = false;
                if (!blockId) {
                    const entry = lineStartBlockMap.get(comment.line);
                    blockId = entry ? entry.blockId : null;
                    atStart = !!entry && this._hasCommandInput(blockId);
                }
                if (!blockId) {
                    blockId = this._commentAnchorOf(this._findBlockIdForLine(comment.line));
                }
                if (blockId) {
                    this._mergeUserComment(blockId, text, true, atStart);
                } else {
                    this._createComment(text, null);
                }
            } else {
                // Preceding comment: attach to block on the next code line
                const nextCodeLine = group.endLine + 1;

                // Check if next line is a class/module start
                // In that case, create a target-level comment (describes the definition, not a block)
                // DefNode is excluded: comments before def are attached to the
                // procedures_definition block so they appear inside the class.
                const containerRange = this._context.containerNodeRanges.find(
                    (r) => r.startLine === nextCodeLine && (r.type === 'ClassNode' || r.type === 'ModuleNode'),
                );
                if (containerRange) {
                    // For modules, include @ruby:module:Name metadata so
                    // the generator can place the comment before the module code
                    if (containerRange.type === 'ModuleNode' && containerRange.moduleName) {
                        this._createComment(`${text}\n@ruby:module:${containerRange.moduleName}`, null);
                    } else {
                        this._createComment(text, null);
                    }
                } else {
                    const blockId = findBlockForLine(nextCodeLine);
                    if (blockId) {
                        this._mergeUserComment(blockId, text, false);
                    } else {
                        // No block found on next line - try scanning further down
                        // but stop at container node boundaries
                        let found = false;
                        for (let scanLine = nextCodeLine + 1; scanLine <= nextCodeLine + 5; scanLine++) {
                            const hitContainer = this._context.containerNodeRanges.some(
                                (r) =>
                                    r.startLine === scanLine &&
                                    (r.type === 'ClassNode' || r.type === 'ModuleNode' || r.type === 'DefNode'),
                            );
                            if (hitContainer) break;
                            const scanBlockId =
                                findBlockForLine(scanLine) ||
                                this._commentAnchorOf(this._findBlockIdForLine(scanLine));
                            if (scanBlockId) {
                                this._mergeUserComment(scanBlockId, text, false);
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            // Target-level (workspace) comment
                            this._createComment(text, null);
                        }
                    }
                }
            }
        }
    },

    /**
     * The blocks the comments of each line go to.
     *
     * By the line where a node starts (`lineStartBlockMap`): the comment goes to the block that writes
     * the line in Ruby. The block of the node that starts on the line is changed to its anchor
     * (`_commentAnchorOf`), so a comment does not go to a value in the line (`a += 1`, the subject of
     * `case`) or to a block that is not written (the blocks that add the elements of `[1, 2]`, the block
     * that stops the method for `return`). Among the nodes that start on the line, the smallest one wins,
     * so "# comment\nloop do" goes to the loop, not to a block around it. The blocks that have a node but
     * are not in the map of nodes (the assignment of a value-only line `"Jimmy"`) are looked at too. The
     * line of `case` goes to the outermost if of the `case` (each `when` visits the subject again, so the
     * node of the subject has the block of the last `when`), and the line of a `when` to the `==` block of
     * the `when`: the generator writes its comment on that line.
     *
     * By the line where a node over more lines ends (`lineEndBlockMap`): the smallest such node, for a
     * trailing comment on `end` (`end # c`, `end while x < 1 # c`).
     * @param {?object} rootNode - The ProgramNode of the parse result.
     * @returns {{lineStartBlockMap: Map, lineEndBlockMap: Map<number, string>}} The maps.
     */
    _commentLineBlockMaps(rootNode) {
        const map = new Map();
        const ends = new Map();
        const anchorOfNode = (node, type, blockId) => {
            if (type === 'DefNode') return this._definitionBlockOf(blockId);
            if (type === 'CaseNode') return this._caseBlockOf(blockId);
            return this._commentAnchorOf(blockId);
        };
        const nodeBlocks = new Map(this._context.nodeToBlockMap);
        for (const block of Object.values(this._context.blocks)) {
            if (block.node && block.node.location && !nodeBlocks.has(block.node)) {
                nodeBlocks.set(block.node, block.id);
            }
        }
        const caseNodes = [];
        for (const [node, blockId] of nodeBlocks.entries()) {
            const type = this._getNodeTypeName(node);
            // The block of a list of statements is only the first block of its first statement.
            if (type === 'ProgramNode' || type === 'StatementsNode') continue;
            const startLine = this._getNodeStartLine(node);
            if (startLine === null) continue;
            const anchorId = anchorOfNode(node, type, blockId);
            if (!anchorId) continue;
            const endLine = this._getNodeEndLine(node) || startLine;
            const range = endLine - startLine;
            if (type === 'CaseNode') caseNodes.push({ node, startLine, anchorId });
            const existing = map.get(startLine);
            if (!existing || range < existing.range) {
                map.set(startLine, { blockId: anchorId, range });
            }
            const existingEnd = ends.get(endLine);
            // The block of `else` is only the first command in it, and the block of `elsif` writes only
            // its line: `end # c` is the comment of the if.
            const endsAnother = type === 'ElseNode' || (type === 'IfNode' && this._isElsifNode(node));
            if (!endsAnother && range > 0 && (!existingEnd || range < existingEnd.range)) {
                ends.set(endLine, { blockId: anchorId, range });
            }
        }
        // A line that starts with a node that has no block (the `1` of `def foo\n  1\nend`, an element
        // of an array literal over more lines) goes to the block of the smallest node around it.
        const fill = (node, outerBlockId) => {
            const type = this._getNodeTypeName(node);
            const own = type === 'ProgramNode' || type === 'StatementsNode' ? null : nodeBlocks.get(node);
            const blockId = own || outerBlockId;
            const line = this._getNodeStartLine(node);
            if (!own && blockId && line !== null && !map.has(line)) {
                const anchorId = this._commentAnchorOf(blockId);
                if (anchorId) map.set(line, { blockId: anchorId, range: Infinity });
            }
            for (const child of this._childNodesOf(node).flat()) {
                if (child && child.location) fill(child, blockId);
            }
        };
        if (rootNode) fill(rootNode, null);
        for (const { node, startLine, anchorId } of caseNodes) {
            map.set(startLine, { blockId: anchorId, range: -1 });
            this._caseWhenConditions(node, anchorId).forEach(({ whenNode, condId }) => {
                const line = this._getNodeStartLine(whenNode);
                if (line !== null) map.set(line, { blockId: condId, range: -1 });
            });
        }
        const lineEndBlockMap = new Map();
        for (const [line, entry] of ends.entries()) lineEndBlockMap.set(line, entry.blockId);
        return { lineStartBlockMap: map, lineEndBlockMap };
    },

    /**
     * Whether an IfNode is the `elsif` of an `if`.
     * @param {object} node - The IfNode.
     * @returns {boolean} True for `elsif`.
     */
    _isElsifNode(node) {
        return /^elsif\b/.test(this._getSource(node));
    },

    /**
     * Whether a block has an input of commands (`SUBSTACK`, `SUBSTACK2`): the generator writes it in
     * more lines, and a trailing comment of its first line needs `@ruby`:comment_position:start.
     * @param {?string} blockId - The block ID.
     * @returns {boolean} True if it has one.
     */
    _hasCommandInput(blockId) {
        const block = blockId ? this._context.blocks[blockId] : null;
        return !!block && Object.keys(block.inputs || {}).some((name) => name.startsWith('SUBSTACK'));
    },

    /**
     * The outermost if of a `case`: the block of the CaseNode, or the first block after it with the
     * `@ruby`:syntax:case marker (the blocks that call the methods of the subject come before it).
     * @param {string} blockId - The block of the CaseNode.
     * @returns {?string} The block ID.
     */
    _caseBlockOf(blockId) {
        const blocks = this._context.blocks;
        for (let block = blocks[blockId]; block; block = block.next ? blocks[block.next] : null) {
            if (this._caseMarkerOf(block)) return block.id;
        }
        return this._commentAnchorOf(blockId);
    },

    /**
     * The `@ruby`:syntax:case marker of a block, or null.
     * @param {?object} block - The block.
     * @returns {?string} The marker.
     */
    _caseMarkerOf(block) {
        const comment = block && block.comment ? this._context.comments[block.comment] : null;
        const marker = rubyMarkersOf(comment ? comment.text : null).find((m) => m.startsWith('@ruby:syntax:case:'));
        return marker || null;
    },

    /**
     * The `==` blocks of the `when`s of a `case`, in order. The `case` is a chain of if blocks with the
     * same `@ruby`:syntax:case marker: the first one has the first `when`, and the if block in its else
     * has the next one.
     * @param {object} caseNode - The CaseNode.
     * @param {string} blockId - The if block of the `case`.
     * @returns {Array<{whenNode: object, condId: string}>} The `when` nodes and their `==` blocks.
     */
    _caseWhenConditions(caseNode, blockId) {
        const blocks = this._context.blocks;
        const caseMarker = (block) => this._caseMarkerOf(block);
        const marker = caseMarker(blocks[blockId]);
        const result = [];
        let block = blocks[blockId];
        for (const whenNode of caseNode.conditions || []) {
            if (!block || !marker || caseMarker(block) !== marker) break;
            const condId = block.inputs.CONDITION && block.inputs.CONDITION.block;
            if (condId && blocks[condId]) result.push({ whenNode, condId });
            const elseId = block.inputs.SUBSTACK2 && block.inputs.SUBSTACK2.block;
            block = elseId ? blocks[elseId] : null;
        }
        return result;
    },

    /**
     * The block that writes in Ruby the line of a block, to put a comment of the line on.
     *
     * - A value block goes up to the block that has it in an input (`a += 1` is the assignment, not the
     *   block that adds; the subject of `case` is the `case`).
     * - A block that the block before it writes goes back to that block: the blocks that add the elements
     *   or the pairs of a literal (`@a = [1, 2]`, `@h = {a: 1}`), the block that stops the method for
     *   `return` (`@ruby`:syntax:return), and the block that sets the return value first in a method
     *   (`@ruby`:return:<method>:initialize, after the definition). The generator does not write them, so
     *   a comment on them was lost or moved to the next line.
     * @param {?string} blockId - The block ID.
     * @returns {?string} The block ID to put the comment on, or null.
     */
    _commentAnchorOf(blockId) {
        const blocks = this._context.blocks;
        let block = blockId ? blocks[blockId] : null;
        for (let guard = 0; block && guard < 1000; guard++) {
            const parent = block.parent ? blocks[block.parent] : null;
            if (!parent) break;
            const isPrevious = parent.next === block.id;
            if (!isPrevious && this._isValueBlock(block)) {
                block = parent;
            } else if (isPrevious && this._isWrittenByPreviousBlock(block)) {
                block = parent;
            } else {
                break;
            }
        }
        return block ? block.id : null;
    },

    /**
     * The procedures_definition block of a method. The node of the method can have a block in its body
     * (the block that sets the return value), and a comment of the line of `def` goes to the definition.
     * @param {string} blockId - A block of the method.
     * @returns {?string} The procedures_definition block ID, or the anchor of the block if there is none.
     */
    _definitionBlockOf(blockId) {
        const blocks = this._context.blocks;
        let block = blocks[blockId];
        while (block && block.parent && blocks[block.parent]) {
            block = blocks[block.parent];
        }
        return block && block.opcode === 'procedures_definition' ? block.id : this._commentAnchorOf(blockId);
    },

    /**
     * Whether a block is written in Ruby by the block before it (see `_commentAnchorOf`).
     * @param {object} block - The block.
     * @returns {boolean} True if the block before it writes it.
     */
    _isWrittenByPreviousBlock(block) {
        const comment = block.comment ? this._context.comments[block.comment] : null;
        const markers = rubyMarkersOf(comment ? comment.text : null);
        if (block.opcode === 'control_stop') {
            return markers.includes('@ruby:syntax:return');
        }
        return markers.some((m) => WRITTEN_BY_PREVIOUS_MARKERS.some((re) => re.test(m)));
    },

    /**
     * Find the block ID associated with a given source line number.
     * Uses lineToNodeMap and nodeToBlockMap.
     * @param {number} line - 1-based line number
     * @returns {string|null} The block ID, or null if not found
     */
    _findBlockIdForLine(line) {
        const entry = this._context.lineToNodeMap.get(line);
        if (!entry) {
            return null;
        }
        const blockId = this._context.nodeToBlockMap.get(entry.node);
        return blockId || null;
    },

    /**
     * Merge a user comment with an existing block comment, or create a new one.
     * User comment text is placed before any `@ruby:` metadata lines.
     *
     * A block can have both a comment on the lines before it and a trailing comment on its own line
     * (`# before\nmove(10) # after`). Then the text before comes first, the trailing text is the last
     * user line, and `@ruby`:comment_position:inline:last tells the generator that only the last line
     * is the trailing comment (issue #1838). With `@ruby`:comment_position:inline, all user lines are
     * the trailing comment.
     * @param {string} blockId - The block ID to attach the comment to
     * @param {string} userText - The user comment text
     * @param {boolean} isInline - Whether this is an inline (trailing) comment
     * @param {boolean} atStart - Whether the trailing comment is on the first line of a block with commands
     *     in it (`loop do # c`): `@ruby`:comment_position:start is added. Without it the generator writes
     *     the trailing comment of such a block on its last line (`end # c`).
     */
    _mergeUserComment(blockId, userText, isInline, atStart = false) {
        const block = this._context.blocks[blockId];
        if (!block) {
            return;
        }

        // Place the user text FIRST, with any `@ruby:` metadata appended on
        // following lines. Blockly v12 renders the collapsed comment as a
        // single-line bar showing the first line — putting user text first
        // keeps that bar readable. The Ruby generator's scrub_() filters
        // by full-line equality / `startsWith('@ruby:')`, so line order
        // doesn't affect round-tripping. (See ruby-generator/scrub.js.)
        const existingComment = block.comment ? this._context.comments[block.comment] : null;
        if (!existingComment) {
            const commentText = isInline
                ? `${userText}\n${INLINE_MARKER}${atStart ? `\n${START_MARKER}` : ''}`
                : userText;
            block.comment = this._createComment(commentText, block.id);
            return;
        }

        const lines = existingComment.text.split('\n');
        const userLines = lines.filter((l) => !l.startsWith('@ruby:'));
        const metadataLines = lines.filter(
            (l) => l.startsWith('@ruby:') && l !== INLINE_MARKER && l !== INLINE_LAST_MARKER && l !== START_MARKER,
        );
        let beforeLines = userLines;
        let inlineText = null;
        let start = lines.includes(START_MARKER);
        if (lines.includes(INLINE_LAST_MARKER)) {
            beforeLines = userLines.slice(0, -1);
            inlineText = userLines[userLines.length - 1];
        } else if (lines.includes(INLINE_MARKER)) {
            beforeLines = [];
            inlineText = userLines.join(' ');
        }
        if (isInline) {
            // A block has one trailing comment. When its first line and its last line both have one
            // (`if @a > 1 # a` ... `end # b`), the one of the first line goes before the block.
            if (inlineText !== null) {
                beforeLines = [...beforeLines, inlineText];
            }
            inlineText = userText;
            start = atStart;
        } else {
            // Keep the lines before that are there (a trailing comment of the first line moved before).
            beforeLines = [...beforeLines, userText];
        }

        const textLines = [...beforeLines];
        if (inlineText !== null) {
            textLines.push(inlineText);
            const positionLines = [beforeLines.length > 0 ? INLINE_LAST_MARKER : INLINE_MARKER];
            if (start) positionLines.push(START_MARKER);
            metadataLines.unshift(...positionLines);
        }
        existingComment.text = [...textLines, ...metadataLines].join('\n');
    },
};

export default CommentHandler;
