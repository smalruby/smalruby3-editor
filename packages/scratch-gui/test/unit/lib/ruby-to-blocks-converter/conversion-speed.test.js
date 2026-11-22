/**
 * How long Ruby → blocks takes for longer code (docs/ruby-editor/converter-stages.md, 「実行の効率」).
 * It only measures and prints, so it runs only with `RUBY_CONVERTER_BENCH=1`:
 *
 *     RUBY_CONVERTER_BENCH=1 npm exec jest -- test/unit/lib/ruby-to-blocks-converter/conversion-speed.test.js
 *
 * The code repeats one unit (a method with a return value, an event with a loop, `if`, `case`, a list)
 * `n` times, so the time for `n` and `4n` units shows whether the conversion grows faster than the code.
 * The same code with a comment on each line of the units, and with a statement that cannot be
 * converted at the end (the error names the statement that holds it), times the comments and the error.
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
 * @param {object} [options] - Options.
 * @param {boolean} [options.comments] - Put a comment on each line of the units.
 * @param {boolean} [options.error] - Put a statement that cannot be converted at the end.
 * @returns {string} The code.
 */
const codeOf = (n, { comments = false, error = false } = {}) => {
    let code = '@score = 0\n';
    for (let i = 0; i < n; i++) {
        const text = unit(i);
        code += comments
            ? text
                  .split('\n')
                  .map((line) => (line.trim() ? `${line} # c` : line))
                  .join('\n')
            : text;
    }
    // The conversion stops at the first error, so one at the end walks the whole code first.
    if (error) code += 'when_flag_clicked do\n  say(1.foo(2))\nend\n';
    return code;
};

/**
 * Convert the code once and return the time in ms.
 * @param {string} code - The code.
 * @returns {Promise<number>} The time.
 */
const convertOnce = async (code, { error = false } = {}) => {
    const { target, runtime } = makeSpriteTarget();
    const converter = makeConverter(target, runtime, { version: '2' });
    const start = Date.now();
    const ok = await converter.targetCodeToBlocks(target, code);
    const ms = Date.now() - start;
    if (ok === error) throw new Error(JSON.stringify(converter.errors));
    return ms;
};

const describeBench = process.env.RUBY_CONVERTER_BENCH ? describe : describe.skip;

describeBench('RubyToBlocksConverter/conversion speed', () => {
    test.each([
        ['plain', {}],
        ['with comments', { comments: true }],
        ['with an error at the end', { error: true }],
    ])(
        'prints the time for 10, 40 and 80 units (%s)',
        async (_name, options) => {
            const rows = [];
            for (const n of [10, 40, 80]) {
                const code = codeOf(n, options);
                await convertOnce(code, options); // warm up
                const times = [];
                for (let i = 0; i < 5; i++) times.push(await convertOnce(code, options));
                times.sort((a, b) => a - b);
                rows.push({ units: n, lines: code.split('\n').length, medianMs: times[2] });
            }
            // eslint-disable-next-line no-console
            console.log(JSON.stringify({ case: _name, rows }));
            expect(rows).toHaveLength(3);
        },
        300000,
    );
});
