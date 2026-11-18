// === Smalruby: This file is Smalruby-specific (a call before the def of the method, issue #2167) ===
/**
 * A call of a method written before its `def` (`myfunc(3)` and then `def myfunc(x)`) was the wrong
 * instruction: the converter knew the procedure only after it had come to the `def`. The analysis
 * collects the `def`s first (`procedures.definitions`), so the call is a call of the My Block
 * wherever the `def` is (issue #2167).
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby to blocks: a call before the def of the method (issue #2167)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    const opcodesOf = () => Object.values(converter._context.blocks).map((b) => b.opcode);

    /**
     * Convert the code with the call before the `def` and the code with the `def` first: both give
     * the same Ruby (the generator writes the scripts in the order of the blocks).
     * @param {string} callFirst - The code with the call before the `def`.
     * @param {string} defFirst - The same code with the `def` first.
     */
    const expectSameAsDefFirst = async (callFirst, defFirst) => {
        const fromCallFirst = await rubyToBlocksToRuby(converter, target, callFirst);
        expect(opcodesOf()).toContain('procedures_call');
        ({ target, runtime } = makeSpriteTarget());
        converter = makeConverter(target, runtime, { version: '2' });
        const fromDefFirst = await rubyToBlocksToRuby(converter, target, defFirst);
        const lines = (ruby) =>
            ruby
                .split('\n')
                .filter((l) => l.trim() !== '')
                .sort();
        expect(lines(fromCallFirst)).toEqual(lines(fromDefFirst));
    };

    test.each([
        ['a call as a statement', 'myfunc(3)', 'def myfunc(x)\n  return 5\nend'],
        ['a call as a value, explicit return', '@答え = たしざん(3, 4)', 'def たしざん(a, b)\n  return a + b\nend'],
        ['a call as a value, implicit return', '@a = f(3)', 'def f(x)\n  x * 2\nend'],
        ['two calls in a line', 'say(f(1) + f(2))', 'def f(x)\n  return x\nend'],
        ['a call without arguments', 'f', 'def f\n  say("hi")\nend'],
        ['a boolean argument', 'f(1 == 1)', 'def f(x)\n  if x\n    say(1)\n  end\nend'],
        ['def self.', 'f(1)', 'def self.f(x)\n  say(x)\nend'],
    ])('%s', async (_name, call, def) => {
        await expectSameAsDefFirst(`${call}\n${def}`, `${def}\n${call}`);
    });

    test('a call in a method before the def of the method it calls', async () => {
        const code = dedent`
            def a
              b(1)
            end

            def b(x)
              say(x)
            end

            a
        `;
        await rubyToBlocksToRuby(converter, target, code);
        expect(opcodesOf().filter((o) => o === 'procedures_call')).toHaveLength(2);
    });

    test('a call in a script before the def', async () => {
        const code = dedent`
            self.when(:flag_clicked) do
              f(1)
            end

            def f(x)
              say(x)
            end
        `;
        await rubyToBlocksToRuby(converter, target, code);
        expect(opcodesOf()).toContain('procedures_call');
    });

    test('a call that another block takes stays that block', async () => {
        await rubyToBlocksToRuby(converter, target, 'move(10)\ndef move(x)\n  say(x)\nend');
        expect(opcodesOf()).toContain('motion_movesteps');
        expect(opcodesOf()).not.toContain('procedures_call');
    });

    test.each([
        ['a value of a method that returns nothing', '@a = f\ndef f\n  puts(1)\nend', 1],
        ['a different number of arguments', 'f(1, 2)\ndef f(x)\n  say(x)\nend', 1],
        // The errors of the `def` come first, as when the call was not converted (issue #2167).
        ['a method defined twice', 'f(1)\ndef f(x)\n  say(x)\nend\ndef f(x)\n  say(x)\nend', 5],
        ['an optional argument', 'f(1)\ndef f(x = 1)\n  say(x)\nend', 2],
    ])('%s is an error', async (_name, code, line) => {
        expect(await converter.targetCodeToBlocks(target, code)).toBe(false);
        expect(converter.errors[0].row).toBe(line - 1);
    });

    test('a declared procedure whose def the converter never came to is the wrong instruction', async () => {
        expect(await converter.targetCodeToBlocks(target, 'f(1)\ndef f(x)\n  say(x)\nend')).toBe(true);
        const callNode = converter._context.procedures.f.callNodesBeforeDefinition[0];
        converter._context.procedures.f.declaredBeforeDefinition = true;
        expect(() => converter._rejectProceduresNotDefined()).toThrow(/f\(1\)" is the wrong instruction/);
        expect(callNode).toBeDefined();
    });
});
