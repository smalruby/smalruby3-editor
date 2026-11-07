/* global process */

// The API that serves Smalruby's generic CORS proxy (infra/smalruby-api
// `GET /cors-proxy?url=<encoded target URL>`) when the build does not set
// SCRATCH_API_PROXY_ENDPOINT. Same default as scratch-gui (webpack.config.js).
const DEFAULT_SCRATCH_API_PROXY_ENDPOINT = 'https://api.smalruby.app';

/**
 * Build the CORS proxy URL from an API endpoint.
 * @param {string} [endpoint] - API endpoint, e.g. https://stg.api.smalruby.app
 * @returns {string} `<endpoint>/cors-proxy` (trailing slashes of the endpoint removed)
 */
const buildCorsProxyHost = (endpoint) => {
    const base = (endpoint || DEFAULT_SCRATCH_API_PROXY_ENDPOINT).replace(/\/+$/, '');
    return `${base}/cors-proxy`;
};

/**
 * The CORS proxy URL of this build. It follows SCRATCH_API_PROXY_ENDPOINT so a branch
 * preview (stg API) does not call the prod API, whose CORS rejects the preview origin.
 * @returns {string} the CORS proxy URL
 */
const getCorsProxyHost = () => buildCorsProxyHost(process.env.SCRATCH_API_PROXY_ENDPOINT);

module.exports = {
    buildCorsProxyHost,
    getCorsProxyHost,
};
