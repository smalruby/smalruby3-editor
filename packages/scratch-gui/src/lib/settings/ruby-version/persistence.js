import {VERSION_1, VERSION_2} from '.';

const STORAGE_KEY = 'smalruby:rubyVersion';
const VERSION_SWITCH_DATE = new Date('2026-04-01T00:00:00Z');

const isValidRubyVersion = version => [VERSION_1, VERSION_2].includes(version);

const getDefaultVersion = () => {
    const now = new Date();
    return now >= VERSION_SWITCH_DATE ? VERSION_2 : VERSION_1;
};

const detectRubyVersion = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return getDefaultVersion();
    }

    const rubyVersion = window.localStorage.getItem(STORAGE_KEY);

    if (isValidRubyVersion(rubyVersion)) return rubyVersion;

    // No preference set. Fall back to date-based default
    return getDefaultVersion();
};

const persistRubyVersion = version => {
    if (!isValidRubyVersion(version)) {
        throw new Error(`Invalid ruby version: ${version}`);
    }

    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, version);
    }
};

export {
    detectRubyVersion,
    persistRubyVersion
};
