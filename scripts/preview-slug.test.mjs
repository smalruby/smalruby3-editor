// node --test scripts/preview-slug.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import {PREVIEW_SLUG_MAX_LENGTH, previewSlug} from './preview-slug.mjs';

test('develop stays develop', () => {
    assert.equal(previewSlug('develop'), 'develop');
});

test('slashes become hyphens and the result is lowercased', () => {
    assert.equal(previewSlug('topic/autopilot-1344'), 'topic-autopilot-1344');
    assert.equal(previewSlug('Feature/Ruby_Tab'), 'feature-ruby-tab');
});

test('characters that DNS labels / S3 keys cannot take are replaced and collapsed', () => {
    assert.equal(previewSlug('fix/a..b@c#d'), 'fix-a-b-c-d');
    assert.equal(previewSlug('fix//double'), 'fix-double');
    assert.equal(previewSlug('日本語/branch'), 'branch');
    assert.equal(previewSlug('-leading/trailing-'), 'leading-trailing');
});

test('long names are cut to a DNS label and keep a hash so they stay distinct', () => {
    const a = previewSlug(`topic/${'x'.repeat(80)}-a`);
    const b = previewSlug(`topic/${'x'.repeat(80)}-b`);
    assert.ok(a.length <= PREVIEW_SLUG_MAX_LENGTH);
    assert.ok(b.length <= PREVIEW_SLUG_MAX_LENGTH);
    assert.notEqual(a, b);
    assert.match(a, /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
    assert.equal(previewSlug(`topic/${'x'.repeat(80)}-a`), a);
});

test('names with nothing usable fall back to a hash, never to an empty prefix', () => {
    const s = previewSlug('日本語');
    assert.match(s, /^b-[0-9a-f]{8}$/);
    assert.throws(() => previewSlug(''));
    assert.throws(() => previewSlug(undefined));
});
