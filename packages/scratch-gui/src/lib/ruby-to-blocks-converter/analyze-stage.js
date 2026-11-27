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
        // `class Studuino` (the port settings of Studuino mode) is read before converting (#2218)
        this._analyzeStuduino(root);
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
     * The scope index of the locals of a method (the `2` of `_a_2_`), decided by the analysis stage
     * (`locals.scopeIndexOfDef`). The methods of a module read from another sprite are not in this
     * code: they get the indexes after the last one of this code, in the order they are converted.
     * @param {object} defNode - The DefNode.
     * @returns {number} The scope index.
     */
    _scopeIndexOfDef(defNode) {
        const locals = this._context.analysis.locals;
        if (locals.scopeIndexOfDef.has(defNode)) return locals.scopeIndexOfDef.get(defNode);
        const imported = this._context.importedScopeIndexes;
        if (!imported.has(defNode)) imported.set(defNode, locals.lastScopeIndex + imported.size + 1);
        return imported.get(defNode);
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
