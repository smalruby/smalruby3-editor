// node --test scripts/hosting/site-compare.test.mjs
// No network: only the pure comparison functions are tested.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
    cacheControlProblem,
    checkDirectoryRedirect,
    checkMissing,
    comparePath,
    contentTypeProblem,
    formatReport,
    htmlAssetPaths,
    mediaType,
    pathsFromFiles,
    precachePaths,
    toPath,
} from './site-compare.mjs';

const ok = (type, cc, sha = 'aaaa') => ({status: 200, headers: {'content-type': type, 'cache-control': cc}, sha256: sha});

test('toPath makes root-relative, percent-encoded paths once', () => {
    assert.equal(toPath('static/a b.png'), '/static/a%20b.png');
    assert.equal(toPath('./x.js'), '/x.js');
    assert.equal(toPath('/%E3%81%82.png'), '/%E3%81%82.png');
    assert.equal(toPath('あ.png'), '/%E3%81%82.png');
});

test('precachePaths reads the Workbox manifest and the runtime chunk', () => {
    const sw = 'define(["./workbox-aa16eec5"],function(e){e.precacheAndRoute([' +
        '{url:".well-known/microsoft-identity-association.json",revision:"1"},' +
        '{url:"gui.0123abcd.js",revision:null},{"revision":"2","url":"about.html"}],{})});';
    assert.deepEqual(precachePaths(sw).sort(), [
        '/.well-known/microsoft-identity-association.json',
        '/about.html',
        '/gui.0123abcd.js',
        '/workbox-aa16eec5.js',
    ]);
});

test('htmlAssetPaths keeps same-site assets only', () => {
    const html = '<link href="favicon.ico"><script src="./gui.0123abcd.js?x=1"></script>' +
        '<a href="https://example.com/">x</a><img src="data:image/png;base64,AA"><a href="#top">t</a>' +
        '<link href="//cdn.example.com/a.css">';
    assert.deepEqual(htmlAssetPaths(html), ['/favicon.ico', '/gui.0123abcd.js']);
});

test('pathsFromFiles turns a build listing into paths and directories', () => {
    const r = pathsFromFiles(['index.html', 'admin/index.html', 'static/x.0123abcd.wasm', '.nojekyll', 'CNAME',
        '.well-known/microsoft-identity-association.json', 'a/.DS_Store']);
    assert.deepEqual(r.paths, ['/', '/.well-known/microsoft-identity-association.json', '/admin/',
        '/admin/index.html', '/index.html', '/static/x.0123abcd.wasm']);
    assert.deepEqual(r.directories, ['/admin']);
});

test('mediaType drops parameters and case', () => {
    assert.equal(mediaType('Text/HTML; charset=utf-8'), 'text/html');
    assert.equal(mediaType(undefined), '');
});

test('hashed files must be immutable for a year', () => {
    assert.equal(cacheControlProblem('/gui.0123abcd.js', 'public, max-age=31536000, immutable'), null);
    assert.match(cacheControlProblem('/gui.0123abcd.js', 'max-age=600'), /immutable/);
});

test('files without a hash must be max-age=0 or no-cache', () => {
    for (const p of ['/', '/index.html', '/service-worker.js', '/version.json', '/auth-redirect.html',
        '/.well-known/microsoft-identity-association.json', '/admin/index.html']) {
        assert.equal(cacheControlProblem(p, 'max-age=0, s-maxage=60'), null, p);
        assert.match(cacheControlProblem(p, 'max-age=600'), /max-age=0/, p);
        assert.match(cacheControlProblem(p, undefined), /max-age=0/, p);
    }
    assert.equal(cacheControlProblem('/index.html', 'no-cache'), null);
});

test('.wasm / .mjs / .hex and the others get the expected Content-Type', () => {
    assert.equal(contentTypeProblem('/prism.0123abcd.wasm', 'application/wasm'), null);
    assert.match(contentTypeProblem('/prism.0123abcd.wasm', 'binary/octet-stream'), /application\/wasm/);
    assert.equal(contentTypeProblem('/m.mjs', 'text/javascript; charset=utf-8'), null);
    assert.match(contentTypeProblem('/m.mjs', 'application/octet-stream'), /javascript/);
    assert.equal(contentTypeProblem('/30d09ba32a17082ef820b57d52d60b7b.hex', 'application/octet-stream'), null);
    assert.match(contentTypeProblem('/a.hex', 'text/html'), /octet-stream/);
    assert.match(contentTypeProblem('/.well-known/microsoft-identity-association.json', 'text/plain'), /json/);
    assert.equal(contentTypeProblem('/admin/', 'text/html'), null);
    assert.equal(contentTypeProblem('/LICENSE', 'text/plain'), null);
});

test('comparePath finds status, body and type differences', () => {
    const same = comparePath('/gui.0123abcd.js', ok('application/javascript', 'max-age=600'),
        ok('application/javascript', 'public, max-age=31536000, immutable'));
    assert.deepEqual(same.problems, []);

    const r = comparePath('/index.html', ok('text/html', 'max-age=600', 'aaa'), ok('text/plain', 'max-age=0', 'bbb'));
    assert.equal(r.problems.length, 3, r.problems.join('\n'));
    assert.match(r.problems.join('\n'), /body differs/);

    const s = comparePath('/x.json', ok('application/json', ''), {status: 403, headers: {}, sha256: ''});
    assert.deepEqual(s.problems, ['status A=200 B=403']);
});

test('a charset difference is only a warning', () => {
    const r = comparePath('/index.html', ok('text/html; charset=utf-8', 'max-age=600'), ok('text/html', 'max-age=0'));
    assert.deepEqual(r.problems, []);
    assert.equal(r.warnings.length, 1);
});

test('B header checks can be turned off (e.g. comparing two Pages hosts)', () => {
    const r = comparePath('/index.html', ok('text/html', 'max-age=600'), ok('text/html', 'max-age=600'), {bChecks: false});
    assert.deepEqual(r.problems, []);
});

test('a missing path must be 403 on B; A is only shown', () => {
    assert.deepEqual(checkMissing('/nope.html', {status: 404}, {status: 403}).problems, []);
    assert.match(checkMissing('/nope.html', {status: 404}, {status: 404}).problems[0], /403/);
    assert.match(checkMissing('/nope.html', {status: 404}, {status: 403}).warnings[0], /A=404 B=403/);
});

test('a directory without "/" must be a 301 to "<path>/" on B', () => {
    const a = {status: 301, headers: {location: 'https://smalruby.example/admin/'}};
    assert.deepEqual(checkDirectoryRedirect('/admin', a, {status: 301, headers: {location: '/admin/'}}).problems, []);
    assert.deepEqual(checkDirectoryRedirect('/admin', a,
        {status: 301, headers: {location: 'https://d1.cloudfront.example/admin/'}}).problems, []);
    assert.match(checkDirectoryRedirect('/admin', a, {status: 403, headers: {}}).problems[0], /301/);
    assert.match(checkDirectoryRedirect('/admin', a, {status: 301, headers: {location: '/'}}).problems[0], /admin\//);
});

test('formatReport counts paths with problems', () => {
    const text = formatReport([{path: '/', problems: [], warnings: []}, {path: '/x', problems: ['p'], warnings: ['w']}], 'A', 'B');
    assert.match(text, /OK {3}\/\n/);
    assert.match(text, /NG {3}\/x\n {7}p\n {7}warn: w/);
    assert.match(text, /2 paths, 1 with problems/);
});
