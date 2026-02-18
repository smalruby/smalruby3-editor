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
                    if (!b.comment) {
                        const commentId = this._createComment(commentText, b.id, 0, 0, true);
                        b.comment = commentId;
                    } else {
                        const comment = this._context.comments[b.comment];
                        if (comment) {
                            comment.text = commentText;
                            comment.minimized = true;
                        }
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
