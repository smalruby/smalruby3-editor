// === Smalruby: This file is Smalruby-specific (the parse stage, docs/ruby-editor/converter-stages.md) ===
import { unwrapWithoutScreenRefreshDefs } from './screen-refresh-defs';

/**
 * The parse stage: the index of the source and the tree of prism. Mixed into
 * RubyToBlocksConverter.prototype by `stages.js`.
 * @type {object}
 */
const ParseStage = {
    /**
     * The first half of the parse stage: the index of the source (byte → character), which the
     * locations of the errors of every stage read.
     * @param {string} code - The Ruby code.
     */
    _indexSource(code) {
        this._context.sourceCode = code;
        this._buildByteToCharMap();
    },

    /**
     * The parse stage: parse the code with prism. A syntax error is translated and put in `errors`.
     * @param {object} prism - The loaded prism.
     * @param {string} code - The Ruby code.
     * @returns {object|null} The result of prism, or null when the code has syntax errors.
     */
    _parse(prism, code) {
        const parseResult = prism.parse(code);
        if (parseResult.errors.length > 0) {
            parseResult.errors.forEach((e) => {
                const translatedMessage = this._prismErrorTranslator.translate(e.message);
                // Prism error locations have startOffset (byte-based) but not startLine/startColumn.
                // Compute line/column from the byte offset using our byte→char mapping.
                const loc = this._getLoc({ location: e.location });
                this._context.errors.push(this._toErrorAnnotation(loc.line, loc.column, translatedMessage));
            });
            return null;
        }
        this._context.rootNode = parseResult.value; // Save root node for line mapping
        // `without_screen_refresh def foo` becomes the `def`; the `def`s are kept (issue #2114).
        this._context.warpDefNodes = unwrapWithoutScreenRefreshDefs(parseResult.value);
        return parseResult;
    },
};

export default ParseStage;
