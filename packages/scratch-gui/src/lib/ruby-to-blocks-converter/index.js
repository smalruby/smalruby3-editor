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

    setTranslatorFunction (translator) {
        this._translator = translator;
        this._prismErrorTranslator = new PrismErrorTranslator(translator);
    }

    async targetCodeToBlocks (target, code) {
        this.reset();
        this._setTarget(target);
        this._loadVariables(target);
        this._context.sourceCode = code;
        try {
            const prism = RubyParser.getPrism() || await RubyParser.loadPrism();
            const parseResult = prism.parse(code);
            if (parseResult.errors.length > 0) {
                parseResult.errors.forEach(e => {
                    const translatedMessage = this._prismErrorTranslator.translate(e.message);
                    this._context.errors.push(this._toErrorAnnotation(
                        e.location.startLine, e.location.startColumn, translatedMessage
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
                this._context.containerNodeRanges.push({
                    type: node.constructor.name,
                    startLine,
                    endLine,
                    depth
                });
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

    visitProgramNode (node) {
        return this.visit(node.statements);
    }

    visitClassNode (node) {
        const className = node.name;
        const isSpriteIndexName = /^Sprite\d+$/.test(className);
        const isStageClass = className === 'Stage';

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
            set_sounds: 'sounds',
            set_variables: 'variables',
            set_lists: 'lists'
        };

        // Set of recognized set_xxx class methods (stage-specific)
        const STAGE_SET_METHODS = {
            set_name: 'name',
            set_current_backdrop: 'current_backdrop',
            set_backdrops: 'backdrops',
            set_sounds: 'sounds',
            set_variables: 'variables',
            set_lists: 'lists'
        };

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
            'current_costume', 'rotation_style', 'costumes', 'sounds', 'variables', 'lists'
        ];
        const STAGE_ATTR_ORDER = [
            'name', 'current_backdrop', 'backdrops', 'sounds', 'variables', 'lists'
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
        let commentText;
        if (attributeNames.length > 0) {
            const commentParts = attributeNames.map(attr => {
                if (attr === 'name' && !isSpriteIndexName && !isStageClass) {
                    return `name=${className}`;
                }
                if (attr === 'sprite') {
                    return `sprite=${classInfo.sprite}`;
                }
                return attr;
            });
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

        // Visit class body, filtering out set_xxx calls
        if (node.body && node.body.body) {
            const filteredStatements = node.body.body.filter(stmt => {
                if (this._getNodeTypeName(stmt) === 'CallNode' &&
                    setMethodNames.has(stmt.name) &&
                    !stmt.receiver) {
                    return false;
                }
                return true;
            });

            if (filteredStatements.length === 0) {
                return [];
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

            return blocks;
        }
        return [];
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
