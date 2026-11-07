const { test } = require('tap');

const fetchModulePath = require.resolve('../../src/util/fetch-with-timeout');
const extPath = require.resolve('../../src/extensions/scratch3_translate');

// The Translate extension is an upstream Scratch file whose translate service is
// CORS-locked to scratch.mit.edu. Smalruby must route requests through its own
// generic CORS proxy (api.smalruby.app/cors-proxy?url=<encoded translate URL>) so
// smalruby.app is not blocked by CORS. This test guards that the proxy wrapping is
// not silently reverted by an upstream merge (same root cause as text2speech; see
// issue #862 / #859 / #857). The proxy host follows SCRATCH_API_PROXY_ENDPOINT so a
// branch preview uses the stg API (issue #1374).

/**
 * Translate once with SCRATCH_API_PROXY_ENDPOINT set to `endpoint` and return the URL
 * passed to fetchWithTimeout.
 * @param {string|undefined} endpoint - the build value (undefined = not set)
 * @returns {Promise<string|null>} the captured request URL
 */
const captureTranslateUrl = (endpoint) => {
    const originalEndpoint = process.env.SCRATCH_API_PROXY_ENDPOINT;
    if (typeof endpoint === 'undefined') {
        delete process.env.SCRATCH_API_PROXY_ENDPOINT;
    } else {
        process.env.SCRATCH_API_PROXY_ENDPOINT = endpoint;
    }

    // Stub fetchWithTimeout before the extension captures it via destructuring at
    // module load time, then fresh-require the extension so it picks up the stub
    // (and reads SCRATCH_API_PROXY_ENDPOINT, which is also resolved at load time).
    const fetchModule = require(fetchModulePath);
    const originalFetch = fetchModule.fetchWithTimeout;
    let capturedUrl = null;
    fetchModule.fetchWithTimeout = (url) => {
        capturedUrl = url;
        return Promise.resolve({ text: () => Promise.resolve('{"result":"hi"}') });
    };

    delete require.cache[extPath];
    const Scratch3TranslateBlocks = require(extPath);
    const ext = new Scratch3TranslateBlocks();

    return ext
        .getTranslate({ WORDS: 'hello', LANGUAGE: 'ja' })
        .then(() => capturedUrl)
        .finally(() => {
            // restore before assertions so a failure does not leak the stub
            fetchModule.fetchWithTimeout = originalFetch;
            delete require.cache[extPath];
            if (typeof originalEndpoint === 'undefined') {
                delete process.env.SCRATCH_API_PROXY_ENDPOINT;
            } else {
                process.env.SCRATCH_API_PROXY_ENDPOINT = originalEndpoint;
            }
        });
};

test('translate extension routes fetch through the generic Smalruby CORS proxy', (t) =>
    captureTranslateUrl(undefined).then((capturedUrl) => {
        t.ok(capturedUrl, 'fetchWithTimeout was called');
        t.match(
            capturedUrl,
            /^https:\/\/api\.smalruby\.app\/cors-proxy\?url=/,
            'request goes to the generic Smalruby CORS proxy',
        );
        // The translate URL (with its query) is carried as the encoded `url` param.
        t.match(
            capturedUrl,
            /url=https%3A%2F%2Ftranslate-service\.scratch\.mit\.edu%2Ftranslate/,
            'the CORS-locked translate URL is wrapped as the proxy `url` param',
        );
        t.notMatch(
            capturedUrl,
            /^https:\/\/translate-service\.scratch\.mit\.edu/,
            'the browser does not call the CORS-locked Scratch translate service directly',
        );
    }));

test('translate extension uses the CORS proxy of SCRATCH_API_PROXY_ENDPOINT', (t) =>
    captureTranslateUrl('https://stg.api.smalruby.app').then((capturedUrl) => {
        t.match(
            capturedUrl,
            /^https:\/\/stg\.api\.smalruby\.app\/cors-proxy\?url=https%3A%2F%2Ftranslate-service/,
            'request goes to the stg CORS proxy',
        );
    }));
