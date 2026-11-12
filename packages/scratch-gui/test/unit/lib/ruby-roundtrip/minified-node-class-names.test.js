/**
 * The production build renames classes, so `node.constructor.name` of a @ruby/prism node is not
 * e.g. 'CallNode' there. These round trips run with the class names renamed the same way,
 * so that the converter must find the type of a node in another way (`_getNodeTypeName`).
 */
import * as prismNodes from '@ruby/prism/src/nodes.js';
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: with the class names renamed as in the production build', () => {
    const originalNames = new Map();
    let target, runtime, converter;

    beforeAll(() => {
        Object.values(prismNodes).forEach((klass, i) => {
            if (typeof klass === 'function') {
                originalNames.set(klass, klass.name);
                Object.defineProperty(klass, 'name', { value: `m${i}` });
            }
        });
    });

    afterAll(() => {
        originalNames.forEach((name, klass) => {
            Object.defineProperty(klass, 'name', { value: name });
        });
    });

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: 2 });
    });

    test('the class names are renamed', () => {
        expect(prismNodes.CallNode.name).not.toBe('CallNode');
    });

    test('say(bar(1) + bar(2)) keeps both calls', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def bar(a)
                  return a
                end

                def foo
                  say(bar(1) + bar(2))
                end
            `,
        );
    });

    test('return bar(1) + bar(2) keeps both calls', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def bar(a)
                  return a
                end

                def foo
                  return bar(1) + bar(2)
                end
            `,
        );
    });

    test('elsif', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                if 1 > 0
                  move(10)
                elsif 2 > 0
                  move(20)
                end
            `,
        );
    });

    test('an empty else', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                if 1 > 0
                  move(10)
                else
                end
            `,
        );
    });

    test('return fact(n - 1) * n', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def fact(n)
                  if n <= 1
                    return 1
                  end
                  return fact(n - 1) * n
                end
            `,
        );
    });
});
