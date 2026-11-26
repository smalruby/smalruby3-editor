// === Smalruby: This file is Smalruby-specific (the integers of prism read again from the source) ===
/**
 * `@ruby/prism` reads 2^31 and more as a signed 32-bit number, so `move(3000000000)` came back as
 * `move(-1294967296)` (issue #2048). The integers are read again from the source.
 */
import { integerValueOfText } from '../../../src/lib/prism-integer-values';
import { loadPrism } from '../../../src/lib/prism-parser';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../helpers/ruby-roundtrip-helper';

const integerValues = async (code) => {
    const prism = await loadPrism();
    const values = [];
    const walk = (node) => {
        if (!node || typeof node.childNodes !== 'function') return;
        if (node.constructor.name === 'IntegerNode') values.push(node.value);
        node.childNodes().forEach(walk);
    };
    walk(prism.parse(code).value);
    return values;
};

describe('integerValueOfText', () => {
    test.each([
        ['2147483647', 2147483647],
        ['2147483648', 2147483648],
        ['-2147483648', -2147483648],
        ['3_000_000_000', 3000000000],
        ['0x80000000', 2147483648],
        ['0b10000000000000000000000000000000', 2147483648],
        ['0o20000000000', 2147483648],
        ['020000000000', 2147483648],
        ['0d2147483648', 2147483648],
        ['+10', 10],
        ['0', 0],
        ['9007199254740993', 9007199254740992],
    ])('%s is %d', (text, value) => {
        expect(integerValueOfText(text)).toBe(value);
    });

    test.each(['1.5', '3r', '2i', 'abc', '0x'])('%s is not an integer literal', (text) => {
        expect(integerValueOfText(text)).toBeNull();
    });
});

describe('prism parse', () => {
    test('reads 2^31 and more right', async () => {
        expect(
            await integerValues('move(2147483647)\nmove(2147483648)\nmove(-2147483648)\nmove(3000000000)'),
        ).toEqual([2147483647, 2147483648, -2147483648, 3000000000]);
    });

    test('reads the integers after multibyte characters right', async () => {
        expect(await integerValues('say("こんにちは")\nmove(4294967297)')).toEqual([4294967297]);
    });

    test('keeps the small integers', async () => {
        expect(await integerValues('move(10)\nmove(-5)\nmove(0x10)')).toEqual([10, -5, 16]);
    });
});

describe('Ruby -> blocks -> Ruby', () => {
    const roundTrip = async (code) => {
        const { target, runtime } = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, { version: '2' });
        return rubyToBlocksToRuby(converter, target, code);
    };

    test.each(['move(2147483647)', 'move(2147483648)', 'move(3000000000)', 'move(-2147483648)'])(
        '%s comes back as it is',
        async (code) => {
            expect((await roundTrip(code)).trim()).toBe(code);
        },
    );

    test('rand(1..2147483648) keeps the upper end', async () => {
        expect((await roundTrip('say(rand(1..2147483648))')).trim()).toBe('say(rand(1..2147483648))');
    });
});
