// === Smalruby: This file is Smalruby-specific (regex support for operator_contains) ===
const test = require('tap').test;
const Operators = require('../../src/blocks/scratch3_operators');

const blocks = new Operators(null);

test('contains with regex: basic matching', (t) => {
    t.equal(blocks.contains({ STRING1: 'hello world', STRING2: '/hello/' }), true);
    t.equal(blocks.contains({ STRING1: 'foo bar', STRING2: '/hello/' }), false);
    t.end();
});

test('contains with regex: anchors', (t) => {
    t.equal(blocks.contains({ STRING1: 'hello world', STRING2: '/^hello/' }), true);
    t.equal(blocks.contains({ STRING1: 'say hello', STRING2: '/^hello/' }), false);
    t.equal(blocks.contains({ STRING1: 'hello world', STRING2: '/world$/' }), true);
    t.equal(blocks.contains({ STRING1: 'world hello', STRING2: '/world$/' }), false);
    t.end();
});

test('contains with regex: meta characters', (t) => {
    t.equal(blocks.contains({ STRING1: 'abc123', STRING2: '/\\d+/' }), true);
    t.equal(blocks.contains({ STRING1: 'abcdef', STRING2: '/\\d+/' }), false);
    t.end();
});

test('contains with regex: case sensitivity', (t) => {
    t.equal(blocks.contains({ STRING1: 'hello', STRING2: '/Hello/' }), false, 'regex is case-sensitive by default');
    t.end();
});

test('contains with regex: flags', (t) => {
    t.equal(blocks.contains({ STRING1: 'hello', STRING2: '/Hello/i' }), true, 'i flag ignores case');
    t.equal(blocks.contains({ STRING1: 'foo', STRING2: '/o/g' }), true, 'g flag works');
    t.end();
});

test('contains with regex: non-regex strings preserve existing behavior', (t) => {
    t.equal(blocks.contains({ STRING1: 'hello world', STRING2: 'hello' }), true, 'plain string works');
    t.equal(blocks.contains({ STRING1: 'HeLLo world', STRING2: 'hello' }), true, 'plain string is case-insensitive');
    t.equal(blocks.contains({ STRING1: '/hello', STRING2: '/hello' }), true, 'leading slash only is plain search');
    t.equal(blocks.contains({ STRING1: 'hello/', STRING2: 'hello/' }), true, 'trailing slash only is plain search');
    t.equal(blocks.contains({ STRING1: 'anything', STRING2: '//' }), false, 'empty regex pattern is plain search');
    t.end();
});

test('contains with regex: invalid regex returns false', (t) => {
    t.equal(blocks.contains({ STRING1: 'hello', STRING2: '/[/' }), false, 'invalid regex returns false');
    t.equal(blocks.contains({ STRING1: 'hello', STRING2: '/hello/xyz' }), false, 'invalid flags returns false');
    t.end();
});
