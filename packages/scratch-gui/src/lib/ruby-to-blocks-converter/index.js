import {defineMessages} from 'react-intl';
import _ from 'lodash';
import RubyParser from '../ruby-parser';
import {Visitor} from '@ruby/prism/src/visitor.js';
import {
    ProgramNode, StatementsNode, BlockNode, BeginNode, DefNode, ClassNode, ModuleNode
} from '@ruby/prism/src/nodes.js';

import {RubyToBlocksConverterError} from './errors';
import registerConverters from './register-converters';
import BlockUtils from './block-utils';
import NodeUtils from './node-utils';
import VariableUtils from './variable-utils';
import ContextUtils from './context-utils';
import ScopeManager from './scope-manager';
import AstHandlers from './ast-handlers';
import LineMappingUtils from './line-mapping';
import ConverterRegistry from './converter-registry';
import TargetApplier from './target-applier';
import PrismErrorTranslator from './prism-error-translator';
import {findTargetsWithModule, generateTargetCode, extractModuleCode} from '../module-sync';
import spritesLibrary from '../libraries/sprites.json';
import costumesLibrary from '../libraries/costumes.json';
import soundsLibrary from '../libraries/sounds.json';
import backdropsLibrary from '../libraries/backdrops.json';

const spriteLibraryNames = new Set(spritesLibrary.map(s => s.name));
const costumeLibraryNames = new Set(costumesLibrary.map(c => c.name));
const soundLibraryNames = new Set(soundsLibrary.map(s => s.name));
const backdropLibraryNames = new Set(backdropsLibrary.map(b => b.name));

