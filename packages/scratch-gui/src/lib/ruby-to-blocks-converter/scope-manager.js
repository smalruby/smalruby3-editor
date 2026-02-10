/**
 * Scope management for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ScopeManager = {
    _enterScope (scopeType) {
        this._context.scopeCounter++;
        const newScopeIndex = this._context.scopeCounter;

        this._context.scopeStack.push({
            index: newScopeIndex,
            type: scopeType,
            localVars: {}
        });

        this._context.currentScopeIndex = newScopeIndex;
        return newScopeIndex;
    },

    _exitScope () {
        const exited = this._context.scopeStack.pop();
        if (this._context.scopeStack.length > 0) {
            this._context.currentScopeIndex =
                this._context.scopeStack[this._context.scopeStack.length - 1].index;
        } else {
            this._context.currentScopeIndex = 1; // Back to top-level
        }
        return exited;
    },

    _getCurrentScope () {
        if (this._context.scopeStack.length === 0) return null;
        return this._context.scopeStack[this._context.scopeStack.length - 1];
    },

    _getScopeIndex () {
        return this._context.currentScopeIndex;
    }
};

export default ScopeManager;
