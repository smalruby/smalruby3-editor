// === Smalruby: This file is Smalruby-specific (the analysis stage, docs/ruby-editor/converter-stages.md) ===
import { analyze } from './analysis';

/**
 * The analysis stage: the frozen `Analysis` of `analysis.js`, which the later stages read. Mixed
 * into RubyToBlocksConverter.prototype by `stages.js`.
 * @type {object}
 */
const AnalyzeStage = {
    /**
     * The analysis stage (analysis.js): walk the tree once before converting and keep what the
     * conversion reads in a frozen table: how each variable name is used, so that `@a.length` does
     * not depend on whether `@a = "abc"` was converted before it (issue #1613), the units of the
     * locals (issue #1630), the calls of the procedures whose values are used (the variables of
     * their return values), and the structure of the classes and the modules.
     * @param {object} root - The root node.
     * @param {string} code - The Ruby code.
     */
    _analyze(root, code) {
        this._context.analysis = analyze(root, { source: code });
        // One `@a` used as both a variable and a list is an error (issues #1593 / #1622)
        this._rejectRubyNameOfVariableAndList();
    },
};

export default AnalyzeStage;
