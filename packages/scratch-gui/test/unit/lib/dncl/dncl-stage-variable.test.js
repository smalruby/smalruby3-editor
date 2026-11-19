/**
 * The Japanese mode has no stage (Issue #1706): it is written for a program
 * that runs alone, as on a terminal. Ruby → Japanese does not write a variable
 * or a list of the stage (`$a`) and tells it where it is, so the student is
 * not given Japanese that cannot be turned back into Ruby.
 */
import { STAGE_VARIABLE_ERROR_ID } from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

const lines = (...ls) => ls.join('\n');

const told = (line, column, name) => ({
    line,
    column,
    id: STAGE_VARIABLE_ERROR_ID,
    name,
    message: `ステージの変数（${name}）は日本語モードでは書けません。Ruby モードでは書けます。`,
});

describe('Ruby → DNCL: the variables of the stage (issue #1706)', () => {
    test('a variable of the stage is told where it is written and read', () => {
        expect(rubyToDncl(lines('$a = 1', 'say($a)')).errors).toEqual([told(1, 1, '$a'), told(2, 5, '$a')]);
    });

    test('a list of the stage is told, not the command it calls', () => {
        expect(rubyToDncl(lines('$a = []', '$a.push(1)')).errors).toEqual([told(1, 1, '$a'), told(2, 1, '$a')]);
    });

    test('a variable of the stage changed by an operator is told at its name', () => {
        expect(rubyToDncl('$score += 1').errors).toEqual([told(1, 1, '$score')]);
    });

    test('a variable of the sprite is still written in the Japanese', () => {
        expect(rubyToDncl(lines('@a = 1', 'say(@a)'))).toEqual({ dncl: lines('a = 1', '表示する(a)'), errors: [] });
    });
});
