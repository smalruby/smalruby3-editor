import _ from 'lodash';

/**
 * Mixin for converter registration and execution methods.
 */
const ConverterRegistry = {
    registerOnSendWithBlock(receiverName, name, numArgs, numRubyBlockArgs, createBlockFunc) {
        if (receiverName === 'any') {
            this._anyReceiverNames().forEach((rn) => {
                this.registerOnSendWithBlock(rn, name, numArgs, numRubyBlockArgs, createBlockFunc);
            });
            return;
        }

        if (_.isArray(receiverName)) {
            receiverName.forEach((rn) => {
                this.registerOnSendWithBlock(rn, name, numArgs, numRubyBlockArgs, createBlockFunc);
            });
            return;
        }

        if (receiverName === 'self') {
            this.registerOnSendWithBlock('sprite', name, numArgs, numRubyBlockArgs, createBlockFunc);
            this.registerOnSendWithBlock('stage', name, numArgs, numRubyBlockArgs, createBlockFunc);
            return;
        }

        // If numArgs is an array, register for each value
        if (_.isArray(numArgs)) {
            numArgs.forEach((n) => {
                this.registerOnSendWithBlock(receiverName, name, n, numRubyBlockArgs, createBlockFunc);
            });
            return;
        }

        let methodToNumArgs = this._receiverToMethods[receiverName];
        if (!methodToNumArgs) methodToNumArgs = this._receiverToMethods[receiverName] = Object.create(null);

        let numArgsToNumRubyBlockArgs = methodToNumArgs[name];
        if (!numArgsToNumRubyBlockArgs) numArgsToNumRubyBlockArgs = methodToNumArgs[name] = Object.create(null);

        let numRubyBlockArgsToCreateBlockFuncs = numArgsToNumRubyBlockArgs[numArgs];
        if (!numRubyBlockArgsToCreateBlockFuncs) {
            numRubyBlockArgsToCreateBlockFuncs = numArgsToNumRubyBlockArgs[numArgs] = Object.create(null);
        }

        let createBlockFuncs = numRubyBlockArgsToCreateBlockFuncs[numRubyBlockArgs];
        if (!createBlockFuncs) createBlockFuncs = numRubyBlockArgsToCreateBlockFuncs[numRubyBlockArgs] = [];

        createBlockFuncs.push(createBlockFunc);
    },

    registerOnSend(receiverName, name, numArgs, createBlockFunc) {
        this.registerOnSendWithBlock(receiverName, name, numArgs, 'none', createBlockFunc);
    },

    registerOnSendMyBlock(receiverName, myBlockHandler) {
        if (receiverName === 'any') {
            this._anyReceiverNames().forEach((rn) => this.registerOnSendMyBlock(rn, myBlockHandler));
            return;
        }

        if (_.isArray(receiverName)) {
            receiverName.forEach((rn) => this.registerOnSendMyBlock(rn, myBlockHandler));
            return;
        }

        if (receiverName === 'self') {
            this.registerOnSendMyBlock('sprite', myBlockHandler);
            this.registerOnSendMyBlock('stage', myBlockHandler);
            return;
        }

        if (!this._receiverToMyBlocks[receiverName]) {
            this._receiverToMyBlocks[receiverName] = [];
        }
        this._receiverToMyBlocks[receiverName].push(myBlockHandler);
    },

    registerOnIf(handler) {
        this._onIfHandlers.push(handler);
    },

    registerOnUntil(handler) {
        this._onUntilHandlers.push(handler);
    },

    registerOnOpAsgn(handler) {
        this._onOpAsgnHandlers.push(handler);
    },

    registerOnAnd(handler) {
        this._onAndHandlers.push(handler);
    },

    registerOnOr(handler) {
        this._onOrHandlers.push(handler);
    },

    registerOnVar(handler) {
        this._onVarHandlers.push(handler);
    },

    registerOnVasgn(handler) {
        this._onVasgnHandlers.push(handler);
    },

    registerOnDefs(handler) {
        this._onDefsHandlers.push(handler);
    },

    callMethod(receiver, name, args, rubyBlockArgs, rubyBlock, node) {
        const block = this._callRegisteredMethod(receiver, name, args, rubyBlockArgs, rubyBlock, node);
        if (block) return block;
        return this._callProcedureDefinedLater(receiver, name, args, rubyBlockArgs, rubyBlock, node);
    },

    /**
     * Make the block of a call of a My Block with the handlers of the receiver.
     * @param {object} procedure - The procedure (`_context.procedures`).
     * @param {object} params - The receiver, the name, the arguments and the node of the call.
     * @returns {?object} The block, or null when no handler makes one.
     */
    _callMyBlock(procedure, params) {
        const previousNode = this._context.currentNode;
        this._context.currentNode = params.node;
        try {
            for (const handler of this._receiverToMyBlocks[params.receiverName]) {
                const block = handler.apply(this, [{ ...params, procedure }]);
                if (block) return block;
            }
            return null;
        } finally {
            this._context.currentNode = previousNode;
        }
    },

    /**
     * A call of a method that a `def` later in the code makes (issue #2167): the converter has not
     * seen the `def` yet, so it declares the procedure from the analysis (`procedures.definitions`)
     * and makes the call. Only a call that no other block takes comes here, so a call that was
     * converted before stays the same block.
     * @param {*} receiver - The value of the receiver.
     * @param {string} name - The name of the method.
     * @param {Array} args - The arguments.
     * @param {?Array} rubyBlockArgs - The arguments of the Ruby block.
     * @param {?object} rubyBlock - The Ruby block.
     * @param {object} node - The node of the call.
     * @returns {?object} The block, or null.
     */
    _callProcedureDefinedLater(receiver, name, args, rubyBlockArgs, rubyBlock, node) {
        const receiverName = this._getReceiverName(receiver);
        if (!receiverName || !this._receiverToMyBlocks[receiverName] || this._lookupProcedure(name)) return null;
        const procedure = this._declareProcedureDefinedLater(name, args.length);
        if (!procedure) return null;
        const params = { receiver, receiverName, name, args, rubyBlockArgs, rubyBlock, node };
        const block = this._callMyBlock(procedure, params);
        if (block) {
            procedure.callNodesBeforeDefinition.push(node);
        } else {
            this._context.store.deleteProcedure(procedure.name);
        }
        return block;
    },

    _callRegisteredMethod(receiver, name, args, rubyBlockArgs, rubyBlock, node) {
        const receiverName = this._getReceiverName(receiver);
        if (!receiverName) return null;

        // Check for my-block procedure calls
        if (this._receiverToMyBlocks[receiverName]) {
            const procedure = this._lookupProcedure(name);
            if (procedure) {
                const params = { receiver, receiverName, name, args, rubyBlockArgs, rubyBlock, node };
                const block = this._callMyBlock(procedure, params);
                if (block) return block;
            }
        }

        const methodToNumArgs = this._receiverToMethods[receiverName];
        if (!methodToNumArgs) return null;
        const numArgsToNumRubyBlockArgs = methodToNumArgs[name];
        if (!numArgsToNumRubyBlockArgs) return null;
        let numRubyBlockArgsToCreateBlockFuncs = numArgsToNumRubyBlockArgs[args.length];
        if (!numRubyBlockArgsToCreateBlockFuncs) {
            numRubyBlockArgsToCreateBlockFuncs = numArgsToNumRubyBlockArgs[-1];
        }
        if (!numRubyBlockArgsToCreateBlockFuncs) return null;

        let numRubyBlockArgs = 'none';
        if (typeof rubyBlock !== 'undefined') {
            numRubyBlockArgs = (rubyBlockArgs && rubyBlockArgs.length) || 0;
        }
        let createBlockFuncs = numRubyBlockArgsToCreateBlockFuncs[numRubyBlockArgs];
        if (!createBlockFuncs) {
            createBlockFuncs = numRubyBlockArgsToCreateBlockFuncs.any;
        }
        if (!createBlockFuncs) {
            createBlockFuncs = numRubyBlockArgsToCreateBlockFuncs[-1];
        }
        if (!createBlockFuncs) return null;

        const params = {
            receiver: receiver,
            receiverName: receiverName,
            name: name,
            args: args,
            rubyBlockArgs: rubyBlockArgs,
            rubyBlock: rubyBlock,
            node: node,
        };

        const previousNode = this._context.currentNode;
        this._context.currentNode = node;

        for (let i = 0; i < createBlockFuncs.length; i++) {
            const createBlockFunc = createBlockFuncs[i];
            const block = createBlockFunc.apply(this, [params]);
            if (block) {
                this._context.currentNode = previousNode;
                return block;
            }
        }

        this._context.currentNode = previousNode;

        return null;
    },

    _callConvertersHandler(handlerName, ...args) {
        const handlersMap = {
            onIf: this._onIfHandlers,
            onUntil: this._onUntilHandlers,
            onOpAsgn: this._onOpAsgnHandlers,
            onAnd: this._onAndHandlers,
            onOr: this._onOrHandlers,
            onVar: this._onVarHandlers,
            onVasgn: this._onVasgnHandlers,
            onDefs: this._onDefsHandlers,
        };

        const handlers = handlersMap[handlerName];
        if (handlers) {
            for (const handler of handlers) {
                const block = handler.apply(this, args);
                if (block) {
                    return block;
                }
            }
        }

        return null;
    },
};

export default ConverterRegistry;
