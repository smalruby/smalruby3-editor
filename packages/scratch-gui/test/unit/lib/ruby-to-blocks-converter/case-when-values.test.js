// A value that the `==` block cannot hold (a symbol, `nil`, an array, a hash, `self`) as the value of
// `when` came back as a bare `when`, and as the subject of `case` it was compared as `0` or `""` when the
// blocks ran. A `case` without a subject stopped with "Cannot set properties of null". All are now the
// error of a wrong instruction on the line of `case` / `when` (issue #1878).
import dedent from 'dedent';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import { readBlocks } from '../../helpers/block-notation';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

const expectWrongInstruction = async (code, row, source) => {
    const { ok, errors } = await convert(code);
    expect(ok).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(row);
    expect(errors[0].text).toContain(wrongInstruction(source));
};

describe('RubyToBlocksConverter/values of case / when that are not values of a block', () => {
    test.each([['when :sym'], ['when nil'], ['when [1, 2]'], ['when {a: 1}'], ['when self']])(
        '`%s` is the wrong instruction',
        async (whenLine) => {
            const code = dedent`
                case @b
                ${whenLine}
                  say(1)
                end
            `;
            await expectWrongInstruction(code, 1, whenLine);
        },
    );

    test('such a value in a later when', async () => {
        const code = dedent`
            case @b
            when 1
              say(1)
            when :x
              say(2)
            end
        `;
        await expectWrongInstruction(code, 3, 'when :x');
    });

    test.each([['case :a'], ['case nil'], ['case [1]'], ['case self']])(
        '`%s` is the wrong instruction',
        async (caseLine) => {
            const code = dedent`
                ${caseLine}
                when 1
                  say(1)
                end
            `;
            await expectWrongInstruction(code, 0, caseLine);
        },
    );

    test('a case without a subject is the wrong instruction', async () => {
        const code = dedent`
            @a = 2
            case
            when @a > 1
              say(1)
            end
        `;
        await expectWrongInstruction(code, 1, 'case');
    });

    // The values a block can hold still come back as written, with no block left behind.
    test.each([['1'], ['-1.5'], ['"a"'], ['@x'], ['true'], ['@x + 1']])('`when %s` comes back', async (value) => {
        const code = dedent`
            case @b
            when ${value}
              say("1")
            end
        `;
        const { target, stage, runtime } = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, { version: '2' });
        expect(await rubyToBlocksToRuby(converter, target, code)).toBe(code);
        expect(() => readBlocks(target, stage)).not.toThrow();
    });
});
