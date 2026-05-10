// === Smalruby: This file is Smalruby-specific (comment extraction and association for Ruby-to-blocks converter) ===

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
    _extractSourceComments (parseResult, sourceCode) {
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
        const offsetToLine = offset => {
            for (let i = lineStarts.length - 1; i >= 0; i--) {
                if (offset >= lineStarts[i]) {
                    return i + 1; // 1-based line numbers
                }
            }
            return 1;
        };

        return parseResult.comments.map(comment => {
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

            return {type, text, line, startOffset: startCharOffset, endOffset: endCharOffset, isTrailing};
        });
    },

    /**
     * Associate extracted source comments with blocks or create workspace comments.
     * Called after all blocks have been created in targetCodeToBlocks.
     * @param {object} parseResult - The prism parse result
     * @param {string} sourceCode - The original source code
     */
    _associateSourceComments (parseResult, sourceCode) {
        const sourceComments = this._extractSourceComments(parseResult, sourceCode);
        if (sourceComments.length === 0) {
            return;
        }

        // Build a map from start line to block ID.
        // Unlike lineToNodeMap (which uses a range/shallowest strategy), this maps only
        // lines where a node actually STARTS, preferring the most specific (smallest range) node.
        // This ensures "# comment\nloop do" attaches to the loop block, not a parent block.
        // Among blocks with equal range, prefer statement blocks over input (value) blocks,
        // so that "# comment\ngreet(name)" attaches to the procedures_call, not data_variable.
        const inputBlockIds = new Set();
        for (const block of Object.values(this._context.blocks)) {
            if (block.inputs) {
                for (const input of Object.values(block.inputs)) {
                    if (input.block) inputBlockIds.add(input.block);
                }
            }
        }

        const lineStartBlockMap = new Map();
        for (const [node, blockId] of this._context.nodeToBlockMap.entries()) {
            const startLine = this._getNodeStartLine(node);
            if (startLine === null) continue;
            const endLine = this._getNodeEndLine(node) || startLine;
            const range = endLine - startLine;
            const isInput = inputBlockIds.has(blockId);
            const existing = lineStartBlockMap.get(startLine);
            if (!existing ||
                range < existing.range ||
                (range === existing.range && !isInput && existing.isInput)) {
                lineStartBlockMap.set(startLine, {blockId, range, isInput});
            }
        }

        const findBlockForLine = line => {
            const entry = lineStartBlockMap.get(line);
            return entry ? entry.blockId : null;
        };

        // Group consecutive non-trailing comments that share adjacent lines
        const groups = [];
        let currentGroup = null;
        for (const comment of sourceComments) {
            if (comment.isTrailing) {
                // Trailing comments are always individual
                groups.push({comments: [comment], isTrailing: true});
                currentGroup = null;
            } else if (currentGroup && comment.line === currentGroup.endLine + 1) {
                // Consecutive comment on next line
                currentGroup.comments.push(comment);
                currentGroup.endLine = comment.line;
            } else {
                currentGroup = {comments: [comment], isTrailing: false, endLine: comment.line};
                groups.push(currentGroup);
            }
        }

        for (const group of groups) {
            const text = group.comments.map(c => c.text).join('\n');

            if (group.isTrailing) {
                // Trailing (inline) comment: attach to block on the same line
                const comment = group.comments[0];
                const blockId = findBlockForLine(comment.line) ||
                    this._findBlockIdForLine(comment.line);
                if (blockId) {
                    this._mergeUserComment(blockId, text, true);
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
                    r => r.startLine === nextCodeLine &&
                        (r.type === 'ClassNode' || r.type === 'ModuleNode')
                );
                if (containerRange) {
                    // For modules, include @ruby:module:Name metadata so
                    // the generator can place the comment before the module code
                    if (containerRange.type === 'ModuleNode' && containerRange.moduleName) {
                        this._createComment(
                            `${text}\n@ruby:module:${containerRange.moduleName}`, null
                        );
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
                                r => r.startLine === scanLine &&
                                    (r.type === 'ClassNode' || r.type === 'ModuleNode' ||
                                        r.type === 'DefNode')
                            );
                            if (hitContainer) break;
                            const scanBlockId = findBlockForLine(scanLine) ||
                                this._findBlockIdForLine(scanLine);
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
     * Find the block ID associated with a given source line number.
     * Uses lineToNodeMap and nodeToBlockMap.
     * @param {number} line - 1-based line number
     * @returns {string|null} The block ID, or null if not found
     */
    _findBlockIdForLine (line) {
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
     * @param {string} blockId - The block ID to attach the comment to
     * @param {string} userText - The user comment text
     * @param {boolean} isInline - Whether this is an inline (trailing) comment
     */
    _mergeUserComment (blockId, userText, isInline) {
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
        const inlineMarker = isInline ? '@ruby:comment_position:inline' : '';

        if (block.comment) {
            // Block already has a comment - merge
            const existingComment = this._context.comments[block.comment];
            if (existingComment) {
                const lines = existingComment.text.split('\n');
                const metadataLines = lines.filter(l => l.startsWith('@ruby:'));
                if (isInline && !metadataLines.includes(inlineMarker)) {
                    metadataLines.unshift(inlineMarker);
                }
                const trailing = metadataLines.length > 0 ? `\n${metadataLines.join('\n')}` : '';
                existingComment.text = `${userText}${trailing}`;
            }
        } else {
            // Create new comment for this block
            const commentText = isInline ? `${userText}\n${inlineMarker}` : userText;
            block.comment = this._createComment(commentText, block.id);
        }
    }
};

export default CommentHandler;
