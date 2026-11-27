import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {
    RETENTION_DAYS,
    isRetained,
    listLocalFiles,
    planPrune,
    toDeleteBatches,
    writeDeleteBatches,
} from './prune-old-assets.mjs';

const NOW = Date.parse('2026-11-27T04:00:00Z');
const daysAgo = days => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

test('isRetained keeps hashed names and versioned Monaco files', () => {
    assert.equal(isRetained('gui.6edcb0b762080afd68f0.js'), true);
    assert.equal(isRetained('gui.6edcb0b762080afd68f0.js.br'), true);
    assert.equal(isRetained('chunks/31.0123abcd.js'), true);
    assert.equal(isRetained('manifest.0123456789abcdef.json'), true);
    assert.equal(isRetained('static/assets/smalrubot-s1.0123456789.png'), true);
    assert.equal(isRetained('static/monaco/0.52.2/vs/loader.js'), true);
    assert.equal(isRetained('index.html'), false);
    assert.equal(isRetained('gui.js'), false);
    assert.equal(isRetained('static/monaco/vs/loader.js'), false);
    assert.equal(isRetained('static/favicon.ico'), false);
});

test('planPrune keeps what the new build has', () => {
    const plan = planPrune({
        objects: [{Key: 'index.html', LastModified: daysAgo(100)}],
        localFiles: new Set(['index.html']),
        now: NOW,
    });
    assert.deepEqual(plan.delete, []);
});

test('planPrune removes stale plain files at once', () => {
    const plan = planPrune({
        objects: [{Key: 'old-page.html', LastModified: daysAgo(0)}],
        localFiles: new Set(['index.html']),
        now: NOW,
    });
    assert.deepEqual(plan.delete, ['old-page.html']);
});

test('planPrune keeps hashed files of an old build until the retention passes', () => {
    const plan = planPrune({
        objects: [
            {Key: 'chunks/31.aaaaaaaa.js', LastModified: daysAgo(RETENTION_DAYS - 1)},
            {Key: 'chunks/31.bbbbbbbb.js', LastModified: daysAgo(RETENTION_DAYS + 1)},
            {Key: 'static/monaco/0.50.0/vs/loader.js', LastModified: daysAgo(3)},
        ],
        localFiles: new Set(),
        now: NOW,
    });
    assert.deepEqual(plan.delete, ['chunks/31.bbbbbbbb.js']);
    assert.deepEqual(plan.retained, ['chunks/31.aaaaaaaa.js', 'static/monaco/0.50.0/vs/loader.js']);
});

test('planPrune works under a prefix and skips excluded prefixes and names', () => {
    const plan = planPrune({
        objects: [
            {Key: 'slug/index.html', LastModified: daysAgo(1)},
            {Key: 'slug/old.html', LastModified: daysAgo(1)},
            {Key: 'slug/admin/index.html', LastModified: daysAgo(1)},
            {Key: 'slug/.DS_Store', LastModified: daysAgo(1)},
            {Key: 'slug/sub/CNAME', LastModified: daysAgo(1)},
            {Key: 'other/old.html', LastModified: daysAgo(1)},
        ],
        localFiles: new Set(['index.html']),
        prefix: 'slug/',
        excludePrefixes: ['admin/'],
        now: NOW,
    });
    assert.deepEqual(plan.delete, ['slug/old.html']);
});

test('planPrune treats an unreadable date as new (never deletes by mistake)', () => {
    const plan = planPrune({
        objects: [{Key: 'chunks/1.aaaaaaaa.js', LastModified: 'not a date'}],
        localFiles: new Set(),
        now: NOW,
    });
    assert.deepEqual(plan.delete, []);
});

test('toDeleteBatches splits into delete-objects payloads of up to 1000 keys', () => {
    const keys = Array.from({length: 2001}, (_, i) => `k${i}`);
    const batches = toDeleteBatches(keys);
    assert.deepEqual(
        batches.map(b => b.Objects.length),
        [1000, 1000, 1],
    );
    assert.equal(batches[0].Quiet, true);
    assert.deepEqual(batches[2].Objects[0], {Key: 'k2000'});
});

test('listLocalFiles lists files relative to the directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'prune-'));
    try {
        await mkdir(path.join(dir, 'chunks'));
        await writeFile(path.join(dir, 'index.html'), '');
        await writeFile(path.join(dir, 'chunks', '1.aaaaaaaa.js'), '');
        assert.deepEqual([...(await listLocalFiles(dir))].sort(), ['chunks/1.aaaaaaaa.js', 'index.html']);
    } finally {
        await rm(dir, {recursive: true, force: true});
    }
});

test('writeDeleteBatches writes one JSON file per batch', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'prune-'));
    try {
        await writeDeleteBatches(['a', 'b'], dir);
        assert.deepEqual(await readdir(dir), ['delete-0.json']);
        const body = JSON.parse(await readFile(path.join(dir, 'delete-0.json'), 'utf8'));
        assert.deepEqual(body, {Objects: [{Key: 'a'}, {Key: 'b'}], Quiet: true});
    } finally {
        await rm(dir, {recursive: true, force: true});
    }
});
