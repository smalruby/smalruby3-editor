import {defineMessages} from 'react-intl';
import _ from 'lodash';
import RubyParser from '../ruby-parser';

const Opal = global.Opal || window.Opal;
if (!Opal) {
    throw new Error('Opal is not defined. Make sure ruby-parser is imported first.');
}

import {Variable} from './constants';
import {RubyToBlocksConverterError} from './errors';
import registerConverters, {
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
import BlockUtils from './block-utils';
import NodeUtils from './node-utils';
import VariableUtils from './variable-utils';
import ContextUtils from './context-utils';
import ScopeManager from './scope-manager';
import AstHandlers from './ast-handlers';

const messages = defineMessages({
    couldNotConvertPrimitive: {
        defaultMessage: '"{ SOURCE }" could not be converted the block.',
        description: 'Error message for converting ruby to block when find the primitive',
        id: 'gui.smalruby3.rubyToBlocksConverter.couldNotConvertPrimitive'
    },
    wrongInstruction: {
        defaultMessage: '"{ SOURCE }" is the wrong instruction.',
        description: 'Error message for converting ruby to block when find the wrong instruction',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongInstruction'
    },
    cannotChangeVariableScope: {
        defaultMessage: '"{ VARIABLE }", can\'t change variable scope',
        description: 'Error message when trying to change variable scope from global to instance or vice versa',
        id: 'gui.smalruby3.rubyToBlocksConverter.cannotChangeVariableScope'
    }
});

// from scratch-vm/src/serialization/sb3.js
const CORE_EXTENSIONS = [
    'argument',
    'colour',
    'control',
    'data',
    'event',
    'looks',
    'math',
    'motion',
    'operator',
    'procedures',
    'ruby', // Ruby blocks are built-in (defined via defineRubyBlocks), not an extension
    'sensing',
    'sound'
];

// from scratch-vm/src/serialization/sb3.js
const getExtensionIdForOpcode = function (opcode) {
    const index = opcode.indexOf('_');
    const prefix = opcode.substring(0, index);
    if (CORE_EXTENSIONS.indexOf(prefix) === -1) {
        if (prefix !== '') return prefix;
    }
    return null;
};

/**
 * Class for a block converter that translates ruby code into the blocks.
 */
class RubyToBlocksConverter {
    constructor (vm, options) {
        this.vm = vm;
        this.version = options && options.version ? options.version : 1;
        this._translator = message => message.defaultMessage;
        this._receiverToMethods = {};
        this._receiverToMyBlocks = {};
        this._onIfHandlers = [];
        this._onUntilHandlers = [];
        this._onOpAsgnHandlers = [];
        this._onAndHandlers = [];
        this._onOrHandlers = [];
        this._onVarHandlers = [];
        this._onVasgnHandlers = [];
        this._onDefsHandlers = [];
        this.reset();

        registerConverters(this);
    }

    get errors () {
        return this._context.errors;
    }

    get blocks () {
        return this._context.blocks;
    }

    get variables () {
        return this._context.variables;
    }

    get lists () {
        return this._context.lists;
    }

    get broadcastMsgs () {
        return this._context.broadcastMsgs;
    }

    setTranslatorFunction (translator) {
        this._translator = translator;
    }

    targetCodeToBlocks (target, code) {
        this.reset();
        this._setTarget(target);
        this._loadVariables(target);
        try {
            const root = RubyParser.$parse(code);
            this._context.rootNode = root; // Save root node for line mapping
            let blocks = this._process(root, false);
            if (blocks === null || blocks === Opal.nil) {
                return true;
            }
            if (!_.isArray(blocks)) {
                blocks = [blocks];
            }
            // Link blocks if root is not a begin node (begin nodes handle linking internally)
            // This is needed for cases like "text = gets" where a single statement returns multiple blocks
            if (root.$type() !== 'begin') {
                blocks = this._linkBlocks(blocks);
            }
            blocks.forEach(block => {
                if (this._isBlock(block)) {
                    if (!block.parent) {
                        block.topLevel = true;
                    }
                } else {
                    const Primitive = require('./primitive').default;
                    if (block instanceof Primitive) {
                        throw new RubyToBlocksConverterError(
                            block.node,
                            this._translator(
                                messages.couldNotConvertPrimitive,
                                {SOURCE: this._getSource(block.node)}
                            )
                        );
                    } else {
                        throw new Error(`invalid block: ${block}`);
                    }
                }
            });
            Object.keys(this._context.blocks).forEach(blockId => {
                const block = this._context.blocks[blockId];

                // Reject ruby blocks (ruby_statement, ruby_expression, ruby_range, etc.)
                // UNLESS they have @ruby:return comment (legitimate fallback for procedures)
                if (this._isRubyBlock(block)) {
                    const hasReturnComment = block.comment &&
                        this._context.comments[block.comment] &&
                        this._context.comments[block.comment].text.startsWith('@ruby:return');
                    if (!hasReturnComment) {
                        throw new RubyToBlocksConverterError(
                            block.node,
                            this._translator(
                                messages.wrongInstruction,
                                {SOURCE: this._getSource(block.node)}
                            )
                        );
                    }
                }

                const extensionID = getExtensionIdForOpcode(block.opcode);
                if (extensionID) {
                    this._context.extensionIDs.add(extensionID);
                }
            });
            return true;
        } catch (e) {
            let error;
            if (e.$$class && e.$$class.$$name === 'SyntaxError') {
                const loc = e.$diagnostic().$location();
                error = this._toErrorAnnotation(loc.$line(), loc.$column(), e.$message());
            } else if (e instanceof RubyToBlocksConverterError) {
                const loc = e.node.$loc();
                error = this._toErrorAnnotation(loc.$line(), loc.$column(), e.message, this._getSource(e.node));
            } else if (this._context.currentNode) {
                const loc = this._context.currentNode.$loc();
                error = this._toErrorAnnotation(
                    loc.$line(), loc.$column(), e.message, this._getSource(this._context.currentNode)
                );
            } else {
                error = this._toErrorAnnotation(1, 0, e.message);
            }
            if (error) {
                this._context.errors.push(error);
            }
            return false;
        }
    }

    applyTargetBlocks (target) {
        let stage;
        if (target.isStage) {
            stage = target;
        } else {
            stage = this.vm.runtime.getTargetForStage();
        }

        // Delete existing local variables (pattern: _%rubyIdentifier%_%number%_)
        // from target before applying new blocks.
        // This prevents ID conflicts when re-executing code with local variables.
        // Ruby identifier: Unicode-aware pattern that matches:
        // - Starts with: letter (not uppercase ASCII) or underscore
        // - Followed by: letters (any language), numbers, or underscores
        // Pattern matches: _xxx_0_, _foo_bar_1_, _高尾_2_, _日本語_5_, etc.
        // Uses negative lookahead (?![A-Z]) to exclude uppercase ASCII at start
        const localVarPattern = /^_(?![A-Z])[\p{L}_][\p{L}\p{N}_]*_\d+_$/u;
        const varsToDelete = [];

        // eslint-disable-next-line no-console
        console.log('[DEBUG] Starting local variable deletion check');
        // eslint-disable-next-line no-console
        console.log('[DEBUG] Pattern:', localVarPattern);
        // eslint-disable-next-line no-console
        console.log('[DEBUG] Existing target variables:', Object.keys(target.variables).map(id => ({
            id,
            name: target.variables[id].name
        })));

        for (const varId in target.variables) {
            const variable = target.variables[varId];
            const matches = localVarPattern.test(variable.name);
            // eslint-disable-next-line no-console
            console.log(`[DEBUG] Testing variable "${variable.name}" (id: ${varId}): matches=${matches}`);
            if (matches) {
                varsToDelete.push(varId);
            }
        }

        // eslint-disable-next-line no-console
        console.log('[DEBUG] Variables to delete:', varsToDelete.map(id => ({
            id,
            name: target.variables[id].name
        })));

        varsToDelete.forEach(varId => {
            target.deleteVariable(varId);
        });

        // eslint-disable-next-line no-console
        console.log('[DEBUG] After deletion, remaining target variables:', Object.keys(target.variables).map(id => ({
            id,
            name: target.variables[id].name
        })));

        // Handle global/instance/local variables and lists
        // Map of old variable IDs to new IDs (for reusing existing variables)
        const variableIdMap = {};

        // eslint-disable-next-line no-console
        console.log('[DEBUG] Starting variable creation');

        ['variables', 'lists', 'localVariables'].forEach(storeName => {
            // eslint-disable-next-line no-console
            console.log(`[DEBUG] Processing storeName: ${storeName}`);
            // eslint-disable-next-line no-console
            console.log(`[DEBUG] Variables in ${storeName}:`, Object.keys(this._context[storeName]).map(name => ({
                name,
                id: this._context[storeName][name].id,
                scope: this._context[storeName][name].scope,
                type: this._context[storeName][name].type,
                isArgument: this._context[storeName][name].isArgument
            })));

            Object.keys(this._context[storeName]).forEach(name => {
                const variable = this._context[storeName][name];
                if (variable.isArgument) {
                    // eslint-disable-next-line no-console
                    console.log(`[DEBUG] Skipping argument variable: ${name}`);
                    return;
                }

                const oldId = variable.id;
                let existingVar = null;

                // eslint-disable-next-line no-console
                console.log(
                    `[DEBUG] Processing variable: name="${variable.name}", ` +
                    `id="${oldId}", scope="${variable.scope}", type="${variable.type}"`
                );

                if (variable.scope === 'global') {
                    // Check if variable already exists by name and type
                    existingVar = stage.lookupVariableByNameAndType(variable.name, variable.type);
                    // eslint-disable-next-line no-console
                    console.log(
                        `[DEBUG] Global variable lookup result: existingVar=${existingVar ? existingVar.id : 'null'}`
                    );
                    if (existingVar) {
                        // Reuse existing variable ID
                        variableIdMap[oldId] = existingVar.id;
                        variable.id = existingVar.id;
                        // eslint-disable-next-line no-console
                        console.log(`[DEBUG] Reusing global variable ID: ${oldId} -> ${existingVar.id}`);
                    } else if (Object.prototype.hasOwnProperty.call(stage.variables, variable.id)) {
                        // eslint-disable-next-line no-console
                        console.log(`[DEBUG] Global variable already exists in stage: id="${variable.id}"`);
                    } else {
                        // eslint-disable-next-line no-console
                        console.log(
                            `[DEBUG] Creating new global variable: ` +
                            `id="${variable.id}", name="${variable.name}"`
                        );
                        stage.createVariable(variable.id, variable.name, variable.type);
                    }
                } else {
                    // For local variables, always create new (they were deleted above)
                    // For instance variables, check if already exists and reuse
                    if (variable.scope === 'local') {
                        // eslint-disable-next-line no-console
                        console.log(`[DEBUG] Local variable - will create new (scope="${variable.scope}")`);
                    } else {
                        existingVar = target.lookupVariableByNameAndType(variable.name, variable.type, true);
                        // eslint-disable-next-line no-console
                        console.log(
                            `[DEBUG] Instance variable lookup result: ` +
                            `existingVar=${existingVar ? existingVar.id : 'null'}`
                        );
                        if (existingVar) {
                            // Reuse existing variable ID
                            variableIdMap[oldId] = existingVar.id;
                            variable.id = existingVar.id;
                            // eslint-disable-next-line no-console
                            console.log(`[DEBUG] Reusing instance variable ID: ${oldId} -> ${existingVar.id}`);
                        }
                    }
                    if (existingVar) {
                        // Variable was reused, no need to create
                    } else if (Object.prototype.hasOwnProperty.call(target.variables, variable.id)) {
                        // eslint-disable-next-line no-console
                        console.log(
                            `[DEBUG] Target variable already exists: ` +
                            `id="${variable.id}", name="${variable.name}"`
                        );
                    } else {
                        // eslint-disable-next-line no-console
                        console.log(
                            `[DEBUG] Creating new target variable: ` +
                            `id="${variable.id}", name="${variable.name}", scope="${variable.scope}"`
                        );
                        target.createVariable(variable.id, variable.name, variable.type);
                    }
                }
            });
        });

        // eslint-disable-next-line no-console
        console.log('[DEBUG] Variable ID map:', variableIdMap);

        // Update variable IDs in blocks
        // eslint-disable-next-line no-console
        console.log('[DEBUG] Updating variable IDs in blocks');
        Object.keys(this._context.blocks).forEach(blockId => {
            const block = this._context.blocks[blockId];
            if (block.fields) {
                ['VARIABLE', 'LIST'].forEach(fieldName => {
                    const field = block.fields[fieldName];
                    if (field && variableIdMap[field.id]) {
                        // eslint-disable-next-line no-console
                        console.log(
                            `[DEBUG] Updating ${fieldName} ID in block ${blockId}: ` +
                            `${field.id} -> ${variableIdMap[field.id]}`
                        );
                        field.id = variableIdMap[field.id];
                    }
                });
            }
        });

        Object.keys(this._context.broadcastMsgs).forEach(name => {
            const broadcastMsg = this._context.broadcastMsgs[name];
            if (!Object.prototype.hasOwnProperty.call(stage.variables, broadcastMsg.id)) {
                stage.createVariable(broadcastMsg.id, broadcastMsg.name, Variable.BROADCAST_MESSAGE_TYPE);
            }
        });

        const extensionPromises = [];
        this._context.extensionIDs.forEach(extensionID => {
            if (!this.vm.extensionManager.isExtensionLoaded(extensionID)) {
                extensionPromises.push(this.vm.extensionManager.loadExtensionURL(extensionID));
            }
        });

        return Promise.all(extensionPromises).then(() => {
            Object.keys(target.blocks._blocks).forEach(blockId => {
                target.blocks.deleteBlock(blockId);
            });
            target.comments = {};

            Object.keys(this._context.blocks).forEach(blockId => {
                target.blocks.createBlock(this._context.blocks[blockId]);
            });

            Object.keys(this._context.comments).forEach(commentId => {
                const comment = this._context.comments[commentId];
                target.createComment(
                    comment.id, comment.blockId, comment.text,
                    comment.x, comment.y, comment.width, comment.height, comment.minimized
                );
            });

            this.vm.emitWorkspaceUpdate();
        });
    }

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
    }

    registerOnSend (receiverName, name, numArgs, createBlockFunc) {
        this.registerOnSendWithBlock(receiverName, name, numArgs, 'none', createBlockFunc);
    }

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
    }

    registerOnIf (handler) {
        this._onIfHandlers.push(handler);
    }

    registerOnUntil (handler) {
        this._onUntilHandlers.push(handler);
    }

    registerOnOpAsgn (handler) {
        this._onOpAsgnHandlers.push(handler);
    }

    registerOnAnd (handler) {
        this._onAndHandlers.push(handler);
    }

    registerOnOr (handler) {
        this._onOrHandlers.push(handler);
    }

    registerOnVar (handler) {
        this._onVarHandlers.push(handler);
    }

    registerOnVasgn (handler) {
        this._onVasgnHandlers.push(handler);
    }

    registerOnDefs (handler) {
        this._onDefsHandlers.push(handler);
    }

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
        if (rubyBlock) numRubyBlockArgs = rubyBlockArgs.length;
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
    }

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

    /**
     * Find AST node at the given line number
     * @param {number} lineNumber - Line number (1-indexed)
     * @returns {object|null} AST node or null if not found
     */
    findNodeAtLine (lineNumber) {
        if (!this._context.rootNode) {
            return null;
        }

        let matchedNode = null;
        let maxDepth = -1;

        const traverse = (node, depth) => {
            if (!node || node === Opal.nil) return;

            try {
                const loc = node.$loc();
                if (loc && loc !== Opal.nil) {
                    const startLine = loc.$line();
                    const endLine = loc.$last_line ? loc.$last_line() : startLine;

                    if (startLine <= lineNumber && lineNumber <= endLine) {
                        if (depth > maxDepth) {
                            maxDepth = depth;
                            matchedNode = node;
                        }
                    }
                }

                // Traverse children
                const children = node.$children ? node.$children() : null;
                if (children && children !== Opal.nil) {
                    const childArray = children.$to_a ? children.$to_a() : [];
                    childArray.forEach(child => {
                        traverse(child, depth + 1);
                    });
                }
            } catch (e) {
                // Ignore nodes without location info
            }
        };

        traverse(this._context.rootNode, 0);
        return matchedNode;
    }

    /**
     * Get block ID for the given line number
     * @param {number} lineNumber - Line number (1-indexed)
     * @returns {string|null} Block ID or null if not found
     */
    getBlockIdForLine (lineNumber) {
        const node = this.findNodeAtLine(lineNumber);
        if (!node) {
            return null;
        }

        return this._context.nodeToBlockMap.get(node) || null;
    }
}

// Mixin methods
Object.assign(RubyToBlocksConverter.prototype, BlockUtils);
Object.assign(RubyToBlocksConverter.prototype, NodeUtils);
Object.assign(RubyToBlocksConverter.prototype, VariableUtils);
Object.assign(RubyToBlocksConverter.prototype, ContextUtils);
Object.assign(RubyToBlocksConverter.prototype, ScopeManager);
Object.assign(RubyToBlocksConverter.prototype, AstHandlers);

/**
 * Null of RubyToBlocksConverter
 */
const NullRubyToBlocksConverter = {
    result: true,
    errors: [],
    apply: () => Promise.resolve()
};

const targetCodeToBlocks = function (vm, target, code, intl, options) {
    const converter = new RubyToBlocksConverter(vm, options);
    if (intl) {
        converter.setTranslatorFunction(intl.formatMessage);
    }
    converter.result = converter.targetCodeToBlocks(target, code);
    if (converter.result) {
        converter.apply = () => converter.applyTargetBlocks(target);
    }
    return converter;
};

export {
    RubyToBlocksConverter as default,
    NullRubyToBlocksConverter,
    targetCodeToBlocks
};
