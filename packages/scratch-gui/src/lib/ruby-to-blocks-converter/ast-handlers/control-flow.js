import _ from 'lodash';

/**
 * Control flow AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ControlFlowHandlers = {
    visitIfNode (node) {
        const saved = this._saveContext();

        const preBlocks = [];
        let cond = this._processCondition(node.predicate);
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

        if (node.subsequent && node.subsequent.constructor.name === 'IfNode') {
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
                        const commentId = this._createComment(commentText, b.id, 0, 0, true);
                        b.comment = commentId;
                    }
                });
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
            const condCommentId = this._createComment(commentText, condBlock.id, 0, 0, true);
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
                    const blockCommentId = this._createComment(commentText, block.id, 0, 0, true);
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
        let cond = this._processCondition(node.predicate);
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        const statement = this._processStatement(node.statements);

        let block = this._callConvertersHandler('onUntil', cond, statement);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
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
        let cond = this._processCondition(node.predicate);
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        // unless cond; thenBody; else; elseBody; end
        // is equivalent to: if cond; elseBody; else; thenBody; end
        // (branches are swapped relative to if)
        const unlessThen = this._processStatement(node.statements);
        const unlessElse = node.elseClause ? this._processStatement(node.elseClause) : null;
        const hasElseClause = !!node.elseClause;

        // Swap: unless-then becomes if-else, unless-else becomes if-then
        const ifThen = unlessElse;
        const ifElse = unlessThen;

        let block = this._callConvertersHandler('onIf', cond, ifThen, ifElse);
        if (!block) {
            this._restoreContext(saved);
            block = this._createRubyStatementBlock(this._getSource(node), node);
        } else if (hasElseClause && this._isBlock(block)) {
            // Ensure control_if_else and SUBSTACK2 exist even when ifElse is null
            block.opcode = 'control_if_else';
            if (!block.inputs.SUBSTACK2) {
                block.inputs.SUBSTACK2 = {name: 'SUBSTACK2', block: null, shadow: null};
            }
        }

        // Attach @ruby:syntax:unless comment to preserve round-trip fidelity
        // Use @ruby:syntax:unless_else when an else clause is present
        if (this._isBlock(block)) {
            const commentText = hasElseClause ? '@ruby:syntax:unless_else' : '@ruby:syntax:unless';
            if (block.comment) {
                const comment = this._context.comments[block.comment];
                if (comment) {
                    comment.text = commentText;
                    comment.minimized = true;
                }
            } else {
                const commentId = this._createComment(commentText, block.id, 0, 0, true);
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
        // Prism WhileNode is similar to UntilNode but opcode is different in converters
        // Actually, Smalruby's onUntil handles 'until'.
        // For 'while', we usually use ruby_statement or specific converter.
        return this._createRubyStatementBlock(this._getSource(node), node);
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
    },

    visitDefNode (node) {
        const saved = this._saveContext();

        // Convert DefNode to a format compatible with onDefs handler
        // In Prism, DefNode has receiver, name, parameters, body.
        
        let block = this._callConvertersHandler('onDefs', node, saved);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        return block;
    }
};

export default ControlFlowHandlers;
