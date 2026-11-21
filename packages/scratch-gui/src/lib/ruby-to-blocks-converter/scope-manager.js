/**
 * Scope management for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ScopeManager = {
    /**
     * Enter the scope of a method.
     * @param {string} scopeType - The type of the scope ('method').
     * @param {number} newScopeIndex - Its scope index, from the analysis stage (`_scopeIndexOfDef`).
     * @returns {number} The scope index.
     */
    _enterScope(scopeType, newScopeIndex) {
        this._context.scopeStack.push({
            index: newScopeIndex,
            type: scopeType,
            localVars: Object.create(null),
        });

        this._context.currentScopeIndex = newScopeIndex;
        return newScopeIndex;
    },

    _exitScope() {
        const exited = this._context.scopeStack.pop();
        if (this._context.scopeStack.length > 0) {
            this._context.currentScopeIndex = this._context.scopeStack[this._context.scopeStack.length - 1].index;
        } else {
            this._context.currentScopeIndex = 1; // Back to top-level
        }
        return exited;
    },

    _getCurrentScope() {
        if (this._context.scopeStack.length === 0) return null;
        return this._context.scopeStack[this._context.scopeStack.length - 1];
    },

    _getScopeIndex() {
        return this._context.currentScopeIndex;
    },
};

export default ScopeManager;
