/**
 * Round-trip tests for regex operators (=~, !~) and regex literal variables.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Regex operators', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('=~ operator with string receiver', async () => {
        await expectRoundTrip(converter, target, dedent`
            "hello" =~ /^he/
        `);
    });

    test('=~ operator with flags', async () => {
        await expectRoundTrip(converter, target, dedent`
            "Hello" =~ /hello/i
        `);
    });

    test('=~ operator with regexp receiver', async () => {
        await expectRoundTrip(converter, target, dedent`
            /^he/ =~ "hello"
        `);
    });

    test('!~ operator with string receiver', async () => {
        await expectRoundTrip(converter, target, dedent`
            "hello" !~ /world/
        `);
    });

    test('!~ operator with regexp receiver', async () => {
        await expectRoundTrip(converter, target, dedent`
            /world/ !~ "hello"
        `);
    });

    test('regex variable assignment (global)', async () => {
        await expectRoundTrip(converter, target, dedent`
            $r = /^hello/i
        `);
    });

    test('regex variable assignment (instance)', async () => {
        await expectRoundTrip(converter, target, dedent`
            @r = /\\d+/
        `);
    });

    test('regex variable assignment (local)', async () => {
        await expectRoundTrip(converter, target, dedent`
            r = /^hello/
        `);
    });
});
