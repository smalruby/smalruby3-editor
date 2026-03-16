// === Smalruby: This file is Smalruby-specific (v2 hash syntax roundtrip tests) ===
/**
 * V2 hash syntax roundtrip tests.
 * Verifies that Ruby → Blocks → Ruby produces correct output
 * for hash operations using dual-list (keys + values) storage.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: V2 hash syntax', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, {version: '2'});
    });

    test('global hash literal with symbol keys', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = {name: "Alice", age: 30}
        `);
    });

    test('instance hash literal with symbol key', async () => {
        await expectRoundTrip(converter, target, dedent`
            @a = {x: 1}
        `);
    });

    test('empty hash literal', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = {}
        `);
    });

    test('hash literal with string keys', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = {"foo" => "bar"}
        `);
    });

    test('hash literal with hash rocket symbol key normalizes to shorthand', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = {:name => "Alice"}
        `, dedent`
            $a = {name: "Alice"}
        `);
    });

    test('mixed symbol and string keys', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = {name: "Alice", "age" => 30}
        `);
    });

    test('hash read with symbol key', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = {name: "Alice"}
            say($a[:name])
        `);
    });

    test('hash read with string key', async () => {
        await expectRoundTrip(converter, target, dedent`
            $a = {"foo" => "bar"}
            say($a["foo"])
        `);
    });
});
