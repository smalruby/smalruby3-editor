import _ from 'lodash';
import {
    MusicConverter,
    PenConverter,
    EV3Converter,
    GdxForConverter,
    SmalrubotS1Converter,
    BoostConverter,
    TranslateConverter,
    MakeyMakeyConverter,
    LooksConverter,
    SoundConverter,
    SensingConverter
} from './register-converters';

/**
 * Mixin for converter registration and execution methods.
 */
const ConverterRegistry = {
    registerOnSendWithBlock (receiverName, name, numArgs, numRubyBlockArgs, createBlockFunc) {
        if (receiverName === 'any') {
            this._anyReceiverNames().forEach(rn => {
                this.registerOnSendWithBlock(rn, name, numArgs, numRubyBlockArgs, createBlockFunc);
            });
            return;
        }

        if (_.isArray(receiverName)) {
            receiverName.forEach(rn => {
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
            numArgs.forEach(n => {
                this.registerOnSendWithBlock(receiverName, name, n, numRubyBlockArgs, createBlockFunc);
            });
            return;
        }

        let methodToNumArgs = this._receiverToMethods[receiverName];
        if (!methodToNumArgs) methodToNumArgs = this._receiverToMethods[receiverName] = {};

        let numArgsToNumRubyBlockArgs = methodToNumArgs[name];
        if (!numArgsToNumRubyBlockArgs) numArgsToNumRubyBlockArgs = methodToNumArgs[name] = {};

        let numRubyBlockArgsToCreateBlockFuncs = numArgsToNumRubyBlockArgs[numArgs];
        if (!numRubyBlockArgsToCreateBlockFuncs) {
            numRubyBlockArgsToCreateBlockFuncs = numArgsToNumRubyBlockArgs[numArgs] = {};
        }

        let createBlockFuncs = numRubyBlockArgsToCreateBlockFuncs[numRubyBlockArgs];
        if (!createBlockFuncs) createBlockFuncs = numRubyBlockArgsToCreateBlockFuncs[numRubyBlockArgs] = [];

        createBlockFuncs.push(createBlockFunc);
    },

    registerOnSend (receiverName, name, numArgs, createBlockFunc) {
        this.registerOnSendWithBlock(receiverName, name, numArgs, 'none', createBlockFunc);
    },

    registerOnSendMyBlock (receiverName, myBlockHandler) {
        if (receiverName === 'any') {
            this._anyReceiverNames().forEach(rn => this.registerOnSendMyBlock(rn, myBlockHandler));
            return;
        }

        if (_.isArray(receiverName)) {
            receiverName.forEach(rn => this.registerOnSendMyBlock(rn, myBlockHandler));
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

    registerOnIf (handler) {
        this._onIfHandlers.push(handler);
    },

    registerOnUntil (handler) {
        this._onUntilHandlers.push(handler);
    },

    registerOnOpAsgn (handler) {
        this._onOpAsgnHandlers.push(handler);
    },

    registerOnAnd (handler) {
        this._onAndHandlers.push(handler);
    },

    registerOnOr (handler) {
        this._onOrHandlers.push(handler);
    },

    registerOnVar (handler) {
        this._onVarHandlers.push(handler);
    },

    registerOnVasgn (handler) {
        this._onVasgnHandlers.push(handler);
    },

    registerOnDefs (handler) {
        this._onDefsHandlers.push(handler);
    },

    callMethod (receiver, name, args, rubyBlockArgs, rubyBlock, node) {
        const receiverName = this._getReceiverName(receiver);
        if (!receiverName) return null;

        // Check for my-block procedure calls
        if (this._receiverToMyBlocks[receiverName]) {
            const procedure = this._lookupProcedure(name);
            if (procedure) {
                const params = {
                    receiver: receiver,
                    receiverName: receiverName,
                    name: name,
                    args: args,
                    rubyBlockArgs: rubyBlockArgs,
                    rubyBlock: rubyBlock,
                    node: node,
                    procedure: procedure
                };

                const previousNode = this._context.currentNode;
                this._context.currentNode = node;

                for (const handler of this._receiverToMyBlocks[receiverName]) {
                    const block = handler.apply(this, [params]);
                    if (block) {
                        this._context.currentNode = previousNode;
                        return block;
                    }
                }

                this._context.currentNode = previousNode;
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
            numRubyBlockArgs = rubyBlockArgs ? rubyBlockArgs.length : 0;
        }
        let createBlockFuncs = numRubyBlockArgsToCreateBlockFuncs[numRubyBlockArgs];
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
            node: node
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

    _callConvertersHandler (handlerName, ...args) {
        // First, check registered handlers based on handlerName
        const handlersMap = {
            onIf: this._onIfHandlers,
            onUntil: this._onUntilHandlers,
            onOpAsgn: this._onOpAsgnHandlers,
            onAnd: this._onAndHandlers,
            onOr: this._onOrHandlers,
            onVar: this._onVarHandlers,
            onVasgn: this._onVasgnHandlers,
            onDefs: this._onDefsHandlers
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

        // Then, check legacy converter objects for remaining unmigrated handlers
        const legacyConverters = [
            MusicConverter,
            PenConverter,
            EV3Converter,
            GdxForConverter,
            SmalrubotS1Converter,
            BoostConverter,
            TranslateConverter,
            MakeyMakeyConverter,
            LooksConverter,
            SoundConverter,
            SensingConverter
        ];

        for (let i = 0; i < legacyConverters.length; i++) {
            const converter = legacyConverters[i];
            if (Object.prototype.hasOwnProperty.call(converter, handlerName)) {
                const block = converter[handlerName].apply(this, args);
                if (block) {
                    return block;
                }
            }
        }

        return null;
    }
};

export default ConverterRegistry;
