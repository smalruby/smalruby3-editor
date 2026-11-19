/**
 * A long or deep program (an expression of thousands of terms, blocks in
 * blocks) is converted: ja-notation walks its syntax trees with a stack of its
 * own (L4 of the EPIC #1731). Ruby that prism cannot parse for its depth is
 * told, and does not stop the editor.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

const repeat = (n, f) => Array.from({ length: n }, (_, i) => f(i));

describe('long and deep programs (L4 of the EPIC #1731)', () => {
    test('an expression of 5000 terms becomes Ruby', () => {
        const { ruby, errors } = dnclToRuby(`x = ${repeat(5000, () => '1').join(' + ')}`);
        expect(errors).toEqual([]);
        expect(ruby).toBe(`@x = ${repeat(5000, () => '1').join(' + ')}`);
    });

    test('5000 parentheses in parentheses become Ruby', () => {
        expect(dnclToRuby(`x = ${'('.repeat(5000)}1${')'.repeat(5000)}`).ruby).toBe('@x = 1');
    });

    test('blocks 500 deep become Ruby', () => {
        const dncl = [...repeat(500, (i) => `${'    '.repeat(i)}もし x > 0 ならば:`), `${'    '.repeat(500)}x = 1`];
        const { ruby, errors } = dnclToRuby(dncl.join('\n'));
        expect(errors).toEqual([]);
        expect(ruby.split('\n')).toHaveLength(1001);
    });

    test('Ruby of 1000 terms becomes Japanese', () => {
        const { dncl, errors } = rubyToDncl(`@x = ${repeat(1000, () => '1').join(' + ')}`);
        expect(errors).toEqual([]);
        expect(dncl).toBe(`x = ${repeat(1000, () => '1').join(' + ')}`);
    });
});
