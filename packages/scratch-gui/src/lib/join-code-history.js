/**
 * Manage join code history in localStorage for quick re-join.
 *
 * Each entry: { joinCode, className, assignmentName, expiresAt, joinedAt }
 * - Sorted by joinedAt descending (most recent first)
 * - Maximum 10 entries
 * - Expired entries are pruned on load
 */

const STORAGE_KEY = 'smalruby:joinCodeHistory';
const MAX_ENTRIES = 10;

/**
 * Load join code history from localStorage, pruning expired entries.
 * @returns {Array<object>} Array of history entries (most recent first)
 */
const loadHistory = () => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const entries = JSON.parse(raw);
        if (!Array.isArray(entries)) return [];

        const now = new Date();
        const valid = entries.filter((e) => {
            if (!e.joinCode || !e.joinedAt) return false;
            if (e.expiresAt && new Date(e.expiresAt) <= now) return false;
            return true;
        });

        // Save back if expired entries were removed
        if (valid.length !== entries.length) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
        }

        return valid;
    } catch {
        return [];
    }
};

/**
 * Add or update a join code entry in the history.
 * @param {object} entry - { joinCode, className, assignmentName, expiresAt }
 */
const addToHistory = (entry) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!entry.joinCode) return;

    try {
        const entries = loadHistory();

        // Remove existing entry with same joinCode
        const filtered = entries.filter((e) => e.joinCode !== entry.joinCode);

        // Add new entry at the top
        filtered.unshift({
            joinCode: entry.joinCode,
            className: entry.className || '',
            assignmentName: entry.assignmentName || '',
            expiresAt: entry.expiresAt || null,
            joinedAt: new Date().toISOString(),
        });

        // Keep only the latest MAX_ENTRIES
        const trimmed = filtered.slice(0, MAX_ENTRIES);

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
        // Ignore storage errors
    }
};

export { loadHistory, addToHistory };
