/**
 * The golden of the Japanese-mode corpus (issue #2095, J0 of docs/ruby-editor/converter-roadmap.md):
 * every program of test/fixtures/ja-notation/corpus/ must still give what
 * test/fixtures/ja-notation/golden/ recorded (Ruby, Japanese, the errors with their lines).
 * The new conversion (`ja-notation`) is switched to only when this stays the same.
 *
 * When a change of the Japanese mode is meant to change the output, make the golden again and
 * read its diff: `UPDATE_JA_GOLDEN=1 npx jest test/unit/lib/ja-notation/golden.test.js`.
 * How to add programs: test/fixtures/ja-notation/README.md.
 */
import fs from 'fs';
import path from 'path';
import { recordJa, recordRuby } from './golden-record';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/ja-notation');
const UPDATE = process.env.UPDATE_JA_GOLDEN === '1';

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));

const KINDS = [
    { kind: 'ja', record: (entry) => recordJa(entry.ja) },
    { kind: 'ruby', record: (entry) => recordRuby(entry.ruby) },
];

describe.each(KINDS)('Japanese-mode golden: $kind', ({ kind, record }) => {
    const corpus = readJson(`corpus/${kind}.json`);
    const goldenFile = `golden/${kind}.json`;
    const golden = UPDATE ? {} : readJson(goldenFile);
    const made = {};

    test('the golden has one record for each program of the corpus', () => {
        if (UPDATE) return;
        expect(Object.keys(golden).sort()).toEqual(corpus.map((entry) => entry.id).sort());
    });

    test.each(corpus.map((entry) => [entry.id, entry]))('%s', async (id, entry) => {
        const actual = await record(entry);
        if (UPDATE) {
            made[id] = actual;
            return;
        }
        expect(actual).toEqual(golden[id]);
    });

    afterAll(() => {
        if (!UPDATE) return;
        // A run narrowed with -t makes only some records: keep the others as they were.
        const before = fs.existsSync(path.join(FIXTURES, goldenFile)) ? readJson(goldenFile) : {};
        const ordered = {};
        corpus.forEach(({ id }) => {
            const recordOfId = id in made ? made[id] : before[id];
            if (recordOfId !== undefined) ordered[id] = recordOfId;
        });
        fs.writeFileSync(path.join(FIXTURES, goldenFile), `${JSON.stringify(ordered, null, 2)}\n`);
    });
});
