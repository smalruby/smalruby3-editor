// The DNCL examples in test/fixtures/dncl/ (README.md there): each one goes through what a
// paste into the Japanese (DNCL) mode goes through (tidy → DNCL to Ruby → blocks), so the
// examples stay readable by Smalruby as the DNCL support changes.
import fs from 'fs';
import path from 'path';
import { findArrayIndexHints } from '../../../../src/lib/dncl/dncl-array-index-hint';
import { checkDnclAnswer } from '../../../../src/lib/genai-dncl-answer.js';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/dncl');

const filesIn = (dir) =>
    fs
        .readdirSync(path.join(FIXTURES, dir))
        .filter((name) => name.endsWith('.dncl'))
        .sort();

const read = (dir, name) => fs.readFileSync(path.join(FIXTURES, dir, name), 'utf8');

// The converter as the Ruby tab uses it (without a VM).
const convert = async (name, code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const result = await converter.targetCodeToBlocks(null, code);
    return { result, errors: converter.errors, blocks: converter.blocks };
};

const check = (code) => checkDnclAnswer({ answer: `\`\`\`\n${code}\`\`\``, editingName: 'スプライト1', convert });

describe('DNCL examples (test/fixtures/dncl)', () => {
    describe.each(['programs', 'formats', 'pitfalls'])('%s/ turn into blocks', (dir) => {
        test.each(filesIn(dir))('%s', async (name) => {
            const result = await check(read(dir, name));
            expect(result.problems).toEqual([]);
            expect(result.ok).toBe(true);
        });
    });

    describe('broken/ do not turn into blocks', () => {
        test.each(filesIn('broken'))('%s', async (name) => {
            const result = await check(read('broken', name));
            expect(result.ok).toBe(false);
            expect(result.problems.length).toBeGreaterThan(0);
        });
    });

    test('programs/ count indexes from 0 (no read past the end of an array)', () => {
        for (const name of filesIn('programs')) {
            expect({ name, hints: findArrayIndexHints(read('programs', name)) }).toEqual({ name, hints: [] });
        }
    });

    test('pitfalls/index-from-one.dncl reads past the end of its array', () => {
        expect(findArrayIndexHints(read('pitfalls', 'index-from-one.dncl')).length).toBeGreaterThan(0);
    });
});
