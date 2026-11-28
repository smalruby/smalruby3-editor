/**
 * The counter of `n.times` in the Japanese (`i`, `j`, ...) does not take the name
 * of a variable or a list the sprite or the stage has, even when the scripts do
 * not use it: the Japanese turned back into Ruby would make a variable of the
 * sprite with the name of one of the stage, or overwrite one (Issue #2574).
 */
import { reservedNamesOf, rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

const variables = (...list) =>
    Object.fromEntries(list.map(([name, type = ''], index) => [`id-${name}-${index}`, { name, type }]));

const stage = { isStage: true, variables: variables(['i'], ['Data', 'list'], ['hello', 'broadcast_msg']) };
const runtime = { getTargetForStage: () => stage };
const sprite = { isStage: false, runtime, variables: variables(['j'], ['k', 'list']) };

const loop = (counter) => `${counter} を 1 から 3 まで 1 ずつ増やしながら繰り返す:\n    表示する(1)`;
const ruby = '3.times do\n  console.puts(1)\nend';

describe('the counter of n.times and the variables of the sprite and the stage (issue #2574)', () => {
    test('without a target the counter is i', () => {
        expect(rubyToDncl(ruby).dncl).toBe(loop('i'));
    });

    test('the counter does not take a name of a variable or a list of the sprite or the stage', () => {
        expect(rubyToDncl(ruby, sprite).dncl).toBe(loop('i2'));
    });

    test('the names are of the variables and the lists of the sprite and the stage, not of the messages', () => {
        expect([...reservedNamesOf(sprite)].sort()).toEqual(['Data', 'i', 'j', 'k']);
    });

    test('the stage has its own names only', () => {
        const stageWithRuntime = { ...stage, runtime: { getTargetForStage: () => stageWithRuntime } };
        expect([...reservedNamesOf(stageWithRuntime)].sort()).toEqual(['Data', 'i']);
        expect(rubyToDncl(ruby, stageWithRuntime).dncl).toBe(loop('j'));
    });

    test('on the stage the counter does not take a name of a variable or a list of a sprite', () => {
        const other = { isStage: false, variables: variables(['j'], ['k', 'list']) };
        const stageRuntime = { getTargetForStage: () => stageWithSprites, targets: [] };
        const stageWithSprites = { ...stage, runtime: stageRuntime };
        stageRuntime.targets.push(stageWithSprites, other);
        expect([...reservedNamesOf(stageWithSprites)].sort()).toEqual(['Data', 'i', 'j', 'k']);
        expect(rubyToDncl(ruby, stageWithSprites).dncl).toBe(loop('i2'));
    });

    test('a target with no runtime gives its own names', () => {
        expect([...reservedNamesOf({ variables: variables(['i']) })]).toEqual(['i']);
        expect([...reservedNamesOf(null)]).toEqual([]);
    });
});
