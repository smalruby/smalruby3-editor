/**
 * The record of what the conversion wrote into the tables of the context (blocks, comments,
 * variables, ...), used to roll a conversion attempt back (`_saveContext` / `_restoreContext`).
 *
 * Copying every table at each attempt made long code slow (it grew with the square of the length,
 * docs/ruby-editor/converter-stages.md 「実行の効率」). Instead, each table is a proxy that records
 * the value a key had before it is set or deleted, and rolling back puts those values back.
 *
 * Rolling back gives the same tables as putting a copy back did, including the order of the keys:
 * a key that was there is set back in place, and a key that was deleted is added again at the end,
 * in the order the keys had when the attempt started.
 */

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

class ContextJournal {
    constructor() {
        // {store, key, had, value, seq, time}: the state of `key` of `store` just before a write
        this._entries = [];
        // A clock for the order of writes, marks and rollbacks.
        this._time = 0;
        // store -> key -> [{time, from, to}]: a rollback added `key` back with the order `from`;
        // before that rollback, its order was `to`. See `_seqAt`.
        this._reorders = new Map();
        // [{from, to}]: the times of a mark and of the rollback to it. A mark taken between them
        // was rolled away and cannot be rolled back to (see `_checkMark`).
        this._rollbacks = [];
        // Nothing is recorded until the first attempt starts.
        this._recording = false;
        // The order in which the keys were added to the tables, to add deleted keys back in order.
        this._seq = 0;
        this._stores = {};
    }

    /**
     * Make a table that records its writes.
     * @param {string} name - The name of the table in the context (e.g. 'blocks').
     * @param {object} [initial] - The entries it starts with.
     * @returns {object} The table (a proxy of an object without a prototype, so that a key such as
     *   `__proto__` or `constructor` is an entry like any other; issue #2034).
     */
    wrap(name, initial = Object.create(null)) {
        const raw = Object.create(null);
        const seqs = new Map();
        this._stores[name] = { raw, seqs };
        Object.keys(initial).forEach((key) => {
            raw[key] = initial[key];
            seqs.set(key, ++this._seq);
        });
        return new Proxy(raw, {
            set: (target, key, value) => {
                if (typeof key === 'symbol') {
                    target[key] = value;
                    return true;
                }
                const had = hasOwn(target, key);
                if (this._recording) {
                    this._entries.push({
                        store: name,
                        key,
                        had,
                        value: target[key],
                        seq: seqs.get(key),
                        time: ++this._time,
                    });
                }
                target[key] = value;
                if (!had) seqs.set(key, ++this._seq);
                return true;
            },
            deleteProperty: (target, key) => {
                if (typeof key === 'symbol' || !hasOwn(target, key)) {
                    return delete target[key];
                }
                if (this._recording) {
                    this._entries.push({
                        store: name,
                        key,
                        had: true,
                        value: target[key],
                        seq: seqs.get(key),
                        time: ++this._time,
                    });
                }
                delete target[key];
                seqs.delete(key);
                return true;
            },
        });
    }

    /**
     * Start an attempt.
     * @returns {{index: number, time: number}} The mark to roll back to.
     */
    mark() {
        this._recording = true;
        return { index: this._entries.length, time: ++this._time };
    }

    /**
     * The order a key had at a mark, from the order recorded in an entry after the mark.
     * A rollback between the mark and the entry may have added the key back at the end
     * (with a new order), while at the mark it was where it had been before that rollback.
     * @param {object} entry - The entry.
     * @param {{time: number}} mark - The mark.
     * @returns {number} The order.
     */
    _seqAt(entry, mark) {
        const byKey = this._reorders.get(entry.store);
        const reorders = byKey && byKey.get(entry.key);
        let seq = entry.seq;
        if (!reorders) return seq;
        for (let i = reorders.length - 1; i >= 0; i--) {
            const reorder = reorders[i];
            if (reorder.time < entry.time && reorder.time > mark.time && reorder.from === seq) {
                seq = reorder.to;
            }
        }
        return seq;
    }

