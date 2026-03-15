// === Smalruby: This file is Smalruby-specific (v2 array syntax roundtrip tests) ===
/**
 * V2 array syntax roundtrip tests.
 * Verifies that Ruby → Blocks → Ruby produces correct output
 * for array operations using the operator_add(index, 1) pattern.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: V2 array syntax', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, {version: '2'});
    });

    test('global array literal and indexing', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a", "b"]
            say($a[0])
        `);
    });

    test('instance array literal and indexing', async () => {
        await expectRoundTrip(converter, target, dedent`
            @a = ["a", "b"]
            say(@a[0])
        `);
    });

    test('array indexing with literal index', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["x", "y", "z"]
            say($a[2])
        `);
    });

    test('array indexing with variable index', async () => {
        await expectRoundTrip(converter, target, dedent`
            @a = ["a", "b"]
            @b = 1
            say(@a[@b])
        `);
    });

    test('array delete_at with literal index', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a", "b", "c"]
            $a.delete_at(0)
        `);
    });

    test('array insert with literal index', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a", "b"]
            $a.insert(0, "x")
        `);
    });

    test('array replace with literal index', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a", "b"]
            $a[0] = "x"
        `);
    });

    test('array push', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a"]
            $a.push("b")
        `);
    });

    test('array push with << operator', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a"]
            $a << "b"
        `, dedent`
            $a = ["a"]
            $a.push("b")
        `);
    });

    test('array clear', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a", "b"]
            $a.clear
        `);
    });

    test('array index method', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a", "b"]

            $a.index("b")
        `, dedent`
            $a = ["a", "b"]

            ($a.index("b"))
        `);
    });

    test('array length', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a", "b"]

            $a.length
        `);
    });

    test('array include?', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = ["a", "b"]

            $a.include?("a")
        `);
    });

    test('empty array literal', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = []
        `);
    });

    test('mixed array operations', async () => {
        await expectRoundTrip(converter, target, dedent`
            @a = ["a", "b"]
            say(@a[0])
            @b = 1
            say(@a[@b])
        `);
    });
});
