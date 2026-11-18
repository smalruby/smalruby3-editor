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
});
