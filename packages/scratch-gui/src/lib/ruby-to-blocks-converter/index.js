import {
    ProgramNode,
    StatementsNode,
    BlockNode,
    BeginNode,
    DefNode,
    ClassNode,
    ModuleNode,
} from '@ruby/prism/src/nodes.js';
import { Visitor } from '@ruby/prism/src/visitor.js';
import _ from 'lodash';
import RubyParser from '../ruby-parser';
import { analyze } from './analysis';
import AstHandlers from './ast-handlers';
import BlockUtils from './block-utils';
import ClassVisitor from './class-visitor';
import CommentHandler from './comment-handler';
import ContextUtils from './context-utils';
import { messages } from './converter-errors';
import ConverterRegistry from './converter-registry';
import { RubyToBlocksConverterError } from './errors';
import Finish from './finish';
import InitializeHandler from './initialize-handler';
import LineMappingUtils from './line-mapping';
import ModuleVisitor from './module-visitor';
import NodeUtils from './node-utils';
import { nodeTypeName } from './node-walk';
import PrismErrorTranslator from './prism-error-translator';
import registerConverters from './register-converters';
import ReturnValueTemps from './return-value-temps';
import ScopeManager from './scope-manager';
import TargetApplier from './target-applier';
import VariableUtils from './variable-utils';

/**
 * Class for a block converter that translates ruby code into the blocks.
 */
