import { Visitor } from '@ruby/prism/src/visitor.js';
import RubyParser from '../ruby-parser';
import { messages } from './converter-errors';
import { RubyToBlocksConverterError } from './errors';
import PrismErrorTranslator from './prism-error-translator';
import registerConverters from './register-converters';
import { STAGES, mixStages } from './stages';

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

    /**
     * Convert the Ruby code of a target into blocks in four stages
     * (docs/ruby-editor/converter-stages.md): parse, analyze, convert and finish. The parts of each
     * stage are in `stages.js`.
     * The blocks are written into the target later by `applyTargetBlocks` (target-applier.js).
     * @param {object} target - The target (sprite or stage) of the code.
     * @param {string} code - The Ruby code.
     * @returns {Promise<boolean>} Whether the code was converted. The errors are in `errors`.
     */
    async targetCodeToBlocks(target, code) {
        this.reset();
        this._setTarget(target);
        this._loadVariables(target);
        this._indexSource(code);
        try {
            // Await only while prism is not loaded yet, and keep the stages synchronous: one more
            // await delays the end of every conversion, and the Ruby tab then lost the error alert
            // of a failed conversion when the sprite was changed (conversion-timing.test.js).
            const prism = RubyParser.getPrism() || (await RubyParser.loadPrism());
            const parseResult = this._parse(prism, code);
            if (!parseResult) {
                return false;
            }
            const root = parseResult.value;
            this._analyze(root, code);
            const blocks = this._convert(root);
            if (blocks === null) {
                return true;
            }
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
}

// The parts of the four stages (stages.js)
mixStages(RubyToBlocksConverter.prototype, STAGES);

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
