// SPDX-License-Identifier: MIT
// Writing the Japanese of a JaAST (data: ./data/write-ja.json).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { writeJa } from '../src/index.js';
import { readData } from './helpers.js';

const data = readData('write-ja.json');

describe('writeJa', () => {
    data.cases.forEach(({ title, program, ja }) => {
        test(title, () => {
            assert.equal(writeJa(program), ja);
        });
    });

    test('a long chain is written without running out of the stack', () => {
        const at = { line: 0, column: 0 };
        const name = (n) => ({ type: 'Name', name: n, ...at });
        let value = name('a0');
        for (let i = 1; i < 20000; i++)
            value = { type: 'Binary', operator: 'and', left: value, right: name(`a${i}`), ...at };
        const text = writeJa({ body: [{ type: 'Assign', target: name('x'), value, ...at }] });
        assert.ok(text.startsWith('x = a0 and a1 and a2'));
        assert.ok(text.endsWith('and a19999'));
    });
});
