#!/usr/bin/env node
/**
 * Collect the corpus of Japanese-mode programs (issue #2095, J0 of
 * docs/ruby-editor/converter-roadmap.md) into test/fixtures/ja-notation/corpus/.
 *
 *     cd packages/scratch-gui
 *     node test/ja-notation/collect-corpus.mjs          # add new programs to the corpus
 *     node test/ja-notation/collect-corpus.mjs --fresh  # make the corpus again from nothing
 *
 * Where the programs come from:
 *
 * - every Japanese code (`dnclToRuby`) and Ruby code (`rubyToDncl`) the unit tests of the
 *   Japanese mode pass to the converters (recorded by `record-setup.js`),
 * - the examples in test/fixtures/dncl/ as they are written (the tests tidy them first),
 * - the code blocks of docs/smalruby-dncl-spec.ja.md that are programs (not templates).
 *
 * Only programs written for Smalruby go in: the tests built on samples from outside
 * (`EXCLUDED_TESTS`) are not run. Programs of the 大学入試センター must not be added
 * (docs/dncl/policy.md).
 *
 * Without `--fresh`, programs already in the corpus stay even when no test uses them any
 * more, so the golden keeps them. Make the golden after collecting:
 * `UPDATE_JA_GOLDEN=1 npx jest test/unit/lib/ja-notation/golden.test.js`.
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GUI = path.resolve(HERE, '../..');
const REPO = path.resolve(GUI, '../..');
const CORPUS = path.join(GUI, 'test/fixtures/ja-notation/corpus');

// The unit tests whose codes are recorded.
const RECORDED_TESTS = [
    'test/unit/lib/dncl/',
    'test/unit/lib/genai-dncl-answer.test.js',
    'test/unit/lib/genai-dncl-prompt.test.js',
    'test/unit/lib/genai-ruby-adapter.test.js',
    'test/unit/lib/ruby-roundtrip/japanese-table.test.js',
    'test/unit/lib/ruby-roundtrip/logical-chain.test.js',
    'test/unit/lib/ruby-roundtrip/multiple-assignment.test.js',
];

// Tests whose programs come from sample pages outside Smalruby (they may hold programs of the
// 大学入試センター): not recorded.
const EXCLUDED_TESTS = ['dncl-v2-example.test.js', 'dncl-v2-ictl-samples.test.js', 'dncl-v2-preprocessor.test.js'];

const DOCS = ['docs/smalruby-dncl-spec.ja.md'];
const JA_KEYWORD = /←|ならば|を実行する|を繰り返す|の間|ずつ(増|減)やしながら|表示する\(|と定義する|【/;
// `もし 条件 ならば` / `文...`: a template of the syntax, not a program.
const TEMPLATE = /\.\.\.|…|条件|開始値|終了値/;

// Codes longer than this are not programs someone would write in the Japanese mode.
const MAX_LENGTH = 20000;
const MAX_FROM = 3;

const idOf = (kind, text) => `${kind}-${crypto.createHash('sha1').update(text).digest('hex').slice(0, 10)}`;

const recordTests = () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ja-corpus-')), 'record.jsonl');
    fs.writeFileSync(file, '');
    const args = [
        'jest',
        ...RECORDED_TESTS,
        `--setupFilesAfterEnv=${path.join(HERE, 'record-setup.js')}`,
        '--testPathIgnorePatterns',
        '/node_modules/',
        ...EXCLUDED_TESTS,
        '--reporters=default',
        '--silent',
    ];
    const result = spawnSync('npx', args, {
        cwd: GUI,
        stdio: 'inherit',
        env: { ...process.env, JA_CORPUS_RECORD: file },
    });
    if (result.status !== 0) {
        console.warn('collect-corpus: some recorded tests failed; their codes are still collected.');
    }
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .map(({ kind, text, from, test }) => ({ kind, text, from: test ? `${from} › ${test}` : from }));
};

const fixturePrograms = () => {
    const root = path.join(GUI, 'test/fixtures/dncl');
    return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((dir) => dir.isDirectory())
        .flatMap((dir) =>
            fs
                .readdirSync(path.join(root, dir.name))
                .filter((name) => name.endsWith('.dncl'))
                .sort()
                .map((name) => ({
                    kind: 'ja',
                    text: fs.readFileSync(path.join(root, dir.name, name), 'utf8'),
                    from: `test/fixtures/dncl/${dir.name}/${name}`,
                })),
        );
};

const docPrograms = () =>
    DOCS.flatMap((doc) => {
        const lines = fs.readFileSync(path.join(REPO, doc), 'utf8').split('\n');
        const programs = [];
        let start = null;
        let lang = '';
        lines.forEach((line, i) => {
            const fence = line.match(/^```(\S*)/);
            if (!fence) return;
            if (start === null) {
                start = i;
                lang = fence[1];
                return;
            }
            const text = lines.slice(start + 1, i).join('\n');
            if ((lang === '' || lang === 'text') && JA_KEYWORD.test(text) && !TEMPLATE.test(text)) {
                programs.push({ kind: 'ja', text, from: `${doc}:${start + 2}` });
            }
            start = null;
        });
        return programs;
    });

const readCorpus = (kind) => {
    const file = path.join(CORPUS, `${kind}.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
};

const main = () => {
    const fresh = process.argv.includes('--fresh');
    const found = [...fixturePrograms(), ...docPrograms(), ...recordTests()].filter(
        ({ text }) => text.trim() !== '' && text.length <= MAX_LENGTH,
    );
    for (const kind of ['ja', 'ruby']) {
        const entries = new Map((fresh ? [] : readCorpus(kind)).map((entry) => [entry.id, entry]));
        const before = entries.size;
        for (const { text, from } of found.filter((f) => f.kind === kind)) {
            const id = idOf(kind, text);
            const entry = entries.get(id) || { id, from: [], [kind]: text };
            if (entry.from.length < MAX_FROM && !entry.from.includes(from)) entry.from.push(from);
            entries.set(id, entry);
        }
        const sorted = [...entries.values()].sort(
            (a, b) => a.from[0].localeCompare(b.from[0]) || a.id.localeCompare(b.id),
        );
        fs.mkdirSync(CORPUS, { recursive: true });
        fs.writeFileSync(path.join(CORPUS, `${kind}.json`), `${JSON.stringify(sorted, null, 2)}\n`);
        console.log(`collect-corpus: ${kind}: ${sorted.length} programs (${sorted.length - before} new)`);
    }
};

main();
