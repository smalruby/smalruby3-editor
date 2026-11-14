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
 */
import dedent from 'dedent';
import RubyGenerator from '../../../src/lib/ruby-generator';
import { buildBlocks, normalizeBlockNotation, printBlockNotation, readBlocks } from './block-notation';
import {
    makeConverter,
    makeSpriteTarget,
    makeStageTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from './ruby-roundtrip-helper';

const clean = (text) => dedent(text).trim();

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
 * Convert Ruby and print the resulting blocks in the canonical notation.
 * @param {string} ruby - The Ruby code.
 * @param {{version: string, stage: boolean}} options - The Ruby version and whether the code is the stage's.
 * @returns {Promise<string>} The canonical notation of the blocks.
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
    return printBlockNotation(readBlocks(target, stageTarget));
};

/**
 * Define the tests of a table.
 * @param {string} name - The name of the table (the describe block).
 * @param {Array<{blocks: string, ruby: string, only?: string, name?: string}>} rows - The rows.
 * @param {{version?: string, stage?: boolean}} [options] - Ruby version (default `'2'`) and whether
 *     the code belongs to the stage (default a sprite).
 */
const defineBlockRubyTable = (name, rows, options = {}) => {
    const opts = { version: options.version || '2', stage: options.stage === true };
    describe(name, () => {
        rows.forEach((row, i) => {
            if (row.only && row.only !== 'toRuby' && row.only !== 'toBlocks') {
                throw new Error(`row ${i}: only must be 'toRuby' or 'toBlocks', not ${row.only}`);
            }
            const ruby = clean(row.ruby);
            const rowName = row.name || `${i + 1}: ${ruby.split('\n')[0]}`;
            describe(rowName, () => {
                if (row.only !== 'toBlocks') {
                    test('toRuby', () => {
                        expect(blocksToRuby(row.blocks, opts)).toBe(ruby);
                    });
                }
                if (row.only !== 'toRuby') {
                    test('toBlocks', async () => {
                        expect(await rubyToBlocks(ruby, opts)).toBe(normalizeBlockNotation(row.blocks));
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
            });
        });
    });
};

export { defineBlockRubyTable, blocksToRuby, rubyToBlocks };