    /**
     * The changes since a mark: for each table, the state each changed key had at the mark.
     * @param {{index: number}} mark - The mark.
     * @returns {Map<string, Map<string, object>>} table name -> key -> the first entry after the mark.
     */
    _changesSince(mark) {
        const changes = new Map();
        for (let i = mark.index; i < this._entries.length; i++) {
            const entry = this._entries[i];
            let byKey = changes.get(entry.store);
            if (!byKey) {
                byKey = new Map();
                changes.set(entry.store, byKey);
            }
            if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
        }
        return changes;
    }

    /**
     * Throw if a mark was rolled away: it was taken inside an attempt that was rolled back
     * after it (an inner mark used after rolling back to an outer one). Its writes are not in the
     * record any more, so the tables at that mark cannot be made again.
     * @param {{time: number}} mark - The mark.
     */
    _checkMark(mark) {
        if (this._rollbacks.some((rollback) => rollback.from < mark.time && mark.time < rollback.to)) {
            throw new Error('ContextJournal: the mark was rolled back by rolling back to an earlier mark');
        }
    }

    /**
     * Put the tables back as they were at a mark.
     * @param {{index: number, time: number}} mark - The mark returned by `mark`.
     * @returns {{removedBlockIds: string[]}} The blocks that rolling back removed.
     */
    rollback(mark) {
        this._checkMark(mark);
        const removedBlockIds = [];
        const time = ++this._time;
        this._rollbacks.push({ from: mark.time, to: time });
        if (mark.index >= this._entries.length) return { removedBlockIds };
        const changes = this._changesSince(mark);
        this._entries.length = mark.index;
        changes.forEach((byKey, name) => {
            const { raw, seqs } = this._stores[name];
            const addBack = [];
            byKey.forEach((entry, key) => {
                if (!entry.had) {
                    if (hasOwn(raw, key)) {
                        delete raw[key];
                        seqs.delete(key);
                        if (name === 'blocks') removedBlockIds.push(key);
                    }
                } else if (hasOwn(raw, key)) {
                    raw[key] = entry.value;
                    // Kept in place, but it may have been deleted and added again since the
                    // mark: for a mark further out, its order is the one it had at this mark.
                    const seq = this._seqAt(entry, mark);
                    if (seq !== seqs.get(key)) {
                        this._addReorder(name, key, { time, from: seqs.get(key), to: seq });
                    }
                } else {
                    addBack.push({ entry, seq: this._seqAt(entry, mark) });
                }
            });
            addBack
                .sort((a, b) => a.seq - b.seq)
                .forEach(({ entry, seq }) => {
                    raw[entry.key] = entry.value;
                    seqs.set(entry.key, ++this._seq);
                    this._addReorder(name, entry.key, { time, from: this._seq, to: seq });
                });
        });
        return { removedBlockIds };
    }

    /**
     * Remember that a rollback added a key back with a new order.
     * @param {string} name - The name of the table.
     * @param {string} key - The key.
     * @param {{time: number, from: number, to: number}} reorder - When, the new order and the old one.
     */
    _addReorder(name, key, reorder) {
        let byKey = this._reorders.get(name);
        if (!byKey) {
            byKey = new Map();
            this._reorders.set(name, byKey);
        }
        if (byKey.has(key)) {
            byKey.get(key).push(reorder);
        } else {
            byKey.set(key, [reorder]);
        }
    }

    /**
     * The entries a table had at a mark, as an object without a prototype (a copy; for reading only).
     * @param {{index: number}} mark - The mark.
     * @param {string} name - The name of the table.
     * @returns {object} The entries.
     */
    storeAt(mark, name) {
        this._checkMark(mark);
        const { raw } = this._stores[name];
        const byKey = this._changesSince(mark).get(name);
        if (!byKey) return Object.assign(Object.create(null), raw);
        const result = Object.create(null);
        Object.keys(raw).forEach((key) => {
            const entry = byKey.get(key);
            if (!entry) {
                result[key] = raw[key];
            } else if (entry.had) {
                result[key] = entry.value;
            }
        });
        byKey.forEach((entry, key) => {
            if (entry.had && !hasOwn(raw, key)) result[key] = entry.value;
        });
        return result;
    }
}

// The tables of the context that an attempt rolls back.
const JOURNALED_STORES = [
    'blocks',
    'blockTypes',
    'localVariables',
    'variables',
    'lists',
    'broadcastMsgs',
    'procedures',
    'comments',
    'literalCallIndices',
];

export { ContextJournal, JOURNALED_STORES };
