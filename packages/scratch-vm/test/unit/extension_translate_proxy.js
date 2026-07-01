const { test } = require('tap');

const fetchModulePath = require.resolve('../../src/util/fetch-with-timeout');
const extPath = require.resolve('../../src/extensions/scratch3_translate');

// The Translate extension is an upstream Scratch file whose translate service is
// CORS-locked to scratch.mit.edu. Smalruby must route requests through its own
// proxy (api.smalruby.app/scratch-api-proxy/) so smalruby.app is not blocked by
// CORS. This test guards that the override is not silently reverted by an
// upstream merge (as happened during the v13.7.2 merge; see issue #857).
test('translate extension routes fetch through the Smalruby CORS proxy', (t) => {
    // Stub fetchWithTimeout before the extension captures it via destructuring at
    // module load time, then fresh-require the extension so it picks up the stub.
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

    return ext.getTranslate({ WORDS: 'hello', LANGUAGE: 'ja' }).then(() => {
        // restore before assertions so a failure does not leak the stub
        fetchModule.fetchWithTimeout = originalFetch;
        delete require.cache[extPath];

        t.ok(capturedUrl, 'fetchWithTimeout was called');
        t.match(
            capturedUrl,
            /^https:\/\/api\.smalruby\.app\/scratch-api-proxy\/translate\?/,
            'serverURL points to the Smalruby CORS proxy',
        );
        t.notMatch(
            capturedUrl,
            /translate-service\.scratch\.mit\.edu/,
            'does not call the CORS-locked Scratch translate service directly',
        );
        t.end();
    });
});
