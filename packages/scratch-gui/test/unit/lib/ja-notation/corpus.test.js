/**
 * The new conversion of the Japanese (ja-notation, J1 and J2 of
 * docs/ruby-editor/converter-roadmap.md) against the golden of the current one
 * (test/fixtures/ja-notation/, made by golden.test.js): for every program of the
 * corpus, in the standard form and in the DNCL-like form, the Ruby of
 * ja-notation must have the same prism syntax tree as the Ruby of `dnclToRuby`
 * (spaces and parentheses may differ), the same comments and the same Japanese
 * line for each Ruby line.
 *
 * A program the current conversion cannot convert (its errors, or the errors
 * of the converter on its Ruby) must not convert here either, and the first
 * error is on the same Japanese line.
 */
import { jaToRuby } from '@smalruby/ja-notation';
import fs from 'fs';
import path from 'path';
import { SMALRUBY_JA_NOTATION } from '../../../../src/lib/dncl/ja-notation-table';
import { loadPrism } from '../../../../src/lib/prism-parser';
import { rubyShape } from './ruby-shape';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/ja-notation');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));

const corpus = readJson('corpus/ja.json');
const golden = readJson('golden/ja.json');

const results = corpus.map((entry) => ({ entry, result: jaToRuby(entry.ja, SMALRUBY_JA_NOTATION) }));

/**
 * Whether a program is in the DNCL-like form: a closing line, `←`, `かつ` /
 * `または` / `でない` or 「...」 (a rough look at the text, to count them).
 */
const DNCL_LIKE_RE = /^[\s｜|⎿]*(?:を実行する|を繰り返す|と定義する)\s*(?:#.*)?$|←|かつ|または|でない|「/m;
const dnclLike = results.filter(({ entry }) => DNCL_LIKE_RE.test(entry.ja));

/** Whether the current conversion fails on a program (its own errors or the converter's). */
const oldFails = (record) => record.ruby === null || record.converterErrors.length > 0;

/**
 * Bugs found by the golden (J0), after the Ruby, and fixed in the converter:
 * #2167 (a call written before its function) and #2168 (`namae + "..."` with a
 * name never set). Their programs have blocks in the golden now. (#2166, blocks
 * → Japanese, was fixed by J4.) A bug the golden finds again is kept in the
 * golden as it is, with a test here that the Ruby stays the same, until it is fixed.
 */
const FIXED_BUGS = {
    'ja-8d7923f4fc': 2168,
    'ja-e2e2f282bb': 2167,
    'ja-053fb08229': 2167,
};

let prism;
beforeAll(async () => {
    prism = await loadPrism();
});

describe('ja-notation against the golden of the Japanese corpus', () => {
    test('the corpus has programs in both forms', () => {
        expect(results.length - dnclLike.length).toBeGreaterThan(300);
        expect(dnclLike.length).toBeGreaterThan(250);
    });

    test.each(results.map((r) => [r.entry.id, r]))('%s', (id, { entry, result }) => {
        const record = golden[id];
        expect(record).toBeDefined();
        if (result.ruby === null) {
            expect(oldFails(record)).toBe(true);
            if (record.errors.length > 0) expect(result.errors[0].line).toBe(record.errors[0].line);
            return;
        }
        expect(record.ruby).not.toBeNull();
        expect(rubyShape(prism, result.ruby)).toEqual(rubyShape(prism, record.ruby));
        expect(result.jaLines).toEqual(record.rubyLines);
        expect(entry.ja.split('\n').length).toBeGreaterThan(0);
    });

    test.each(Object.entries(FIXED_BUGS))('fixed bug %s (#%s): the golden has the blocks', (id) => {
        const found = results.find((r) => r.entry.id === id);
        expect(found).toBeDefined();
        expect(rubyShape(prism, found.result.ruby)).toEqual(rubyShape(prism, golden[id].ruby));
        expect(golden[id].converterErrors).toEqual([]);
        expect(golden[id].blocks).toEqual(expect.any(String));
        expect(golden[id].shown.errors).toEqual([]);
    });
});
