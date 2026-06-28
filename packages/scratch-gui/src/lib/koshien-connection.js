/**
 * Koshien connection settings (#741).
 *
 * The game server endpoint is configured via Smalruby settings (not the program):
 * the Koshien menu opens a settings modal that stores the connection here. The
 * stored settings are exposed to the VM koshien extension through
 * `vm.runtime.getKoshienRemoteOptions()` (see wireKoshienRemoteOptions), which
 * the extension reads to choose RemoteClient (connected) vs MockClient (offline).
 */

const STORAGE_KEY = 'smalruby:koshienConnection';
const PLAYER_ID_KEY = 'smalruby:koshienPlayerId';

const hasLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

/**
 * Generate an RFC4122-ish v4 UUID (used to identify this player across rounds).
 * @returns {string} - a UUID string.
 */
const generateUuid = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        const v = c === 'x' ? r : (r % 4) + 8;
        return v.toString(16);
    });
};

/**
 * Load the saved Koshien connection settings.
 * @returns {object} - {endpoint, side, gameCode} (any may be undefined).
 */
const loadKoshienConnection = () => {
    if (!hasLocalStorage()) return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
};

/**
 * Persist the Koshien connection settings.
 * @param {object} settings - {endpoint, side, gameCode}.
 */
const saveKoshienConnection = (settings) => {
    if (!hasLocalStorage()) return;
    try {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                endpoint: settings.endpoint || '',
                side: Number(settings.side) === 2 ? 2 : 1,
                gameCode: settings.gameCode || '',
            }),
        );
    } catch (e) {
        // ignore quota / serialization errors
    }
};

/**
 * Get (creating + persisting once) this player's stable UUID.
 * @returns {string} - the player UUID.
 */
const getOrCreatePlayerId = () => {
    if (!hasLocalStorage()) return generateUuid();
    let id = window.localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
        id = generateUuid();
        try {
            window.localStorage.setItem(PLAYER_ID_KEY, id);
        } catch (e) {
            // ignore
        }
    }
    return id;
};

/**
 * Build the options object the koshien VM extension expects, or null when no
 * endpoint is configured (→ the extension stays on the offline MockClient).
 * @returns {?object} - {endpoint, side, gameCode, playerId} or null.
 */
const buildKoshienRemoteOptions = () => {
    const s = loadKoshienConnection();
    if (!s.endpoint) return null;
    return {
        endpoint: s.endpoint,
        side: Number(s.side) === 2 ? 2 : 1,
        gameCode: s.gameCode || null,
        playerId: getOrCreatePlayerId(),
    };
};

/**
 * Expose the saved connection settings to the VM runtime so the koshien
 * extension can read them when it loads.
 * @param {VirtualMachine} vm - the scratch VM.
 */
const wireKoshienRemoteOptions = (vm) => {
    if (!vm || !vm.runtime) return;
    vm.runtime.getKoshienRemoteOptions = buildKoshienRemoteOptions;
};

/**
 * Probe whether a game server endpoint is reachable (for the "test" button).
 * Resolves to {ok, message}; never rejects.
 * @param {string} endpoint - base URL of the game server.
 * @param {Function} [fetchImpl] - fetch implementation (injectable for tests).
 * @returns {Promise<object>} - {ok: boolean, message: string}.
 */
const testKoshienConnection = async (endpoint, fetchImpl) => {
    const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(null) : null);
    if (!endpoint) return { ok: false, message: 'no endpoint' };
    if (!doFetch) return { ok: false, message: 'fetch unavailable' };
    const url = `${endpoint.replace(/\/$/, '')}/api/viewer/getAllMap`;
    try {
        // A reachable server responds (even 401 for the viewer-auth route means it's up).
        const res = await doFetch(url, { method: 'GET' });
        return { ok: true, message: `reachable (status ${res.status})` };
    } catch (e) {
        return { ok: false, message: e && e.message ? e.message : 'unreachable' };
    }
};

export {
    STORAGE_KEY,
    PLAYER_ID_KEY,
    loadKoshienConnection,
    saveKoshienConnection,
    buildKoshienRemoteOptions,
    wireKoshienRemoteOptions,
    testKoshienConnection,
};
