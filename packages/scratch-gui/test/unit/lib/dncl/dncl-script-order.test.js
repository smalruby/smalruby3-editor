// Issue #2550: a round trip through the blocks keeps the order the program was written in
// (a function defined after the main program stays after it).
import dedent from 'dedent';
import { rubyInScriptOrder } from '../../../../src/lib/dncl/dncl-script-order';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

beforeAll(() => loadPrism());

describe('DNCL → blocks → DNCL keeps the order of the scripts', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    const dncl = dedent`
        表示する(合計(3))
        Data = [1, 2]
        Data に 3 を追加する
        関数 合計(n):
            s = 0
            i を 1 から n まで 1 ずつ増やしながら繰り返す:
                s = s + i
            s を返す
    `;

    // The Ruby of the Ruby tab, as the code tab gives it back (the reducer generates it).
    const rubyTabRuby = async (src = dncl) => {
        await rubyToBlocksToRuby(converter, target, dnclToRuby(src).ruby);
        return RubyGenerator.targetToCode(target, { version: '2' });
    };

    // The generated text ends with a new line, as all the text the blocks give back does.
    test('a function defined after the main program stays after it', async () => {
        const ruby = rubyInScriptOrder(target, await rubyTabRuby(), '2');
        expect(rubyToDncl(ruby).dncl).toBe(`${dncl}\n`);
    });

    test('the Ruby tab still puts the definitions first', async () => {
        expect(await rubyTabRuby()).toMatch(/^def 合計\(n\)[^]*end\n\nconsole\.puts\(合計\(3\)\)/);
    });

    test('Ruby that the blocks do not have is kept as it is', async () => {
        await rubyTabRuby();
        expect(rubyInScriptOrder(target, 'console.puts(1)\n', '2')).toBe('console.puts(1)\n');
        expect(rubyInScriptOrder(null, 'console.puts(1)\n', '2')).toBe('console.puts(1)\n');
    });

    test('a function defined first stays first', async () => {
        const first = dedent`
            関数 二倍(n):
                n * 2 を返す
            表示する(二倍(3))
        `;
        const ruby = rubyInScriptOrder(target, await rubyTabRuby(first), '2');
        expect(rubyToDncl(ruby).dncl).toBe(`${first}\n`);
    });
});
