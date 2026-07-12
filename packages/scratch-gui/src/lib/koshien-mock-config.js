/**
 * Koshien practice game settings.
 *
 * The koshien extension always plays against its built-in local practice
 * game. The Koshien settings modal stores how that game should be set up
 * (which practice map, which side the user plays, which built-in rival AI to
 * face) here, and the settings are exposed to the VM extension through
 * `vm.runtime.getKoshienMockConfig()` (see wireKoshienMockConfig). The
 * extension reads them every time the AI connects, so changes apply from the
 * next connect on.
 */
import { MOCK_MAPS } from '@smalruby/scratch-vm/src/extensions/koshien/mock-maps';

const STORAGE_KEY = 'smalruby:koshienMockConfig';

/**
 * The rival strategies the practice game accepts.
 * @type {Array<string>}
 */
const RIVAL_STRATEGIES = ['goal', 'item', 'stop', 'random'];

const hasLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

/**
 * The maximum per-turn sleep (seconds) the practice game accepts.
 * @type {number}
 */
const MAX_TURN_INTERVAL = 5;

/**
 * The default per-turn sleep (seconds) used when nothing is saved yet, so a
 * fresh practice game already slows down enough to follow the path by eye.
 * @type {number}
 */
const DEFAULT_TURN_INTERVAL = 3;

/**
 * Clamp a raw turn-interval value into [0, MAX_TURN_INTERVAL] seconds.
 * Missing / non-numeric values normalize to DEFAULT_TURN_INTERVAL, while an
 * explicit 0 (or negative) stays 0 — an intentional no-wait choice.
 * @param {*} value - the raw turn-interval value.
 * @returns {number} - a valid interval in seconds.
 */
const clampTurnInterval = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_TURN_INTERVAL;
    if (n <= 0) return 0;
    return Math.min(n, MAX_TURN_INTERVAL);
};

/**
 * Clamp raw (possibly stale/foreign) values into a valid config.
 * @param {object} raw - the raw settings.
 * @returns {object} - {mapId, side, rival, turnInterval} with valid values.
 */
const normalizeKoshienMockConfig = (raw) => {
    const settings = raw || {};
    return {
        mapId: MOCK_MAPS.some((m) => m.id === settings.mapId) ? settings.mapId : MOCK_MAPS[0].id,
        side: Number(settings.side) === 2 ? 2 : 1,
        rival: RIVAL_STRATEGIES.includes(settings.rival) ? settings.rival : 'goal',
        turnInterval: clampTurnInterval(settings.turnInterval),
    };
};

/**
 * Load the saved practice game settings.
 * @returns {object} - {mapId, side, rival, turnInterval} (always valid values).
 */
const loadKoshienMockConfig = () => {
    if (!hasLocalStorage()) return normalizeKoshienMockConfig({});
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return normalizeKoshienMockConfig(raw ? JSON.parse(raw) : {});
    } catch (e) {
        return normalizeKoshienMockConfig({});
    }
};

/**
 * Persist the practice game settings.
 * @param {object} settings - {mapId, side, rival, turnInterval}.
 */
const saveKoshienMockConfig = (settings) => {
    if (!hasLocalStorage()) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeKoshienMockConfig(settings)));
    } catch (e) {
        // ignore quota / serialization errors
    }
};

/**
 * Expose the saved settings to the VM runtime so the koshien extension can
 * read them whenever the AI connects to (i.e. starts) a practice game.
 * @param {VirtualMachine} vm - the scratch VM.
 */
const wireKoshienMockConfig = (vm) => {
    if (!vm || !vm.runtime) return;
    vm.runtime.getKoshienMockConfig = loadKoshienMockConfig;
};

export {
    STORAGE_KEY,
    MOCK_MAPS as KOSHIEN_MOCK_MAPS,
    RIVAL_STRATEGIES,
    MAX_TURN_INTERVAL,
    DEFAULT_TURN_INTERVAL,
    normalizeKoshienMockConfig,
    loadKoshienMockConfig,
    saveKoshienMockConfig,
    wireKoshienMockConfig,
};
