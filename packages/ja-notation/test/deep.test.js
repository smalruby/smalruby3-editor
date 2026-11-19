// SPDX-License-Identifier: MIT
// Deep and long programs: the walks of the syntax trees (parse, buildRuby,
// writeRuby, readRuby, writeJa) keep a stack of their own (../src/run.js), so
// an expression of thousands of terms, a chain of thousands of signs or
// parentheses and blocks thousands deep do not run out of the call stack.
// The programs are made by repeating, so they are written here, not in ./data/.
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { jaToRuby, parse, rubyToJa, writeJa } from '../src/index.js';
import { prism } from './helpers.js';

const N = 5000;

const repeat = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/**
 * Compare two long texts, saying only where they first differ (not the
 * thousands of characters).
 * @param {string} actual - The text made.
 * @param {string} expected - The text expected.
 */
const sameText = (actual, expected) => {
    if (actual === expected) return;
    const at = [...expected].findIndex((ch, i) => actual[i] !== ch);
    assert.fail(
        `differs at ${at}: ${JSON.stringify(String(actual).slice(at, at + 40))} for ${JSON.stringify(expected.slice(at, at + 40))}`,
    );
};

describe('Japanese → Ruby of deep programs', () => {
    const cases = [
        {
            title: `an expression of ${N} terms`,
            ja: `x = ${repeat(N, () => '1').join(' + ')}`,
            ruby: `x = ${repeat(N, () => '1').join(' + ')}`,
        },
        {
            title: `${N} conditions joined by and`,
            ja: `x = ${repeat(N, () => 'a > 1').join(' and ')}`,
            ruby: `x = ${repeat(N, () => 'a > 1').join(' && ')}`,
        },
        {
            title: `${N} parentheses in parentheses`,
            ja: `x = ${'('.repeat(N)}1${')'.repeat(N)}`,
            ruby: 'x = 1',
        },
        {
            title: `${N} terms nested on the right`,
            ja: `x = ${'1 + ('.repeat(N)}1${')'.repeat(N)}`,
            ruby: `x = ${'1 + ('.repeat(N - 1)}1 + 1${')'.repeat(N - 1)}`,
        },
        {
            title: `${N} signs`,
            ja: `x = ${'-'.repeat(N)}a`,
            ruby: `x = ${'-('.repeat(N - 1)}-a${')'.repeat(N - 1)}`,
        },
        {
            title: `${N} nots`,
            ja: `x = ${'not '.repeat(N)}a`,
            ruby: `x = ${'!'.repeat(N)}a`,
        },
        {
            title: `${N} calls in calls`,
            ja: `関数 f(a):\n    a を返す\nx = ${'f('.repeat(N)}1${')'.repeat(N)}`,
            ruby: `def f(a)\n  return a\nend\nx = ${'f('.repeat(N)}1${')'.repeat(N)}`,
        },
        {
            title: `${N} indexes in indexes`,
            ja: `a = [0]\nx = ${'a['.repeat(N)}0${']'.repeat(N)}`,
            ruby: `a = [0]\nx = ${'a['.repeat(N)}0${']'.repeat(N)}`,
        },
    ];
    cases.forEach(({ title, ja, ruby }) => {
        test(title, () => {
            const result = jaToRuby(ja);
            assert.deepEqual(result.errors, []);
            sameText(result.ruby, ruby);
        });
    });

    test('blocks 1000 deep, in the standard form and in the DNCL-like form', () => {
        const depth = 1000;
        const ruby = [
            ...repeat(depth, (i) => `${'  '.repeat(i)}if a > 0`),
            `${'  '.repeat(depth)}x = 1`,
            ...repeat(depth, (i) => `${'  '.repeat(depth - 1 - i)}end`),
        ].join('\n');
        const standard = [
            ...repeat(depth, (i) => `${'    '.repeat(i)}もし a > 0 ならば:`),
            `${'    '.repeat(depth)}x = 1`,
        ].join('\n');
        const dnclLike = [
            ...repeat(depth, () => 'もし a > 0 ならば'),
            'x = 1',
            ...repeat(depth, () => 'を実行する'),
        ].join('\n');
        sameText(jaToRuby(standard).ruby, ruby);
        sameText(jaToRuby(dnclLike).ruby, ruby);
    });

    test(`the JaAST of an expression of ${N} terms is written back as the same Japanese`, () => {
        const ja = `x = ${repeat(N, () => '1').join(' + ')} - ${'('.repeat(N)}a${')'.repeat(N)}`;
        sameText(writeJa(parse(ja).program), `x = ${repeat(N, () => '1').join(' + ')} - a`);
    });
});

describe('Ruby → Japanese of long programs (as long as prism can parse them)', () => {
    let parseRuby;
    before(async () => {
        parseRuby = await prism();
    });

    test('an expression of 1000 terms', () => {
        const ruby = `x = ${repeat(1000, () => '1').join(' + ')}`;
        sameText(rubyToJa(ruby, { parse: parseRuby }).ja, ruby);
    });

    test('3000 conditions joined by &&', () => {
        const ruby = `x = ${repeat(3000, () => 'a > 1').join(' && ')}`;
        sameText(rubyToJa(ruby, { parse: parseRuby }).ja, `x = ${repeat(3000, () => 'a > 1').join(' and ')}`);
    });

    test('1000 elsif', () => {
        const ruby = ['a = 1', 'if a > 0', '  x = 0', ...repeat(1000, (i) => `elsif a > ${i}\n  x = ${i}`), 'end'];
        const ja = [
            'a = 1',
            'もし a > 0 ならば:',
            '    x = 0',
            ...repeat(1000, (i) => `そうでなくもし a > ${i} ならば:\n    x = ${i}`),
        ];
        sameText(rubyToJa(ruby.join('\n'), { parse: parseRuby }).ja, ja.join('\n'));
    });
});
