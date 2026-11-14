// A call that takes a block decides how many block parameters it takes: a hat (`when_flag_clicked do`)
// and a loop (`loop do`) take none, `3.times do |i|` takes one and `@h.each do |k, v|` takes two. A block
// with other parameters (`do |k|` of a hat) has no place for them in the blocks, so it is the wrong
// instruction on the line of the call (P17). The parameters of the hats of Makey Makey and the block of a
// call of a My Block were dropped without an error (issue #1909).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

describe('RubyToBlocksConverter/the number of block parameters', () => {
    test.each([
        ['when_key_pressed("a") do |k|', 'when_key_pressed("a") do |k|...'],
        ['when_flag_clicked do |k|', 'when_flag_clicked do |k|...'],
        ['when_clicked do |a, b|', 'when_clicked do |a, b|...'],
        ['when_receive("m") do |k|', 'when_receive("m") do |k|...'],
        ['when_backdrop_switches("b") do |k|', 'when_backdrop_switches("b") do |k|...'],
        ['when_greater_than("timer", 10) do |k|', 'when_greater_than("timer", 10) do |k|...'],
        ['when_start_as_a_clone do |k|', 'when_start_as_a_clone do |k|...'],
        ['self.when(:flag_clicked) do |k|', 'self.when(:flag_clicked) do |k|...'],
        ['loop do |x|', 'loop do |x|...'],
        ['repeat(3) do |x|', 'repeat(3) do |x|...'],
        ['with_screen_refresh do |x|', 'with_screen_refresh do |x|...'],
        ['loop.with_screen_refresh do |x|', 'loop.with_screen_refresh do |x|...'],
        ['3.times do |i, j|', '3.times do |i, j|...'],
        ['@a.each do |x, y|', '@a.each do |x, y|...'],
        ['@h.each do |k, v, w|', '@h.each do |k, v, w|...'],
        ['makey.when_key_pressed("SPACE") do |x|', 'makey.when_key_pressed("SPACE") do |x|.....'],
        ['makey.when_key_pressed("SPACE") do |x, y|', 'makey.when_key_pressed("SPACE") do |x, y...'],
        ['makey.when_pressed_in_oder("LEFT UP RIGHT") do |x|', 'makey.when_pressed_in_oder("LEFT UP RIGH...'],
        // Told as the wrong instruction, not as a symbol that needs `.to_s`: the parameter is what is wrong.
        ['self.when(:key_pressed, "a") do |x|', 'self.when(:key_pressed, "a") do |x|...'],
        ['self.when(:makey_key_pressed, "SPACE") do |x|', 'self.when(:makey_key_pressed, "SPACE") d...'],
        ['self.when(:makey_pressed_in_oder, "LEFT") do |x|', 'self.when(:makey_pressed_in_oder, "LEFT"...'],
        ['define_method(:foo) do |a|', 'define_method(:foo) do |a|...'],
        ['mesh.when_receive(:a) do |x|', 'mesh.when_receive(:a) do |x|...'],
    ])('%s is the wrong instruction', async (line, source) => {
        const { ok, errors } = await convert(`@a = [1]\n@h = {a: 1}\n${line}\n  say(1)\nend`);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(2);
        expect(errors[0].text).toContain(wrongInstruction(source));
    });

    // A call of a My Block has no place for a block: its body was dropped without an error.
    test.each([
        ['foo(1) do |x|\n  say(x)\nend', 'foo(1) do |x|...'],
        ['foo(1) do\n  say(2)\nend', 'foo(1) do...'],
        ['foo(1) { say(2) }', 'foo(1) { say(2) }'],
        ['foo(1, &blk)', 'foo(1, &blk)'],
        ['foo(1, &:x)', 'foo(1, &:x)'],
    ])('%s of a My Block is the wrong instruction', async (call, source) => {
        const { ok, errors } = await convert(`def foo(a)\n  say(a)\nend\n${call}`);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(3);
        expect(errors[0].text).toContain(wrongInstruction(source));
    });

    // The arguments of a lambda and of `define_method` are told on their line, like those of a My Block.
    test.each([
        ['f = ->(a = 1) { say(a) }', 0, 'f = ->(a = 1) { say(a) }'],
        ['f = ->(a,\n      b = 1) { say(a) }', 1, 'b = 1) { say(a) }'],
        ['define_method(:foo) do |a = 1|\n  say(a)\nend', 0, 'define_method(:foo) do |a = 1|'],
    ])('%s is the wrong instruction', async (code, row, source) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(row);
        expect(errors[0].text).toContain(wrongInstruction(source));
    });

    // `each` of a hash takes the key and the value (`do |k, v|`). With no block parameter or with one, it
    // was taken as `each` of an empty list named after the hash: nothing ran, and in Ruby `|k|` is given the
    // pair `[key, value]` (issue #1911). A hash set in this code or a hash of the project, of any scope.
    test.each([
        ['@h = {a: 1}\n@h.each do |k|\n  say(k)\nend', 1, '@h.each do |k|...'],
        ['@h = {a: 1}\n@h.each do\n  say(1)\nend', 1, '@h.each do...'],
        ['@h = {a: 1}\n@h.each { |k| say(k) }', 1, '@h.each { |k| say(k) }'],
        ['@h = {a: 1}\n@h.each { say(1) }', 1, '@h.each { say(1) }'],
        ['@h = {a: 1}\n@h.each(&:x)', 1, '@h.each(&:x)'],
        ['$h = {a: 1}\n$h.each do |k|\n  say(k)\nend', 1, '$h.each do |k|...'],
        ['$h = {a: 1}\n$h.each do\n  say(1)\nend', 1, '$h.each do...'],
        ['h = {a: 1}\nh.each do |k|\n  say(k)\nend', 1, 'h.each do |k|...'],
        ['h = {a: 1}\nh.each do\n  say(1)\nend', 1, 'h.each do...'],
        ['@h = {a: 1}\nwhen_flag_clicked do\n  @h.each do |k|\n    say(k)\n  end\nend', 2, '@h.each do |k|...'],
        ['@h = {a: 1}\n@h.each_pair do |k, v|\n  say(k)\nend', 1, '@h.each_pair do |k, v|...'],
        ['@h = {a: 1}\n@h.each_pair do |k|\n  say(k)\nend', 1, '@h.each_pair do |k|...'],
        ['@h = {a: 1}\n@h.each_with_index do |k, i|\n  say(k)\nend', 1, '@h.each_with_index do |k, i|...'],
        ['@h = {a: 1}\n@h.each_key do |k|\n  say(k)\nend', 1, '@h.each_key do |k|...'],
        ['@h = {a: 1}\n@h.map do |k, v|\n  say(k)\nend', 1, '@h.map do |k, v|...'],
    ])('%s of a hash is the wrong instruction', async (code, row, source) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(row);
        expect(errors[0].text).toContain(wrongInstruction(source));
    });

    // The numbers of block parameters the calls take stay as they are.
    test.each([
        ['when_key_pressed("a") do\n  say(1)\nend'],
        ['when_flag_clicked do\n  say(1)\nend'],
        ['self.when(:flag_clicked) do\n  say(1)\nend'],
        ['loop do\n  say(1)\nend'],
        ['3.times do\n  say(1)\nend'],
        ['3.times do |i|\n  say(i)\nend'],
        ['@a = [1]\n@a.each do |x|\n  say(x)\nend'],
        ['@h = {a: 1}\n@h.each do |k, v|\n  say(k)\nend'],
        ['$h = {a: 1}\n$h.each do |k, v|\n  say(v)\nend'],
        ['h = {a: 1}\nh.each do |k, v|\n  say(v)\nend'],
        ['@h = {a: 1}\n@h.keys.each do |k|\n  say(k)\nend'],
        ['@a = [1]\n@a.each do\n  say(1)\nend'],
        ['@a = [1]\n@a.each { |x| say(x) }'],
        ['makey.when_key_pressed("SPACE") do\n  say(1)\nend'],
        ['makey.when_pressed_in_oder("LEFT UP RIGHT") do\n  say(1)\nend'],
        ['self.when(:makey_key_pressed, "SPACE") do\n  say(1)\nend'],
        ['self.when(:makey_pressed_in_oder, "LEFT UP RIGHT") do\n  say(1)\nend'],
        ['def foo(a)\n  say(a)\nend\nfoo(1)'],
    ])('%s is converted', async (code) => {
        const { ok, errors } = await convert(code);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });
});
