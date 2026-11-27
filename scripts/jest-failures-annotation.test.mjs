// node --test scripts/jest-failures-annotation.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MAX_LISTED, annotationCommand, failedEntries } from './jest-failures-annotation.mjs';

const SCRIPT = fileURLToPath(new URL('./jest-failures-annotation.mjs', import.meta.url));

const CWD = '/repo';

const suite = (name, assertionResults, extra = {}) => ({
    name: `/repo/packages/scratch-gui/test/unit/${name}`,
    status: assertionResults.some(a => a.status === 'failed') ? 'failed' : 'passed',
    assertionResults,
    ...extra,
});

test('lists each failed test with its file, relative to cwd', () => {
    const results = {
        testResults: [
            suite('a.test.js', [
                {status: 'passed', fullName: 'A works'},
                {status: 'failed', fullName: 'A converts x', ancestorTitles: ['A'], title: 'converts x'},
            ]),
            suite('b.test.js', [{status: 'failed', ancestorTitles: ['B', 'nested'], title: 'y'}]),
        ],
    };
    assert.deepEqual(failedEntries(results, CWD), [
        'packages/scratch-gui/test/unit/a.test.js › A converts x',
        'packages/scratch-gui/test/unit/b.test.js › B nested y',
    ]);
});

test('lists a test file that failed to run with the first line of its error', () => {
    const results = {
        testResults: [
            suite('c.test.js', [], {
                status: 'failed',
                message: "  ● Test suite failed to run\n\n    Cannot find module './missing'\n\n      at foo",
            }),
        ],
    };
    assert.deepEqual(failedEntries(results, CWD), [
        "packages/scratch-gui/test/unit/c.test.js › (test file failed to run): Cannot find module './missing'",
    ]);
});

test('drops the colour codes from the error of a test file that failed to run', () => {
    const esc = String.fromCharCode(27);
    const results = {
        testResults: [
            suite('d.test.js', [], {
                status: 'failed',
                message: `${esc}[1m${esc}[31m  ${esc}[1m● ${esc}[22mTest suite failed to run${esc}[39m\n\n    ${esc}[31mboom${esc}[39m`,
            }),
        ],
    };
    assert.deepEqual(failedEntries(results, CWD), [
        'packages/scratch-gui/test/unit/d.test.js › (test file failed to run): boom',
    ]);
});

test('prints nothing when every test passed', () => {
    const results = {testResults: [suite('a.test.js', [{status: 'passed', fullName: 'A works'}])]};
    assert.deepEqual(failedEntries(results, CWD), []);
    assert.equal(annotationCommand([], 'jest-results.json'), null);
});

test('builds one ::error with escaped title and newline-separated entries', () => {
    const command = annotationCommand(['f.js › a: 100%', 'g.js › b, c'], 'jest-results.json');
    assert.equal(
        command,
        '::error title=jest%3A 2 failed (jest-results.json)::f.js › a: 100%25%0Ag.js › b, c',
    );
});

test(`lists at most ${MAX_LISTED} entries and counts the rest`, () => {
    const entries = Array.from({length: MAX_LISTED + 5}, (_, i) => `t${i}`);
    const message = annotationCommand(entries, 'r.json').split('::')[2];
    const lines = message.split('%0A');
    assert.equal(lines.length, MAX_LISTED + 1);
    assert.equal(lines[MAX_LISTED], '... and 5 more');
    assert.ok(annotationCommand(entries, 'r.json').includes(`jest%3A ${MAX_LISTED + 5} failed`));
});

test('CLI prints one ::error per result file, and says so when jest wrote no result', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-failures-annotation-'));
    try {
        const passed = path.join(dir, 'passed.json');
        const failed = path.join(dir, 'failed.json');
        fs.writeFileSync(passed, JSON.stringify({ testResults: [] }));
        fs.writeFileSync(
            failed,
            JSON.stringify({
                testResults: [
                    {
                        name: path.join(dir, 'a.test.js'),
                        status: 'failed',
                        assertionResults: [{ status: 'failed', fullName: 'A x' }],
                    },
                ],
            }),
        );
        const missing = path.join(dir, 'missing.json');
        const out = execFileSync(process.execPath, [SCRIPT, passed, failed, missing], {
            cwd: dir,
            encoding: 'utf8',
        });
        const lines = out.trim().split('\n');
        assert.equal(lines.length, 2);
        assert.equal(lines[0], '::error title=jest%3A 1 failed (failed.json)::a.test.js › A x');
        assert.ok(lines[1].startsWith('::error title=jest%3A no result ('));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
