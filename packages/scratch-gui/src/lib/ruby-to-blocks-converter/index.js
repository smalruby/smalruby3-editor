import {defineMessages} from 'react-intl';
import _ from 'lodash';
import RubyParser from '../ruby-parser';

const Opal = global.Opal || window.Opal;
if (!Opal) {
    throw new Error('Opal is not defined. Make sure ruby-parser is imported first.');
}

import {Variable, LOCAL_VARIABLE_PATTERN} from './constants';
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

        // Delete existing local variables from target before applying new blocks.
        // This prevents ID conflicts when re-executing code with local variables.
        // Local variables are scope-specific and should be recreated on each execution.
        const varsToDelete = [];
        for (const varId in target.variables) {
            const variable = target.variables[varId];
            if (LOCAL_VARIABLE_PATTERN.test(variable.name)) {
                varsToDelete.push(varId);
            }
        }
        varsToDelete.forEach(varId => {
            target.deleteVariable(varId);
        });

        // Handle global/instance/local variables and lists
        // Map of old variable IDs to new IDs (for reusing existing variables)
        const variableIdMap = {};

        ['variables', 'lists', 'localVariables'].forEach(storeName => {
            Object.keys(this._context[storeName]).forEach(name => {
                const variable = this._context[storeName][name];
                if (variable.isArgument) return;

                const oldId = variable.id;
                let existingVar = null;

                if (variable.scope === 'global') {
                    // Check if variable already exists by name and type
                    existingVar = stage.lookupVariableByNameAndType(variable.name, variable.type);
                    if (existingVar) {
                        // Reuse existing variable ID
                        variableIdMap[oldId] = existingVar.id;
                        variable.id = existingVar.id;
                    } else if (Object.prototype.hasOwnProperty.call(stage.variables, variable.id)) {
                        // Variable with this ID already exists
                    } else {
                        stage.createVariable(variable.id, variable.name, variable.type);
                    }
                } else {
                    // For local variables, always create new (they were deleted above)
                    // For instance variables, check if already exists and reuse
                    if (variable.scope !== 'local') {
                        existingVar = target.lookupVariableByNameAndType(variable.name, variable.type, true);
                        if (existingVar) {
                            // Reuse existing variable ID
                            variableIdMap[oldId] = existingVar.id;
                            variable.id = existingVar.id;
                        }
                    }
                    if (existingVar) {
                        // Variable was reused, no need to create
                    } else if (Object.prototype.hasOwnProperty.call(target.variables, variable.id)) {
                        // Variable with this ID already exists
                    } else {
                        target.createVariable(variable.id, variable.name, variable.type);
                    }
                }
            });
        });

        // Update variable IDs in blocks
        Object.keys(this._context.blocks).forEach(blockId => {
            const block = this._context.blocks[blockId];
            if (block.fields) {
                ['VARIABLE', 'LIST'].forEach(fieldName => {
                    const field = block.fields[fieldName];
                    if (field && variableIdMap[field.id]) {
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
     * Get block ID for the given line number using O(1) map lookup with fallback.
     * The lineToNodeMap is populated during AST processing with a shallowest-first strategy,
     * so this returns the parent block for nested statements.
     * If no direct mapping exists for the line (e.g., line contains only `do` or `end`),
     * falls back to finding the shallowest node whose range contains the line.
     * @param {number} lineNumber - Line number (1-indexed)
     * @returns {string|null} Block ID or null if not found
     */
    getBlockIdForLine (lineNumber) {
        const entry = this._context.lineToNodeMap.get(lineNumber);

        if (!entry) {
            // Fallback 1: Find the shallowest node whose range contains this line
            const fallbackEntry = this._findContainingNode(lineNumber);
            if (fallbackEntry) {
                const blockId = this._context.nodeToBlockMap.get(fallbackEntry.node);
                if (blockId) return blockId;
            }

            // Fallback 2: Find the nearest executable line before this line
            const nearestLine = this._findNearestExecutableLine(lineNumber);
            if (nearestLine !== null) {
                return this.getBlockIdForLine(nearestLine);
            }

            return null;
        }

        const blockId = this._context.nodeToBlockMap.get(entry.node);

        // If direct mapping exists but node has no block, or block was deleted, try fallback
        if (!blockId || !this._context.blocks[blockId]) {
            const fallbackEntry = this._findContainingNode(lineNumber);
            if (fallbackEntry) {
                const fallbackBlockId = this._context.nodeToBlockMap.get(fallbackEntry.node);
                if (fallbackBlockId && this._context.blocks[fallbackBlockId]) {
                    return fallbackBlockId;
                }
            }

            const nearestLine = this._findNearestExecutableLine(lineNumber);
            if (nearestLine !== null) {
                return this.getBlockIdForLine(nearestLine);
            }

            return null;
        }

        return blockId;
    }

    /**
     * Find the shallowest node whose line range contains the given line number.
     * This is used as a fallback when no direct line mapping exists.
     * Searches through all nodes in nodeToBlockMap (which have associated blocks).
     * @param {number} lineNumber - Line number to search for
     * @returns {{node: object, depth: number}|null} Entry with node and depth, or null
     */
    _findContainingNode (lineNumber) {
        let bestMatchNode = null;
        let bestMatchStartLine = null;
        let bestMatchEndLine = null;

        // Search through all nodes that have blocks (nodeToBlockMap)
        for (const [node] of this._context.nodeToBlockMap.entries()) {
            try {
                // Get line range for this node
                const loc = node.$loc ? node.$loc() : null;
                if (loc && loc !== Opal.nil) {
                    const startLine = loc.$line ? loc.$line() : null;
                    const endLine = loc.$last_line ? loc.$last_line() : startLine;

                    // Check if this node's range contains the target line
                    if (startLine !== null && endLine !== null &&
                        startLine <= lineNumber && lineNumber <= endLine) {
                        // Keep the shallowest (smallest range) matching node
                        // If multiple nodes have same range, keep first found
                        const range = endLine - startLine;
                        const currentBestRange = bestMatchEndLine === null ? Infinity :
                            bestMatchEndLine - bestMatchStartLine;

                        if (range < currentBestRange ||
                            (range === currentBestRange && startLine < bestMatchStartLine)) {
                            bestMatchNode = node;
                            bestMatchStartLine = startLine;
                            bestMatchEndLine = endLine;
                        }
                    }
                }
            } catch (e) {
                // Ignore errors when accessing location
            }
        }

        if (bestMatchNode) {
            return {node: bestMatchNode, depth: 0};
        }

        return null;
    }

    /**
     * Find the nearest executable line before the given line number.
     * Searches backwards from the target line to find a line with an executable block.
     * @param {number} lineNumber - Line number to start searching from
     * @returns {number|null} Nearest executable line number, or null if not found
     */
    _findNearestExecutableLine (lineNumber) {
        // Search backwards from the line before the target
        for (let line = lineNumber - 1; line >= 1; line--) {
            const entry = this._context.lineToNodeMap.get(line);
            if (entry) {
                const blockId = this._context.nodeToBlockMap.get(entry.node);
                if (blockId) {
                    return line;
                }
            }

            // Fallback: Check if this line is contained in some node that has a block
            const fallbackEntry = this._findContainingNode(line);
            if (fallbackEntry) {
                return line;
            }
        }
        return null;
    }

    /**
     * Get the line range for a top-level script block.
     * Returns the minimum and maximum line numbers covered by all blocks in the script.
     * @param {string} topBlockId - ID of the top-level block
     * @param {object} blocks - Blocks object from VM target
     * @returns {{startLine: number, endLine: number}|null} Line range or null if not found
     */
    getLineRangeForTopLevelScript (topBlockId, blocks) {
        if (!topBlockId || !blocks) return null;

        let minLine = Infinity;
        let maxLine = -Infinity;
        let foundAny = false;

        // Traverse all blocks in the script
        const visitBlock = blockId => {
            if (!blockId) return;

            const block = blocks.getBlock ? blocks.getBlock(blockId) : blocks[blockId];

            // Find the node for this block
            for (const [node, id] of this._context.nodeToBlockMap.entries()) {
                if (id === blockId) {
                    try {
                        const loc = node.$loc ? node.$loc() : null;
                        if (loc && loc !== Opal.nil) {
                            const startLine = loc.$line ? loc.$line() : null;
                            const endLine = loc.$last_line ? loc.$last_line() : startLine;

                            if (startLine !== null && endLine !== null) {
                                minLine = Math.min(minLine, startLine);
                                maxLine = Math.max(maxLine, endLine);
                                foundAny = true;
                            }
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                    break;
                }
            }

            // Visit next block
            if (block && block.next) {
                visitBlock(block.next);
            }

            // Visit inputs (for nested blocks and substacks)
            if (block && block.inputs) {
                Object.entries(block.inputs).forEach(([_key, input]) => {
                    if (input && input.block) {
                        visitBlock(input.block);
                    }
                });
            }
        };

        visitBlock(topBlockId);

        if (foundAny) {
            // Extend range to include closing 'end' lines from container nodes
            let bestContainer = null;
            let bestContainerSize = Infinity;

            if (this._context.containerNodeRanges) {
                this._context.containerNodeRanges.forEach(container => {
                    // Only consider 'block' type containers (do...end blocks)
                    // Skip 'begin' and 'kwbegin' as they are often too broad
                    if (container.type !== 'block') {
                        return;
                    }

                    // If container starts at minLine and ends after maxLine
                    if (container.startLine === minLine && container.endLine > maxLine) {
                        const containerSize = container.endLine - container.startLine;
                        if (containerSize < bestContainerSize) {
                            bestContainer = container;
                            bestContainerSize = containerSize;
                        }
                    }
                });

                if (bestContainer) {
                    maxLine = bestContainer.endLine;
                }
            }

            return {startLine: minLine, endLine: maxLine};
        }

        return null;
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
