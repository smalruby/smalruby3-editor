import {VERSION_1, VERSION_2} from '.';

const STORAGE_KEY = 'smalruby:rubyVersion';
const MIGRATION_KEY = 'smalruby:rubyVersionMigratedToV2';

const isValidRubyVersion = version => [VERSION_1, VERSION_2].includes(version);

const detectRubyVersion = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return VERSION_2;
    }

    const migrated = window.localStorage.getItem(MIGRATION_KEY);

    if (migrated !== 'true') {
        // One-time migration: set version to V2 and mark as migrated
        window.localStorage.setItem(STORAGE_KEY, VERSION_2);
        window.localStorage.setItem(MIGRATION_KEY, 'true');
        return VERSION_2;
    }

    // Already migrated: respect user's stored preference
    const rubyVersion = window.localStorage.getItem(STORAGE_KEY);
    if (isValidRubyVersion(rubyVersion)) return rubyVersion;

    return VERSION_2;
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
