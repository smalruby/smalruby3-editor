// SPDX-License-Identifier: MIT
// Reading the Japanese into a JaAST: the standard form, and the DNCL-like form
// into the same JaAST (data: ./data/parse.json).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parse } from '../src/index.js';
import { plain, readData, withoutPositions } from './helpers.js';

const data = readData('parse.json');

describe('parse: the JaAST of a program', () => {
    data.programs.forEach(({ title, ja, program }) => {
        test(title, () => {
            const result = parse(ja);
            assert.deepEqual(plain(result.errors), []);
            assert.deepEqual(plain(result.program), program);
        });
    });
});

describe('parse: sources read as the same JaAST', () => {
    data.same.forEach(({ title, ja, as }) => {
        test(title, () => {
            const [a, b] = [parse(ja), parse(as)];
            assert.deepEqual(plain(a.errors), []);
            assert.deepEqual(plain(b.errors), []);
            assert.deepEqual(
                withoutPositions(plain(a.program.body), data.positionKeys),
                withoutPositions(plain(b.program.body), data.positionKeys),
            );
        });
    });
});

describe('parse: errors', () => {
    data.errors.forEach(({ title, ja, errors }) => {
        test(title, () => {
            const result = parse(ja);
            assert.equal(result.program, null);
            assert.deepEqual(plain(result.errors), errors);
        });
    });
});
