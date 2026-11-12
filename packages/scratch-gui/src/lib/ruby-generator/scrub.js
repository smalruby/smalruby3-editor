// === Smalruby: This file is Smalruby-specific (comment/block-chain scrub handler for RubyGenerator) ===

/**
 * Whether a comment marks a block that calls a method of the condition of a loop again
 * (`@ruby`:loop_condition_call, put by the converter's `_conditionCallsAgain`).
 * @param {?string} comment - The comment text of the block.
 * @returns {boolean} True if it is the marker.
 */
export const isLoopConditionCall = (comment) =>
    !!comment && comment.split(/[,\s]/).includes('@ruby:loop_condition_call');

const hasMarker = (comment, marker) => !!comment && comment.split(/[,\s]/).includes(marker);

/**
 * Whether a comment marks a block of the body of `begin ... end while cond` put once before the
 * loop (`@ruby`:begin_loop_body, put by the converter's `_beginLoopBodyCopy`, issue #1610).
 * @param {?string} comment - The comment text of the block.
 * @returns {boolean} True if it is the marker.
 */
export const isBeginLoopBody = (comment) => hasMarker(comment, '@ruby:begin_loop_body');

/**
 * The comment text of a block as it is kept, with the `@ruby`:begin_loop_body marker.
 * @param {object} Generator - The RubyGenerator.
 * @param {?object} block - The block.
 * @returns {?string} The comment text, or null.
 */
const rawCommentText = (Generator, block) => {
    const comment = block && Generator.cache_ && Generator.cache_.comments[block.id];
    return comment ? comment.text : null;
};

/**
 * A comment text without the `@ruby`:begin_loop_body marker. The marker is added after the markers
 * the block has (e.g. `@ruby`:lvar:a:1), and the generators of the blocks read those markers as
 * the whole comment, so they must not see it when the body before the loop is written (issue #1610).
 * @param {?string} text - The comment text.
 * @returns {?string} The text without the marker, or null if nothing is left.
 */
const withoutBeginLoopBody = (text) => {
    if (!isBeginLoopBody(text)) {
        return text;
    }
    const stripped = text
        .replace(/,@ruby:begin_loop_body(?=$|[,\s])/g, '')
        .replace(/(^|\s)@ruby:begin_loop_body(?:,|(?=$|\s))/g, '$1');
    return stripped.trim() === '' ? null : stripped;
};

/**
 * Whether a comment marks the loop of `begin ... end while cond` (`@ruby`:syntax:begin_end).
 * @param {?string} comment - The comment text of the loop block.
 * @returns {boolean} True if it is the marker.
 */
export const isBeginLoop = (comment) => hasMarker(comment, '@ruby:syntax:begin_end');

/**
 * A text that is the same for two blocks that make the same code: the opcode, the fields, the
 * mutation and the blocks in the inputs (and the blocks after them in a substack), without the ids
 * of the blocks and comments. The ids of the variables / lists in the fields are kept: two variables
 * can have the same name (e.g. a local variable of another method).
 * @param {object} Generator - The RubyGenerator.
 * @param {?object} block - The first block.
 * @returns {string} The text of the block and the blocks after it.
 */
const chainSignature = (Generator, block) => {
    const parts = [];
    for (let b = block; b; b = Generator.getBlock(b.next)) {
        const fields = Object.keys(b.fields || {})
            .sort()
            .map((name) => `${name}=${JSON.stringify([b.fields[name].id, b.fields[name].value])}`);
        const mutation = b.mutation ? JSON.stringify(b.mutation, Object.keys(b.mutation).sort()) : '';
        const inputs = Object.keys(b.inputs || {})
            .sort()
            .map((name) => {
                const input = b.inputs[name];
                const shadow =
                    input.shadow && input.shadow !== input.block
                        ? chainSignature(Generator, Generator.getBlock(input.shadow))
                        : '';
                return `${name}:(${chainSignature(Generator, Generator.getBlock(input.block))}|${shadow})`;
            });
        parts.push(`${b.opcode}{${fields.join(',')}}[${mutation}](${inputs.join(',')})`);
    }
    return parts.join(';');
};

/**
 * The previous block in a stack (the block whose `next` is the block), or null.
 * @param {object} Generator - The RubyGenerator.
 * @param {object} block - The block.
 * @returns {?object} The previous block.
 */
const previousBlock = (Generator, block) => {
    const parent = Generator.getBlock(block.parent);
    return parent && parent.next === block.id ? parent : null;
};

/**
 * The blocks of the body of `begin ... end while cond` put once before the loop (issue #1610),
 * when they are still the same as the body of the loop. The blocks that call the methods of the
 * condition before the loop (as many as the `@ruby`:loop_condition_call blocks at the end of the
 * body, issue #1606) are between them and the loop. When they are not the same (changed on the
 * blocks screen), null: they are written as they are, and the loop is written as a plain loop.
 * @param {object} Generator - The RubyGenerator.
 * @param {object} loop - The control_repeat_until block.
 * @returns {?Array} The blocks before the loop, in order, or null.
 */
