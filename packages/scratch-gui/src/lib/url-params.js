// === Smalruby: This file is Smalruby-specific (URL parameters for Playwright testing) ===
import log from './log.js';
import { VERSION_1, VERSION_2 } from './settings/ruby-version';

// Inline tab index constants to avoid circular dependency with editor-tab reducer.
// These must match the values in ../reducers/editor-tab.js.
const TAB_INDICES = { code: 0, blocks: 0, costumes: 1, sounds: 2, ruby: 3 };

const VALID_RUBY_VERSIONS = [VERSION_1, VERSION_2];

// === Smalruby: Start of Ruby mode constants ===
// Valid values for rubyMode URL parameter (case-insensitive).
const DNCL_ALIASES = ['dncl', 'dnclv2', 'ja', 'japanese'];
const FURIGANA_ALIASES = ['rubi', 'furigana'];
const RUBY_ALIASES = ['ruby'];
// === Smalruby: End of Ruby mode constants ===

/**
 * Parse Smalruby-specific URL parameters for testing convenience.
 * Supported parameters:
 * - no_beforeunload=1  — disable the beforeunload confirmation dialog
 * - tab=ruby           — activate a specific tab on startup (code/blocks/costumes/sounds/ruby)
 * - ruby_version=2     — set the Ruby version (1 or 2); invalid values are ignored
 * - rubyMode=dncl      — activate DNCL mode (aliases: dnclv2, case-insensitive)
 * - rubyMode=rubi      — activate furigana mode (aliases: furigana, case-insensitive)
 * - welcome=1          — auto-open the welcome modal on load
 * - genai_idle=10      — idle seconds before the genai concierge nudges (testing)
 * @returns {object} parsed parameters
 */
const parseUrlParams = () => {
    if (typeof window === 'undefined') {
        return {
            noBeforeUnload: false,
            initialTab: null,
            rubyVersion: null,
            rubyMode: null,
            features: [],
            classcode: null,
            devlogin: false,
            showWelcome: false,
            genaiIdle: null,
        };
    }

    let params;
    try {
        params = new URL(window.location.href).searchParams;
    } catch {
        return {
            noBeforeUnload: false,
            initialTab: null,
            rubyVersion: null,
            rubyMode: null,
            features: [],
            classcode: null,
            devlogin: false,
            showWelcome: false,
            genaiIdle: null,
        };
    }

    // no_beforeunload: any truthy value disables the dialog
    const noBeforeUnload = params.get('no_beforeunload') === '1' || params.get('no_beforeunload') === 'true';

    // tab: map name to tab index, ignore invalid values
    const tabName = (params.get('tab') || '').toLowerCase();
    const initialTab = Object.prototype.hasOwnProperty.call(TAB_INDICES, tabName) ? TAB_INDICES[tabName] : null;

    // ruby_version: only accept valid versions
    const rvParam = params.get('ruby_version');
    const rubyVersion = VALID_RUBY_VERSIONS.includes(rvParam) ? rvParam : null;

    // === Smalruby: Start of rubyMode URL param ===
    // rubyMode: 'dncl'/'ja'/'japanese' → 'dncl', 'rubi'/'furigana' → 'furigana', 'ruby' → 'ruby'
    const rmParam = (params.get('rubyMode') || '').toLowerCase();
    let rubyMode = null;
    if (DNCL_ALIASES.includes(rmParam)) {
        rubyMode = 'dncl';
    } else if (FURIGANA_ALIASES.includes(rmParam)) {
        rubyMode = 'furigana';
    } else if (RUBY_ALIASES.includes(rmParam)) {
        rubyMode = 'ruby';
    }
    // === Smalruby: End of rubyMode URL param ===

    // features: comma-separated feature flags (e.g., ?features=classroom,experiment)
    const featuresParam = params.get('features') || '';
    const features = featuresParam
        .split(',')
        .map((f) => f.trim().toLowerCase())
        .filter((f) => f.length > 0);

    // classcode: auto-join a classroom via invite link
    const classcode = (params.get('classcode') || '').trim().toLowerCase() || null;

    // devlogin: bypass Google auth with a secret token (stg/local only).
    // getUrlParams() removes it from the address bar after reading it.
    const devlogin = params.get('devlogin') || null;

    // === Smalruby: Start of welcome URL param ===
    // welcome: any truthy value auto-opens the welcome modal on load
    // (used for testing / first-time demo; normally users open it from the
    // About menu or MobileDrawer help section)
    const welcomeParam = params.get('welcome');
    const showWelcome = welcomeParam === '1' || welcomeParam === 'true';
    // === Smalruby: End of welcome URL param ===

    // genai_idle: seconds of inactivity before the genai concierge offers help (testing)
    const genaiIdleParam = Number(params.get('genai_idle'));
    const genaiIdle = genaiIdleParam > 0 ? genaiIdleParam : null;

    return {
        noBeforeUnload,
        initialTab,
        rubyVersion,
        rubyMode,
        features,
        classcode,
        devlogin,
        showWelcome,
        genaiIdle,
    };
};

/**
 * Remove one query parameter from a URL, keeping the other params and the hash.
 * @param {string} href - the URL to edit
 * @param {string} name - the query parameter to remove
 * @returns {string|null} the new URL, or null when the param is not present
 */
const removeUrlParam = (href, name) => {
    let url;
    try {
        url = new URL(href);
    } catch {
        return null;
    }
    if (!url.searchParams.has(name)) return null;
    url.searchParams.delete(name);
    return url.toString();
};

/**
 * Take the dev bypass token out of the address bar once it has been read, so it
 * does not end up in screenshots, browser history or URLs people share (#1393).
 * The value stays available through the cached getUrlParams() result.
 */
const stripDevloginFromUrl = () => {
    if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
    const next = removeUrlParam(window.location.href, 'devlogin');
    if (!next) return;
    try {
        window.history.replaceState(window.history.state, '', next);
    } catch (e) {
        log.warn('Failed to remove devlogin from the URL:', e);
    }
};

// Cache the result so it's only parsed once
let _cached = null;
const getUrlParams = () => {
    if (!_cached) {
        _cached = parseUrlParams();
        if (_cached.devlogin) stripDevloginFromUrl();
    }
    return _cached;
};

/**
 * Clear the cached classcode so it is only consumed once.
 */
const clearClasscode = () => {
    if (_cached) {
        _cached = { ..._cached, classcode: null };
    }
};

export { getUrlParams, clearClasscode, removeUrlParam };
export default getUrlParams;
