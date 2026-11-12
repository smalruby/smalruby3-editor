// Issue #1668: DNCL has one way to write a loop with nothing in it
// (`条件 でない の間` / `を繰り返す`), so an empty "repeat until" and a
// "wait until" become the same DNCL. The decision is that it goes back to
// "wait until": both wait doing nothing until the condition holds, and DNCL
// gets no form that the 共通テスト用プログラム表記 does not have.
import dedent from 'dedent';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const toRuby = (dncl) => dnclToRuby(dncl).ruby;
const toDncl = (ruby) => rubyToDncl(ruby).dncl;

describe('DNCL empty loops become "wait until"', () => {
    // Ruby → blocks → Ruby with a fresh converter, so the opcodes are only from this code
    const toBlocks = async (ruby) => {
        const { target, runtime } = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime);
        const ruby2 = await rubyToBlocksToRuby(converter, target, ruby);
        const opcodes = Object.values(converter._context.blocks).map((b) => b.opcode);
        return { ruby2, opcodes };
    };

    test('an empty 「〜でない の間」 becomes "wait until"', async () => {
        const dncl = dedent`
            a = 0
            a > 10 でない の間
            を繰り返す
        `;
        const { ruby2, opcodes } = await toBlocks(toRuby(dncl));
        expect(opcodes).toContain('control_wait_until');
        expect(opcodes).not.toContain('control_repeat_until');
        expect(ruby2).toContain('wait until @a > 10');
        // and it shows the same DNCL again
        expect(toDncl(ruby2)).toBe(dncl);
    });

    test('an empty 「〜の間」 becomes "wait until" of the negated condition', async () => {
        const dncl = dedent`
            a = 0
            a > 10 の間
            を繰り返す
        `;
        const { opcodes } = await toBlocks(toRuby(dncl));
        expect(opcodes).toContain('control_wait_until');
        expect(opcodes).toContain('operator_not');
        expect(opcodes).not.toContain('control_repeat_until');
    });

    test('an empty "repeat until" becomes "wait until" through DNCL', async () => {
        // the "repeat until" block writes `until x do` / `end` when it is empty (#1655)
        const first = await toBlocks('@a = 0\nuntil @a > 10 do\nend');
        expect(first.opcodes).toContain('control_repeat_until');
        expect(first.ruby2).toContain('until @a > 10 do');

        const dncl = toDncl(first.ruby2);
        expect(dncl).toBe('a = 0\na > 10 でない の間\nを繰り返す');

        const second = await toBlocks(toRuby(dncl));
        expect(second.opcodes).toContain('control_wait_until');
        expect(second.opcodes).not.toContain('control_repeat_until');
        expect(second.ruby2).toContain('wait until @a > 10');
    });

    test('"wait until" stays "wait until" through DNCL', async () => {
        const first = await toBlocks('@a = 0\nwait until @a > 10');
        expect(first.opcodes).toContain('control_wait_until');

        const second = await toBlocks(toRuby(toDncl(first.ruby2)));
        expect(second.opcodes).toContain('control_wait_until');
        expect(second.opcodes).not.toContain('control_repeat_until');
        expect(second.ruby2).toBe(first.ruby2);
    });

    test('a "repeat until" with a body stays "repeat until" through DNCL', async () => {
        const first = await toBlocks('@a = 0\nuntil @a > 10\n  @a += 1\nend');
        expect(first.opcodes).toContain('control_repeat_until');

        const second = await toBlocks(toRuby(toDncl(first.ruby2)));
        expect(second.opcodes).toContain('control_repeat_until');
        expect(second.opcodes).not.toContain('control_wait_until');
        expect(second.ruby2).toBe(first.ruby2);
    });

    test('a 「〜の間」 with a body stays a loop', async () => {
        const dncl = dedent`
            a = 0
            a < 10 の間
              a = a + 1
            を繰り返す
        `;
        const { opcodes } = await toBlocks(toRuby(dncl));
        expect(opcodes).not.toContain('control_wait_until');
        expect(opcodes).toContain('control_repeat_until');
    });
});
