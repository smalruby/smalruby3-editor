import _ from 'lodash';
import Primitive from '../primitive';
import {RubyToBlocksConverterError} from '../errors';

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
        const savedIsValue = this._context.isValue;
        this._context.isValue = true;
        const args = (node.arguments_ ? node.arguments_.arguments_ : []).map(childNode => {
            const result = this.visit(childNode);
            const s = this._splitPreBlocksAndValue(result);
            preBlocks.push(...s.preBlocks);
            return s.value;
        });
        this._context.isValue = savedIsValue;

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

            const arithmeticOps = ['+', '-', '*', '/', '%', '**'];
            const comparisonOps = ['>', '<', '>=', '<='];
            const isSymReceiver = this._isPrimitive(receiver) && receiver.type === 'sym';
            const symbolArg = args.find(a => this._isPrimitive(a) && a.type === 'sym');

            // Symbol in arithmetic → specific error
            if (arithmeticOps.indexOf(name) >= 0 && (isSymReceiver || symbolArg)) {
                const source = this._truncateSource(this._getSource(node));
                const sym = isSymReceiver ? receiver : symbolArg;
                const suggestion = source.replace(
                    `:${sym.value}`,
                    `:${sym.value}.to_s`
                );
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(this._symbolCannotArithmeticMessage(), {
                        SOURCE: source,
                        SUGGESTION: suggestion
                    })
                );
            }

            // Symbol in comparison with non-symbol → specific error
            if (comparisonOps.indexOf(name) >= 0 && (isSymReceiver || symbolArg)) {
                const source = this._truncateSource(this._getSource(node));
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(this._symbolCannotCompareMessage(), {SOURCE: source})
                );
            }

            // Symbol in other contexts → needs .to_s
            if (symbolArg) {
                const source = this._truncateSource(this._getSource(node));
                const suggestion = source.replace(
                    `:${symbolArg.value}`,
                    `:${symbolArg.value}.to_s`
                );
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(this._symbolNeedsToSMessage(), {
                        SOURCE: source,
                        SUGGESTION: suggestion
                    })
                );
            }

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

    visitKeywordHashNode (node) {
        // Prism KeywordHashNode is used for keyword arguments without braces, e.g. foo(secs: 5)
        // Elements are AssocNode with SymbolNode keys
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

    visitParenthesesNode (node) {
        // Parenthesized expression e.g. (1), (x + 1), (a; b; c)
        // Delegate to the inner StatementsNode so chaining/sequencing is handled correctly
        if (node.body) {
            return this.visit(node.body);
        }
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
            name: node.name
        };
        return new Primitive('const', value, node);
    },

    visitReturnNode (node) {
        const procedureName = this._context.currentProcedureName;
        if (!procedureName) {
            return this._createRubyStatementBlock(this._getSource(node), node);
        }

        // Get return value (first argument of the return node, or nil)
        const args = node.arguments_ && node.arguments_.arguments_;
        let returnValue;
        if (args && args.length > 0) {
            returnValue = this.visit(args[0]);
        }

        // Create assign block: @_return_procedureName_ = returnValue
        const variable = this._lookupOrCreateVariable(`@_return_${procedureName}_`);
        const assignBlock = this._createBlock('data_setvariableto', 'statement', {
            fields: {
                VARIABLE: {
                    name: 'VARIABLE',
                    id: variable.id,
                    value: variable.name,
                    variableType: variable.type
                }
            }
        });
        assignBlock.comment = this._createComment(
            `@ruby:syntax:return @ruby:return:${procedureName}`, assignBlock.id
        );
        if (returnValue) {
            this._addTextInput(
                assignBlock, 'VALUE', this._isNumber(returnValue) ? returnValue.toString() : returnValue, '0'
            );
        } else {
            this._addTextInput(assignBlock, 'VALUE', '', '0');
        }

        // Create stop block: control_stop "this script"
        const stopBlock = this._createBlock('control_stop', 'terminate', {
            fields: {
                STOP_OPTION: {
                    name: 'STOP_OPTION',
                    value: 'this script'
                }
            },
            mutation: {
                hasnext: 'false',
                tagName: 'mutation',
                children: []
            }
        });
        stopBlock.comment = this._createComment('@ruby:syntax:return', stopBlock.id);

        return [assignBlock, stopBlock];
    },

    visitParametersNode (node) {
        // Used for method definition parameters: def foo(arg1, arg2)
        return (node.requireds || []).map(childNode => this.visit(childNode));
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
