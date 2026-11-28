// A line indented to a depth that matches no block (Issue #2052)
//
// In a block written with indentation only, a line that is deeper than the
// head of a block but shallower than its body (`z = 2` at 6 columns between
// a body at 4 and a body at 8) is read as a line of the inner block. The
// Ruby is still made as before, but the line is found so that the editor can
// warn on it.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { findIndentMismatchLines } from '../../../../src/lib/dncl/dncl-v2-preprocessor';

const mismatches = (lines) => findIndentMismatchLines(lines.join('\n'));

describe('DNCL indentation that matches no block (Issue #2052)', () => {
    test('a tab and full-width spaces mixed: the 6-column line is found', () => {
        const lines = ['もし a ならば:', '\tもし b ならば:', '\t\tx = 1', '　　　z = 2', 'y = 1'];
        expect(mismatches(lines)).toEqual([4]);
        // The Ruby is made as before (the line stays in the inner block).
        expect(dnclToRuby(lines.join('\n')).ruby).toBe(
            ['if @a', '  if @b', '    @x = 1', '    @z = 2', '  end', 'end', '@y = 1'].join('\n'),
        );
    });

    test('a line between the head and the body of one block is found', () => {
        expect(mismatches(['もし a ならば:', '    x = 1', '  y = 2'])).toEqual([3]);
    });

    test('indents that match a block are not found', () => {
        expect(
            mismatches([
                'i を 1 から 2 まで 1 ずつ増やしながら繰り返す:',
                '\tもし i > 1 ならば:',
                '\t\t表示する(i)',
                '　　そうでなければ:',
                '        表示する(0)',
                '    表示する(i)',
                '表示する("end")',
            ]),
        ).toEqual([]);
    });

    test('the body of そうでなければ may have its own width', () => {
        expect(mismatches(['もし a ならば:', '    x = 1', 'そうでなければ:', '  x = 2', 'y = 1'])).toEqual([]);
    });

    test('a line between the head and the body of そうでなければ is found', () => {
        expect(
            mismatches(['もし a ならば:', '    x = 1', 'そうでなければ:', '    x = 2', '  y = 3', 'z = 1']),
        ).toEqual([5]);
        expect(
            mismatches(['もし a ならば:', '    x = 1', 'そうでなくもし b ならば:', '    x = 2', '  y = 3', 'z = 1']),
        ).toEqual([5]);
    });

    test('a tab and full-width spaces mixed in a nested そうでなければ', () => {
        const lines = [
            'もし a ならば:',
            '\tもし b ならば:',
            '\t\tx = 1',
            '\tそうでなければ:',
            '\t\tx = 2',
            '　　　z = 2',
            'y = 1',
        ];
        expect(mismatches(lines)).toEqual([6]);
    });

    test('blank and comment lines are not found', () => {
        expect(mismatches(['もし a ならば:', '    x = 1', '  ', '  # c', '    y = 2'])).toEqual([]);
    });

    test('numbered lines are read by the indent after the number', () => {
        expect(mismatches(['(1) もし a ならば:', '(2)     x = 1', '(3)   y = 2', '(4) z = 3'])).toEqual([3]);
    });

    test('`｜` / `⎿` markers are not found', () => {
        expect(mismatches(['もし a ならば:', '｜ x = 1', '⎿ y = 2', 'z = 3'])).toEqual([]);
    });

    test('a program without blocks has none', () => {
        expect(mismatches(['x = 1', '  y = 2'])).toEqual([]);
    });
});
