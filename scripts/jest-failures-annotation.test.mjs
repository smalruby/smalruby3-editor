// node --test scripts/jest-failures-annotation.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

import {MAX_LISTED, annotationCommand, failedEntries} from './jest-failures-annotation.mjs';

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
