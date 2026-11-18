import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import zlib from 'node:zlib';

import {CLOUDFRONT_MAX_COMPRESS_BYTES, isOversized, isTarget, precompress} from './precompress-assets.mjs';

test('isTarget picks only the gui JS at the top level', () => {
    assert.equal(isTarget('gui.js'), true);
    assert.equal(isTarget('gui.6edcb0b762080afd68f0.js'), true);
    assert.equal(isTarget('gui.js.map'), false);
    assert.equal(isTarget('gui.js.br'), false);
    assert.equal(isTarget('chunks/gui.js'), false);
    assert.equal(isTarget('lib.min.js'), false);
    assert.equal(isTarget('gui-worker.js'), false);
});

test('isOversized reports large files CloudFront will not compress', () => {
    const big = CLOUDFRONT_MAX_COMPRESS_BYTES + 1;
    assert.equal(isOversized('chunks/tfjs.0123456789.js', big), true);
    assert.equal(isOversized('chunks/tfjs.0123456789.js', CLOUDFRONT_MAX_COMPRESS_BYTES), false);
    assert.equal(isOversized('gui.js', big), false);
    assert.equal(isOversized('gui.js.map', big), false);
    assert.equal(isOversized('gui.js.br', big), false);
    assert.equal(isOversized('gui.js.gz', big), false);
});

test('precompress writes .br / .gz that decompress to the original', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'precompress-'));
    try {
        const body = Buffer.from('const a = "smalruby";\n'.repeat(5000));
        await writeFile(path.join(dir, 'gui.0123abcd89.js'), body);
        await writeFile(path.join(dir, 'index.html'), '<html></html>');
        await mkdir(path.join(dir, 'chunks'));
        await writeFile(path.join(dir, 'chunks', 'gui.js'), 'nested, not a target');

        const {written, oversized} = await precompress(dir);
        assert.deepEqual(written, ['gui.0123abcd89.js.br', 'gui.0123abcd89.js.gz']);
        assert.deepEqual(oversized, []);

        const br = await readFile(path.join(dir, 'gui.0123abcd89.js.br'));
        const gz = await readFile(path.join(dir, 'gui.0123abcd89.js.gz'));
        assert.ok(br.length < body.length);
        assert.deepEqual(zlib.brotliDecompressSync(br), body);
        assert.deepEqual(zlib.gunzipSync(gz), body);
    } finally {
        await rm(dir, {recursive: true, force: true});
    }
});
