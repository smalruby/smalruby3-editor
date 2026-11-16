/**
 * How long Ruby → blocks takes for longer code (docs/ruby-editor/converter-stages.md, 「実行の効率」).
 * It only measures and prints, so it runs only with `RUBY_CONVERTER_BENCH=1`:
 *
 *     RUBY_CONVERTER_BENCH=1 npm exec jest -- test/unit/lib/ruby-to-blocks-converter/conversion-speed.test.js
 *
 * The code repeats one unit (a method with a return value, an event with a loop, `if`, `case`, a list)
 * `n` times, so the time for `n` and `4n` units shows whether the conversion grows faster than the code.
 */
import { makeConverter, makeSpriteTarget } from '../../helpers/ruby-roundtrip-helper';

const unit = (i) => `
def foo${i}(a)
  @score += a
  return a * 2
end

when_flag_clicked do
  @list${i} = [1, 2, 3]
  10.times do
    move(10)
    turn_right(15)
    if @score > ${i}
      say(@score)
    else
      self.x += 3
      @score = foo${i}(3)
    end
  end
  case @score
  when 1
    say(foo${i}(1))
  end
  @list${i}.push(@score)
end
`;

/**
 * Ruby code of `n` units.
 * @param {number} n - The number of units.
 * @returns {string} The code.
 */
const codeOf = (n) => {
    let code = '@score = 0\n';
    for (let i = 0; i < n; i++) code += unit(i);
    return code;
};

/**
 * Convert the code once and return the time in ms.
 * @param {string} code - The code.
 * @returns {Promise<number>} The time.
 */
const convertOnce = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    const converter = makeConverter(target, runtime, { version: '2' });
    const start = Date.now();
    const ok = await converter.targetCodeToBlocks(target, code);
    const ms = Date.now() - start;
    if (!ok) throw new Error(JSON.stringify(converter.errors));
    return ms;
};

const describeBench = process.env.RUBY_CONVERTER_BENCH ? describe : describe.skip;

describeBench('RubyToBlocksConverter/conversion speed', () => {
    test('prints the time for 10, 40 and 80 units', async () => {
        const rows = [];
        for (const n of [10, 40, 80]) {
            const code = codeOf(n);
            await convertOnce(code); // warm up
            const times = [];
            for (let i = 0; i < 5; i++) times.push(await convertOnce(code));
            times.sort((a, b) => a - b);
            rows.push({ units: n, lines: code.split('\n').length, medianMs: times[2] });
        }
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(rows));
        expect(rows).toHaveLength(3);
    }, 300000);
});
