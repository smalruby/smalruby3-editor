// SPDX-License-Identifier: MIT
// Japanese → Ruby (parse, buildRuby and writeRuby) with the tables the data
// names (data: ./data/ja-to-ruby.json).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { jaToRuby } from '../src/index.js';
import { plain, readData, TABLES } from './helpers.js';

const data = readData('ja-to-ruby.json');

describe('jaToRuby', () => {
    data.cases.forEach(({ title, table, ja, ruby, jaLines, errors }) => {
        test(`${title} (table: ${table})`, () => {
            const result = jaToRuby(ja, TABLES[table]);
            if (errors) {
                assert.equal(result.ruby, null);
                assert.deepEqual(plain(result.errors), errors);
                return;
            }
            assert.deepEqual(plain(result.errors), []);
            assert.equal(result.ruby, ruby);
            assert.deepEqual(result.jaLines, jaLines);
        });
    });
});
