// === Smalruby: This file is Smalruby-specific (a local variable read stays a local after saving) ===
/**
 * A saved project keeps a variable read inside an input as a primitive, so the read loses its
 * `@ruby:lvar:<name>:<N>` comment when the project is opened again. The read must still be written
 * as the local variable, not as `@_<name>_<N>_` (#2592).
 */
import { loadPrism } from '../../../../src/lib/prism-parser';
import { saveAndOpenRuby } from '../../helpers/save-and-open-project';

beforeAll(() => loadPrism());

describe('a local variable read stays a local after saving the project (#2592)', () => {
    test('at the top level', async () => {
        const ruby = await saveAndOpenRuby(['b = 1', 'move(b)'].join('\n'));
        expect(ruby).toContain('b = 1');
        expect(ruby).toContain('move(b)');
        expect(ruby).not.toContain('_b_');
    });

    test('inside an expression', async () => {
        const ruby = await saveAndOpenRuby(['b = 1', 'move(b + 2)', 'say(b * b)'].join('\n'));
        expect(ruby).toContain('move(b + 2)');
        expect(ruby).toContain('say(b * b)');
        expect(ruby).not.toContain('_b_');
    });

    test('inside a method', async () => {
        const source = ['def go(n)', '  c = n + 1', '  move(c)', 'end', 'go(3)'].join('\n');
        const ruby = await saveAndOpenRuby(source);
        expect(ruby).toContain('c = n + 1');
        expect(ruby).toContain('move(c)');
        expect(ruby).not.toContain('_c_');
    });

    test('inside a block', async () => {
        const source = ['when_flag_clicked do', '  d = 10', '  move(d)', 'end'].join('\n');
        const ruby = await saveAndOpenRuby(source);
        expect(ruby).toContain('d = 10');
        expect(ruby).toContain('move(d)');
        expect(ruby).not.toContain('_d_');
    });

    test('on the stage', async () => {
        const ruby = await saveAndOpenRuby(['b = 1', 'sleep(b)'].join('\n'), { onStage: true });
        expect(ruby).toContain('sleep(b)');
        expect(ruby).not.toContain('_b_');
    });

    test('an array', async () => {
        const source = ['a = [3, 1]', 'say(a)', 'say(a.sort)', 'a.each do |x|', '  move(x)', 'end'].join('\n');
        const ruby = await saveAndOpenRuby(source);
        expect(ruby).toContain('say(a)');
        expect(ruby).toContain('say(a.sort)');
        expect(ruby).toContain('a.each do |x|');
        expect(ruby).not.toContain('_a_');
    });

    test('a hash', async () => {
        const ruby = await saveAndOpenRuby(['h = {a: 1}', 'say(h.keys)', 'say(h.values)'].join('\n'));
        expect(ruby).toContain('say(h.keys)');
        expect(ruby).toContain('say(h.values)');
        expect(ruby).not.toContain('_hash_');
    });

    test('a list made in the blocks named like a local stays an instance variable', async () => {
        const ruby = await saveAndOpenRuby(['@_e_1_ = [3, 1]', 'say(@_e_1_.sort)'].join('\n'));
        expect(ruby).toContain('say(@_e_1_.sort)');
    });

    test('a variable made in the blocks named like a local stays an instance variable', async () => {
        const ruby = await saveAndOpenRuby(['@_e_1_ = 1', 'move(@_e_1_)'].join('\n'));
        expect(ruby).toContain('move(@_e_1_)');
    });
});
