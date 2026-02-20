import _ from 'lodash';
import Primitive from '../primitive';

/**
 * Expression AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ExpressionHandlers = {
    visitCallNode (node) {
        const saved = this._saveContext();

        const preBlocks = [];
        let receiver = this.visit(node.receiver);
        const split = this._splitPreBlocksAndValue(receiver);
        receiver = split.value;
        preBlocks.push(...split.preBlocks);

        const name = node.name;
        const args = (node.arguments_ ? node.arguments_.arguments_ : []).map(childNode => {
            const result = this.visit(childNode);
            const s = this._splitPreBlocksAndValue(result);
            preBlocks.push(...s.preBlocks);
            return s.value;
        });

        let rubyBlockArgs;
        if (node.block && node.block.parameters) {
            rubyBlockArgs = this.visit(node.block.parameters);
        }

        let rubyBlock;
        if (node.block) {
            rubyBlock = this._processStatement(node.block.body);
            if (typeof rubyBlock === 'undefined') {
                rubyBlock = null;
            }
        }

        let block = this.callMethod(receiver, name, args, rubyBlockArgs, rubyBlock, node);
        if (!block) {
            block = this._callConvertersHandler('onSend', receiver, name, args, rubyBlockArgs, rubyBlock, node);
        }
        if (!block) {
            if ((this._isSelf(receiver) || receiver === null) && !rubyBlock) {
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

            if (node.block) {
                block = this._createBlock('ruby_statement_with_block', 'statement');
                block.node = node;
                this._addTextInput(block, 'STATEMENT', this._getSource(node));
                this._addTextInput(block, 'ARGS', node.block.parameters ? this._getSource(node.block.parameters) : '');
                this._addSubstack(block, this._processStatement(node.block.body));
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

    visitSelfNode (node) {
        return new Primitive('self', 'self', node);
    },

    visitSymbolNode (node) {
        return new Primitive('sym', node.unescaped.value, node);
    },

    visitStringNode (node) {
        return new Primitive('str', node.unescaped.value, node);
    },

    visitIntegerNode (node) {
        return new Primitive('int', node.value, node);
    },

    visitFloatNode (node) {
        return new Primitive('float', node.value, node);
    },

    visitTrueNode (node) {
        const index = (this._context.literalCallIndices.true || 0) + 1;
        this._context.literalCallIndices.true = index;

        const block = this._createBlock('operator_equals', 'value_boolean');
        block.node = node;
        this._addTextInput(block, 'OPERAND1', '1', '1');
        this._addTextInput(block, 'OPERAND2', '1', '1');
        block.comment = this._createComment(`@ruby:literal:true:${index}`, block.id);
        return block;
    },

    visitFalseNode (node) {
        const index = (this._context.literalCallIndices.false || 0) + 1;
        this._context.literalCallIndices.false = index;

        const block = this._createBlock('operator_lt', 'value_boolean');
        block.node = node;
        this._addTextInput(block, 'OPERAND1', '0', '0');
        this._addTextInput(block, 'OPERAND2', '0', '0');
        block.comment = this._createComment(`@ruby:literal:false:${index}`, block.id);
        return block;
    },

    visitArrayNode (node) {
        return new Primitive('array', node.elements.map(childNode => this.visit(childNode)), node);
    },

    visitHashNode (node) {
        // Prism HashNode has elements which are AssocNode or AssocSplatNode
        const elements = new Map();
        node.elements.forEach(element => {
            if (element.constructor.name === 'AssocNode') {
                elements.set(this.visit(element.key), this.visit(element.value));
            }
        });
        return new Primitive('hash', elements, node);
    },

    visitNilNode (node) {
        return new Primitive('nil', null, node);
    },

    visitAssocNode (node) {
        return [this.visit(node.key), this.visit(node.value)];
    },

    visitRangeNode (node) {
        const left = this.visit(node.left);
        const right = this.visit(node.right);
        const opcode = node.isExcludeEnd() ? 'ruby_exclude_range' : 'ruby_range';
        const block = this._createBlock(opcode, 'value_boolean');
        block.node = node;
        this._addNumberInput(block, 'FROM', 'math_number', left, 1);
        this._addNumberInput(block, 'TO', 'math_number', right, 10);
        return block;
    },

    visitConstantReadNode (node) {
        const value = {
            scope: null,
            name: node.name
        };
        return new Primitive('const', value, node);
    },

    visitConstantPathNode (node) {
        const value = {
            scope: this.visit(node.parent),
            name: node.child.name
        };
        return new Primitive('const', value, node);
    },

    visitBlockParametersNode (node) {
        return (node.parameters ? node.parameters.requireds : []).map(childNode => this.visit(childNode));
    },

    visitRequiredParameterNode (node) {
        return node.name;
    },

    visitGlobalVariableReadNode (node) {
        return this._onVar(node.name, 'global', node);
    },

    visitInstanceVariableReadNode (node) {
        return this._onVar(node.name, 'instance', node);
    },

    visitLocalVariableReadNode (node) {
        const originalVarName = node.name;
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
    },

    _onVar (name, scope, node) {
        const variable = this._lookupOrCreateVariable(name);
        const block = this._callConvertersHandler('onVar', scope, variable);
        if (block) {
            return block;
        }

        return name;
    }
};

export default ExpressionHandlers;
