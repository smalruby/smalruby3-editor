/**
 * The new conversion of the Japanese (ja-notation, J1 of
 * docs/ruby-editor/converter-roadmap.md) against the golden of the current one
 * (test/fixtures/ja-notation/, made by golden.test.js): for every program of the
 * corpus in the standard form, the Ruby of ja-notation must have the same prism
 * syntax tree as the Ruby of `dnclToRuby` (spaces and parentheses may differ),
 * the same comments and the same Japanese line for each Ruby line.
 *
 * - A program the current conversion cannot convert (its errors, or the errors
 *   of the converter on its Ruby) must not convert here either, and the first
 *   error is on the same Japanese line.
 * - Programs in the DNCL-like form are read in J2; until then they are listed
 *   (`dncl-like`) and must be in the golden too.
 */
import fs from 'fs';
import path from 'path';
import { SMALRUBY_JA_NOTATION } from '../../../../src/lib/dncl/ja-notation-table';
import { jaToRuby } from '../../../../src/lib/ja-notation';
import { loadPrism } from '../../../../src/lib/prism-parser';
import { rubyShape } from './ruby-shape';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/ja-notation');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));

const corpus = readJson('corpus/ja.json');
const golden = readJson('golden/ja.json');

const results = corpus.map((entry) => ({ entry, result: jaToRuby(entry.ja, SMALRUBY_JA_NOTATION) }));
const isDnclLike = ({ result }) => result.errors.some((e) => e.code === 'dncl-like');
const standard = results.filter((r) => !isDnclLike(r));
const dnclLike = results.filter(isDnclLike);

/** Whether the current conversion fails on a program (its own errors or the converter's). */
const oldFails = (record) => record.ruby === null || record.converterErrors.length > 0;

/**
 * Bugs found by the golden (J0). They are fixed on the new path (J2 and
 * later), so here they stay as the current conversion has them; each entry
 * says where the program is now.
 */
const KNOWN_BUGS = {
    // #2168: the Ruby is the same as now; the converter cannot make blocks of it.
    'ja-8d7923f4fc': { issue: 2168, where: 'standard' },
    // #2166, #2167: written in the DNCL-like form, read in J2.
    'ja-ff70a2a2df': { issue: 2166, where: 'dncl-like' },
    'ja-e2e2f282bb': { issue: 2167, where: 'dncl-like' },
    'ja-053fb08229': { issue: 2167, where: 'dncl-like' },
};

let prism;
beforeAll(async () => {
    prism = await loadPrism();
});

describe('ja-notation against the golden of the Japanese corpus', () => {
    test('the corpus has programs in the standard form', () => {
        expect(standard.length).toBeGreaterThan(300);
    });

    test.each(standard.map((r) => [r.entry.id, r]))('%s', (id, { entry, result }) => {
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

    test('the programs in the DNCL-like form are in the golden (read in J2)', () => {
        dnclLike.forEach(({ entry }) => expect(golden[entry.id]).toBeDefined());
        expect(dnclLike.length + standard.length).toBe(corpus.length);
    });

    test.each(Object.entries(KNOWN_BUGS))('known bug %s stays where it is', (id, { where }) => {
        const found = results.find((r) => r.entry.id === id);
        expect(found).toBeDefined();
        expect(isDnclLike(found) ? 'dncl-like' : 'standard').toBe(where);
        if (where === 'standard') {
            expect(rubyShape(prism, found.result.ruby)).toEqual(rubyShape(prism, golden[id].ruby));
            expect(golden[id].converterErrors.length).toBeGreaterThan(0);
        }
    });
});
