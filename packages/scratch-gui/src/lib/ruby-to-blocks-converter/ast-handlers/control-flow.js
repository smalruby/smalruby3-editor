import _ from 'lodash';
import ControlFlowDef from './control-flow-def';

// The marker of the blocks that call the methods of the condition of a loop again at the end of
// its body (issue #1606). The generator does not write them (see `scrub.js` of the generator).
const LOOP_CONDITION_CALL_MARKER = '@ruby:loop_condition_call';

/**
 * Control flow AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ControlFlowHandlers = {
    ...ControlFlowDef,

    visitIfNode(node) {
        const saved = this._saveContext();

        const preBlocks = [];
        this._context.variableHint = null;
        let cond = this._processCondition(node.predicate);
        const variableHint = this._context.variableHint;
        this._context.variableHint = null;
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        const statement = this._processStatement(node.statements);
        const elseStatement = this._processStatement(node.subsequent);

        let block = this._callConvertersHandler('onIf', cond, statement, elseStatement);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        // When there's an explicit else clause (ElseNode, not IfNode/elsif), ensure control_if_else
        // even if the else body is empty — preserves round-trip fidelity for "if cond; else; end"
        if (
            node.subsequent &&
            this._getNodeTypeName(node.subsequent) === 'ElseNode' &&
            this._isBlock(block) &&
            block.opcode !== 'control_if_else'
        ) {
            block.opcode = 'control_if_else';
            if (!block.inputs.SUBSTACK2) {
                block.inputs.SUBSTACK2 = { name: 'SUBSTACK2', block: null, shadow: null };
            }
        }

        let hasElsif = false;
        if (node.subsequent && this._getNodeTypeName(node.subsequent) === 'IfNode') {
            hasElsif = true;
            const elseBlock = this._elsifBlockOf(_.isArray(elseStatement) ? elseStatement[0] : elseStatement);
            if (this.isBlock(block) && this.isBlock(elseBlock)) {
                let n;
                if (elseBlock.comment) {
                    const comment = this._context.comments[elseBlock.comment];
                    if (comment) {
                        const match = comment.text.match(/^@ruby:syntax:elsif:(\d+)$/);
                        if (match) {
                            n = parseInt(match[1], 10);
                        }
                    }
                }
                if (!n) {
                    this._context.elsifCounter++;
                    n = this._context.elsifCounter;
                }
                const commentText = `@ruby:syntax:elsif:${n}`;
                [block, elseBlock].forEach((b) => {
                    if (b.comment) {
                        const comment = this._context.comments[b.comment];
                        if (comment) {
                            comment.text = commentText;
                            comment.minimized = true;
                        }
                    } else {
                        const commentId = this._createComment(commentText, b.id);
                        b.comment = commentId;
                    }
                });
            }
        }

        // Detect if modifier form: endKeywordLoc is null for modifier syntax
        if (node.endKeywordLoc === null && this._isBlock(block)) {
            let commentText = '@ruby:syntax:if_modifier';
            if (variableHint) commentText += `,@ruby:variable:${variableHint}`;
            if (block.comment) {
                const comment = this._context.comments[block.comment];
                if (comment) {
                    comment.text = commentText;
                    comment.minimized = true;
                }
            } else {
                const commentId = this._createComment(commentText, block.id);
                block.comment = commentId;
            }
        } else if (variableHint && !hasElsif && this._isBlock(block)) {
            // Attach @ruby:variable: comment for round-trip (non-modifier, non-elsif forms)
            const varCommentText = `@ruby:variable:${variableHint}`;
            if (block.comment) {
                const existingComment = this._context.comments[block.comment];
                if (existingComment) existingComment.text += `,${varCommentText}`;
            } else {
                const commentId = this._createComment(varCommentText, block.id);
                block.comment = commentId;
            }
        }

        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },

    /**
     * The block of the `if` of `elsif` in `else`. It comes after the blocks that call the methods of
     * its condition (issue #1615), so it is not always the first block of `else`.
     * @param {object} elseBlock - The first block of `else`.
     * @returns {object} The block of the `if`, or the first block when there is no `if`.
     */
    _elsifBlockOf(elseBlock) {
        if (!this.isBlock(elseBlock)) return elseBlock;
        for (let b = elseBlock; b; b = this._context.blocks[b.next]) {
            if (b.opcode === 'control_if' || b.opcode === 'control_if_else') return b;
        }
        return elseBlock;
    },

    visitCaseNode(node) {
        const saved = this._saveContext();

        const subjectNode = node.predicate;
        const subjectResult = this.visit(subjectNode);
        const subjectSplit = this._splitPreBlocksAndValue(subjectResult);
        const preBlocks = subjectSplit.preBlocks;
        // Each `when` visits the subject again (a block can be used only once), so drop this one.
        if (this._isBlock(subjectSplit.value)) {
            this._discardBlock(subjectSplit.value);
        }

        const subjectSource = this._getSource(subjectNode);

        this._context.caseCounter++;
        const caseIndex = this._context.caseCounter;
        const commentText = `@ruby:syntax:case:${subjectSource}:${caseIndex}`;

        const whenNodes = node.conditions;
        const elseNode = node.elseClause;

        const convertWhen = (index) => {
            if (index >= whenNodes.length) {
                if (elseNode) {
                    return this._processStatement(elseNode);
                }
                return null;
            }

            const whenNode = whenNodes[index];
            if (whenNode.conditions.length !== 1) {
                // More than one condition in 'when' is not supported yet
                return null;
            }

            // Re-process subject for each 'when' to avoid reusing the same block
            const currentSubjectResult = this.visit(subjectNode);
            const currentSubjectSplit = this._splitPreBlocksAndValue(currentSubjectResult);
            const currentSubject = currentSubjectSplit.value;
            preBlocks.push(...currentSubjectSplit.preBlocks);

            const conditionNode = whenNode.conditions[0];
            const rhResult = this.visit(conditionNode);
            const rhSplit = this._splitPreBlocksAndValue(rhResult);
            const currentRh = rhSplit.value;
            preBlocks.push(...rhSplit.preBlocks);

            const body = this._processStatement(whenNode.statements);

            // Create subject == rh block
            const condBlock = this._createBlock('operator_equals', 'value_boolean');
            this._addTextInput(
                condBlock,
                'OPERAND1',
                this._isNumber(currentSubject) ? currentSubject.toString() : currentSubject,
                '',
            );
            this._addTextInput(
                condBlock,
                'OPERAND2',
                this._isNumber(currentRh) ? currentRh.toString() : currentRh,
                '50',
            );

            // Add comment to condition block
            const condCommentId = this._createComment(commentText, condBlock.id);
            condBlock.comment = condCommentId;

            const elseStatement = convertWhen(index + 1);

            const block = this._callConvertersHandler('onIf', condBlock, body, elseStatement);
            if (!block) {
                return null;
            }

            // Add comment to if block
            if (this.isBlock(block)) {
                if (block.comment) {
                    const comment = this._context.comments[block.comment];
                    if (comment) {
                        comment.text = commentText;
                        comment.minimized = true;
                    }
                } else {
                    const blockCommentId = this._createComment(commentText, block.id);
                    block.comment = blockCommentId;
                }
            }

            return block;
        };

        const result = convertWhen(0);
        if (!result) {
            this._restoreContext(saved);
            return this._createRubyStatementBlock(this._getSource(node), node);
        }

        if (preBlocks.length > 0) {
            if (_.isArray(result)) {
                return [...preBlocks, ...result];
            }
            return [...preBlocks, result];
        }
        return result;
    },

    visitUntilNode(node) {
        const saved = this._saveContext();

        const preBlocks = [];
        const callState = this._methodCallState();
        this._context.variableHint = null;
        let cond = this._processCondition(node.predicate);
        const variableHint = this._context.variableHint;
        this._context.variableHint = null;
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        const statement = this._processStatement(node.statements);
        const conditionCalls = this._conditionCallsAgain(node.predicate, split.preBlocks, callState);

        let block = this._callConvertersHandler('onUntil', cond, statement);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        } else if (this._appendConditionCalls(block, conditionCalls) === 'control_wait_until') {
            // `wait until bar(a) == 0` became a loop that calls bar again: write it back as written.
            this._addCommentMarker(block, '@ruby:syntax:wait_until');
        }

        if (variableHint && this._isBlock(block)) {
            const varCommentText = `@ruby:variable:${variableHint}`;
            if (block.comment) {
                const existingComment = this._context.comments[block.comment];
                if (existingComment) existingComment.text += `,${varCommentText}`;
            } else {
                const commentId = this._createComment(varCommentText, block.id);
                block.comment = commentId;
            }
        }

        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },

    visitUnlessNode(node) {
        const saved = this._saveContext();

        const preBlocks = [];
        this._context.variableHint = null;
        let cond = this._processCondition(node.predicate);
        const variableHint = this._context.variableHint;
        this._context.variableHint = null;
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        // Negate condition: unless cond => if !(cond)
        const notBlock = this._createBlock('operator_not', 'value_boolean');
        if (this._isFalseOrBooleanBlock(cond)) {
            this._addBooleanInput(notBlock, 'OPERAND', cond);
        }

        const unlessThen = this._processStatement(node.statements);
        const unlessElse = node.elseClause ? this._processStatement(node.elseClause) : null;
        const hasElseClause = !!node.elseClause;

        // Pass branches in natural order (no swap): unless-then → statement, unless-else → elseStatement
        let block = this._callConvertersHandler('onIf', notBlock, unlessThen, unlessElse);
        if (!block) {
            this._restoreContext(saved);
            block = this._createRubyStatementBlock(this._getSource(node), node);
        } else if (hasElseClause && this._isBlock(block)) {
            // Ensure control_if_else and SUBSTACK2 exist even when unlessElse is null
            block.opcode = 'control_if_else';
            if (!block.inputs.SUBSTACK2) {
                block.inputs.SUBSTACK2 = { name: 'SUBSTACK2', block: null, shadow: null };
            }
        }

        // Attach @ruby:syntax:unless* comment to preserve round-trip fidelity
        if (this._isBlock(block)) {
            const isModifier = node.endKeywordLoc === null;
            let commentText2;
            if (isModifier) {
                commentText2 = '@ruby:syntax:unless_modifier';
            } else if (hasElseClause) {
                commentText2 = '@ruby:syntax:unless_else';
            } else {
                commentText2 = '@ruby:syntax:unless';
            }
            if (variableHint) commentText2 += `,@ruby:variable:${variableHint}`;
            if (block.comment) {
                const comment = this._context.comments[block.comment];
                if (comment) {
                    comment.text = commentText2;
                    comment.minimized = true;
                }
            } else {
                const commentId = this._createComment(commentText2, block.id);
                block.comment = commentId;
            }
        }

        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },

    visitElseNode(node) {
        return this.visit(node.statements);
    },

    visitWhileNode(node) {
        const saved = this._saveContext();

        const preBlocks = [];
        const callState = this._methodCallState();
        this._context.variableHint = null;
        let cond = this._processCondition(node.predicate);
        const variableHint = this._context.variableHint;
        this._context.variableHint = null;
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        // Negate condition: while cond => until !(cond)
        const notBlock = this._createBlock('operator_not', 'value_boolean');
        if (this._isFalseOrBooleanBlock(cond)) {
            this._addBooleanInput(notBlock, 'OPERAND', cond);
        }

        const statement = this._processStatement(node.statements);
        const conditionCalls = this._conditionCallsAgain(node.predicate, split.preBlocks, callState);

        let block = this._callConvertersHandler('onUntil', notBlock, statement);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        } else if (this._isBlock(block)) {
            this._appendConditionCalls(block, conditionCalls);
            // Attach @ruby:syntax:while comment for round-trip fidelity, keeping the markers the loop
            // has (e.g. `@ruby:method:wait` of a body that ends with `wait`).
            let commentText = '@ruby:syntax:while';
            if (variableHint) {
                commentText += `,@ruby:variable:${variableHint}`;
            }
            this._addCommentMarker(block, commentText);
        }

        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },

    /**
     * The state of the return values of the calls in the current line, to visit a condition again
     * as it was visited the first time (see `_conditionCallsAgain`).
     * @returns {object} The call indices and whether a return value is saved in this line.
     */
    _methodCallState() {
        return {
            methodCallIndices: Object.assign({}, this._context.methodCallIndices),
            savedReturnValueInStatement: this._context.savedReturnValueInStatement,
        };
    },

    /**
     * The blocks that call the methods of the condition of a loop again (issue #1606). A method
     * called in a condition (e.g. `while bar(a) < 3`) is called by a block before the loop, and the
     * condition reads the return value; Ruby calls it before every check, so the blocks call it
     * again at the end of the body. They are marked `@ruby`:loop_condition_call so that the
     * generator does not write them: the condition is written once, as in Ruby.
     * @param {object} node - The condition node.
     * @param {Array} preBlocks - The blocks put before the loop by the first visit of the condition.
     * @param {object} callState - The state before the first visit (see `_methodCallState`).
     * @returns {Array} The statement blocks to put at the end of the body (none if no call).
     */
    _conditionCallsAgain(node, preBlocks, callState) {
        if (!preBlocks.some((b) => this._isBlock(b))) {
            return [];
        }
        const context = this._context;
        const after = {
            methodCallIndices: context.methodCallIndices,
            savedReturnValueInStatement: context.savedReturnValueInStatement,
            variableHint: context.variableHint,
        };
        // The calls get the same comments and variables as the first time (e.g. `@_return_bar_1_`).
        context.methodCallIndices = Object.assign({}, callState.methodCallIndices);
        context.savedReturnValueInStatement = callState.savedReturnValueInStatement;
        // A line of the Ruby code stays mapped to the blocks before the loop.
        const nodeToBlockMap = context.nodeToBlockMap && new Map(context.nodeToBlockMap);
        let split;
        try {
            split = this._splitPreBlocksAndValue(this._processCondition(node));
        } finally {
            context.methodCallIndices = after.methodCallIndices;
            context.savedReturnValueInStatement = after.savedReturnValueInStatement;
            context.variableHint = after.variableHint;
            if (nodeToBlockMap) {
                context.nodeToBlockMap.clear();
                nodeToBlockMap.forEach((blockId, n) => context.nodeToBlockMap.set(n, blockId));
            }
        }
        // Only the calls are used: the loop reads the value with the condition of the first visit.
        this._discardBlock(split.value);
        const calls = split.preBlocks.filter((b) => this._isBlock(b));
        calls.forEach((b) => {
            if (b.comment && context.comments[b.comment]) {
                context.comments[b.comment].text = LOOP_CONDITION_CALL_MARKER;
            } else {
                b.comment = this._createComment(LOOP_CONDITION_CALL_MARKER, b.id);
            }
        });
        return calls;
    },

    /**
     * Put the blocks of `_conditionCallsAgain` at the end of the body of a loop. A loop without a
     * body (`control_wait_until`, e.g. `wait until bar(a) == 0`) becomes `control_repeat_until`
     * with them as its body, so that the methods are called while waiting.
     * @param {object} block - The loop block (`control_repeat_until` or `control_wait_until`).
     * @param {Array} calls - The blocks to put.
     * @returns {?string} The opcode of the loop before they were put, or null if nothing was put.
     */
    _appendConditionCalls(block, calls) {
        if (calls.length === 0) {
            return null;
        }
        if (!this._isBlock(block)) {
            calls.forEach((b) => this._discardBlock(b));
            return null;
        }
        const opcode = block.opcode;
        if (opcode !== 'control_repeat_until' && opcode !== 'control_wait_until') {
            // Not left behind as orphans.
            calls.forEach((b) => this._discardBlock(b));
            return null;
        }
        const firstId = block.inputs.SUBSTACK && block.inputs.SUBSTACK.block;
        const last = firstId ? this._lastBlock(this._context.blocks[firstId]) : null;
        if (last && this._getBlockType(last) === 'terminate') {
            // The end of the body is never reached (e.g. `loop do ... end`), and nothing can follow it.
            calls.forEach((b) => this._discardBlock(b));
            return null;
        }
        calls.forEach((b, i) => {
            if (i > 0) {
                calls[i - 1].next = b.id;
                b.parent = calls[i - 1].id;
            }
        });
        if (last) {
            last.next = calls[0].id;
            calls[0].parent = last.id;
        } else {
            block.opcode = 'control_repeat_until';
            this._addSubstack(block, calls[0]);
        }
        return opcode;
    },

    /**
     * Add a `@ruby`: marker to the comment of a block, keeping the markers it has.
     * @param {object} block - The block.
     * @param {string} marker - The marker.
     */
    _addCommentMarker(block, marker) {
        const comment = block.comment && this._context.comments[block.comment];
        if (comment) {
            comment.text = comment.text ? `${comment.text},${marker}` : marker;
        } else {
            block.comment = this._createComment(marker, block.id);
        }
    },

    visitAndNode(node) {
        const preBlocks = [];
        const operands = [node.left, node.right].map((childNode) => {
            const result = this._processCondition(childNode);
            const s = this._splitPreBlocksAndValue(result);
            preBlocks.push(...s.preBlocks);
            return s.value;
        });

        const block = this._callConvertersHandler('onAnd', operands);
        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },

    visitOrNode(node) {
        const preBlocks = [];
        const operands = [node.left, node.right].map((childNode) => {
            const result = this._processCondition(childNode);
            const s = this._splitPreBlocksAndValue(result);
            preBlocks.push(...s.preBlocks);
            return s.value;
        });

        const block = this._callConvertersHandler('onOr', operands);
        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },
};

export default ControlFlowHandlers;
