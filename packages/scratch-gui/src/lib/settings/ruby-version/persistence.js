import cookie from 'cookie';

import {VERSION_1, VERSION_2} from '.';

const COOKIE_KEY = 'smalruby:rubyVersion';
const VERSION_SWITCH_DATE = new Date('2026-04-01T00:00:00Z');

const isValidRubyVersion = version => [VERSION_1, VERSION_2].includes(Number(version));

const getDefaultVersion = () => {
    const now = new Date();
    return now >= VERSION_SWITCH_DATE ? VERSION_2 : VERSION_1;
};

const detectRubyVersion = () => {
    const obj = cookie.parse(document.cookie) || {};
    const rubyVersionCookie = obj[COOKIE_KEY];

    if (isValidRubyVersion(rubyVersionCookie)) return Number(rubyVersionCookie);

    // No cookie set. Fall back to date-based default
    return getDefaultVersion();
};

const persistRubyVersion = version => {
    if (!isValidRubyVersion(version)) {
        throw new Error(`Invalid ruby version: ${version}`);
    }

    const expires = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toUTCString();
    document.cookie = `${COOKIE_KEY}=${version};expires=${expires};path=/`;
};

export {
    detectRubyVersion,
    persistRubyVersion
};
