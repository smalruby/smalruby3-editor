// === Smalruby: This file is Smalruby-specific (list as argument roundtrip tests, issue #1567) ===
/**
 * A list variable (`@a = []`) passed as a value must survive the round trip.
 * Scratch can drop the list reporter (data_listcontents) into any input.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: list as an argument (issue #1567)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test.each([
        ['say(@a)', '@a = []\nsay(@a)'],
        ['think(@a)', '@a = []\nthink(@a)'],
        ['say($a)', '$a = []\nsay($a)'],
        ['say with list of values', '@a = ["a", "b"]\nsay(@a)'],
        ['move(@a)', '@a = []\nmove(@a)'],
        ['sleep(@a)', '@a = []\nsleep(@a)'],
        ['a local list', 'a = []\nsay(a)'],
        ['list read before the list is made', 'def f\n  say(@a)\nend\n\n@a = []\nf'],
        ['say(@a.length)', '@a = []\nsay(@a.length)'],
        ['if @a == "x"', '@a = []\nif @a == "x"\n  say("y")\nend'],
        ['@b = @a', '@a = []\n@b = @a'],
        ['$b = $a', '$a = []\n$b = $a'],
        ['repeat @a', '@a = []\n@a.times do\n  say("x")\nend'],
    ])('%s', async (_name, code) => {
        await expectRoundTrip(converter, target, code);
    });

    test('reuses the existing list and makes no scalar of the same name on a second apply', async () => {
        const code = '@a = ["x"]\nsay(@a)';
        await rubyToBlocksToRuby(converter, target, code);
        const second = makeConverter(target, runtime, { version: '2' });
        setupRubyGenerator();
        expect(await rubyToBlocksToRuby(second, target, code)).toBe(code);

        const vars = Object.values(target.variables).filter((v) => v.name === 'a');
        expect(vars.map((v) => v.type)).toEqual(['list']);
        const reads = Object.values(target.blocks._blocks).filter((b) => b.opcode === 'data_listcontents');
        expect(reads.map((b) => b.fields.LIST.id)).toEqual([vars[0].id]);
    });
});
