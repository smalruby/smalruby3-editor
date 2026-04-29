import { defineMessages } from 'react-intl';

/**
 * Localized messages used by the URL loader UI and HOC.
 * Exported so the HOC and unit tests reference the same source of truth.
 */
const urlLoaderMessages = defineMessages({
    loadError: {
        id: 'gui.urlLoader.loadError',
        defaultMessage: 'The project URL that was entered failed to load.',
        description: 'Generic fallback when project URL loading fails.',
    },
    invalidUrl: {
        id: 'gui.urlLoader.invalidUrl',
        defaultMessage: 'Please enter a valid Scratch project URL.',
        description: 'Error shown when the entered URL is not a Scratch project URL.',
    },
    projectNotFound: {
        id: 'gui.urlLoader.projectNotFound',
        defaultMessage:
            'Project not found. It may have been unshared, or the URL may be incorrect.',
        description: 'Shown when the upstream Scratch API returns 404.',
    },
    projectAccessDenied: {
        id: 'gui.urlLoader.projectAccessDenied',
        defaultMessage: 'Access to this project is denied.',
        description: 'Shown when the upstream Scratch API returns 403.',
    },
    serverError: {
        id: 'gui.urlLoader.serverError',
        defaultMessage: 'Scratch server-side error. Please try again later.',
        description: 'Shown when the upstream Scratch API returns 5xx.',
    },
    networkError: {
        id: 'gui.urlLoader.networkError',
        defaultMessage: 'Network error. Please check your internet connection.',
        description:
            'Shown when fetch throws a TypeError (offline, DNS failure, blocked by extension).',
    },
});

/**
 * Error thrown by the URL loader pipeline. Carries an HTTP-like `status` code so
 * the formatter can map it to a user-facing message.
 */
class UrlLoaderError extends Error {
    /**
     * @param {string} message - Internal error message (logged, not user-visible).
     * @param {number} status - HTTP-like status (404 / 403 / 5xx / 502 etc.).
     */
    constructor(message, status) {
        super(message);
        this.name = 'UrlLoaderError';
        this.status = status;
    }
}

/**
 * Map a thrown error from the load pipeline to a user-facing localized message.
 * @param {Error|UrlLoaderError} error - The error caught from the load pipeline.
 * @param {object} intl - react-intl `intl` object (must have formatMessage).
 * @returns {string} Localized error message.
 */
const formatLoadError = (error, intl) => {
    if (error && error.status === 404) {
        return intl.formatMessage(urlLoaderMessages.projectNotFound);
    }
    if (error && error.status === 403) {
        return intl.formatMessage(urlLoaderMessages.projectAccessDenied);
    }
    if (error && typeof error.status === 'number' && error.status >= 500) {
        return intl.formatMessage(urlLoaderMessages.serverError);
    }
    // fetch() throws TypeError on network failures (offline, DNS, CORS, etc.)
    if (error && error.name === 'TypeError') {
        return intl.formatMessage(urlLoaderMessages.networkError);
    }
    return intl.formatMessage(urlLoaderMessages.loadError);
};

/**
 * Fetch project metadata (including project_token) via the smalruby-api proxy.
 *
 * Returns the parsed JSON body when successful, or throws `UrlLoaderError` with
 * the appropriate status:
 * - 404 / 403 / 5xx are propagated from the proxy
 * - Legacy SAM proxy returned 200 with `{code: "NotFound"}` for missing projects
 *   — we detect this and treat it as 404 for backwards compatibility
 * - Missing `project_token` in a 200 response → 502 (bad gateway)
 * @param {string} endpoint - Base endpoint (no trailing slash), e.g. https://stg.api.smalruby.app
 * @param {string|number} projectId - Scratch project id (numeric string).
 * @returns {Promise<{project_token: string, [key: string]: unknown}>} Resolves with project info.
 */
const fetchProjectInfo = async (endpoint, projectId) => {
    const uri = `${endpoint}/scratch-api-proxy/projects/${encodeURIComponent(projectId)}`;
    const response = await fetch(uri, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
        throw new UrlLoaderError(`HTTP ${response.status}`, response.status);
    }
    const data = await response.json();
    // Backwards compatibility with the legacy SAM proxy that returned
    // `200 OK` with `{code: 'NotFound'}` for missing projects.
    if (data && data.code === 'NotFound') {
        throw new UrlLoaderError('Project not found (legacy proxy)', 404);
    }
    if (!data || typeof data.project_token !== 'string' || data.project_token.length === 0) {
        throw new UrlLoaderError('Project token missing in proxy response', 502);
    }
    return data;
};

export { UrlLoaderError, fetchProjectInfo, formatLoadError, urlLoaderMessages };
