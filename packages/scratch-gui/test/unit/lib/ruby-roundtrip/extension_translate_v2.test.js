/**
 * Unit test for v2 translate extension: translate.call / translate.language.
 * Related issue: #363
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Translate v2 API', () => {
    let target, runtime;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
    });

    test('translate.call and translate.language (v2)', async () => {
        const converter2 = makeConverter(target, runtime, {version: 2});
        await expectRoundTrip(converter2, target, dedent`
            translate.call("hello", "ja")

            translate.language
        `, null, {version: 2});
    });

    test('v1 backward compat: translate() and language', async () => {
        const converter1 = makeConverter(target, runtime);
        await expectRoundTrip(converter1, target, dedent`
            translate("hello", "ja")

            language
        `);
    });
});