const messages = defineMessages({
    couldNotConvertPrimitive: {
        defaultMessage: '"{ SOURCE }" could not be converted to a block.' +
            '\nCheck the spelling or use a supported value.',
        description: 'Error message for converting ruby to block when find the primitive',
        id: 'gui.smalruby3.rubyToBlocksConverter.couldNotConvertPrimitive'
    },
    wrongInstruction: {
        defaultMessage: '"{ SOURCE }" is the wrong instruction.' +
            '\nCheck the spelling or use a supported block.',
        description: 'Error message for converting ruby to block when find the wrong instruction',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongInstruction'
    },
    cannotChangeVariableScope: {
        defaultMessage: '"{ VARIABLE }", can\'t change variable scope.' +
            '\nDelete the variable first, then recreate it with the correct scope.',
        description: 'Error message when trying to change variable scope from global to instance or vice versa',
        id: 'gui.smalruby3.rubyToBlocksConverter.cannotChangeVariableScope'
    },
    wrongInstructionInClass: {
        defaultMessage: '"{ SOURCE }" cannot be placed directly inside a class definition.' +
            '\nUse it inside an event block (e.g. when_flag_clicked) or a method definition (def).',
        description: 'Error message when a non-hat/non-def block is placed directly in a class body',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongInstructionInClass'
    },
    spriteAndCostumesSoundsExclusive: {
        defaultMessage: 'set_sprite and set_costumes/set_sounds cannot be used together.' +
            '\nUse either set_sprite or set_costumes/set_sounds.',
        description: 'Error message when set_sprite is used with set_costumes or set_sounds',
        id: 'gui.smalruby3.rubyToBlocksConverter.spriteAndCostumesSoundsExclusive'
    },
    invalidSpriteName: {
        defaultMessage: 'sprite "{ NAME }" does not exist in the sprite library.' +
            '\nCheck the name or use a valid sprite name.',
        description: 'Error message when set_sprite references an invalid sprite library name',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidSpriteName'
    },
    invalidCostumeName: {
        defaultMessage: 'costume "{ NAME }" does not exist in the costume library.' +
            '\nCheck the name or use a valid costume name.',
        description: 'Error message when set_costumes references an invalid costume library name',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidCostumeName'
    },
    invalidSoundName: {
        defaultMessage: 'sound "{ NAME }" does not exist in the sound library.' +
            '\nCheck the name or use a valid sound name.',
        description: 'Error message when set_sounds references an invalid sound library name',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidSoundName'
    },
    invalidBackdropName: {
        defaultMessage: 'backdrop "{ NAME }" does not exist in the backdrop library.' +
            '\nCheck the name or use a valid backdrop name.',
        description: 'Error message when set_backdrops references an invalid backdrop library name',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidBackdropName'
    },
    spriteMethodInStageClass: {
        defaultMessage: '"{ METHOD }" cannot be used in class Stage.' +
            '\nThis method is only available for sprites.',
        description: 'Error message when a sprite-only set_xxx method is used in class Stage',
        id: 'gui.smalruby3.rubyToBlocksConverter.spriteMethodInStageClass'
    },
    stageMethodInSpriteClass: {
        defaultMessage: '"{ METHOD }" cannot be used in a sprite class.' +
            '\nThis method is only available for class Stage.',
        description: 'Error message when a stage-only set_xxx method is used in a sprite class',
        id: 'gui.smalruby3.rubyToBlocksConverter.stageMethodInSpriteClass'
    },
    classNotSupportedInV1: {
        defaultMessage: 'class definitions are not supported in Ruby version 1.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when class syntax is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.classNotSupportedInV1'
    },
    invalidStageSuperclass: {
        defaultMessage: 'Stage class can only inherit from ::Smalruby3::Stage or Smalruby3::Stage.',
        description: 'Error message when Stage class has invalid superclass',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidStageSuperclass'
    },
    setVariablesListsNotSupported: {
        defaultMessage: '"{ METHOD }" is not supported in Ruby version 2.' +
            '\nUse def initialize to set variable and list values instead.',
        description: 'Error message when set_variables/set_lists is used in V2 class',
        id: 'gui.smalruby3.rubyToBlocksConverter.setVariablesListsNotSupported'
    },
    invalidInitializeBody: {
        defaultMessage: '"{ SOURCE }" cannot be placed inside def initialize.' +
            '\nOnly variable and list assignments are allowed.',
        description: 'Error message when invalid code is in def initialize',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidInitializeBody'
    },
    wrongVariableScopeInInitialize: {
        defaultMessage: '"{ SOURCE }" uses the wrong variable scope for this class.' +
            '\nUse { PREFIX } variables in { CLASS_TYPE } classes.',
        description: 'Error message when wrong variable scope is used in initialize',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongVariableScopeInInitialize'
    },
    moduleNotSupportedInV1: {
        defaultMessage: 'module is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when module syntax is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.moduleNotSupportedInV1'
    },
    nestedModuleNotSupported: {
        defaultMessage: 'Nested modules are not supported in Smalruby.',
        description: 'Error message when a module is nested inside another module',
        id: 'gui.smalruby3.rubyToBlocksConverter.nestedModuleNotSupported'
    },
    onlyMethodsInModule: {
        defaultMessage: 'Only method definitions (def) can be placed inside a module in Smalruby.',
        description: 'Error message when non-def statement is inside a module',
        id: 'gui.smalruby3.rubyToBlocksConverter.onlyMethodsInModule'
    },
    undefinedModule: {
        defaultMessage: 'Module "{ NAME }" is not defined.',
        description: 'Error message when include references an undefined module',
        id: 'gui.smalruby3.rubyToBlocksConverter.undefinedModule'
    },
    moduleFunctionNotSupported: {
        defaultMessage: 'module_function is not supported in Smalruby.',
        description: 'Error message when module_function is used',
        id: 'gui.smalruby3.rubyToBlocksConverter.moduleFunctionNotSupported'
    },
    extendNotSupported: {
        defaultMessage: 'extend is not supported in Smalruby.',
        description: 'Error message when extend is used',
        id: 'gui.smalruby3.rubyToBlocksConverter.extendNotSupported'
    },
    moduleNotSupportedInStage: {
        defaultMessage: 'module is not supported in Stage.' +
            '\nModules can only be used in sprite classes.',
        description: 'Error message when module syntax is used in Stage',
        id: 'gui.smalruby3.rubyToBlocksConverter.moduleNotSupportedInStage'
    },
    includeNotSupportedInStage: {
        defaultMessage: 'include is not supported in class Stage.' +
            '\nModules can only be included in sprite classes.',
        description: 'Error message when include is used in class Stage',
        id: 'gui.smalruby3.rubyToBlocksConverter.includeNotSupportedInStage'
    },
    moduleImportFailed: {
        defaultMessage: 'Failed to import module "{ NAME }" from other sprites.',
        description: 'Error message when module auto-import from other sprites fails',
        id: 'gui.smalruby3.rubyToBlocksConverter.moduleImportFailed'
    },
    symbolNeedsToS: {
        defaultMessage: '"{ SOURCE }" — symbols need .to_s to be used as a string.' +
            '\nWrite { SUGGESTION } instead.',
        description: 'Error message when a symbol is used where a string is expected without .to_s',
        id: 'gui.smalruby3.rubyToBlocksConverter.symbolNeedsToS'
    },
    symbolCannotArithmetic: {
        defaultMessage: '"{ SOURCE }" — symbols cannot be used in arithmetic (+, -, *, /).' +
            '\nUse .to_s to convert first, e.g. { SUGGESTION }.',
        description: 'Error message when a symbol is used in arithmetic operation',
        id: 'gui.smalruby3.rubyToBlocksConverter.symbolCannotArithmetic'
    },
    symbolCannotCompare: {
        defaultMessage: '"{ SOURCE }" — symbols can only be compared with other symbols using >, <, >=, <=.' +
            '\nUse == instead, or convert with .to_s.',
        description: 'Error message when a symbol is compared with non-symbol using >, <, >=, <=',
        id: 'gui.smalruby3.rubyToBlocksConverter.symbolCannotCompare'
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
class RubyToBlocksConverter extends Visitor {
    constructor (vm, options) {
        super();
        this.vm = vm;
        this.version = options && options.version ? options.version : 1;
        this._translator = (message, values) => {
            let text = message.defaultMessage;
            if (values) {
                Object.keys(values).forEach(key => {
                    text = text.replace(new RegExp(`\\{\\s*${key}\\s*\\}`, 'g'), values[key]);
                });
            }
            return text;
        };
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
        this._prismErrorTranslator = new PrismErrorTranslator(this._translator);
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

    _symbolNeedsToSMessage () {
        return messages.symbolNeedsToS;
    }

    _symbolCannotArithmeticMessage () {
        return messages.symbolCannotArithmetic;
    }

    _symbolCannotCompareMessage () {
        return messages.symbolCannotCompare;
    }

    setTranslatorFunction (translator) {
        this._translator = translator;
        this._prismErrorTranslator = new PrismErrorTranslator(translator);
    }

    async targetCodeToBlocks (target, code) {
        this.reset();
        this._setTarget(target);
        this._loadVariables(target);
        this._context.sourceCode = code;
        this._buildByteToCharMap();
        try {
            const prism = RubyParser.getPrism() || await RubyParser.loadPrism();
            const parseResult = prism.parse(code);
            if (parseResult.errors.length > 0) {
                parseResult.errors.forEach(e => {
                    const translatedMessage = this._prismErrorTranslator.translate(e.message);
                    // Prism error locations have startOffset (byte-based) but not startLine/startColumn.
                    // Compute line/column from the byte offset using our byte→char mapping.
                    const loc = this._getLoc({location: e.location});
                    this._context.errors.push(this._toErrorAnnotation(
                        loc.line, loc.column, translatedMessage
                    ));
                });
                return false;
            }
            const root = parseResult.value;
            this._context.rootNode = root; // Save root node for line mapping
            // Pre-pass: count procedure calls to support evacuation block generation
            this._countProcedureCallsInNode(root);
            let blocks = this.visit(root);
            if (blocks === null || typeof blocks === 'undefined') {
                return true;
            }
            if (!_.isArray(blocks)) {
                blocks = [blocks];
            }
            // Link blocks if root is not a begin node (begin nodes handle linking internally)
            // This is needed for cases like "text = gets" where a single statement returns multiple blocks
            const rootType = this._getNodeTypeName(root);
            if (rootType !== 'StatementsNode' &&
                rootType !== 'ProgramNode' &&
                rootType !== 'BeginNode') {
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
                        if (block.type === 'sym') {
                            const source = this._truncateSource(this._getSource(block.node));
                            const suggestion = `${source}.to_s`;
                            throw new RubyToBlocksConverterError(
                                block.node,
                                this._translator(
                                    messages.symbolNeedsToS,
                                    {SOURCE: source, SUGGESTION: suggestion}
                                )
                            );
                        }
                        throw new RubyToBlocksConverterError(
                            block.node,
                            this._translator(
                                messages.couldNotConvertPrimitive,
                                {SOURCE: this._truncateSource(this._getSource(block.node))}
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
                                {SOURCE: this._truncateSource(this._getSource(block.node))}
                            )
                        );
                    }
                }

                const extensionID = getExtensionIdForOpcode(block.opcode);
                if (extensionID) {
                    this._context.extensionIDs.add(extensionID);
                }
            });

            // Create $_symbols_ list if symbols were collected
            this._createSymbolsList();

            // Associate source comments with blocks
            this._associateSourceComments(parseResult, code);

            return true;
        } catch (e) {
            let error;
            if (e instanceof RubyToBlocksConverterError) {
                const loc = this._getLoc(e.node);
                error = this._toErrorAnnotation(loc.line, loc.column, e.message, this._getSource(e.node));
            } else if (this._context.currentNode) {
                const loc = this._getLoc(this._context.currentNode);
                error = this._toErrorAnnotation(
                    loc.line, loc.column, e.message, this._getSource(this._context.currentNode)
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

    visit (node) {
        if (!node) {
            return null;
        }

        // Track depth for lineToNodeMap
        const depth = this._context.processDepth || 0;
        this._context.processDepth = depth + 1;

        const startLine = this._getNodeStartLine(node);
        const endLine = this._getNodeEndLine(node) || startLine;

        if (startLine !== null && endLine !== null) {
            const isContainerNode = node instanceof ProgramNode ||
                node instanceof StatementsNode ||
                node instanceof BlockNode ||
                node instanceof BeginNode ||
                node instanceof DefNode ||
                node instanceof ClassNode ||
                node instanceof ModuleNode;

            if (isContainerNode) {
                const rangeEntry = {
                    type: node.constructor.name,
                    startLine,
                    endLine,
                    depth
                };
                // Store module name for comment association
                if (node instanceof ModuleNode) {
                    rangeEntry.moduleName = node.name;
                }
                this._context.containerNodeRanges.push(rangeEntry);
            } else {
                for (let line = startLine; line <= endLine; line++) {
                    const existingEntry = this._context.lineToNodeMap.get(line);
                    if (!existingEntry || depth < existingEntry.depth) {
                        this._context.lineToNodeMap.set(line, {node, depth});
                    }
                }
            }
        }

        const previousNode = this._context.currentNode;
        this._context.currentNode = node;

        // Resolve the handler name via node.accept() rather than constructor.name.
        // constructor.name is mangled by esbuild/terser in production builds, but
        // each node class has a hardcoded accept() that calls the correct visitXxxNode
        // method name on the visitor, so we can use a sniffing proxy to get it.
        let handlerName = null;
        const sniffer = new Proxy({}, {
            get (_target, prop) {
                if (typeof prop === 'string' && prop.startsWith('visit')) {
                    handlerName = prop;
                }
                return () => {};
            }
        });
        node.accept(sniffer);

        let result;
        if (handlerName && typeof this[handlerName] === 'function') {
            result = this[handlerName](node);
        } else {
            throw new Error(`not supported node type: ${node.constructor.name}`);
        }

        if (result && !this._context.nodeToBlockMap.has(node)) {
            const blockId = this._getBlockIdFromResult(result);
            if (blockId) {
                this._context.nodeToBlockMap.set(node, blockId);
            }
        }

        this._context.currentNode = previousNode;
        this._context.processDepth = depth;
        return result;
    }

    // Get the node type name using accept()-based sniffing, which is safe
    // against minification (constructor.name is mangled by esbuild/terser).
    // Returns e.g. 'CallNode', 'StringNode', 'IntegerNode', etc.
    _getNodeTypeName (node) {
        let handlerName = null;
        const sniffer = new Proxy({}, {
            get (_target, prop) {
                if (typeof prop === 'string' && prop.startsWith('visit')) {
                    handlerName = prop;
                }
                return () => {};
            }
        });
        node.accept(sniffer);
        // handlerName is e.g. 'visitCallNode' -> extract 'CallNode'
        return handlerName ? handlerName.slice('visit'.length) : null;
    }

    /**
     * Extract comments from prism parse result and return structured data.
     * @param {object} parseResult - The prism parse result
     * @param {string} sourceCode - The original source code
     * @returns {Array<object>} Array of comment objects with type, text, line, isTrailing
     */
    _extractSourceComments (parseResult, sourceCode) {
        if (!parseResult.comments || parseResult.comments.length === 0) {
            return [];
        }

        // Ensure sourceCode and byteToChar map are available for _byteOffsetToCharOffset
        if (this._context.sourceCode !== sourceCode) {
            this._context.sourceCode = sourceCode;
            this._context.byteToChar = null; // force rebuild
        }

        // Build char-offset-to-line mapping
        const lineStarts = [0]; // line 1 starts at char offset 0
        for (let i = 0; i < sourceCode.length; i++) {
            if (sourceCode[i] === '\n') {
                lineStarts.push(i + 1);
            }
        }
        const offsetToLine = offset => {
            for (let i = lineStarts.length - 1; i >= 0; i--) {
                if (offset >= lineStarts[i]) {
                    return i + 1; // 1-based line numbers
                }
            }
            return 1;
        };

        return parseResult.comments.map(comment => {
            const startByte = comment.location.startOffset;
            const lengthBytes = comment.location.length;
            // Convert byte offsets to char offsets using shared mapping
            const startCharOffset = this._byteOffsetToCharOffset(startByte);
            const endCharOffset = this._byteOffsetToCharOffset(startByte + lengthBytes);
            const rawText = sourceCode.substring(startCharOffset, endCharOffset);
            const line = offsetToLine(startCharOffset);
            const lineStart = lineStarts[line - 1];

            // Check if there's non-whitespace before this comment on the same line
            const textBeforeOnLine = sourceCode.substring(lineStart, startCharOffset);
            const isTrailing = textBeforeOnLine.trim().length > 0;

            let type;
            let text;
            if (comment.type === 1) {
                // EmbDocComment: =begin\n...\n=end\n
                type = 'embdoc';
                text = rawText.replace(/^=begin\n?/, '').replace(/\n?=end\n?$/, '');
            } else {
                // InlineComment: # ...
                type = 'inline';
                // Strip '# ' or '#' prefix
                text = rawText.replace(/^#/, '');
                if (text.startsWith(' ')) {
                    text = text.substring(1);
                }
            }

            return {type, text, line, startOffset: startCharOffset, endOffset: endCharOffset, isTrailing};
        });
    }

    /**
     * Associate extracted source comments with blocks or create workspace comments.
     * Called after all blocks have been created in targetCodeToBlocks.
     * @param {object} parseResult - The prism parse result
     * @param {string} sourceCode - The original source code
     */
    _associateSourceComments (parseResult, sourceCode) {
        const sourceComments = this._extractSourceComments(parseResult, sourceCode);
        if (sourceComments.length === 0) {
            return;
        }

        // Build a map from start line to block ID.
        // Unlike lineToNodeMap (which uses a range/shallowest strategy), this maps only
        // lines where a node actually STARTS, preferring the most specific (smallest range) node.
        // This ensures "# comment\nloop do" attaches to the loop block, not a parent block.
        // Among blocks with equal range, prefer statement blocks over input (value) blocks,
        // so that "# comment\ngreet(name)" attaches to the procedures_call, not data_variable.
        const inputBlockIds = new Set();
        for (const block of Object.values(this._context.blocks)) {
            if (block.inputs) {
                for (const input of Object.values(block.inputs)) {
                    if (input.block) inputBlockIds.add(input.block);
                }
            }
        }

        const lineStartBlockMap = new Map();
        for (const [node, blockId] of this._context.nodeToBlockMap.entries()) {
            const startLine = this._getNodeStartLine(node);
            if (startLine === null) continue;
            const endLine = this._getNodeEndLine(node) || startLine;
            const range = endLine - startLine;
            const isInput = inputBlockIds.has(blockId);
            const existing = lineStartBlockMap.get(startLine);
            if (!existing ||
                range < existing.range ||
                (range === existing.range && !isInput && existing.isInput)) {
                lineStartBlockMap.set(startLine, {blockId, range, isInput});
            }
        }

        const findBlockForLine = line => {
            const entry = lineStartBlockMap.get(line);
            return entry ? entry.blockId : null;
        };

        // Group consecutive non-trailing comments that share adjacent lines
        const groups = [];
        let currentGroup = null;
        for (const comment of sourceComments) {
            if (comment.isTrailing) {
                // Trailing comments are always individual
                groups.push({comments: [comment], isTrailing: true});
                currentGroup = null;
            } else if (currentGroup && comment.line === currentGroup.endLine + 1) {
                // Consecutive comment on next line
                currentGroup.comments.push(comment);
                currentGroup.endLine = comment.line;
            } else {
                currentGroup = {comments: [comment], isTrailing: false, endLine: comment.line};
                groups.push(currentGroup);
            }
        }

        for (const group of groups) {
            const text = group.comments.map(c => c.text).join('\n');

            if (group.isTrailing) {
                // Trailing (inline) comment: attach to block on the same line
                const comment = group.comments[0];
                const blockId = findBlockForLine(comment.line) ||
                    this._findBlockIdForLine(comment.line);
                if (blockId) {
                    this._mergeUserComment(blockId, text, true);
                } else {
                    this._createComment(text, null);
                }
            } else {
                // Preceding comment: attach to block on the next code line
                const nextCodeLine = group.endLine + 1;

                // Check if next line is a class/module start
                // In that case, create a target-level comment (describes the definition, not a block)
                // DefNode is excluded: comments before def are attached to the
                // procedures_definition block so they appear inside the class.
                const containerRange = this._context.containerNodeRanges.find(
                    r => r.startLine === nextCodeLine &&
                        (r.type === 'ClassNode' || r.type === 'ModuleNode')
                );
                if (containerRange) {
                    // For modules, include @ruby:module:Name metadata so
                    // the generator can place the comment before the module code
                    if (containerRange.type === 'ModuleNode' && containerRange.moduleName) {
                        this._createComment(
                            `${text}\n@ruby:module:${containerRange.moduleName}`, null
                        );
                    } else {
                        this._createComment(text, null);
                    }
                } else {
                    const blockId = findBlockForLine(nextCodeLine);
                    if (blockId) {
                        this._mergeUserComment(blockId, text, false);
                    } else {
                        // No block found on next line - try scanning further down
                        // but stop at container node boundaries
                        let found = false;
                        for (let scanLine = nextCodeLine + 1; scanLine <= nextCodeLine + 5; scanLine++) {
                            const hitContainer = this._context.containerNodeRanges.some(
                                r => r.startLine === scanLine &&
                                    (r.type === 'ClassNode' || r.type === 'ModuleNode' || r.type === 'DefNode')
                            );
                            if (hitContainer) break;
                            const scanBlockId = findBlockForLine(scanLine) ||
                                this._findBlockIdForLine(scanLine);
                            if (scanBlockId) {
                                this._mergeUserComment(scanBlockId, text, false);
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            // Target-level (workspace) comment
                            this._createComment(text, null);
                        }
                    }
                }
            }
        }
    }

    /**
     * Find the block ID associated with a given source line number.
     * Uses lineToNodeMap and nodeToBlockMap.
     * @param {number} line - 1-based line number
     * @returns {string|null} The block ID, or null if not found
     */
    _findBlockIdForLine (line) {
        const entry = this._context.lineToNodeMap.get(line);
        if (!entry) {
            return null;
        }
        const blockId = this._context.nodeToBlockMap.get(entry.node);
        return blockId || null;
    }

    /**
     * Merge a user comment with an existing block comment, or create a new one.
     * User comment text is placed before any `@ruby:` metadata lines.
     * @param {string} blockId - The block ID to attach the comment to
     * @param {string} userText - The user comment text
     * @param {boolean} isInline - Whether this is an inline (trailing) comment
     */
    _mergeUserComment (blockId, userText, isInline) {
        const block = this._context.blocks[blockId];
        if (!block) {
            return;
        }

        const inlineMarker = isInline ? '@ruby:comment_position:inline\n' : '';

        if (block.comment) {
            // Block already has a comment - merge
            const existingComment = this._context.comments[block.comment];
            if (existingComment) {
                // Put user text before metadata lines
                const lines = existingComment.text.split('\n');
                const metadataLines = lines.filter(l => l.startsWith('@ruby:'));
                const newText = `${inlineMarker}${userText}\n${metadataLines.join('\n')}`;
                existingComment.text = newText;
            }
        } else {
            // Create new comment for this block
            const commentText = isInline ? `${inlineMarker}${userText}` : userText;
            block.comment = this._createComment(commentText, block.id);
        }
    }

    /**
     * Convert a ConstantReadNode or ConstantPathNode to its full path string.
     * e.g. ConstantReadNode "Foo" -> "Foo"
     * e.g. ConstantPathNode(ConstantPathNode(null, "Smalruby3"), "Sprite") -> "::Smalruby3::Sprite"
     * @param {object} node - A prism constant node
     * @returns {string} The full constant path
     */
    _constantNodeToPath (node) {
        const typeName = this._getNodeTypeName(node);
        if (typeName === 'ConstantReadNode') {
            return node.name;
        }
        if (typeName === 'ConstantPathNode') {
            if (node.parent) {
                return `${this._constantNodeToPath(node.parent)}::${node.name}`;
            }
            // Leading :: (root scope)
            return `::${node.name}`;
        }
        return String(node.name || '');
    }

    visitProgramNode (node) {
        return this.visit(node.statements);
    }

    visitModuleNode (node) {
        // module definitions are only supported in version 2
        if (String(this.version) === '1') {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.moduleNotSupportedInV1)
            );
        }

        // module is not supported in Stage (stage and sprite have different available methods)
        if (this._context.target && this._context.target.isStage) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.moduleNotSupportedInStage)
            );
        }

        // Nested modules are not supported
        if (this._context.currentModuleName) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.nestedModuleNotSupported)
            );
        }

        const moduleName = node.name;

        // Validate: only DefNode allowed in module body
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                const typeName = this._getNodeTypeName(stmt);
                if (typeName === 'CallNode' && stmt.name === 'module_function' && !stmt.receiver) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.moduleFunctionNotSupported)
                    );
                }
                if (typeName !== 'DefNode') {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.onlyMethodsInModule)
                    );
                }
            }
        }

        // Save the module's method DefNodes in context for later expansion by include
        this._context.modules[moduleName] = {
            name: moduleName,
            methods: (node.body && node.body.body) ? node.body.body : []
        };

        // Module definition itself does not produce blocks
        return [];
    }

    /**
     * Try to import a module definition from other sprites.
     * Searches other sprites' block comments for `@ruby:module_source:moduleName`,
     * generates Ruby code from the found sprite, extracts the module definition,
     * parses it, and stores the DefNodes in this._context.modules.
     * @param {string} moduleName - The module name to import
     * @returns {boolean} true if the module was successfully imported
     */
    _importModuleFromOtherSprites (moduleName) {
        if (!this.vm || !this.vm.runtime) return false;

        const currentTargetId = this._context.target ? this._context.target.id : null;
        const sourceCandidates = findTargetsWithModule(this.vm, moduleName, currentTargetId);
        if (sourceCandidates.length === 0) return false;

        // Use the first sprite that has the module
        const sourceTarget = sourceCandidates[0];
        const sourceCode = generateTargetCode(sourceTarget, String(this.version));
        const moduleCode = extractModuleCode(sourceCode, moduleName);
        if (!moduleCode) return false;

        // Parse the module code to get DefNodes
        const prism = RubyParser.getPrism();
        if (!prism) return false;

        const parseResult = prism.parse(moduleCode);
        if (parseResult.errors.length > 0) return false;

        // The parsed result should be: ProgramNode > StatementsNode > [ModuleNode]
        const root = parseResult.value;
        let moduleNode = null;
        if (root.statements && root.statements.body) {
            for (const stmt of root.statements.body) {
                if (this._getNodeTypeName(stmt) === 'ModuleNode') {
                    moduleNode = stmt;
                    break;
                }
            }
        }
        if (!moduleNode) return false;

        // Store the module's method DefNodes
        this._context.modules[moduleName] = {
            name: moduleName,
            methods: (moduleNode.body && moduleNode.body.body) ? moduleNode.body.body : []
        };
        return true;
    }

    visitClassNode (node) {
        // class definitions are only supported in version 2
        if (String(this.version) === '1') {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.classNotSupportedInV1)
            );
        }

        const className = node.name;
        const isSpriteIndexName = /^Sprite\d+$/.test(className);
        const isStageClass = className === 'Stage';

        // Extract superclass path (e.g. "::Smalruby3::Sprite", "Foo")
        let superclassPath = null;
        if (node.superclass) {
            superclassPath = this._constantNodeToPath(node.superclass);
        }

        // Stage only accepts no superclass, ::Smalruby3::Stage, or Smalruby3::Stage
        if (isStageClass && superclassPath !== null) {
            if (superclassPath !== '::Smalruby3::Stage' && superclassPath !== 'Smalruby3::Stage') {
                throw new RubyToBlocksConverterError(
                    node.superclass,
                    this._translator(messages.invalidStageSuperclass)
                );
            }
            // Accepted Stage superclass — don't store it (Stage is always Stage)
            superclassPath = null;
        }

        // Set of recognized set_xxx class methods (sprite-specific)
        const SPRITE_SET_METHODS = {
            set_name: 'name',
            set_sprite: 'sprite',
            set_x: 'x',
            set_y: 'y',
            set_direction: 'direction',
            set_visible: 'visible',
            set_size: 'size',
            set_current_costume: 'current_costume',
            set_rotation_style: 'rotation_style',
            set_costumes: 'costumes',
            set_sounds: 'sounds'
        };

        // Set of recognized set_xxx class methods (stage-specific)
        const STAGE_SET_METHODS = {
            set_name: 'name',
            set_current_backdrop: 'current_backdrop',
            set_backdrops: 'backdrops',
            set_sounds: 'sounds'
        };

        // Methods rejected in V2 (use def initialize instead)
        const REJECTED_SET_METHODS = new Set(['set_variables', 'set_lists']);

        // Methods only allowed in sprite classes (forbidden in Stage)
        const SPRITE_ONLY_METHODS = new Set([
            'set_sprite', 'set_x', 'set_y', 'set_direction', 'set_visible',
            'set_size', 'set_current_costume', 'set_rotation_style', 'set_costumes'
        ]);

        // Methods only allowed in stage class (forbidden in sprite classes)
        const STAGE_ONLY_METHODS = new Set([
            'set_current_backdrop', 'set_backdrops'
        ]);

        const SET_METHODS = isStageClass ? STAGE_SET_METHODS : SPRITE_SET_METHODS;

        // Canonical attribute order for comment text
        const SPRITE_ATTR_ORDER = [
            'sprite', 'name', 'x', 'y', 'direction', 'visible', 'size',
            'current_costume', 'rotation_style', 'costumes', 'sounds'
        ];
        const STAGE_ATTR_ORDER = [
            'name', 'current_backdrop', 'backdrops', 'sounds'
        ];
        const ATTR_ORDER = isStageClass ? STAGE_ATTR_ORDER : SPRITE_ATTR_ORDER;

        // Pre-scan class body for set_xxx calls
        const classInfo = {};
        const setMethodNames = new Set();
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'CallNode' &&
                    !stmt.receiver &&
                    stmt.arguments_ &&
                    stmt.arguments_.arguments_.length === 1) {

                    // Check for cross-class method usage
                    if (isStageClass && SPRITE_ONLY_METHODS.has(stmt.name)) {
                        throw new RubyToBlocksConverterError(
                            stmt,
                            this._translator(messages.spriteMethodInStageClass, {METHOD: stmt.name})
                        );
                    }
                    if (!isStageClass && STAGE_ONLY_METHODS.has(stmt.name)) {
                        throw new RubyToBlocksConverterError(
                            stmt,
                            this._translator(messages.stageMethodInSpriteClass, {METHOD: stmt.name})
                        );
                    }

                    // Reject set_variables/set_lists in V2
                    if (REJECTED_SET_METHODS.has(stmt.name)) {
                        throw new RubyToBlocksConverterError(
                            stmt,
                            this._translator(messages.setVariablesListsNotSupported, {METHOD: stmt.name})
                        );
                    }

                    if (SET_METHODS[stmt.name]) {
                        const attrName = SET_METHODS[stmt.name];
                        const arg = stmt.arguments_.arguments_[0];
                        const value = this._extractClassMethodArg(arg);
                        if (value !== null) {
                            classInfo[attrName] = value;
                            setMethodNames.add(stmt.name);
                        }
                    }
                }
            }
        }

        // Pre-scan for include/extend statements
        const includedModuleNames = [];
        const includeStatements = new Set();
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'CallNode' && !stmt.receiver) {
                    // Reject extend
                    if (stmt.name === 'extend') {
                        throw new RubyToBlocksConverterError(
                            stmt,
                            this._translator(messages.extendNotSupported)
                        );
                    }
                    // Handle include
                    if (stmt.name === 'include' &&
                        stmt.arguments_ &&
                        stmt.arguments_.arguments_.length === 1) {
                        const argNode = stmt.arguments_.arguments_[0];
                        const argType = this._getNodeTypeName(argNode);
                        if (argType === 'ConstantReadNode') {
                            const moduleName = argNode.name;

                            if (isStageClass) {
                                throw new RubyToBlocksConverterError(
                                    stmt,
                                    this._translator(messages.includeNotSupportedInStage)
                                );
                            }

                            if (!this._context.modules[moduleName]) {
                                // Try to import the module from other sprites
                                const imported = this._importModuleFromOtherSprites(moduleName);
                                if (!imported) {
                                    throw new RubyToBlocksConverterError(
                                        stmt,
                                        this._translator(messages.undefinedModule, {NAME: moduleName})
                                    );
                                }
                            }

                            includedModuleNames.push(moduleName);
                            includeStatements.add(stmt);
                        }
                    }
                }
            }
        }

        // Pre-scan class methods for super usage to determine which module methods need renaming
        // superMethodMap: { methodName: { moduleName, renamedProcName } }
        const superMethodMap = {};
        if (node.body && node.body.body && includedModuleNames.length > 0) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'DefNode' && !stmt.receiver) {
                    const methodName = stmt.name;
                    if (this._nodeContainsSuper(stmt)) {
                        // Find which module has a method with the same name
                        let foundModule = null;
                        for (const moduleName of includedModuleNames) {
                            const moduleDef = this._context.modules[moduleName];
                            if (moduleDef && moduleDef.methods.some(m => m.name === methodName)) {
                                foundModule = moduleName;
                                break;
                            }
                        }
                        if (foundModule) {
                            const index = Object.keys(superMethodMap).length + 1;
                            superMethodMap[methodName] = {
                                moduleName: foundModule,
                                renamedProcName: `_super_${methodName}_${index}_`
                            };
                        }
                    }
                }
            }
        }
        this._context.superMethodMap = superMethodMap;

        // Mutual exclusion: set_sprite cannot be used with set_costumes/set_sounds (sprite only)
        const has = prop => Object.prototype.hasOwnProperty.call(classInfo, prop);
        if (!isStageClass && has('sprite') && (has('costumes') || has('sounds'))) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.spriteAndCostumesSoundsExclusive)
            );
        }

        // Validate library names
        if (has('sprite') && !spriteLibraryNames.has(classInfo.sprite)) {
            throw new RubyToBlocksConverterError(
                node,
                this._translator(messages.invalidSpriteName, {NAME: classInfo.sprite})
            );
        }
        if (has('costumes') && Array.isArray(classInfo.costumes)) {
            for (const name of classInfo.costumes) {
                if (!costumeLibraryNames.has(name)) {
                    throw new RubyToBlocksConverterError(
                        node,
                        this._translator(messages.invalidCostumeName, {NAME: name})
                    );
                }
            }
        }
        if (has('backdrops') && Array.isArray(classInfo.backdrops)) {
            for (const name of classInfo.backdrops) {
                if (!backdropLibraryNames.has(name)) {
                    throw new RubyToBlocksConverterError(
                        node,
                        this._translator(messages.invalidBackdropName, {NAME: name})
                    );
                }
            }
        }
        if (has('sounds') && Array.isArray(classInfo.sounds)) {
            for (const name of classInfo.sounds) {
                if (!soundLibraryNames.has(name)) {
                    throw new RubyToBlocksConverterError(
                        node,
                        this._translator(messages.invalidSoundName, {NAME: name})
                    );
                }
            }
        }

        // Collect attribute names for comment
        const attributeNames = Object.keys(classInfo);
        if (!isSpriteIndexName && !isStageClass && !Object.prototype.hasOwnProperty.call(classInfo, 'name')) {
            attributeNames.push('name');
        }
        // Sort by canonical order
        attributeNames.sort((a, b) => ATTR_ORDER.indexOf(a) - ATTR_ORDER.indexOf(b));

        // Generate comment text
        // For non-Sprite\d+ class names (excluding Stage), use name=ClassName format to preserve the class name
        // Superclass is encoded as <=path with :: replaced by /
        let commentText;
        const commentParts = [];
        if (superclassPath) {
            let encodedSuperclass;
            if (superclassPath.startsWith('::')) {
                encodedSuperclass = `//${superclassPath.slice(2).replace(/::/g, '/')}`;
            } else {
                encodedSuperclass = superclassPath.replace(/::/g, '/');
            }
            commentParts.push(`<=${encodedSuperclass}`);
        }
        if (attributeNames.length > 0) {
            attributeNames.forEach(attr => {
                if (attr === 'name' && !isSpriteIndexName && !isStageClass) {
                    commentParts.push(`name=${className}`);
                } else if (attr === 'sprite') {
                    commentParts.push(`sprite=${classInfo.sprite}`);
                } else {
                    commentParts.push(attr);
                }
            });
        }
        // Add include= parts for each included module (in order)
        includedModuleNames.forEach(moduleName => {
            commentParts.push(`include=${moduleName}`);
        });

        if (commentParts.length > 0) {
            commentText = `@ruby:class:${commentParts.join(',')}`;
        } else {
            commentText = '@ruby:class';
        }
        this._createComment(commentText, null);

        // Store class info in context
        if (attributeNames.length > 0) {
            if (!Object.prototype.hasOwnProperty.call(classInfo, 'name') && !isSpriteIndexName && !isStageClass) {
                classInfo.name = className;
            }
            this._context.classInfo = classInfo;
        }

        // Expand included module methods: visit each module's DefNodes and attach comments
        const moduleBlocks = [];
        for (const moduleName of includedModuleNames) {
            const moduleDef = this._context.modules[moduleName];
            this._context.currentModuleName = moduleName;
            for (const methodNode of moduleDef.methods) {
                const originalMethodName = methodNode.name;
                const superEntry = superMethodMap[originalMethodName];

                // If this method is overridden with super, rename it
                if (superEntry && superEntry.moduleName === moduleName) {
                    this._context.superRenameTarget = superEntry.renamedProcName;
                }

                const block = this.visit(methodNode);

                this._context.superRenameTarget = null;

                if (block) {
                    const blocks = Array.isArray(block) ? block : [block];
                    for (const b of blocks) {
                        if (b && b.opcode === 'procedures_definition') {
                            // Attach comment with super_of info if renamed
                            let moduleCommentText;
                            if (superEntry && superEntry.moduleName === moduleName) {
                                moduleCommentText = `@ruby:module_source:${moduleName}:super_of:${originalMethodName}`;
                            } else {
                                moduleCommentText = `@ruby:module_source:${moduleName}`;
                            }
                            const commentId = this._createComment(
                                moduleCommentText, b.id, 0, 0, true
                            );
                            b.comment = commentId;
                        }
                    }
                    moduleBlocks.push(...blocks);
                }
            }
            this._context.currentModuleName = null;
        }

        // Pre-scan for def initialize and process it
        const initializeNodes = new Set();
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'DefNode' && stmt.name === 'initialize') {
                    initializeNodes.add(stmt);
                    this._processInitialize(stmt, isStageClass);
                }
            }
        }

        // Visit class body, filtering out set_xxx calls, include statements, and def initialize
        if (node.body && node.body.body) {
            const filteredStatements = node.body.body.filter(stmt => {
                if (this._getNodeTypeName(stmt) === 'CallNode' &&
                    setMethodNames.has(stmt.name) &&
                    !stmt.receiver) {
                    return false;
                }
                // Filter out include statements (already processed above)
                if (includeStatements.has(stmt)) {
                    return false;
                }
                // Filter out def initialize (already processed above)
                if (initializeNodes.has(stmt)) {
                    return false;
                }
                return true;
            });

            if (filteredStatements.length === 0) {
                return moduleBlocks;
            }

            // Visit filtered statements manually
            const blocks = [];
            const blockToStmt = new Map();
            for (const stmt of filteredStatements) {
                this._context.methodCallIndices = {};
                const block = this.visit(stmt);
                if (Array.isArray(block)) {
                    block.forEach(b => {
                        blocks.push(b);
                        blockToStmt.set(b, stmt);
                    });
                } else if (block !== null && typeof block !== 'undefined') {
                    blocks.push(block);
                    blockToStmt.set(block, stmt);
                }
            }

            // Validate: only hat blocks and procedures_definition are allowed at class top-level
            for (const block of blocks) {
                if (!block || !block.opcode) continue;
                const blockType = this._getBlockType(block);
                if (blockType !== 'hat' && block.opcode !== 'procedures_definition') {
                    const errorNode = block.node || blockToStmt.get(block) || node;
                    const src = this._truncateSource(this._getSource(errorNode));
                    throw new RubyToBlocksConverterError(
                        errorNode,
                        this._translator(
                            messages.wrongInstructionInClass,
                            {SOURCE: src}
                        )
                    );
                }
            }

            return [...moduleBlocks, ...blocks];
        }
        return moduleBlocks;
    }

    /**
     * Process def initialize in a class body.
     * Extracts variable/list assignments and stores them in context.
     * @param {object} defNode - The DefNode for initialize
     * @param {boolean} isStageClass - Whether this is a Stage class
     */
    _processInitialize (defNode, isStageClass) {
        const commentParts = [];

        // Save arguments if present
        if (defNode.parameters) {
            const params = this._getSource(defNode.parameters);
            if (params) {
                commentParts.push(`args=${params}`);
            }
        }

        // Get body statements
        let bodyStmts = [];
        if (defNode.body && defNode.body.body) {
            bodyStmts = Array.isArray(defNode.body.body) ?
                defNode.body.body :
                [defNode.body.body];
        }

        // Check for super at the beginning
        let startIndex = 0;
        if (bodyStmts.length > 0) {
            const firstType = this._getNodeTypeName(bodyStmts[0]);
            if (firstType === 'SuperNode') {
                const superArgs = bodyStmts[0].arguments_;
                if (superArgs && superArgs.arguments_ && superArgs.arguments_.length > 0) {
                    const argsSource = superArgs.arguments_.map(a => this._getSource(a)).join(', ');
                    commentParts.push(`super=(${argsSource})`);
                } else {
                    commentParts.push('super');
                }
                startIndex = 1;
            } else if (firstType === 'ForwardingSuperNode') {
                commentParts.push('super');
                startIndex = 1;
            }
        }

        // Process body statements (variable/list assignments only)
        const initializeValues = {};
        for (let i = startIndex; i < bodyStmts.length; i++) {
            const stmt = bodyStmts[i];
            const stmtType = this._getNodeTypeName(stmt);

            if (stmtType === 'InstanceVariableWriteNode') {
                if (isStageClass) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.wrongVariableScopeInInitialize, {
                            SOURCE: this._getSource(stmt),
                            PREFIX: '$',
                            CLASS_TYPE: 'Stage'
                        })
                    );
                }
                const varName = stmt.name.replace(/^@/, '');
                const value = this._extractInitializeValue(stmt.value);
                if (value === null) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.invalidInitializeBody, {
                            SOURCE: this._truncateSource(this._getSource(stmt))
                        })
                    );
                }
                if (Array.isArray(value)) {
                    initializeValues[varName] = {value, type: 'list'};
                    this._lookupOrCreateList(`@${varName}`);
                } else {
                    initializeValues[varName] = {value, type: ''};
                    this._lookupOrCreateVariable(`@${varName}`);
                }
            } else if (stmtType === 'GlobalVariableWriteNode') {
                if (!isStageClass) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.wrongVariableScopeInInitialize, {
                            SOURCE: this._getSource(stmt),
                            PREFIX: '@',
                            CLASS_TYPE: 'sprite'
                        })
                    );
                }
                const varName = stmt.name.replace(/^\$/, '');
                const value = this._extractInitializeValue(stmt.value);
                if (value === null) {
                    throw new RubyToBlocksConverterError(
                        stmt,
                        this._translator(messages.invalidInitializeBody, {
                            SOURCE: this._truncateSource(this._getSource(stmt))
                        })
                    );
                }
                if (Array.isArray(value)) {
                    initializeValues[varName] = {value, type: 'list'};
                    this._lookupOrCreateList(`$${varName}`);
                } else {
                    initializeValues[varName] = {value, type: ''};
                    this._lookupOrCreateVariable(`$${varName}`);
                }
            } else {
                const src = this._truncateSource(this._getSource(stmt));
                throw new RubyToBlocksConverterError(
                    stmt,
                    this._translator(messages.invalidInitializeBody, {SOURCE: src})
                );
            }
        }

        this._context.initializeValues = initializeValues;

        // Create comment for round-trip
        if (commentParts.length > 0) {
            this._createComment(`@ruby:initialize:${commentParts.join(',')}`, null);
        }
    }

    /**
     * Extract a scalar or array value from an AST node for def initialize.
     * @param {object} valueNode - AST node representing the value
     * @returns {number|string|boolean|Array|null} The extracted value, or null if not supported
     */
    _extractInitializeValue (valueNode) {
        const type = this._getNodeTypeName(valueNode);
        switch (type) {
        case 'IntegerNode':
            return valueNode.value;
        case 'FloatNode':
            return valueNode.value;
        case 'StringNode': {
            const unescaped = valueNode.unescaped;
            return typeof unescaped === 'object' ? unescaped.value : unescaped;
        }
        case 'TrueNode':
            return true;
        case 'FalseNode':
            return false;
        case 'NilNode':
            return '';
        case 'CallNode':
            // Handle negative numbers: -10 (parsed as CallNode with name '-@')
            if (valueNode.name === '-@') {
                const inner = this._extractInitializeValue(valueNode.receiver);
                if (typeof inner === 'number') return -inner;
            }
            return null;
        case 'ArrayNode': {
            const elements = valueNode.elements || [];
            const result = [];
            for (const elem of elements) {
                const val = this._extractInitializeValue(elem);
                if (val === null) return null;
                if (Array.isArray(val)) return null; // No nested arrays
                result.push(val);
            }
            return result;
        }
        default:
            return null;
        }
    }

    /**
     * Check if an AST node tree contains a SuperNode or ForwardingSuperNode.
     * @param {object} node - AST node to search
     * @returns {boolean} true if super is found
     */
    _nodeContainsSuper (node) {
        if (!node) return false;
        const typeName = this._getNodeTypeName(node);
        if (typeName === 'SuperNode' || typeName === 'ForwardingSuperNode') {
            return true;
        }
        if (node.compactChildNodes) {
            for (const child of node.compactChildNodes()) {
                if (this._nodeContainsSuper(child)) {
                    return true;
                }
            }
        }
        return false;
    }

    _extractClassMethodArg (argNode) {
        const type = this._getNodeTypeName(argNode);
        switch (type) {
        case 'StringNode': {
            const unescaped = argNode.unescaped;
            return typeof unescaped === 'object' ? unescaped.value : unescaped;
        }
        case 'IntegerNode':
            return argNode.value;
        case 'FloatNode':
            return argNode.value;
        case 'TrueNode':
            return true;
        case 'FalseNode':
            return false;
        case 'CallNode':
            // Handle unary minus: e.g., -50
            if (argNode.name === '-@' && argNode.receiver) {
                const innerValue = this._extractClassMethodArg(argNode.receiver);
                if (typeof innerValue === 'number') {
                    return -innerValue;
                }
            }
            return null;
        case 'ArrayNode': {
            const elements = argNode.elements;
            if (!elements || elements.length === 0) return null;
            const result = [];
            for (const elem of elements) {
                const val = this._extractClassMethodArg(elem);
                if (val === null) return null;
                result.push(val);
            }
            return result;
        }
        default:
            return null;
        }
    }
}

