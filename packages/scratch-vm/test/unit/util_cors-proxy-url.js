const { test } = require('tap');

const { buildCorsProxyHost, getCorsProxyHost } = require('../../src/util/cors-proxy-url');

// The translate / text2speech extensions reach Scratch's CORS-locked services through
// Smalruby's generic CORS proxy. The proxy host follows the build value
// SCRATCH_API_PROXY_ENDPOINT so a branch preview (stg API) does not call the prod API,
// whose CORS does not allow the preview origin (issue #1374).
test('buildCorsProxyHost defaults to the prod API when no endpoint is given', (t) => {
    t.equal(buildCorsProxyHost(), 'https://api.smalruby.app/cors-proxy');
    t.equal(buildCorsProxyHost(''), 'https://api.smalruby.app/cors-proxy');
    t.equal(buildCorsProxyHost(null), 'https://api.smalruby.app/cors-proxy');
    t.end();
});

test('buildCorsProxyHost appends /cors-proxy to the given endpoint', (t) => {
    t.equal(buildCorsProxyHost('https://stg.api.smalruby.app'), 'https://stg.api.smalruby.app/cors-proxy');
    t.end();
});

test('buildCorsProxyHost strips trailing slashes from the endpoint', (t) => {
    t.equal(buildCorsProxyHost('https://stg.api.smalruby.app/'), 'https://stg.api.smalruby.app/cors-proxy');
    t.equal(buildCorsProxyHost('https://stg.api.smalruby.app//'), 'https://stg.api.smalruby.app/cors-proxy');
    t.end();
});

test('getCorsProxyHost reads SCRATCH_API_PROXY_ENDPOINT', (t) => {
    const original = process.env.SCRATCH_API_PROXY_ENDPOINT;
    t.teardown(() => {
        if (typeof original === 'undefined') {
            delete process.env.SCRATCH_API_PROXY_ENDPOINT;
        } else {
            process.env.SCRATCH_API_PROXY_ENDPOINT = original;
        }
    });

    delete process.env.SCRATCH_API_PROXY_ENDPOINT;
    t.equal(getCorsProxyHost(), 'https://api.smalruby.app/cors-proxy');

    process.env.SCRATCH_API_PROXY_ENDPOINT = 'https://stg.api.smalruby.app';
    t.equal(getCorsProxyHost(), 'https://stg.api.smalruby.app/cors-proxy');
    t.end();
});
