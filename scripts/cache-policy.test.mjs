import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {CACHE_CONTROL, cacheClassFor, isExcluded, split} from './cache-policy.mjs';

test('cacheClassFor makes file names with a hash immutable', () => {
    assert.equal(cacheClassFor('gui.6edcb0b762080afd68f0.js'), 'immutable');
    assert.equal(cacheClassFor('gui.6edcb0b762080afd68f0.js.br'), 'immutable');
    assert.equal(cacheClassFor('chunks/fetch-worker.0123abcd.js'), 'immutable');
    assert.equal(cacheClassFor('static/assets/boost.4a2ce7f91157e3155ee7.png'), 'immutable');
});

test('cacheClassFor makes the versioned monaco directory immutable', () => {
    assert.equal(cacheClassFor('static/monaco/0.57.0/vs/loader.js'), 'immutable');
    assert.equal(cacheClassFor('static/monaco/0.57.0/vs/editor/editor.main.css'), 'immutable');
    assert.equal(cacheClassFor('static/monaco/1.0.0-rc.1/vs/loader.js'), 'immutable');
    // Not a version: stays re-checked.
    assert.equal(cacheClassFor('static/monaco/latest/vs/loader.js'), 'revalidate');
    assert.equal(cacheClassFor('static/monaco/loader.js'), 'revalidate');
});

test('cacheClassFor makes md5-named smalruby-assets immutable', () => {
    assert.equal(cacheClassFor('static/smalruby-assets/57613248603bb9c5b4b767b72cd4fdef.png'), 'immutable');
    assert.equal(cacheClassFor('static/smalruby-assets/57613248603bb9c5b4b767b72cd4fdef.svg'), 'immutable');
    assert.equal(cacheClassFor('static/smalruby-assets/logo.png'), 'revalidate');
    assert.equal(cacheClassFor('static/smalruby-assets/5761324860.png'), 'revalidate');
});

test('cacheClassFor gives blocks-media a short lifetime', () => {
    assert.equal(cacheClassFor('static/blocks-media/default/sprites.png'), 'short');
    assert.equal(cacheClassFor('static/blocks-media/high-contrast/repeat.svg'), 'short');
});

test('cacheClassFor keeps entry files re-checked', () => {
    for (const rel of [
        'index.html',
        'gui.js',
        'gui.js.br',
        'service-worker.js',
        'version.json',
        'auth-redirect.html',
        '.well-known/microsoft-identity-association.json',
        'admin/index.html',
        'static/favicon.ico',
        'extension-worker.js',
    ]) {
        assert.equal(cacheClassFor(rel), 'revalidate', rel);
    }
});

test('CACHE_CONTROL has a header for every class', () => {
    assert.equal(CACHE_CONTROL.immutable, 'public, max-age=31536000, immutable');
    assert.equal(CACHE_CONTROL.short, 'public, max-age=86400, stale-while-revalidate=604800');
    assert.equal(CACHE_CONTROL.revalidate, 'max-age=0, s-maxage=60');
});

test('CACHE_CONTROL lists revalidate last (ci-cd.yml uploads the classes in this order)', () => {
    assert.deepEqual(Object.keys(CACHE_CONTROL), ['immutable', 'short', 'revalidate']);
});

test('isExcluded skips files that are not uploaded by the split', () => {
    assert.equal(isExcluded('.DS_Store'), true);
    assert.equal(isExcluded('static/.DS_Store'), true);
    assert.equal(isExcluded('.nojekyll'), true);
    assert.equal(isExcluded('CNAME'), true);
    assert.equal(isExcluded('gui.js.br'), true);
    assert.equal(isExcluded('gui.6edcb0b762080afd68f0.js.gz'), true);
    assert.equal(isExcluded('gui.js'), false);
    assert.equal(isExcluded('chunks/gui.js.br'), false);
    assert.equal(isExcluded('index.html'), false);
});

test('split copies files into one directory per class', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cache-policy-'));
    try {
        const src = path.join(root, 'src');
        const out = path.join(root, 'out');
        const files = {
            'index.html': '<html>',
            'gui.js.br': 'br',
            '.DS_Store': 'x',
            'static/monaco/0.57.0/vs/loader.js': 'loader',
            'static/blocks-media/default/sprites.png': 'png',
            'static/smalruby-assets/57613248603bb9c5b4b767b72cd4fdef.png': 'asset',
        };
        for (const [rel, body] of Object.entries(files)) {
            await mkdir(path.dirname(path.join(src, rel)), {recursive: true});
            await writeFile(path.join(src, rel), body);
        }
        const counts = await split(src, out);
        assert.deepEqual(counts, {immutable: 2, short: 1, revalidate: 1});
        assert.equal(await readFile(path.join(out, 'immutable/static/monaco/0.57.0/vs/loader.js'), 'utf8'), 'loader');
        assert.equal(
            await readFile(path.join(out, 'immutable/static/smalruby-assets/57613248603bb9c5b4b767b72cd4fdef.png'), 'utf8'),
            'asset',
        );
        assert.equal(await readFile(path.join(out, 'short/static/blocks-media/default/sprites.png'), 'utf8'), 'png');
        assert.equal(await readFile(path.join(out, 'revalidate/index.html'), 'utf8'), '<html>');
        await assert.rejects(stat(path.join(out, 'revalidate/gui.js.br')));
        await assert.rejects(stat(path.join(out, 'revalidate/.DS_Store')));
        // Every class directory exists, so `aws s3 sync` never fails on a missing one.
        for (const name of Object.keys(CACHE_CONTROL)) {
            assert.equal((await stat(path.join(out, name))).isDirectory(), true);
        }
    } finally {
        await rm(root, {recursive: true, force: true});
    }
});
