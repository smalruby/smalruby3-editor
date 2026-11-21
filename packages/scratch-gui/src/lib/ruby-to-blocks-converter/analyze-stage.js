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

    /**
     * Analyze the code of a module read from another sprite, whose defs are converted with this
     * code (`_importModuleFromOtherSprites`).
     * @param {object} root - The root node of the module's code.
     * @param {string} code - The module's code.
     */
    _analyzeImported(root, code) {
        this._context.importedAnalyses.push(analyze(root, { source: code }));
    },

    /**
     * The entry of `procedures.definitions` of a DefNode, from the analysis of this code or of a
     * module read from another sprite.
     * @param {object} defNode - The DefNode.
     * @returns {?object} The entry, or null.
     */
    _definitionOf(defNode) {
        const analyses = [this._context.analysis, ...this._context.importedAnalyses];
        for (const analysis of analyses) {
            if (analysis && analysis.procedures.ofNode.has(defNode)) return analysis.procedures.ofNode.get(defNode);
        }
        return null;
    },
};

export default AnalyzeStage;
