// === Smalruby: This file is Smalruby-specific (loads the Ruby bundle lazily) ===
// The Ruby tab, the blocks -> Ruby generator, the Ruby -> blocks converter and the prism parser are
// in a separate bundle (`chunks/ruby.<hash>.js`, made by `ruby-bundle-entry.js`), so the main
// bundle (`gui.js`) is smaller and starts faster. The bundle is read in the idle time after the
// start (`ruby-tab-loader.jsx`, with `whenIdle`), and every place that uses it waits for it
// (`loadRubyBundle`).
//
// PWA: the Workbox service worker precaches every emitted file, so the bundle and prism.wasm are
// cached with gui.js and work offline (index.html does not register the worker yet). A page that runs an old gui.js after a new version replaced the cache asks
// for a bundle name that is gone (404): loading fails after the retries, and the Ruby tab tells
// the user to reload the page (`ruby-tab-loader.jsx`).

// Waits between the attempts (ms): a short network hiccup at school should not break the tab.
const RETRY_DELAYS_MS = [1000, 3000];
// The longest wait for an idle moment before reading the bundle anyway.
const IDLE_TIMEOUT_MS = 5000;
// Without requestIdleCallback (Safari), read the bundle this long after the start.
const FALLBACK_DELAY_MS = 2000;

let bundle = null;
let loading = null;

const importBundle = () => import(/* webpackChunkName: "ruby" */ './ruby-bundle-entry.js');

const wait = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * The Ruby bundle if it is already read, otherwise null.
 * @returns {?object} the exports of `ruby-bundle-entry.js`
 */
const getRubyBundle = () => bundle;

/**
 * The Ruby bundle for code that can't wait (a reducer, a memo). Read it first with `loadRubyBundle`.
 * @returns {object} the exports of `ruby-bundle-entry.js`
 */
const requireRubyBundle = () => {
    if (!bundle) {
        throw new Error('The Ruby bundle is not loaded yet');
    }
    return bundle;
};

/**
 * Read the Ruby bundle (once; concurrent calls share the reading). A failed reading is tried again
 * after `RETRY_DELAYS_MS`, and when every attempt fails the next call starts over.
 * @param {object} [options] - options (for tests)
 * @param {Function} [options.importer] - reads the bundle (resolves to its exports)
 * @param {number[]} [options.retryDelays] - waits between the attempts (ms)
 * @returns {Promise<object>} the exports of `ruby-bundle-entry.js`
 */
const loadRubyBundle = ({ importer = importBundle, retryDelays = RETRY_DELAYS_MS } = {}) => {
    if (bundle) return Promise.resolve(bundle);
    if (loading) return loading;
    loading = (async () => {
        let lastError = null;
        for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
            if (attempt > 0) await wait(retryDelays[attempt - 1]);
            try {
                // webpack forgets a chunk that failed to load, so importing again fetches it again.
                const loaded = await importer();
                bundle = loaded;
                return loaded;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    })();
    loading.then(
        () => {
            loading = null;
        },
        () => {
            loading = null;
        },
    );
    return loading;
};

/**
 * Run a function in an idle moment of the browser (or a little later when there is no
 * requestIdleCallback).
 * @param {Function} callback - the function to run
 * @param {object} [win] - the window (for tests)
 */
const whenIdle = (callback, win = typeof window === 'undefined' ? null : window) => {
    if (win && typeof win.requestIdleCallback === 'function') {
        win.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
    } else {
        setTimeout(callback, FALLBACK_DELAY_MS);
    }
};

/**
 * Convert Ruby to blocks (`targetCodeToBlocks` of the converter), reading the bundle first.
 * @param {...*} args - vm, target, code, intl, options
 * @returns {Promise<object>} the converter with `result`, `errors` and `apply`
 */
const targetCodeToBlocks = (...args) => {
    // Once read, call it directly: the same promise (and microtask timing) as a static import.
    // The Ruby tab's tab-switch logic races with other async work (adding a sprite activates
    // the code tab), so an extra await here changes which one wins.
    if (bundle) return bundle.targetCodeToBlocks(...args);
    return loadRubyBundle().then((loaded) => loaded.targetCodeToBlocks(...args));
};

/**
 * Blocks -> Ruby for a reducer: the code of the target, or '' while the bundle is not read yet.
 * The Ruby tab is in the bundle, so the code is always there when the tab shows it.
 * @param {object} target - the target
 * @param {object} options - generator options (`version`)
 * @returns {string} the Ruby code
 */
const generateTargetCode = (target, options) => {
    if (!bundle) return '';
    return bundle.RubyGenerator.targetToCode(target, options);
};

/**
 * Forget the read bundle (for tests).
 */
const resetRubyBundleForTest = () => {
    bundle = null;
    loading = null;
};

export {
    generateTargetCode,
    getRubyBundle,
    loadRubyBundle,
    requireRubyBundle,
    resetRubyBundleForTest,
    targetCodeToBlocks,
    whenIdle,
};
