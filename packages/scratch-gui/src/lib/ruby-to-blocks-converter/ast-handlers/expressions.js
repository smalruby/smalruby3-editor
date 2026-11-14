import _ from 'lodash';
import { defineMessages } from 'react-intl';
import { RubyToBlocksConverterError } from '../errors';
import Primitive from '../primitive';
import ExpressionsLiterals from './expressions-literals';

const messages = defineMessages({
    superNotSupportedInV1: {
        defaultMessage:
            'super is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when super is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.superNotSupportedInV1',
    },
    superOutsideMethod: {
        defaultMessage: 'super can only be used inside a method definition (def).',
        description: 'Error message when super is used outside a method',
        id: 'gui.smalruby3.rubyToBlocksConverter.superOutsideMethod',
    },
    superWithoutModuleMethod: {
        defaultMessage:
            'super in "{ METHOD }" requires a same-named method in an included module.' +
            '\nDefine "{ METHOD }" in a module and include it in the class.',
        description: 'Error message when super is used but no matching module method exists',
        id: 'gui.smalruby3.rubyToBlocksConverter.superWithoutModuleMethod',
    },
    visibilityNotSupported: {
        defaultMessage: '"{ NAME }" is not supported in Smalruby.\nDelete "{ SOURCE }".',
        description:
            'Error message when private / protected / public is written (with no argument or with ' +
            'method names such as private :foo)',
        id: 'gui.smalruby3.rubyToBlocksConverter.visibilityNotSupported',
    },
    visibilityDefNotSupported: {
        defaultMessage:
            '"{ NAME }" is not supported in Smalruby.' +
            '\nDelete "{ NAME }". Then the method from "{ DEF }" to its "end" can be used.',
        description:
            'Error message when a method definition is written with private / protected / public ' +
            '(e.g. private def foo ... end)',
        id: 'gui.smalruby3.rubyToBlocksConverter.visibilityDefNotSupported',
    },
    superWithoutReturnValue: {
        defaultMessage:
            '"{ SOURCE }" is used as a value, but "{ METHOD }" of { MODULE } does not return a value.' +
            '\nReturn a value in "{ METHOD }" of { MODULE } (e.g. return a), or write "{ SOURCE }" on a line by itself.',
        description:
            'Error message when the value of super is used (e.g. return super) but the method of the module ' +
            'that super calls does not return a value',
        id: 'gui.smalruby3.rubyToBlocksConverter.superWithoutReturnValue',
    },
    superTwiceInLine: {
        defaultMessage:
            'The value of super is used more than once in a line.' +
            '\nWith blocks, the value of the first super would be overwritten by the next one.' +
            '\nSave the value in a variable first (e.g. x = super), then use the variable.',
        description:
            'Error message when the value of super is used twice or more in a line (e.g. return super + super)',
        id: 'gui.smalruby3.rubyToBlocksConverter.superTwiceInLine',
    },
});

// No block can hold the visibility of a method, so these are rejected wherever they are written (#1561).
const VISIBILITY_MODIFIERS = ['private', 'protected', 'public'];

