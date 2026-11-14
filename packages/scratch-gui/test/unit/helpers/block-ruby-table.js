/**
 * A table of "blocks ⇔ Ruby" rows, run in both directions and as a round trip (issue #1828).
 *
 * ```js
 * defineBlockRubyTable('Motion', [
 *     { blocks: 'motion_movesteps(STEPS: 10)', ruby: 'move(10)' },
 *     { blocks: 'motion_changexby(DX: -10)', ruby: 'self.x -= 10' },
 *     { blocks: 'motion_changexby(DX: operator_subtract(NUM1: 0, NUM2: 10))', ruby: 'self.x += 0 - 10', only: 'toRuby' },
 * ]);
 * ```
 *
 * For each row it defines up to three tests:
 *
 * - `toRuby`: write `blocks` (the notation of `block-notation.js`) to a sprite and generate Ruby;
 *   it must equal `ruby`.
 * - `toBlocks`: convert `ruby` and read the blocks back; they must equal `blocks` (compared in the
 *   canonical notation, so ids, positions and argument order do not matter, and a failure shows a
 *   line diff of the notation).
 * - `roundTrip`: Ruby → blocks → Ruby must give `ruby` again.
 *
 * `only: 'toRuby'` / `only: 'toBlocks'` runs that direction alone (for shapes that do not come
 * back the same way). `name` names the row; by default it is the first line of `ruby`.
 * `versions: ['2']` on a row overrides the Ruby versions of the table for that row.
 *
 * Multi-line Ruby: start a template literal with a new line and indent it as you like; it is
 * dedented. A string that starts on its first line is used as it is (only trimmed), so
 * `'3.times do\n  say("hi")\nend'` keeps its indentation.
 */
import dedent from 'dedent';
import RubyGenerator from '../../../src/lib/ruby-generator';
import { buildBlocks, printBlockNotationLike, readBlocks } from './block-notation';
import {
    makeConverter,
    makeSpriteTarget,
    makeStageTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from './ruby-roundtrip-helper';

/**
 * The Ruby of a row: dedented when it starts with a new line (a template literal), else as it is.
 * @param {string} text - The Ruby of the row.
 * @returns {string} The Ruby, trimmed.
 */
const cleanRuby = (text) => (text.startsWith('\n') ? dedent(text) : text).trim();

const makeTarget = (stage) => (stage ? makeStageTarget() : makeSpriteTarget());

/**
 * Generate Ruby from the notation of blocks.
 * @param {string} blocks - The notation.
 * @param {{version: string, stage: boolean}} options - The Ruby version and whether the blocks are the stage's.
 * @returns {string} The generated Ruby, trimmed.
 */
const blocksToRuby = (blocks, { version, stage }) => {
    const { target, stage: stageTarget } = makeTarget(stage);
    setupRubyGenerator();
    buildBlocks(blocks, target, stageTarget);
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, { version }).trim();
};

/**
 * Convert Ruby and read the resulting blocks back as notation nodes.
 * @param {string} ruby - The Ruby code.
 * @param {{version: string, stage: boolean}} options - The Ruby version and whether the code is the stage's.
 * @returns {Promise<object>} The blocks, as `readBlocks` returns them.
 */
const rubyToBlocks = async (ruby, { version, stage }) => {
    const { target, stage: stageTarget, runtime } = makeTarget(stage);
    setupRubyGenerator();
    const converter = makeConverter(target, runtime, { version });
    const ok = await converter.targetCodeToBlocks(target, ruby);
    if (!ok || converter.errors.length > 0) {
        throw new Error(`Ruby could not be converted:\n${ruby}\nerrors: ${JSON.stringify(converter.errors)}`);
    }
    await converter.applyTargetBlocks(target);
    return readBlocks(target, stageTarget);
};

const defineRowTests = (row, ruby, opts) => {
    if (row.only !== 'toBlocks') {
        test('toRuby', () => {
            expect(blocksToRuby(row.blocks, opts)).toBe(ruby);
        });
    }
    if (row.only !== 'toRuby') {
        test('toBlocks', async () => {
            const { actual, expected } = printBlockNotationLike(await rubyToBlocks(ruby, opts), row.blocks);
            expect(actual).toBe(expected);
        });
    }
    if (!row.only) {
        test('roundTrip', async () => {
            const { target, runtime } = makeTarget(opts.stage);
            setupRubyGenerator();
            const converter = makeConverter(target, runtime, { version: opts.version });
            expect(await rubyToBlocksToRuby(converter, target, ruby)).toBe(ruby);
        });
    }
};

/**
 * Define the tests of a table.
 * @param {string} name - The name of the table (the describe block).
 * @param {Array<{blocks: string, ruby: string, only?: string, name?: string, versions?: Array<string>}>} rows
 *     - The rows.
 * @param {{versions?: Array<string>, version?: string, stage?: boolean}} [options] - The Ruby
 *     versions to run every row with (default `['2']`; `version: '1'` is the same as `versions: ['1']`)
 *     and whether the code belongs to the stage (default a sprite).
 */
const defineBlockRubyTable = (name, rows, options = {}) => {
    const tableVersions = options.versions || [options.version || '2'];
    const stage = options.stage === true;
    describe(name, () => {
        rows.forEach((row, i) => {
            if (row.only && row.only !== 'toRuby' && row.only !== 'toBlocks') {
                throw new Error(`row ${i}: only must be 'toRuby' or 'toBlocks', not ${row.only}`);
            }
            const ruby = cleanRuby(row.ruby);
            const rowName = row.name || `${i + 1}: ${ruby.split('\n')[0]}`;
            const versions = row.versions || tableVersions;
            describe(rowName, () => {
                versions.forEach((version) => {
                    const opts = { version: String(version), stage };
                    if (versions.length > 1) {
                        describe(`v${version}`, () => defineRowTests(row, ruby, opts));
                    } else {
                        defineRowTests(row, ruby, opts);
                    }
                });
            });
        });
    });
};

export { defineBlockRubyTable, blocksToRuby, rubyToBlocks, cleanRuby };
