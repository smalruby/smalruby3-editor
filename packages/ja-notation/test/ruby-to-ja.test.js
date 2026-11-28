// SPDX-License-Identifier: MIT
// Ruby → Japanese (prism, readRuby and writeJa) with the tables the data names
// (data: ./data/ruby-to-ja.json).
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { rubyToJa } from '../src/index.js';
import { plain, prism, readData, TABLES } from './helpers.js';

const data = readData('ruby-to-ja.json');

describe('rubyToJa', () => {
    let parse;
    before(async () => {
        parse = await prism();
    });

    data.cases.forEach(({ title, table, ruby, ja, errors }) => {
        test(`${title} (table: ${table})`, () => {
            const result = rubyToJa(ruby, { ...TABLES[table], parse });
            assert.equal(result.ja, ja);
            assert.deepEqual(plain(result.errors), errors);
        });
    });

    // The names of the variables the program does not use but are there (of the
    // sprite and of the stage), which the counter must not take (Issue #2574).
    describe('reservedNames', () => {
        test('the counter of n.times is not a reserved name', () => {
            const result = rubyToJa('3.times do\n  a = 1\nend', {
                ...TABLES.none,
                parse,
                reservedNames: ['i', 'k'],
            });
            assert.equal(result.ja, 'j を 1 から 3 まで 1 ずつ増やしながら繰り返す:\n    a = 1');
        });

        test('the reserved names are added to the names the program uses', () => {
            const result = rubyToJa('j = 0\n3.times do\n  j = j + 1\nend', {
                ...TABLES.none,
                parse,
                reservedNames: new Set(['i', 'k']),
            });
            assert.equal(result.ja, 'j = 0\ni2 を 1 から 3 まで 1 ずつ増やしながら繰り返す:\n    j = j + 1');
        });
    });
});