export const beginLoopBodyOf = (Generator, loop) => {
    if (!loop || !isBeginLoop(Generator.getCommentText(loop))) {
        return null;
    }
    const substack = loop.inputs && loop.inputs.SUBSTACK;
    const body = [];
    const calls = [];
    for (let b = substack ? Generator.getBlock(substack.block) : null; b; b = Generator.getBlock(b.next)) {
        (isLoopConditionCall(Generator.getCommentText(b)) ? calls : body).push(b);
    }
    if (body.length === 0) {
        return null;
    }
    const callsBefore = [];
    let b = previousBlock(Generator, loop);
    while (b && callsBefore.length < calls.length && !isBeginLoopBody(rawCommentText(Generator, b))) {
        callsBefore.unshift(b);
        b = previousBlock(Generator, b);
    }
    if (callsBefore.length !== calls.length) {
        return null;
    }
    const copy = [];
    while (b && copy.length < body.length && isBeginLoopBody(rawCommentText(Generator, b))) {
        copy.unshift(b);
        b = previousBlock(Generator, b);
    }
    // One block of the copy more (left by a change) makes it not the same.
    if (copy.length !== body.length || (b && isBeginLoopBody(rawCommentText(Generator, b)))) {
        return null;
    }
    const same = (xs, ys) =>
        xs.every((x, i) => {
            const y = ys[i];
            const sigX = chainSignature(Generator, { ...x, next: null });
            const sigY = chainSignature(Generator, { ...y, next: null });
            return sigX === sigY;
        });
    return same(copy, body) && same(callsBefore, calls) ? copy : null;
};

/**
 * Whether a block is one of the blocks of the body of `begin ... end while cond` put before the
 * loop, and they are the same as the body of the loop (see `beginLoopBodyOf`): it is not written.
 * @param {object} Generator - The RubyGenerator.
 * @param {object} block - The block with the `@ruby`:begin_loop_body marker.
 * @returns {boolean} True if it is not written.
 */
const isSkippedBeginLoopBody = (Generator, block) => {
    let b = block;
    while (b && isBeginLoopBody(rawCommentText(Generator, b))) {
        b = Generator.getBlock(b.next);
    }
    // Over the blocks that call the methods of the condition, to the loop.
    while (b && b.opcode !== 'control_repeat_until' && !isBeginLoopBody(rawCommentText(Generator, b))) {
        b = Generator.getBlock(b.next);
    }
    const copy = b && b.opcode === 'control_repeat_until' ? beginLoopBodyOf(Generator, b) : null;
    return !!copy && copy.some((c) => c.id === block.id);
};

/**
 * Register the scrub_ method on the RubyGenerator.
 * Handles comment output, block chaining (next), isStatement end, and inline comments.
 * @param {object} Generator - The RubyGenerator instance.
 * @returns {object} The Generator instance.
 */
export default function (Generator) {
    Generator.getCommentText = function (block) {
        return withoutBeginLoopBody(rawCommentText(this, block));
    };

    Generator.scrub_ = function (block, code) {
        if (code === null) {
            return '';
        }
        // A block that calls a method of the condition of a loop again at the end of its body is not
        // written: the condition is written once, as in Ruby (issue #1606).
        if (!this.isConnectedValue(block) && isLoopConditionCall(this.getCommentText(block))) {
            return this.blockToCode(this.getBlock(block.next));
        }
        // The body of `begin ... end while cond` before the loop is written once, in the loop (issue #1610).
        if (
            !this.isConnectedValue(block) &&
            isBeginLoopBody(rawCommentText(this, block)) &&
            isSkippedBeginLoopBody(this, block)
        ) {
            return this.blockToCode(this.getBlock(block.next));
        }

        let commentCode = '';
        let isInlineComment = false;
        if (!this.isConnectedValue(block)) {
            let comment = this.getCommentText(block);
            if (comment) {
                isInlineComment = comment.split('\n').some((line) => line === '@ruby:comment_position:inline');
                const filteredComment = comment
                    .split('\n')
                    .filter((line) => !line.startsWith('@ruby:'))
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
                        const filteredComment = comment
                            .split('\n')
                            .filter((line) => !line.startsWith('@ruby:'))
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
            const inlineComment = this.getCommentText(block)
                .split('\n')
                .filter((line) => !line.startsWith('@ruby:'))
                .join(' ');
            if (inlineComment.trim().length > 0 && code.endsWith('\n')) {
                code = `${code.slice(0, -1)} # ${inlineComment.trim()}\n`;
            }
        }
        return commentCode + code + nextCode + endCode;
    };

    return Generator;
}
