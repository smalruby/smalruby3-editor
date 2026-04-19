import {defineMessages} from 'react-intl';
import _ from 'lodash';
import {RubyToBlocksConverterError} from '../errors';
import Primitive from '../primitive';
import ExpressionsLiterals from './expressions-literals';

const messages = defineMessages({
    superNotSupportedInV1: {
        defaultMessage: 'super is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when super is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.superNotSupportedInV1'
    },
    superOutsideMethod: {
        defaultMessage: 'super can only be used inside a method definition (def).',
        description: 'Error message when super is used outside a method',
        id: 'gui.smalruby3.rubyToBlocksConverter.superOutsideMethod'
    },
    superWithoutModuleMethod: {
        defaultMessage: 'super in "{ METHOD }" requires a same-named method in an included module.' +
            '\nDefine "{ METHOD }" in a module and include it in the class.',
        description: 'Error message when super is used but no matching module method exists',
        id: 'gui.smalruby3.rubyToBlocksConverter.superWithoutModuleMethod'
    }
});

/**
 * Expression AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ExpressionHandlers = {
    ...ExpressionsLiterals,

    visitCallNode (node) {
        // === Smalruby: Start of attr_accessor getter/setter resolution ===
        const attrAccessors = this._context.attrAccessors;
        if (attrAccessors) {
            const recvType = node.receiver ? this._getNodeTypeName(node.receiver) : null;
            const isSelfOrNone = !node.receiver || recvType === 'SelfNode';

            // Getter: foo or self.foo (no args, no block)
            if (isSelfOrNone &&
                (!node.arguments_ || node.arguments_.arguments_.length === 0) &&
                !node.block) {
                const attrKind = attrAccessors[node.name];
                if (attrKind === 'accessor' || attrKind === 'reader') {
                    return this._onVar(`@${node.name}`, 'instance', node);
                }
            }

            // Setter: self.foo = val (name ends with =, 1 arg)
            if (node.name.endsWith('=') &&
                recvType === 'SelfNode' &&
                node.arguments_ && node.arguments_.arguments_.length === 1) {
                const baseName = node.name.slice(0, -1);
                const attrKind = attrAccessors[baseName];
                if (attrKind === 'accessor' || attrKind === 'writer') {
                    const variable = this._lookupOrCreateVariable(`@${baseName}`);
                    const savedIsValue = this._context.isValue;
                    this._context.isValue = true;
                    let rh = this.visit(node.arguments_.arguments_[0]);
                    this._context.isValue = savedIsValue;
                    const s = this._splitPreBlocksAndValue(rh);
                    rh = s.value;
                    const preBlks = s.preBlocks;
                    const block = this._callConvertersHandler('onVasgn', 'instance', variable, rh);
                    if (block) {
                        if (preBlks.length > 0) {
                            return [...preBlks, ...(_.isArray(block) ? block : [block])];
                        }
                        return block;
                    }
                }
            }
        }
        // === Smalruby: End of attr_accessor getter/setter resolution ===

        // === Smalruby: Start of Array.new / Hash.new constructor ===
        if (node.name === 'new' && node.receiver) {
            const recvType = this._getNodeTypeName(node.receiver);
            if (recvType === 'ConstantReadNode') {
                const className = node.receiver.name;
                const ctorArgs = node.arguments_ ? node.arguments_.arguments_ : [];

                if (className === 'Array') {
                    if (ctorArgs.length === 0) {
                        return new Primitive('array', [], node);
                    }
                    if (ctorArgs.length <= 2) {
                        const sizeNode = ctorArgs[0];
                        const sizeType = this._getNodeTypeName(sizeNode);
                        if (sizeType === 'IntegerNode') {
                            const size = sizeNode.value;
                            const fillVal = ctorArgs.length === 2
                                ? this.visit(ctorArgs[1])
                                : '';
                            const items = Array.from({length: size}, () => fillVal);
                            return new Primitive('array', items, node);
                        }
                    }
                }

                if (className === 'Hash') {
                    if (ctorArgs.length === 0) {
                        return new Primitive('hash', new Map(), node);
                    }
                    // Hash.new(default) → error
                    throw new RubyToBlocksConverterError(
                        node,
                        `Hash.new(${this._getSource(ctorArgs[0])}) — ` +
                        'ハッシュのデフォルト値には対応していません。{} を使ってください。'
                    );
                }
            }
        }
        // === Smalruby: End of Array.new / Hash.new constructor ===

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

        // === Smalruby: Start of auto-split method call return value ===
        // When a smalrubyRuby method COMMAND block is used in a value context
        // (e.g. say("hello".reverse)), split into:
        //   1. The COMMAND block (as a pre-block)
        //   2. A returnValue REPORTER (as the value)
        if (block && this._isBlock(block) &&
            typeof block.opcode === 'string' &&
            /^smalrubyRuby_\w+Method$/.test(block.opcode)) {
            // Skip auto-split for bang methods (they are statements, not expressions)
            const method = block.fields && block.fields.METHOD && block.fields.METHOD.value;
            if (!method || !method.endsWith('!')) {
                const rvBlock = this._createBlock('smalrubyRuby_returnValue', 'value');
                preBlocks.push(block);
                block = rvBlock;
            }
        }
        // === Smalruby: End of auto-split method call return value ===

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
    },

    /**
     * Handle super(args) call - SuperNode from `@ruby`/prism.
     * super is syntactic sugar for calling the same-named method in an included module.
     * @param {object} node - SuperNode AST node
     * @returns {object} procedures_call block for the module method
     */
    visitSuperNode (node) {
        return this._handleSuper(node, false);
    },

    /**
     * Handle bare super call (forwarding args) - ForwardingSuperNode from `@ruby`/prism.
     * @param {object} node - ForwardingSuperNode AST node
     * @returns {object} procedures_call block for the module method
     */
    visitForwardingSuperNode (node) {
        return this._handleSuper(node, true);
    },

    /**
     * Common handler for SuperNode and ForwardingSuperNode.
     * @param {object} node - AST node
     * @param {boolean} isForwarding - true for bare super (forward all args)
     * @returns {object} procedures_call block
     */
    _handleSuper (node, isForwarding) {
        // Validate: v1 not supported
        if (String(this.version) === '1') {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.superNotSupportedInV1)
            );
        }

        // Validate: must be inside a method definition
        const procedureName = this._context.currentProcedureName;
        if (!procedureName) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.superOutsideMethod)
            );
        }

        // Validate: a same-named method must exist in an included module
        const superInfo = this._context.superMethodMap && this._context.superMethodMap[procedureName];
        if (!superInfo) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.superWithoutModuleMethod, {METHOD: procedureName})
            );
        }

        // Get the renamed module procedure
        const renamedProcName = superInfo.renamedProcName;
        const procedure = this._lookupProcedure(renamedProcName);
        if (!procedure) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.superWithoutModuleMethod, {METHOD: procedureName})
            );
        }

        // Build arguments
        let args;
        if (isForwarding) {
            // Forward all arguments from the current method
            const currentProc = this._lookupProcedure(procedureName);
            if (currentProc) {
                args = currentProc.argumentVariables.map(v => {
                    const block = this._callConvertersHandler('onVar', 'local', v);
                    return block || v.name;
                });
            } else {
                args = [];
            }
        } else {
            // Explicit arguments from super(a, b, ...)
            const savedIsValue = this._context.isValue;
            this._context.isValue = true;
            args = (node.arguments_ ? node.arguments_.arguments_ : []).map(
                childNode => this.visit(childNode)
            );
            this._context.isValue = savedIsValue;
        }

        // Create procedures_call block directly (not via callMethod) to avoid
        // side effects like argument boolean type conversion
        const callBlock = this._createBlock('procedures_call', 'statement', {
            mutation: {
                argumentids: JSON.stringify(procedure.argumentIds),
                proccode: procedure.procCode.join(' '),
                tagName: 'mutation',
                children: [],
                warp: 'false'
            }
        });

        // Add arguments as inputs
        for (let i = 0; i < procedure.argumentIds.length; i++) {
            const inputId = procedure.argumentIds[i];
            const arg = i < args.length ? args[i] : procedure.argumentDefaults[i];
            if (this._isNumberOrBlock(arg) || this._isStringOrBlock(arg)) {
                this._addTextInput(callBlock, inputId, this._isNumber(arg) ? arg.toString() : arg,
                    procedure.argumentDefaults[i] || '');
            } else if (this._isFalse(arg)) {
                // boolean false: don't add input (default)
            } else {
                this._addInput(callBlock, inputId, arg, null);
            }
        }

        // Track this call for procedure boolean detection
        if (!this._context.procedureCallBlocks[procedure.id]) {
            this._context.procedureCallBlocks[procedure.id] = [];
        }
        this._context.procedureCallBlocks[procedure.id].push(callBlock.id);

        // Attach @ruby:super or @ruby:super:forwarding comment
        const commentText = isForwarding ? '@ruby:super:forwarding' : '@ruby:super';
        callBlock.comment = this._createComment(commentText, callBlock.id);

        return callBlock;
    }
};

export default ExpressionHandlers;