/**
 * Expression AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ExpressionHandlers = {
    ...ExpressionsLiterals,

    /**
     * Throw an error when the node is `private` / `protected` / `public` (with or without arguments).
     * @param {object} node - A node of a line.
     */
    _rejectVisibilityModifier(node) {
        if (
            this._getNodeTypeName(node) !== 'CallNode' ||
            node.receiver ||
            !VISIBILITY_MODIFIERS.includes(node.name)
        ) {
            return;
        }
        // A custom block (def private ... end) may be named private; calling it is not a visibility modifier.
        if (this._lookupProcedure(node.name)) {
            return;
        }
        const args = node.arguments_ ? node.arguments_.arguments_ : [];
        const defNode = args.length === 1 && this._getNodeTypeName(args[0]) === 'DefNode' ? args[0] : null;
        const message = defNode
            ? this._translator(messages.visibilityDefNotSupported, {
                  NAME: node.name,
                  DEF: this._firstLineSource(defNode),
              })
            : this._translator(messages.visibilityNotSupported, {
                  NAME: node.name,
                  SOURCE: this._truncateSource(this._firstLineSource(node)),
              });
        throw new RubyToBlocksConverterError(node, message);
    },

    visitCallNode(node) {
        this._rejectVisibilityModifier(node);

        // === Smalruby: Start of attr_accessor getter/setter resolution ===
        const attrAccessors = this._context.attrAccessors;
        if (attrAccessors) {
            const recvType = node.receiver ? this._getNodeTypeName(node.receiver) : null;
            const isSelfOrNone = !node.receiver || recvType === 'SelfNode';

            // Getter: foo or self.foo (no args, no block)
            if (isSelfOrNone && (!node.arguments_ || node.arguments_.arguments_.length === 0) && !node.block) {
                const attrKind = attrAccessors[node.name];
                if (attrKind === 'accessor' || attrKind === 'reader') {
                    return this._onVar(`@${node.name}`, 'instance', node);
                }
            }

            // Setter: self.foo = val (name ends with =, 1 arg)
            if (
                node.name.endsWith('=') &&
                recvType === 'SelfNode' &&
                node.arguments_ &&
                node.arguments_.arguments_.length === 1
            ) {
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
                            const fillVal = ctorArgs.length === 2 ? this.visit(ctorArgs[1]) : '';
                            const items = Array.from({ length: size }, () => fillVal);
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
                            'ハッシュのデフォルト値には対応していません。{} を使ってください。',
                    );
                }
            }
        }
        // === Smalruby: End of Array.new / Hash.new constructor ===

        const saved = this._saveContext();

        const preBlocks = [];
        // The receiver is a value too (e.g. `bar(1)` / `super` of `super + 1`): a call of a method that
        // returns a value becomes the call followed by its return variable, as an argument does (#1568).
        const savedIsValueForReceiver = this._context.isValue;
        this._context.isValue = true;
        let receiver;
        try {
            receiver = this.visit(node.receiver);
        } finally {
            this._context.isValue = savedIsValueForReceiver;
        }
        const split = this._splitPreBlocksAndValue(receiver);
        receiver = split.value;
        preBlocks.push(...split.preBlocks);

        const name = node.name;
        const savedIsValue = this._context.isValue;
        this._context.isValue = true;
        const args = (node.arguments_ ? node.arguments_.arguments_ : []).map((childNode) => {
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

        // A receiver or an argument that is not a value (e.g. `(a = 2)` of `(a = 2).to_s`), or a value
        // before it in parentheses (e.g. `a` of `(a; b)`), makes the call one that cannot be converted,
        // like `say(a = 2)`: put in an input, the command or the value was lost without an error (issue #1691).
        // The loop of `loop.with_screen_refresh` / `N.times.with_screen_refresh` is a command by design.
        const hasCommandValue =
            (this._isCommandValue(receiver) && !this._isLoopToChain(receiver, name)) ||
            args.some((a) => this._isCommandValue(a)) ||
            this._hasLostPreBlock(preBlocks);

        let block = null;
        if (!hasCommandValue) {
            block = this.callMethod(receiver, name, args, rubyBlockArgs, rubyBlock, node);
            if (!block) {
                block = this._callConvertersHandler('onSend', receiver, name, args, rubyBlockArgs, rubyBlock, node);
            }
        }

        // === Smalruby: Start of auto-split method call return value ===
        // When a smalrubyRuby method COMMAND block is used in a value context
        // (e.g. say("hello".reverse)), split into:
        //   1. The COMMAND block (as a pre-block)
        //   2. A returnValue REPORTER (as the value)
        if (
            block &&
            this._isBlock(block) &&
            typeof block.opcode === 'string' &&
            /^smalrubyRuby_\w+Method$/.test(block.opcode)
        ) {
            // Skip auto-split for bang methods (they are statements, not expressions)
            const method = block.fields && block.fields.METHOD && block.fields.METHOD.value;
            if (!method || !method.endsWith('!')) {
                const rvBlock = this._createBlock('smalrubyRuby_returnValue', 'value');
                this._recordReturnValueSource(rvBlock, block);
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
            const symbolArg = args.find((a) => this._isPrimitive(a) && a.type === 'sym');

            // Symbol in arithmetic → specific error
            if (arithmeticOps.indexOf(name) >= 0 && (isSymReceiver || symbolArg)) {
                const source = this._truncateSource(this._getSource(node));
                const sym = isSymReceiver ? receiver : symbolArg;
                const suggestion = source.replace(`:${sym.value}`, `:${sym.value}.to_s`);
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(this._symbolCannotArithmeticMessage(), {
                        SOURCE: source,
                        SUGGESTION: suggestion,
                    }),
                );
            }

            // Symbol in comparison with non-symbol → specific error
            if (comparisonOps.indexOf(name) >= 0 && (isSymReceiver || symbolArg)) {
                const source = this._truncateSource(this._getSource(node));
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(this._symbolCannotCompareMessage(), { SOURCE: source }),
                );
            }

            // Symbol in other contexts → needs .to_s
            if (symbolArg) {
                const source = this._truncateSource(this._getSource(node));
                const suggestion = source.replace(`:${symbolArg.value}`, `:${symbolArg.value}.to_s`);
                throw new RubyToBlocksConverterError(
                    node,
                    this._translator(this._symbolNeedsToSMessage(), {
                        SOURCE: source,
                        SUGGESTION: suggestion,
                    }),
                );
            }

            if (node.block) {
                block = this._createBlock('ruby_statement_with_block', 'statement');
                block.node = node;
                this._addTextInput(block, 'STATEMENT', this._getSource(node));
                this._addTextInput(
                    block,
                    'ARGS',
                    node.block.parameters ? this._getSource(node.block.parameters) : '',
                );
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

    visitReturnNode(node) {
        const procedureName = this._context.currentProcedureName;
        if (!procedureName) {
            return this._createRubyStatementBlock(this._getSource(node), node);
        }

        // Get return value (first argument of the return node, or nil)
        const args = node.arguments_ && node.arguments_.arguments_;
        let returnValue;
        if (args && args.length > 1) {
            // Only one value can be returned through blocks, so the others would be lost (issue #1553).
            throw this._returnMultipleValuesError(node, args[0]);
        }
        let preBlocks = [];
        let parenthesized = false;
        if (args && args.length > 0) {
            // `return (x + 1)`: the value in the parentheses is returned, and a marker brings the
            // parentheses back (issue #1557). More than one line in them (e.g. `(move(10); 1)`) is an error.
            let valueNode = args[0];
            while (this._getNodeTypeName(valueNode) === 'ParenthesesNode') {
                const statements = this._parenthesesStatements(valueNode);
                if (statements.length !== 1) {
                    throw this._cannotReturnError(args[0]);
                }
                parenthesized = true;
                valueNode = statements[0];
            }
            // A `return` with a value makes the method one that returns a value. Mark it now, so that a call
            // of the method itself in the value (e.g. `return fact(n - 1) * n`) is a call that returns a value.
            const procedure = this._lookupProcedure(procedureName);
            if (procedure) {
                procedure.hasReturnValue = true;
            }
            // Visit the value as a value, like an argument of `say(...)`: a call of a method that returns
            // a value becomes the call followed by its return variable (issue #1556).
            const savedIsValue = this._context.isValue;
            this._context.isValue = true;
            let visited;
            try {
                visited = this.visit(valueNode);
            } finally {
                this._context.isValue = savedIsValue;
            }
            const split = this._splitPreBlocksAndValue(visited);
            preBlocks = split.preBlocks;
            returnValue = split.value;
            // A value no block can hold (e.g. `self`, `[1, 2]`, `"#{x}"`) or a command (e.g. `x = 1`)
            // would be dropped or become "" (issue #1553).
            const isCommand = this._isBlock(returnValue) && !this._isValueBlock(returnValue);
            if (
                returnValue === null ||
                typeof returnValue === 'undefined' ||
                isCommand ||
                this._isUnreturnableValue(returnValue)
            ) {
                throw this._cannotReturnError(args[0]);
            }
            // A list has no value block that keeps it a list: it would become 0 (issue #1557).
            if (this._isListValue(returnValue)) {
                throw this._cannotReturnListError(args[0]);
            }
        }

        // Create assign block: @_return_procedureName_ = returnValue
        const variable = this._lookupOrCreateVariable(`@_return_${procedureName}_`);
        const assignBlock = this._createBlock('data_setvariableto', 'statement', {
            fields: {
                VARIABLE: {
                    name: 'VARIABLE',
                    id: variable.id,
                    value: variable.name,
                    variableType: variable.type,
                },
            },
        });
        // `return nil` / `return :a` keeps the text "" / "a" and a marker to come back as written (issue #1548).
        // `return` without a value keeps the text "" too, and a marker to come back as `return` (issue #1553).
        let literalMarker = returnValue ? '' : ',@ruby:return-bare';
        // The parentheses marker comes before the nil / symbol one: the symbol one runs to the end.
        const parenMarker = parenthesized ? ',@ruby:return-paren' : '';
        if (this._isPrimitive(returnValue) && (returnValue.type === 'nil' || returnValue.type === 'sym')) {
            const isNil = returnValue.type === 'nil';
            // A comment keeps one line for the marker, so a symbol with a line break stays a string.
            if (isNil || !/[\r\n]/.test(returnValue.value)) {
                literalMarker = isNil ? ',@ruby:nil' : `,@ruby:symbol:${returnValue.value}`;
            }
            // The text itself goes in the input, as `return ""` does: a text block put there got a `0`
            // shadow behind it, which no script reached (issue #1866).
            returnValue = isNil ? '' : returnValue.value.toString();
        }
        assignBlock.comment = this._createComment(
            `@ruby:syntax:return @ruby:return:${procedureName}${parenMarker}${literalMarker}`,
            assignBlock.id,
        );
        if (returnValue) {
            this._addTextInput(
                assignBlock,
                'VALUE',
                this._isNumber(returnValue) ? returnValue.toString() : returnValue,
                '0',
            );
        } else {
            this._addTextInput(assignBlock, 'VALUE', '', '0');
        }

        // Create stop block: control_stop "this script"
        const stopBlock = this._createBlock('control_stop', 'terminate', {
            fields: {
                STOP_OPTION: {
                    name: 'STOP_OPTION',
                    value: 'this script',
                },
            },
            mutation: {
                hasnext: 'false',
                tagName: 'mutation',
                children: [],
            },
        });
        stopBlock.comment = this._createComment('@ruby:syntax:return', stopBlock.id);

        return [...preBlocks, assignBlock, stopBlock];
    },

    visitParametersNode(node) {
        // Used for method definition parameters: def foo(arg1, arg2)
        return (node.requireds || []).map((childNode) => this.visit(childNode));
    },

    visitBlockParametersNode(node) {
        return (node.parameters ? node.parameters.requireds : []).map((childNode) => this.visit(childNode));
    },

    visitRequiredParameterNode(node) {
        return node.name;
    },

    visitGlobalVariableReadNode(node) {
        return this._onVar(node.name, 'global', node);
    },

    visitInstanceVariableReadNode(node) {
        return this._onVar(node.name, 'instance', node);
    },

    visitLocalVariableReadNode(node) {
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

    _onVar(name, scope, node) {
        // `@a` that is a list reads the list itself (issue #1622): the sprite has only the list `a`,
        // the code uses `@a` as a list, or it is `@_a_list_`. Ruby version 1 reads a list with
        // `list("@a")`, so there a read stays a variable read (the applier still reads the list
        // that this code makes, issue #1567).
        if (
            this.version >= 2 &&
            (scope === 'global' || scope === 'instance') &&
            this._kindOfRubyName(name) === 'list'
        ) {
            const list = this._lookupOrCreateList(name);
            const listBlock = this._createBlock('data_listcontents', 'value_variable', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: list.id,
                        value: list.name,
                        variableType: list.type,
                    },
                },
            });
            // A read of `@a` in Ruby, whose index is from 0 (see `convertToListBlock`)
            this._context.listReadBlockIds.add(listBlock.id);
            return listBlock;
        }
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
    visitSuperNode(node) {
        return this._handleSuper(node, false);
    },

    /**
     * Handle bare super call (forwarding args) - ForwardingSuperNode from `@ruby`/prism.
     * @param {object} node - ForwardingSuperNode AST node
     * @returns {object} procedures_call block for the module method
     */
    visitForwardingSuperNode(node) {
        return this._handleSuper(node, true);
    },

    /**
     * Common handler for SuperNode and ForwardingSuperNode.
     * @param {object} node - AST node
     * @param {boolean} isForwarding - true for bare super (forward all args)
     * @returns {object} procedures_call block
     */
    _handleSuper(node, isForwarding) {
        // Validate: v1 not supported
        if (String(this.version) === '1') {
            throw new RubyToBlocksConverterError(node, this._translator(messages.superNotSupportedInV1));
        }

        // Validate: must be inside a method definition
        const procedureName = this._context.currentProcedureName;
        if (!procedureName) {
            throw new RubyToBlocksConverterError(node, this._translator(messages.superOutsideMethod));
        }

        // Validate: a same-named method must exist in an included module
        const superInfo = this._context.superMethodMap && this._context.superMethodMap[procedureName];
        if (!superInfo) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.superWithoutModuleMethod, { METHOD: procedureName }),
            );
        }

        // Get the renamed module procedure
        const renamedProcName = superInfo.renamedProcName;
        const procedure = this._lookupProcedure(renamedProcName);
        if (!procedure) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.superWithoutModuleMethod, { METHOD: procedureName }),
            );
        }

        // Build arguments
        let args;
        if (isForwarding) {
            // Forward all arguments from the current method
            const currentProc = this._lookupProcedure(procedureName);
            if (currentProc) {
                args = currentProc.argumentVariables.map((v) => {
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
            args = (node.arguments_ ? node.arguments_.arguments_ : []).map((childNode) => this.visit(childNode));
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
                warp: 'false',
            },
        });

        // Add arguments as inputs
        for (let i = 0; i < procedure.argumentIds.length; i++) {
            const inputId = procedure.argumentIds[i];
            const arg = i < args.length ? args[i] : procedure.argumentDefaults[i];
            if (this._isNumberOrBlock(arg) || this._isStringOrBlock(arg)) {
                this._addTextInput(
                    callBlock,
                    inputId,
                    this._isNumber(arg) ? arg.toString() : arg,
                    procedure.argumentDefaults[i] || '',
                );
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
        if (this.isValueContext()) {
            return this._superValueBlocks(node, callBlock, commentText, superInfo, procedure);
        }
        callBlock.comment = this._createComment(commentText, callBlock.id);

        return callBlock;
    },

    /**
     * The blocks of super used as a value (e.g. `return super + 1`): the call, then a read of the return
     * variable of the module method, as `return bar + 1` does (issue #1568).
     * @param {object} node - The super node.
     * @param {object} callBlock - The procedures_call block of the module method.
     * @param {string} commentText - `@ruby`:super or `@ruby`:super:forwarding.
     * @param {object} superInfo - The module name and the renamed procedure name.
     * @param {object} procedure - The renamed procedure of the module method.
     * @returns {Array} The call block and the data_variable block of the value.
     */
    _superValueBlocks(node, callBlock, commentText, superInfo, procedure) {
        const source = this._firstLineSource(node);
        const methodName = this._context.currentProcedureName;
        if (!procedure.hasReturnValue) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.superWithoutReturnValue, {
                    SOURCE: source,
                    METHOD: methodName,
                    MODULE: superInfo.moduleName,
                }),
            );
        }
        // All the super in a line share one return variable, so a second one would overwrite the first.
        const renamedProcName = superInfo.renamedProcName;
        const indexKey = `super:${renamedProcName}`;
        const index = (this._context.methodCallIndices[indexKey] || 0) + 1;
        this._context.methodCallIndices[indexKey] = index;
        if (index > 1) {
            throw new RubyToBlocksConverterError(node, this._translator(messages.superTwiceInLine));
        }

        const returnComment = `@ruby:return:${renamedProcName}`;
        callBlock.comment = this._createComment(`${commentText},${returnComment}`, callBlock.id);
        const variable = this._lookupOrCreateVariable(`@_return_${renamedProcName}_`);
        const varBlock = this._createBlock('data_variable', 'value_variable', {
            fields: {
                VARIABLE: {
                    name: 'VARIABLE',
                    id: variable.id,
                    value: variable.name,
                    variableType: variable.type,
                },
            },
        });
        varBlock.comment = this._createComment(returnComment, varBlock.id);
        return [callBlock, varBlock];
    },
};

export default ExpressionHandlers;
