const log = require('../../util/log');

const MESH_DOMAIN_STORAGE_KEY = 'mesh_v2_domain';

const validateDomain = domain => {
    if (!domain) return null;

    if (domain.length > 256) {
        log.warn(`Mesh domain too long: ${domain.length} characters (max 256)`);
        return null;
    }

    // Allow alphanumeric, hyphen, underscore, dot.
    const validPattern = /^[a-zA-Z0-9-._]+$/;
    if (!validPattern.test(domain)) {
        log.warn(`Mesh domain contains invalid characters: ${domain}`);
        return null;
    }

    return domain;
};

/* istanbul ignore next */
const getDomainFromUrl = () => {
    /* istanbul ignore next */
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const domain = urlParams.get('mesh');

    return validateDomain(domain);
};

/* istanbul ignore next */
const getDomainFromLocalStorage = () => {
    /* istanbul ignore next */
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const domain = window.localStorage.getItem(MESH_DOMAIN_STORAGE_KEY);

    return validateDomain(domain);
};

/* istanbul ignore next */
const saveDomainToLocalStorage = domain => {
    /* istanbul ignore next */
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (domain) {
        window.localStorage.setItem(MESH_DOMAIN_STORAGE_KEY, domain);
    } else {
        window.localStorage.removeItem(MESH_DOMAIN_STORAGE_KEY);
    }
};

/* istanbul ignore next */
const getDomain = () => {
    // URL parameter (?mesh=...) is a one-time seed: save it to localStorage
    // on first access, then never reference the URL again. This lets the URL
    // set the modal's initial value while allowing the user to override it.
    const urlDomain = getDomainFromUrl();
    if (urlDomain) {
        saveDomainToLocalStorage(urlDomain);
    }
    return getDomainFromLocalStorage();
};

/* istanbul ignore next */
const getForcePollingFromUrl = () => {
    /* istanbul ignore next */
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const polling = urlParams.get('mesh_polling');
    return !!polling && polling !== '0' && polling !== 'false';
};

module.exports = {
    getDomainFromUrl,
    getDomainFromLocalStorage,
    saveDomainToLocalStorage,
    getDomain,
    validateDomain,
    getForcePollingFromUrl
};