// Mixin methods
Object.assign(RubyToBlocksConverter.prototype, BlockUtils);
Object.assign(RubyToBlocksConverter.prototype, NodeUtils);
Object.assign(RubyToBlocksConverter.prototype, VariableUtils);
Object.assign(RubyToBlocksConverter.prototype, ContextUtils);
Object.assign(RubyToBlocksConverter.prototype, ScopeManager);
Object.assign(RubyToBlocksConverter.prototype, AstHandlers);
Object.assign(RubyToBlocksConverter.prototype, LineMappingUtils);
Object.assign(RubyToBlocksConverter.prototype, ConverterRegistry);
Object.assign(RubyToBlocksConverter.prototype, TargetApplier);

/**
 * Null of RubyToBlocksConverter
 */
const NullRubyToBlocksConverter = {
    result: true,
    errors: [],
    apply: () => Promise.resolve()
};

const targetCodeToBlocks = async function (vm, target, code, intl, options) {
    const converter = new RubyToBlocksConverter(vm, options);
    if (intl) {
        converter.setTranslatorFunction(intl.formatMessage);
    }
    const result = await converter.targetCodeToBlocks(target, code);
    converter.result = result; // eslint-disable-line require-atomic-updates
    if (result) {
        converter.apply = () => converter.applyTargetBlocks(target);
    }
    return converter;
};

export {
    RubyToBlocksConverter as default,
    NullRubyToBlocksConverter,
    targetCodeToBlocks
};
