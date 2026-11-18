// SPDX-License-Identifier: MIT
// The boundary of the library (docs/ruby-editor/converter-roadmap.md,
// 「ライブラリにするときの約束」): it has no dependency, imports nothing outside
// its src/, and every file says it is MIT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const files = fs.readdirSync(SRC).filter((name) => name.endsWith('.js'));
const sourceFiles = [
    ...files.map((name) => path.join('src', name)),
    ...fs
        .readdirSync(path.join(ROOT, 'test'))
        .filter((name) => name.endsWith('.js'))
        .map((name) => path.join('test', name)),
    'eslint.config.mjs',
    'prettier.config.mjs',
];

/**
 * Every module a source imports or requires.
 * @param {string} source - The source.
 * @returns {Array<string>} The modules.
 */
const importsOf = (source) => {
    const found = [];
    const patterns = [
        /\bimport\s[^'"]*?from\s*['"]([^'"]+)['"]/g,
        /\bimport\s*['"]([^'"]+)['"]/g,
        /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\bexport\s[^'"]*?from\s*['"]([^'"]+)['"]/g,
    ];
    patterns.forEach((re) => {
        for (const m of source.matchAll(re)) found.push(m[1]);
    });
    return found;
};

describe('the boundary of ja-notation', () => {
    test('the library has its files', () => {
        const expected = [
            'index.js',
            'ja-ast.js',
            'lexer.js',
            'parse.js',
            'build-ruby.js',
            'write-ruby.js',
            'prism-reader.js',
            'read-ruby.js',
            'settings.js',
            'write-ja.js',
        ];
        expected.forEach((name) => assert.ok(files.includes(name), name));
    });

    test('the package is MIT and has no dependency', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
        assert.equal(pkg.license, 'MIT');
        assert.ok(!('dependencies' in pkg));
        assert.match(fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8'), /^MIT License/);
    });

    files.forEach((name) => {
        test(`src/${name} imports only files of the library, with their extension`, () => {
            const source = fs.readFileSync(path.join(SRC, name), 'utf8');
            importsOf(source).forEach((spec) => {
                assert.match(spec, /^\.\/[^/]+\.js$/);
                assert.ok(fs.existsSync(path.join(SRC, spec)), spec);
            });
        });
    });

    sourceFiles.forEach((file) => {
        test(`${file} says it is MIT`, () => {
            const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
            assert.ok(source.startsWith('// SPDX-License-Identifier: MIT\n'));
        });
    });

    test('the import scan finds imports', () => {
        assert.deepEqual(importsOf("import a from 'x';\nimport { b } from \"../y\";\nconst c = require('z');"), [
            'x',
            '../y',
            'z',
        ]);
    });
});
