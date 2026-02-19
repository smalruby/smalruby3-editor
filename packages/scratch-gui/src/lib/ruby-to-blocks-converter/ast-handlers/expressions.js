import _ from 'lodash';
import Primitive from '../primitive';

const Opal = global.Opal || window.Opal;

/**
 * Expression AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ExpressionHandlers = {
    _onSend (node, rubyBlockArgsNode, rubyBlockNode) {
        const saved = this._saveContext();

        const preBlocks = [];
        let receiver = this._process(node.children[0]);
        const split = this._splitPreBlocksAndValue(receiver);
        receiver = split.value;
        preBlocks.push(...split.preBlocks);

        const name = node.children[1].toString();
        const args = node.children.slice(2).map(childNode => {
            const result = this._process(childNode);
            const s = this._splitPreBlocksAndValue(result);
            preBlocks.push(...s.preBlocks);
            return s.value;
        });

        let rubyBlockArgs;
        if (rubyBlockArgsNode) {
            rubyBlockArgs = this._process(rubyBlockArgsNode);
        }

        let rubyBlock;
        if (rubyBlockNode) {
            rubyBlock = this._processStatement(rubyBlockNode);
        }

        let block = this.callMethod(receiver, name, args, rubyBlockArgs, rubyBlock, node);
        if (!block) {
            block = this._callConvertersHandler('onSend', receiver, name, args, rubyBlockArgs, rubyBlock, node);
        }
        if (!block) {
            if ((this._isSelf(receiver) || receiver === Opal.nil) && !rubyBlock) {
                switch (name) {
                case 'wait':
                    if (args.length === 0) {
                        block = this._createRubyStatementBlock('wait', node);
                    }
                    break;
                }
            }
        }

        if (!block) {
            this._restoreContext(saved);

            if (rubyBlockNode) {
                block = this._createBlock('ruby_statement_with_block', 'statement');
                block.node = node;
                this._addTextInput(block, 'STATEMENT', this._getSource(node));
                this._addTextInput(block, 'ARGS', this._getSource(rubyBlockArgsNode));
                this._addSubstack(block, this._processStatement(rubyBlockNode));
            } else {
                block = this._createRubyStatementBlock(this._getSource(node), node);
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

    _onSelf (node) {
        return new Primitive('self', 'self', node);
    },

    _onSym (node) {
        this._checkNumChildren(node, 1);

        return new Primitive('sym', node.children[0].toString(), node);
    },

    _onStr (node) {
        this._checkNumChildren(node, 1);

        return new Primitive('str', node.children[0].toString(), node);
    },

    _onInt (node) {
        this._checkNumChildren(node, 1);

        return new Primitive('int', node.children[0], node);
    },

    _onFloat (node) {
        this._checkNumChildren(node, 1);

        return new Primitive('float', node.children[0], node);
    },

    _onTrue (node) {
        const index = (this._context.literalCallIndices.true || 0) + 1;
        this._context.literalCallIndices.true = index;

        const block = this._createBlock('operator_equals', 'value_boolean');
        block.node = node;
        this._addTextInput(block, 'OPERAND1', '1', '1');
        this._addTextInput(block, 'OPERAND2', '1', '1');
        block.comment = this._createComment(`@ruby:literal:true:${index}`, block.id);
        return block;
    },

    _onFalse (node) {
        const index = (this._context.literalCallIndices.false || 0) + 1;
        this._context.literalCallIndices.false = index;

        const block = this._createBlock('operator_lt', 'value_boolean');
        block.node = node;
        this._addTextInput(block, 'OPERAND1', '0', '0');
        this._addTextInput(block, 'OPERAND2', '0', '0');
        block.comment = this._createComment(`@ruby:literal:false:${index}`, block.id);
        return block;
    },

    _onArray (node) {
        return new Primitive('array', node.children.map(childNode => this._process(childNode)), node);
    },

    _onHash (node) {
        return new Primitive('hash', new Map(node.children.map(childNode => this._process(childNode))), node);
    },

    _onNil (node) {
        return new Primitive('nil', Opal.nil, node);
    },

    _onPair (node) {
        this._checkNumChildren(node, 2);

        return node.children.map(childNode => this._process(childNode));
    },

    _onIrange (node) {
        this._checkNumChildren(node, 2);

        const args = node.children.map(childNode => this._process(childNode));
        const block = this._createBlock('ruby_range', 'value_boolean');
        block.node = node;
        this._addNumberInput(block, 'FROM', 'math_number', args[0], 1);
        this._addNumberInput(block, 'TO', 'math_number', args[1], 10);
        return block;
    },

    _onErange (node) {
        this._checkNumChildren(node, 2);

        const args = node.children.map(childNode => this._process(childNode));
        const block = this._createBlock('ruby_exclude_range', 'value_boolean');
        block.node = node;
        this._addNumberInput(block, 'FROM', 'math_number', args[0], 1);
        this._addNumberInput(block, 'TO', 'math_number', args[1], 10);
        return block;
    },

    _onConst (node) {
        this._checkNumChildren(node, 2);

        const value = {
            scope: this._process(node.children[0]),
            name: node.children[1].toString()
        };
        return new Primitive('const', value, node);
    },

    _onArgs (node) {
        return node.children.map(childNode => this._process(childNode));
    },

    _onArg (node) {
        this._checkNumChildren(node, 1);

        return node.children[0];
    },

    _onVar (node, scope) {
        this._checkNumChildren(node, 1);

        const variable = this._lookupOrCreateVariable(node.children[0]);
        const block = this._callConvertersHandler('onVar', scope, variable);
        if (block) {
            return block;
        }

        return node.children[0].toString();
    },

    _onGvar (node) {
        return this._onVar(node, 'global');
    },

    _onIvar (node) {
        return this._onVar(node, 'instance');
    },

    _onLvar (node) {
        this._checkNumChildren(node, 1);

        const originalVarName = node.children[0].toString();
        // Normalize variable name to match how arguments and other locals are stored
        const normalizedVarName = this._toSnakeCaseLowercase(originalVarName);

        // Look up or create local variable using normalized name
        const variable = this._lookupOrCreateVariable(normalizedVarName);

        if (variable) {
            const block = this._callConvertersHandler('onVar', 'local', variable);
            if (block) {
                return block;
            }
        }

        return normalizedVarName;
    }
};

export default ExpressionHandlers;
