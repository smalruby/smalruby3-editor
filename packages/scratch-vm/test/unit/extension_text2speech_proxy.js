const { test } = require('tap');

const fetchModulePath = require.resolve('../../src/util/fetch-with-timeout');
const extPath = require.resolve('../../src/extensions/scratch3_text2speech');

// The Text2Speech extension is an upstream Scratch file whose synthesis service is
// CORS-locked to scratch.mit.edu. Smalruby must route requests through its own
// generic CORS proxy (api.smalruby.app/cors-proxy?url=<encoded synth URL>) so
// smalruby.app is not blocked by CORS. This test guards that the proxy wrapping is
// not silently reverted by an upstream merge (same root cause as translate; see
// issue #859 / #857).
test('text2speech extension routes fetch through the generic Smalruby CORS proxy', (t) => {
    // Stub fetchWithTimeout before the extension captures it via destructuring at
    // module load time, then fresh-require the extension so it picks up the stub.
    const fetchModule = require(fetchModulePath);
    const originalFetch = fetchModule.fetchWithTimeout;
    let capturedUrl = null;
    fetchModule.fetchWithTimeout = (url) => {
        capturedUrl = url;
        // Short-circuit before the audio-engine path by rejecting.
        return Promise.reject(new Error('stubbed'));
    };

    delete require.cache[extPath];
    const Scratch3Text2SpeechBlocks = require(extPath);
    // Minimal runtime: constructor subscribes via .on, and getCurrentLanguage
    // calls getTargetForStage (null stage => falls back to DEFAULT_LANGUAGE).
    const runtime = {
        on: () => {},
        getTargetForStage: () => null,
    };
    const ext = new Scratch3Text2SpeechBlocks(runtime);

    // Minimal target providing custom-state storage used by _getState.
    const customState = {};
    const target = {
        getCustomState: (key) => customState[key],
        setCustomState: (key, value) => {
            customState[key] = value;
        },
    };

    // speakAndWait always resolves (it swallows fetch errors in a .catch and logs
    // a warning), so we assert on the captured URL after it settles.
    return ext.speakAndWait({ WORDS: 'hello' }, { target }).then(() => {
        // restore before assertions so a failure does not leak the stub
        fetchModule.fetchWithTimeout = originalFetch;
        delete require.cache[extPath];

        t.ok(capturedUrl, 'fetchWithTimeout was called');
        t.match(
            capturedUrl,
            /^https:\/\/api\.smalruby\.app\/cors-proxy\?url=/,
            'request goes to the generic Smalruby CORS proxy',
        );
        // The synth URL (with its query) is carried as the encoded `url` param.
        t.match(
            capturedUrl,
            /url=https%3A%2F%2Fsynthesis-service\.scratch\.mit\.edu%2Fsynth/,
            'the CORS-locked synthesis URL is wrapped as the proxy `url` param',
        );
        t.notMatch(
            capturedUrl,
            /^https:\/\/synthesis-service\.scratch\.mit\.edu/,
            'the browser does not call the CORS-locked Scratch service directly',
        );
        t.end();
    });
});
