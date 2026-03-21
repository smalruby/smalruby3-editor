import _ from 'lodash';
import RubyParser from '../ruby-parser';
import {Visitor} from '@ruby/prism/src/visitor.js';
import {
    ProgramNode, StatementsNode, BlockNode, BeginNode, DefNode, ClassNode, ModuleNode
} from '@ruby/prism/src/nodes.js';

import {RubyToBlocksConverterError} from './errors';
import {messages, getExtensionIdForOpcode} from './converter-errors';
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
import CommentHandler from './comment-handler';
import ClassVisitor from './class-visitor';
import InitializeHandler from './initialize-handler';
import ModuleVisitor from './module-visitor';
import PrismErrorTranslator from './prism-error-translator';

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
            // This is needed for cases like "text = gets" where a single statement returns
            // multiple blocks
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
Object.assign(RubyToBlocksConverter.prototype, CommentHandler);
Object.assign(RubyToBlocksConverter.prototype, ClassVisitor);
Object.assign(RubyToBlocksConverter.prototype, InitializeHandler);
Object.assign(RubyToBlocksConverter.prototype, ModuleVisitor);

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
