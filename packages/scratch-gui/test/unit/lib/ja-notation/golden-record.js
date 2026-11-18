/**
 * What the golden of the Japanese-mode corpus records for one program (issue #2095, J0 of
 * docs/ruby-editor/converter-roadmap.md): the output of the current `dnclToRuby` / `rubyToDncl`
 * and of the converter on that output, as plain JSON.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import { printBlockNotationLike, readBlocks } from '../../helpers/block-notation';
import { makeConverter, makeSpriteTarget, setupRubyGenerator } from '../../helpers/ruby-roundtrip-helper';

// Keeps what JSON keeps (drops undefined and functions), so the record equals its file.
const plain = (value) => JSON.parse(JSON.stringify(value));

/**
 * Rename the argument ids of custom blocks (random each time) to `arg1`, `arg2`, ... in the
 * blocks of the target, so the notation is the same every time (inputs are printed sorted by
 * name). Done after the Ruby is generated.
 * @param {object} target - The target the blocks are on.
 */
const stabilizeArgumentIds = (target) => {
    const blocks = Object.values(target.blocks._blocks);
    const names = new Map();
    blocks.forEach((block) => {
        const argumentIds = block.mutation && block.mutation.argumentids;
        if (!argumentIds) return;
        JSON.parse(argumentIds).forEach((id) => {
            if (!names.has(id)) names.set(id, `arg${names.size + 1}`);
        });
    });
    blocks.forEach((block) => {
        const inputs = {};
        Object.entries(block.inputs).forEach(([name, input]) => {
            const renamed = names.get(name) || name;
            inputs[renamed] = { ...input, name: renamed };
        });
        block.inputs = inputs;
    });
};

/**
 * Convert Ruby to blocks as the Japanese mode does (a sprite, Ruby v2), then generate Ruby again.
 * @param {string} ruby - The Ruby made from the Japanese.
 * @returns {Promise<object>} `{errors}` when it fails, else `{errors: [], blocks, generated}`.
 */
const convertToBlocks = async (ruby) => {
    const { target, stage, runtime } = makeSpriteTarget();
    setupRubyGenerator();
    const converter = makeConverter(target, runtime, { version: '2' });
    const ok = await converter.targetCodeToBlocks(target, ruby);
    if (!ok || converter.errors.length > 0) return { errors: converter.errors };
    await converter.applyTargetBlocks(target);
    RubyGenerator.currentTarget = target;
    const generated = RubyGenerator.targetToCode(target, { version: '2' }).trim();
    stabilizeArgumentIds(target);
    let blocks;
    try {
        blocks = printBlockNotationLike(readBlocks(target, stage), '').actual;
    } catch (e) {
        blocks = `(cannot be read: ${e.message})`;
    }
    return { errors: [], blocks, generated };
};

/**
 * The record of a Japanese program.
 *
 * - `ruby` / `errors` / `blockErrors`: what `dnclToRuby` returns (the errors on Japanese lines).
 * - `rubyLines`: for each Ruby line, its Japanese line (the source map).
 * - `converterErrors`: the converter's errors on the Ruby, moved to Japanese rows as the
 *   Japanese mode shows them. `blocks`: the blocks (block notation) when it converts.
 * - `shown`: the blocks back to Ruby (the generator) and to Japanese (`rubyToDncl`), as the
 *   Japanese mode shows the program again.
 * @param {string} ja - The Japanese code.
 * @returns {Promise<object>} The record.
 */
const recordJa = async (ja) => {
    const result = dnclToRuby(ja);
    const record = { ruby: result.ruby, errors: result.errors, blockErrors: result.blockErrors };
    if (result.ruby === null) return plain(record);
    const rubyLineCount = result.ruby.split('\n').length;
    record.rubyLines = Array.from({ length: rubyLineCount }, (_, i) => result.sourceMap.rubyLineToDnclLine(i + 1));
    const converted = await convertToBlocks(result.ruby);
    record.converterErrors = result.sourceMap.rubyErrorsToDncl(converted.errors);
    if (converted.errors.length === 0) {
        record.blocks = converted.blocks;
        const back = rubyToDncl(converted.generated);
        record.shown = { ruby: converted.generated, ja: back.dncl, errors: back.errors };
    }
    return plain(record);
};

/**
 * The record of a Ruby program: `rubyToDncl` (the Japanese and the errors on Ruby lines) and
 * that Japanese back to Ruby (`dnclToRuby`).
 * @param {string} ruby - The Ruby code.
 * @returns {object} The record.
 */
const recordRuby = (ruby) => {
    const toJa = rubyToDncl(ruby);
    const back = dnclToRuby(toJa.dncl);
    return plain({
        ja: toJa.dncl,
        errors: toJa.errors,
        back: { ruby: back.ruby, errors: back.errors, blockErrors: back.blockErrors },
    });
};

export { recordJa, recordRuby };