class RubyToBlocksConverter extends Visitor {
    constructor(vm, options) {
        super();
        this.vm = vm;
        this.version = options && options.version ? options.version : 1;
        // 音・コスチューム・背景の名前が作品に無いときにエラーにするか。レッスンのヒントの吹き出しは
        // まだ足していない音や背景のブロックも描くので false にする
        this.validateAssets = !(options && options.validateAssets === false);
        this._translator = (message, values) => {
            let text = message.defaultMessage;
            if (values) {
                Object.keys(values).forEach((key) => {
                    text = text.replace(new RegExp(`\\{\\s*${key}\\s*\\}`, 'g'), values[key]);
                });
            }
            return text;
        };
        // Keyed by method names: `toString` / `constructor` must not find Object.prototype (#2034).
        this._receiverToMethods = Object.create(null);
        this._receiverToMyBlocks = Object.create(null);
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

    get errors() {
        return this._context.errors;
    }

    get blocks() {
        return this._context.blocks;
    }

    get variables() {
        return this._context.variables;
    }

    get lists() {
        return this._context.lists;
    }

    get broadcastMsgs() {
        return this._context.broadcastMsgs;
    }

    _symbolNeedsToSMessage() {
        return messages.symbolNeedsToS;
    }

    _symbolCannotArithmeticMessage() {
        return messages.symbolCannotArithmetic;
    }

    _symbolCannotCompareMessage() {
        return messages.symbolCannotCompare;
    }

    setTranslatorFunction(translator) {
        this._translator = translator;
        this._prismErrorTranslator = new PrismErrorTranslator(translator);
    }

    async targetCodeToBlocks(target, code) {
        this.reset();
        this._setTarget(target);
        this._loadVariables(target);
        this._context.sourceCode = code;
        this._buildByteToCharMap();
        try {
            const prism = RubyParser.getPrism() || (await RubyParser.loadPrism());
            const parseResult = prism.parse(code);
            if (parseResult.errors.length > 0) {
                parseResult.errors.forEach((e) => {
                    const translatedMessage = this._prismErrorTranslator.translate(e.message);
                    // Prism error locations have startOffset (byte-based) but not startLine/startColumn.
                    // Compute line/column from the byte offset using our byte→char mapping.
                    const loc = this._getLoc({ location: e.location });
                    this._context.errors.push(this._toErrorAnnotation(loc.line, loc.column, translatedMessage));
                });
                return false;
            }
            const root = parseResult.value;
            this._context.rootNode = root; // Save root node for line mapping
            // The analysis stage (docs/ruby-editor/converter-stages.md): walk the tree once before
            // converting and keep what the conversion reads in a frozen table: how each variable
            // name is used, so that `@a.length` does not depend on whether `@a = "abc"` was
            // converted before it (issue #1613), the units of the locals (issue #1630), and the
            // calls of the procedures whose values are used (the variables of their return values).
            this._context.analysis = analyze(root, { source: code });
            // One `@a` used as both a variable and a list is an error (issues #1593 / #1622)
            this._rejectRubyNameOfVariableAndList();
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
            const rootType = nodeTypeName(root);
            if (rootType !== 'StatementsNode' && rootType !== 'ProgramNode' && rootType !== 'BeginNode') {
                blocks = this._linkBlocks(blocks);
            }
            // The finish stage (finish.js): what is decided or checked after the whole code is converted
            this._finish(blocks, parseResult, code);

            return true;
        } catch (e) {
            let error;
            if (e instanceof RubyToBlocksConverterError) {
                const loc = this._getLoc(e.node);
                error = this._toErrorAnnotation(loc.line, loc.column, e.message, this._getSource(e.node));
            } else if (this._context.currentNode) {
                const loc = this._getLoc(this._context.currentNode);
                error = this._toErrorAnnotation(
                    loc.line,
                    loc.column,
                    e.message,
                    this._getSource(this._context.currentNode),
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

    visit(node) {
        if (!node) {
            return null;
        }

        // Track depth for lineToNodeMap
        const depth = this._context.processDepth || 0;
        this._context.processDepth = depth + 1;

        const startLine = this._getNodeStartLine(node);
        const endLine = this._getNodeEndLine(node) || startLine;

        if (startLine !== null && endLine !== null) {
            const isContainerNode =
                node instanceof ProgramNode ||
                node instanceof StatementsNode ||
                node instanceof BlockNode ||
                node instanceof BeginNode ||
                node instanceof DefNode ||
                node instanceof ClassNode ||
                node instanceof ModuleNode;

            if (isContainerNode) {
                const rangeEntry = {
                    type: nodeTypeName(node),
                    startLine,
                    endLine,
                    depth,
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
                        this._context.lineToNodeMap.set(line, { node, depth });
                    }
                }
            }
        }

        const previousNode = this._context.currentNode;
        this._context.currentNode = node;
        // A method or a block of the script has its own local variables (issue #1630)
        const previousLocalUnit = this._enterLocalUnit(node);

        // The type name is found by node.accept() once for each class of node (`nodeTypeName`):
        // constructor.name is mangled by esbuild/terser in production builds.
        const typeName = nodeTypeName(node);
        const handlerName = typeName ? `visit${typeName}` : null;

        let result;
        try {
            if (handlerName && typeof this[handlerName] === 'function') {
                result = this[handlerName](node);
            } else {
                throw new Error(`not supported node type: ${typeName}`);
            }
        } finally {
            if (previousLocalUnit !== null) this._context.currentLocalUnit = previousLocalUnit;
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

    /**
     * Convert a ConstantReadNode or ConstantPathNode to its full path string.
     * e.g. ConstantReadNode "Foo" -> "Foo"
     * e.g. ConstantPathNode(ConstantPathNode(null, "Smalruby3"), "Sprite") -> "::Smalruby3::Sprite"
     * @param {object} node - A prism constant node
     * @returns {string} The full constant path
     */
    _constantNodeToPath(node) {
        const typeName = nodeTypeName(node);
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

    visitProgramNode(node) {
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
Object.assign(RubyToBlocksConverter.prototype, ReturnValueTemps);
Object.assign(RubyToBlocksConverter.prototype, LineMappingUtils);
Object.assign(RubyToBlocksConverter.prototype, ConverterRegistry);
Object.assign(RubyToBlocksConverter.prototype, TargetApplier);
Object.assign(RubyToBlocksConverter.prototype, CommentHandler);
Object.assign(RubyToBlocksConverter.prototype, ClassVisitor);
Object.assign(RubyToBlocksConverter.prototype, InitializeHandler);
Object.assign(RubyToBlocksConverter.prototype, ModuleVisitor);
Object.assign(RubyToBlocksConverter.prototype, Finish);

/**
 * Null of RubyToBlocksConverter
 */
const NullRubyToBlocksConverter = {
    result: true,
    errors: [],
    apply: () => Promise.resolve(),
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

export { RubyToBlocksConverter as default, NullRubyToBlocksConverter, targetCodeToBlocks };
