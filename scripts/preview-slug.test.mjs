// node --test scripts/preview-slug.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import {PREVIEW_SLUG_MAX_LENGTH, previewSlug} from './preview-slug.mjs';

test('develop stays develop', () => {
    assert.equal(previewSlug('develop'), 'develop');
});

const HASHED = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$/;

test('names that are already valid slugs stay as they are', () => {
    assert.equal(previewSlug('feature-x'), 'feature-x');
    assert.equal(previewSlug('fix-123'), 'fix-123');
});

test('normalized names are lowercased, hyphenated and get a hash of the original name', () => {
    const s = previewSlug('topic/autopilot-1344');
    assert.match(s, HASHED);
    assert.ok(s.startsWith('topic-autopilot-1344-'));
    assert.ok(previewSlug('Feature/Ruby_Tab').startsWith('feature-ruby-tab-'));
    assert.equal(previewSlug('topic/autopilot-1344'), s);
});

test('characters that DNS labels / S3 keys cannot take are replaced and collapsed', () => {
    assert.ok(previewSlug('fix/a..b@c#d').startsWith('fix-a-b-c-d-'));
    assert.ok(previewSlug('fix//double').startsWith('fix-double-'));
    assert.ok(previewSlug('日本語/branch').startsWith('branch-'));
    assert.ok(previewSlug('-leading/trailing-').startsWith('leading-trailing-'));
});

test('branches that normalize the same still get different slugs', () => {
    assert.notEqual(previewSlug('fix/foo_bar'), previewSlug('fix/foo-bar'));
    assert.notEqual(previewSlug('Feature/X'), previewSlug('feature/x'));
    assert.notEqual(previewSlug('fix/foo'), previewSlug('fix-foo'));
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
