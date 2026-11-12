// === Smalruby: This file is Smalruby-specific (v2 hash method and hash literal value roundtrip tests) ===
/**
 * Methods called on a hash variable (`@h.keys`, `@h.length`, `@h.key?(:a)`, ...) come back as written,
 * and a hash literal whose value cannot be a block is an error instead of a silent `0`
 * (issues #1652 / #1654).
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

const inFlag = (lines) => `when_flag_clicked do\n${lines.map((line) => `  ${line}`).join('\n')}\nend`;

describe('Ruby Roundtrip: V2 hash methods (#1652)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    const operations = [
        'say(H.keys)',
        'say(H.values)',
        'say(H[:a])',
        'H[:a] = 2',
        'say(H.length)',
        'say(H.empty?)',
        'say(H.key?(:a))',
        'say(H.key?("b"))',
        'say(H.key?(@k))',
    ];
    const cases = [];
    ['@h', '$h', 'h'].forEach((name) => {
        operations.forEach((op) => cases.push([name, op.replace(/H/g, name)]));
    });

    test.each(cases)('%s: %s round-trips', async (name, line) => {
        await expectRoundTrip(converter, target, inFlag([`${name} = {a: 1, "b" => 2}`, line]));
    });

    test.each(['@h', '$h', 'h'])('%s.each do |k, v| round-trips', async (name) => {
        await expectRoundTrip(
            converter,
            target,
            inFlag([`${name} = {a: 1}`, `${name}.each do |k, v|`, '  say(k)', '  say(v)', 'end']),
        );
    });

    test('keys and values in a condition and as an argument', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              @h = {a: 1}
              if @h.key?(:a)
                say(@h.values)
              end
              @x = @h.length + 1
            end
        `,
        );
    });

    test('length of a hash used in a method before the hash is set', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            def f
              say(@h.length)
              say(@h.key?(:a))
            end

            when_flag_clicked do
              @h = {a: 1}
            end
        `,
        );
    });

    test('length and key? of a hash read its keys list (no list named after the hash)', async () => {
        const code = inFlag(['@h = {a: 1}', 'say(@h.length)', 'say(@h.key?(:a))', 'say(@h.empty?)']);
        expect(await converter.targetCodeToBlocks(target, code)).toBe(true);
        const keysList = converter._context.lists._hash_h_keys_;
        expect(keysList).toBeDefined();
        expect(Object.keys(converter._context.lists).sort()).toEqual(['_hash_h_keys_', '_hash_h_values_']);
        const blocks = Object.values(converter._context.blocks);
        const lengths = blocks.filter((b) => b.opcode === 'data_lengthoflist');
        expect(lengths).toHaveLength(2);
        lengths.forEach((b) => expect(b.fields.LIST.id).toBe(keysList.id));
        const contains = blocks.find((b) => b.opcode === 'data_listcontainsitem');
        expect(contains.fields.LIST.id).toBe(keysList.id);
        const item = converter._context.blocks[contains.inputs.ITEM.block];
        expect(item.fields.TEXT.value).toBe(':a');
    });

    test('empty? of a local array keeps the local name', async () => {
        await expectRoundTrip(converter, target, inFlag(['a = [1]', 'say(a.empty?)']));
    });

    // A list that the user named like the lists of a hash is not a hash: it keeps its own name,
    // and converting the code again still reads that list.
    test.each([
        ['@_hash_x_keys_ = [1, 2]', 'say(@_hash_x_keys_.length)', 'say(@_hash_x_keys_.empty?)'],
        ['@_hash_x_values_ = [1, 2, 3]', 'say(@_hash_x_values_.length)'],
        ['$_hash_x_keys_ = [1]', 'say($_hash_x_keys_.length)'],
        ['@_hash_x_keys_ = [1, 2]', '@x = 3', 'say(@_hash_x_keys_.length)', 'say(@x)'],
    ])('a list named %s keeps its name after two round trips', async (...lines) => {
        const code = inFlag(lines);
        await expectRoundTrip(converter, target, code);
        await expectRoundTrip(makeConverter(target, runtime, { version: '2' }), target, code);
    });

    test('length of a hash of the stage, read in a sprite, reads the keys list of the stage', async () => {
        const stage = runtime.getTargetForStage();
        const stageConverter = makeConverter(stage, runtime, { version: '2' });
        expect(await stageConverter.targetCodeToBlocks(stage, inFlag(['$h = {a: 1}']))).toBe(true);
        await stageConverter.applyTargetBlocks(stage);

        const code = inFlag(['say($h.length)', 'say($h.empty?)']);
        expect(await converter.targetCodeToBlocks(target, code)).toBe(true);
        const lengths = Object.values(converter._context.blocks).filter((b) => b.opcode === 'data_lengthoflist');
        expect(lengths.map((b) => b.fields.LIST.value)).toEqual(['_hash_h_keys_', '_hash_h_keys_']);
        await expectRoundTrip(makeConverter(target, runtime, { version: '2' }), target, code);
    });

    test('a string whose name has a list named like the lists of a hash is still a string', async () => {
        const code = inFlag(['@_hash_s_keys_ = [1]', '@s = "ab"', 'say(@s.length)']);
        expect(await converter.targetCodeToBlocks(target, code)).toBe(true);
        const blocks = Object.values(converter._context.blocks);
        expect(blocks.some((b) => b.opcode === 'operator_length')).toBe(true);
        expect(blocks.some((b) => b.opcode === 'data_lengthoflist')).toBe(false);
    });

    test.each([
        ['@s = "a"', 'say(@s.key?(:a))'],
        ['@a = [1]', 'say(@a.key?(:a))'],
    ])('%s: key? of a string or a list does not make the lists of a hash', async (...lines) => {
        await converter.targetCodeToBlocks(target, inFlag(lines));
        expect(Object.keys(converter._context.lists).filter((name) => name.includes('_hash_'))).toEqual([]);
    });
});

describe('Ruby Roundtrip: V2 hash literal values that are not blocks (#1654)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test.each([
        '@h = {a: {b: 1}}',
        '@h = {a: [1, 2]}',
        'h = {a: {b: 1}}',
        '$h = {a: [1]}',
        '@h = {a: nil}',
        '@h = {1 => 2}',
        '@h = {a: 1, @k => 2}',
    ])('%s is an error on its line, not a silent 0', async (line) => {
        await expect(rubyToBlocksToRuby(converter, target, inFlag(['say("x")', line]))).rejects.toThrow(/"row":2/);
    });

    test.each(['@h[:a] = {b: 1}', '@h[:a] = [1, 2]', '@h[:a] = nil'])(
        '%s is an error that says the value cannot be in a hash',
        async (line) => {
            await expect(rubyToBlocksToRuby(converter, target, inFlag(['@h = {a: 1}', line]))).rejects.toThrow(
                /cannot be a value in a hash/,
            );
        },
    );

    test.each(['@h = {a: @x}', '@h = {a: 1 + 2}', '@h = {a: :b}', '@h = {a: "x", b: 1.5}', '@h = {a: true}'])(
        '%s still round-trips',
        async (line) => {
            await expectRoundTrip(converter, target, inFlag([line]));
        },
    );
});
