// === Smalruby: This file is Smalruby-specific (the BlockStore of the convert stage, docs/ruby-editor/converter-stages.md) ===
import { ContextJournal, JOURNALED_STORES } from './context-journal';

/**
 * What the convert stage writes: the blocks, their types, the comments, the variables, the lists,
 * the messages, the procedures, the indexes of the literal calls and the symbols the code uses.
 *
 * The conversion writes only through the methods of the store, and reads the tables (`blocks`,
 * `comments`, ...), which the context of the converter points at. The tables record their writes
 * (`context-journal.js`), so that a conversion attempt can be rolled back (`mark` / `rollback`).
 * The symbols are not rolled back: a symbol that a given-up attempt used stays, as before.
 */
class BlockStore {
    constructor() {
        this._journal = new ContextJournal();
        // The tables keyed by names from the Ruby code have no prototype (issue #2034).
        JOURNALED_STORES.forEach((name) => {
            this[name] = this._journal.wrap(name);
        });
        this.symbols = new Set();
    }

    /**
     * Add a block (or put it back in place).
     * @param {object} block - The block.
     * @param {string} type - Its type (`statement`, `value`, `hat`, ...).
     */
    setBlock(block, type) {
        this.blocks[block.id] = block;
        this.setBlockType(block.id, type);
    }

    /**
     * Set the type of a block.
     * @param {string} id - The id of the block.
     * @param {string} type - The type.
     */
    setBlockType(id, type) {
        this.blockTypes[id] = type;
    }

    /**
     * Remove a block.
     * @param {string} id - The id of the block.
     * @param {object} [options] - Options.
     * @param {boolean} [options.withType] - Remove its type too.
     */
    deleteBlock(id, { withType = false } = {}) {
        delete this.blocks[id];
        if (withType) delete this.blockTypes[id];
    }

    /**
     * Add a comment.
     * @param {object} comment - The comment (with its `id`).
     */
    setComment(comment) {
        this.comments[comment.id] = comment;
    }

    /**
     * Remove a comment.
     * @param {string} id - The id of the comment.
     */
    deleteComment(id) {
        delete this.comments[id];
    }

    /**
     * Add a variable, a list, a local variable or a message to its table.
     * @param {string} table - `variables`, `lists`, `localVariables` or `broadcastMsgs`.
     * @param {string} name - The key (the name of the variable).
     * @param {object} variable - The variable.
     */
    setVariable(table, name, variable) {
        this._checkVariableTable(table);
        this[table][name] = variable;
    }

    /**
     * Remove a variable, a list, a local variable or a message from its table.
     * @param {string} table - `variables`, `lists`, `localVariables` or `broadcastMsgs`.
     * @param {string} name - The key.
     */
    deleteVariable(table, name) {
        this._checkVariableTable(table);
        delete this[table][name];
    }

    _checkVariableTable(table) {
        if (!['variables', 'lists', 'localVariables', 'broadcastMsgs'].includes(table)) {
            throw new Error(`BlockStore: not a table of variables: ${table}`);
        }
    }

    /**
     * Add a procedure (a method made with `def`).
     * @param {string} name - The name of the method.
     * @param {object} procedure - The procedure.
     */
    setProcedure(name, procedure) {
        this.procedures[name] = procedure;
    }

    /**
     * Remove a procedure: one declared for a call before its `def` that the call did not use
     * (issue #2167).
     * @param {string} name - The name of the method.
     */
    deleteProcedure(name) {
        delete this.procedures[name];
    }

    /**
     * Set the last index of a kind of literal call (`true`, `false`, `_lit_`).
     * @param {string} key - The kind.
     * @param {number} index - The index.
     */
    setLiteralCallIndex(key, index) {
        this.literalCallIndices[key] = index;
    }

    /**
     * Keep a symbol that the converted blocks use (`$_symbols_`).
     * @param {string} symbol - The symbol (`:name`).
     */
    addSymbol(symbol) {
        this.symbols.add(symbol);
    }

    /**
     * Start a conversion attempt that `rollback` can undo.
     * @returns {object} The point to roll back to.
     */
    mark() {
        return this._journal.mark();
    }

    /**
     * Undo the writes since a point of `mark`.
     * @param {object} mark - The point.
     */
    rollback(mark) {
        this._journal.rollback(mark);
    }

    /**
     * The entries a table had at a point of `mark` (a copy, for reading).
     * @param {object} mark - The point.
     * @param {string} name - The name of the table.
     * @returns {object} The entries.
     */
    storeAt(mark, name) {
        return this._journal.storeAt(mark, name);
    }
}

// The tables of a BlockStore, which the context of the converter points at.
const BLOCK_STORE_TABLES = [...JOURNALED_STORES, 'symbols'];

export { BlockStore, BLOCK_STORE_TABLES };
