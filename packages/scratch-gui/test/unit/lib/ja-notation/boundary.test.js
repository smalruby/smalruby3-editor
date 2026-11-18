/**
 * The boundary of the ja-notation library (docs/ruby-editor/converter-roadmap.md,
 * 「ライブラリにするときの約束」): it imports nothing outside its directory, so it
 * can be taken out as a package of its own, and every file says it is MIT.
 */
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(__dirname, '../../../../src/lib/ja-notation');
const files = fs.readdirSync(DIR).filter((name) => name.endsWith('.js'));

/** Every module a file imports or requires. */
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

describe('ja-notation library boundary', () => {
    test('the library has its files', () => {
        expect(files).toEqual(
            expect.arrayContaining(['index.js', 'lexer.js', 'parse-standard.js', 'build-ruby.js', 'write-ruby.js']),
        );
    });

    test('the library has its MIT license', () => {
        expect(fs.readFileSync(path.join(DIR, 'LICENSE'), 'utf8')).toMatch(/^MIT License/);
    });

    test.each(files)('%s imports only files of the library', (name) => {
        const source = fs.readFileSync(path.join(DIR, name), 'utf8');
        importsOf(source).forEach((spec) => {
            expect(spec).toMatch(/^\.\/[^/]+$/);
            const target = path.join(DIR, spec.endsWith('.js') ? spec : `${spec}.js`);
            expect(fs.existsSync(target)).toBe(true);
        });
    });

    test.each(files)('%s says it is MIT', (name) => {
        const source = fs.readFileSync(path.join(DIR, name), 'utf8');
        expect(source.startsWith('// SPDX-License-Identifier: MIT\n')).toBe(true);
    });

    test('the import scan finds imports', () => {
        expect(importsOf("import a from 'x';\nimport { b } from \"../y\";\nconst c = require('z');")).toEqual([
            'x',
            '../y',
            'z',
        ]);
    });
});
