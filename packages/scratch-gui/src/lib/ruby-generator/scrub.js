// === Smalruby: This file is Smalruby-specific (comment/block-chain scrub handler for RubyGenerator) ===

/**
 * Register the scrub_ method on the RubyGenerator.
 * Handles comment output, block chaining (next), isStatement end, and inline comments.
 * @param {object} Generator - The RubyGenerator instance.
 * @returns {object} The Generator instance.
 */
export default function (Generator) {
    Generator.scrub_ = function (block, code) {
        if (code === null) {
            return '';
        }

        let commentCode = '';
        let isInlineComment = false;
        if (!this.isConnectedValue(block)) {
            let comment = this.getCommentText(block);
            if (comment) {
                isInlineComment = comment.split('\n').some(line => line === '@ruby:comment_position:inline');
                const filteredComment = comment.split('\n')
                    .filter(line => !line.startsWith('@ruby:'))
                    .join('\n');
                if (filteredComment.trim().length > 0) {
                    if (!isInlineComment) {
                        commentCode += `${this.prefixLines(filteredComment, '# ')}\n`;
                    }
                }
            }
            const inputs = this.getInputs(block);
            for (const name in inputs) {
                const input = inputs[name];
                const childBlock = this.getBlock(input.block);
                if (childBlock) {
                    comment = this.allNestedComments(childBlock);
                    if (comment) {
                        const filteredComment = comment.split('\n')
                            .filter(line => !line.startsWith('@ruby:'))
                            .join('\n');
                        if (filteredComment.trim().length > 0) {
                            commentCode += this.prefixLines(filteredComment, '# ');
                        }
                    }
                }
            }
        }

        // Check if this block has explicitly marked that its next chain should not be processed
        // (e.g., procedures_definition manually processes its body blocks)
        let nextCode = '';
        if (block._skipNextInScrub) {
            // Clean up the flag
            delete block._skipNextInScrub;
        } else {
            const nextBlock = this.getBlock(block.next);
            nextCode = this.blockToCode(nextBlock);
        }
        let endCode = '';
        if (block.isStatement) {
            if (nextCode !== '') {
                nextCode = this.prefixLines(nextCode, this.INDENT);
            }
            endCode = 'end\n';
            delete block.isStatement;
        }
        if (isInlineComment && !this.isConnectedValue(block)) {
            const inlineComment = this.getCommentText(block).split('\n')
                .filter(line => !line.startsWith('@ruby:'))
                .join(' ');
            if (inlineComment.trim().length > 0 && code.endsWith('\n')) {
                code = `${code.slice(0, -1)} # ${inlineComment.trim()}\n`;
            }
        }
        return commentCode + code + nextCode + endCode;
    };

    return Generator;
}
