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
    },
    wrongInstructionInClass: {
        defaultMessage: '"{ SOURCE }" cannot be placed directly inside a class definition.' +
            ' Use it inside an event block (e.g. when_flag_clicked) or a method definition (def).',
        description: 'Error message when a non-hat/non-def block is placed directly in a class body',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongInstructionInClass'
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
                    this._context.errors.push(this._toErrorAnnotation(
                        e.location.startLine, e.location.startColumn, e.message
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
            if (root.constructor.name !== 'StatementsNode' &&
                root.constructor.name !== 'ProgramNode' &&
                root.constructor.name !== 'BeginNode') {
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

        // Set of recognized set_xxx class methods
        const SET_METHODS = {
            set_name: 'name',
            set_x: 'x',
            set_y: 'y',
            set_direction: 'direction',
            set_visible: 'visible',
            set_size: 'size',
            set_current_costume: 'current_costume',
            set_rotation_style: 'rotation_style',
            set_costumes: 'costumes',
            set_variables: 'variables',
            set_lists: 'lists'
        };

        // Canonical attribute order for comment text
        const ATTR_ORDER = [
            'name', 'x', 'y', 'direction', 'visible', 'size',
            'current_costume', 'rotation_style', 'costumes', 'variables', 'lists'
        ];

        // Pre-scan class body for set_xxx calls
        const classInfo = {};
        const setMethodNames = new Set();
        if (node.body && node.body.body) {
            for (const stmt of node.body.body) {
                if (this._getNodeTypeName(stmt) === 'CallNode' &&
                    SET_METHODS[stmt.name] &&
                    !stmt.receiver &&
                    stmt.arguments_ &&
                    stmt.arguments_.arguments_.length === 1) {
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

        // Collect attribute names for comment
        const attributeNames = Object.keys(classInfo);
        if (!isSpriteIndexName && !Object.prototype.hasOwnProperty.call(classInfo, 'name')) {
            attributeNames.push('name');
        }
        // Sort by canonical order
        attributeNames.sort((a, b) => ATTR_ORDER.indexOf(a) - ATTR_ORDER.indexOf(b));

        // Generate comment text
        // For non-Sprite\d+ class names, use name=ClassName format to preserve the class name
        let commentText;
        if (attributeNames.length > 0) {
            const commentParts = attributeNames.map(attr => {
                if (attr === 'name' && !isSpriteIndexName) {
                    return `name=${className}`;
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
            if (!Object.prototype.hasOwnProperty.call(classInfo, 'name') && !isSpriteIndexName) {
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
