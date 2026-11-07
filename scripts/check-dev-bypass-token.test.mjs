// node --test scripts/check-dev-bypass-token.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { findLeaks, parseGitGrep } from './check-dev-bypass-token.mjs';

// Build the key and a dummy value at runtime so this file itself never matches the check.
const KEY = ['DEV', 'BYPASS', 'TOKEN'].join('_');
const DUMMY = 'dummy'.repeat(5);

const leaks = (text) => findLeaks([{ file: 'f', line: 1, text }]).length > 0;

test('values are caught', () => {
    assert.ok(leaks(`${KEY}=${DUMMY}`));
    assert.ok(leaks(`${KEY} = '${DUMMY}'`));
    assert.ok(leaks(`export ${KEY}="${DUMMY}"`));
    assert.ok(leaks(`"${KEY}": "${DUMMY}"`));
    assert.ok(leaks(`    ${KEY}: '${DUMMY}',`));
    assert.ok(leaks(`process.env.${KEY} || '${DUMMY}'`));
    assert.ok(leaks(`process.env.${KEY} ?? \`${DUMMY}\``));
    // a value at the end of a sentence in docs
    assert.ok(leaks(`Set ${KEY}=${DUMMY}.`));
    assert.ok(leaks(`${KEY}: ${DUMMY}...`));
});

test('empty values and placeholders pass', () => {
    assert.ok(!leaks(`${KEY}=`));
    assert.ok(!leaks(`${KEY}=""`));
    assert.ok(!leaks(`?devlogin=<${KEY}>`));
    assert.ok(!leaks(`${KEY}=<${KEY}>`));
    assert.ok(!leaks(`${KEY}="$(grep -E '^${KEY}=' .env | cut -d= -f2-)"`));
    assert.ok(!leaks(`devlogin=\${${KEY}}`));
    assert.ok(!leaks(`${KEY}: process.env.${KEY}`));
    assert.ok(!leaks(`const ${KEY} = readTheTokenFromTheEnvironment();`));
    assert.ok(!leaks(`const ${KEY} = configurationSettings.devBypassToken;`));
    assert.ok(!leaks(`${KEY}=short`));
});

test('the result does not include the line text', () => {
    const [hit] = findLeaks([{ file: 'a.js', line: 3, text: `${KEY}=${DUMMY}` }]);
    assert.deepEqual(hit, { file: 'a.js', line: 3 });
});

test('parseGitGrep reads -z -n output', () => {
    assert.deepEqual(parseGitGrep(`a.js\x002\x00x = 1\nb/c.env\x0010\x00y: z\n`), [
        { file: 'a.js', line: 2, text: 'x = 1' },
        { file: 'b/c.env', line: 10, text: 'y: z' },
    ]);
});

test('the CLI fails on a staged value and passes on a placeholder', () => {
    const script = fileURLToPath(new URL('./check-dev-bypass-token.mjs', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'check-dev-bypass-token-'));
    const run = (...args) => {
        try {
            execFileSync(process.execPath, [script, ...args], { cwd: dir, stdio: 'pipe' });
            return 0;
        } catch (e) {
            assert.doesNotMatch(String(e.stderr), new RegExp(DUMMY));
            return e.status;
        }
    };
    try {
        execFileSync('git', ['init', '-q'], { cwd: dir });
        writeFileSync(join(dir, '.env.example'), `${KEY}=\n`);
        writeFileSync(join(dir, 'README.md'), `open ?devlogin=<${KEY}>\n`);
        execFileSync('git', ['add', '.'], { cwd: dir });
        assert.equal(run('--staged'), 0);
        assert.equal(run(), 0);

        writeFileSync(join(dir, 'config.js'), `const t = process.env.${KEY} || '${DUMMY}';\n`);
        execFileSync('git', ['add', 'config.js'], { cwd: dir });
        assert.equal(run('--staged'), 1);
        assert.equal(run(), 1);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
