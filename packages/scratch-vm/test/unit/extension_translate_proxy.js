const { test } = require('tap');

const fetchModulePath = require.resolve('../../src/util/fetch-with-timeout');
const extPath = require.resolve('../../src/extensions/scratch3_translate');

// The Translate extension is an upstream Scratch file whose translate service is
// CORS-locked to scratch.mit.edu. Smalruby must route requests through its own
// generic CORS proxy (api.smalruby.app/cors-proxy?url=<encoded translate URL>) so
// smalruby.app is not blocked by CORS. This test guards that the proxy wrapping is
// not silently reverted by an upstream merge (same root cause as text2speech; see
// issue #862 / #859 / #857).
test('translate extension routes fetch through the generic Smalruby CORS proxy', (t) => {
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
        t.end();
    });
});
