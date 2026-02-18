import _ from 'lodash';

const Opal = global.Opal || window.Opal;

/**
 * Control flow AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ControlFlowHandlers = {
    _onIf (node) {
        this._checkNumChildren(node, 3);

        const saved = this._saveContext();

        const preBlocks = [];
        let cond = this._processCondition(node.children[0]);
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        const statement = this._processStatement(node.children[1]);
        let elseStatement;
        if (node.children[2] !== Opal.nil ||
            (node.$loc().$else && node.$loc().$else() !== Opal.nil)) {
            elseStatement = this._processStatement(node.children[2]);
        }

        let block = this._callConvertersHandler('onIf', cond, statement, elseStatement);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        if (node.children[2] && node.children[2].type === 'if') {
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

    _onCase (node) {
        this._checkNumChildren(node, node.children.length);

        const saved = this._saveContext();

        const subjectNode = node.children[0];
        const subjectResult = this._process(subjectNode, true);
        const subjectSplit = this._splitPreBlocksAndValue(subjectResult);
        const subject = subjectSplit.value;
        const preBlocks = subjectSplit.preBlocks;

        const subjectSource = this._getSource(subjectNode);

        this._context.caseCounter++;
        const caseIndex = this._context.caseCounter;
        const commentText = `@ruby:syntax:case:${subjectSource}:${caseIndex}`;

        const whenNodes = node.children.slice(1, -1);
        const elseNode = node.children[node.children.length - 1];

        const convertWhen = index => {
            if (index >= whenNodes.length) {
                if (elseNode !== Opal.nil) {
                    return this._processStatement(elseNode);
                }
                return null;
            }

            const whenNode = whenNodes[index];
            if (whenNode.children.length !== 2) {
                // More than one condition in 'when' is not supported yet
                return null;
            }

            // Re-process subject for each 'when' to avoid reusing the same block
            const currentSubjectResult = this._process(subjectNode, true);
            const currentSubjectSplit = this._splitPreBlocksAndValue(currentSubjectResult);
            const currentSubject = currentSubjectSplit.value;
            preBlocks.push(...currentSubjectSplit.preBlocks);

            const conditionNode = whenNode.children[0];
            const rhResult = this._process(conditionNode, true);
            const rhSplit = this._splitPreBlocksAndValue(rhResult);
            const currentRh = rhSplit.value;
            preBlocks.push(...rhSplit.preBlocks);

            const body = this._processStatement(whenNode.children[whenNode.children.length - 1]);

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

    _onUntil (node) {
        this._checkNumChildren(node, 2);

        const saved = this._saveContext();

        const preBlocks = [];
        let cond = this._processCondition(node.children[0]);
        const split = this._splitPreBlocksAndValue(cond);
        cond = split.value;
        preBlocks.push(...split.preBlocks);

        const statement = this._processStatement(node.children[1]);

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

    _onAnd (node) {
        this._checkNumChildren(node, 2);

        const preBlocks = [];
        const operands = node.children.map(childNode => {
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

    _onOr (node) {
        this._checkNumChildren(node, 2);

        const preBlocks = [];
        const operands = node.children.map(childNode => {
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

    _onDef (node) {
        this._checkNumChildren(node, 3);

        const saved = this._saveContext();

        // Convert def to a format compatible with onDefs handler (receiver = nil)
        const defsNode = {
            type: 'defs',
            children: [Opal.nil, node.children[0], node.children[1], node.children[2]],
            $loc: node.$loc
        };

        let block = this._callConvertersHandler('onDefs', defsNode, saved);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        return block;
    },

    _onDefs (node) {
        this._checkNumChildren(node, 4);

        const saved = this._saveContext();

        let block = this._callConvertersHandler('onDefs', node, saved);
        if (!block) {
            this._restoreContext(saved);

            block = this._createRubyStatementBlock(this._getSource(node), node);
        }

        return block;
    }
};

export default ControlFlowHandlers;
