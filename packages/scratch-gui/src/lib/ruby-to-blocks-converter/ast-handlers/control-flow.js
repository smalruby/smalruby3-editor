import _ from 'lodash';
import ControlFlowDef from './control-flow-def';

/**
 * Control flow AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ControlFlowHandlers = {
    ...ControlFlowDef,

    visitIfNode (node) {
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
        if (node.subsequent && node.subsequent.constructor.name === 'ElseNode' &&
            this._isBlock(block) && block.opcode !== 'control_if_else') {
            block.opcode = 'control_if_else';
            if (!block.inputs.SUBSTACK2) {
                block.inputs.SUBSTACK2 = {name: 'SUBSTACK2', block: null, shadow: null};
            }
        }

        let hasElsif = false;
        if (node.subsequent && node.subsequent.constructor.name === 'IfNode') {
            hasElsif = true;
            const elseBlock = _.isArray(elseStatement) ? elseStatement[0] : elseStatement;
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
                [block, elseBlock].forEach(b => {
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

    visitCaseNode (node) {
        const saved = this._saveContext();

        const subjectNode = node.predicate;
        const subjectResult = this.visit(subjectNode);
        const subjectSplit = this._splitPreBlocksAndValue(subjectResult);
        const subject = subjectSplit.value;
        const preBlocks = subjectSplit.preBlocks;

        const subjectSource = this._getSource(subjectNode);

        this._context.caseCounter++;
        const caseIndex = this._context.caseCounter;
        const commentText = `@ruby:syntax:case:${subjectSource}:${caseIndex}`;

        const whenNodes = node.conditions;
        const elseNode = node.elseClause;

        const convertWhen = index => {
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
                condBlock, 'OPERAND1', this._isNumber(currentSubject) ? currentSubject.toString() : currentSubject, ''
            );
            this._addTextInput(
                condBlock, 'OPERAND2', this._isNumber(currentRh) ? currentRh.toString() : currentRh, '50'
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

    visitUntilNode (node) {
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

        let block = this._callConvertersHandler('onUntil', cond, statement);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
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

    visitUnlessNode (node) {
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
            this._addInput(notBlock, 'OPERAND', cond);
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
                block.inputs.SUBSTACK2 = {name: 'SUBSTACK2', block: null, shadow: null};
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

    visitElseNode (node) {
        return this.visit(node.statements);
    },

    visitWhileNode (node) {
        const saved = this._saveContext();

        const preBlocks = [];
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
            this._addInput(notBlock, 'OPERAND', cond);
        }

        const statement = this._processStatement(node.statements);

        let block = this._callConvertersHandler('onUntil', notBlock, statement);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        } else if (this._isBlock(block)) {
            // Attach @ruby:syntax:while comment for round-trip fidelity
            let commentText = '@ruby:syntax:while';
            if (variableHint) {
                commentText += `,@ruby:variable:${variableHint}`;
            }
            const commentId = this._createComment(commentText, block.id);
            block.comment = commentId;
        }

        if (preBlocks.length > 0 && block) {
            if (_.isArray(block)) {
                return [...preBlocks, ...block];
            }
            return [...preBlocks, block];
        }
        return block;
    },

    visitAndNode (node) {
        const preBlocks = [];
        const operands = [node.left, node.right].map(childNode => {
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

    visitOrNode (node) {
        const preBlocks = [];
        const operands = [node.left, node.right].map(childNode => {
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
    }
};

export default ControlFlowHandlers;
