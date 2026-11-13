// === Smalruby: This file is Smalruby-specific (two return values in one statement, issue #1725) ===
/**
 * A statement that uses the return values of two method calls (`say(("ab" * 3).length + "cd".reverse.length)`)
 * used to read both from the "return value" reporter, which gives the value of the call that ran last: the
 * blocks gave another value, and the Ruby made from them kept `_rv_`. Each of those calls now saves its
 * return value in an instance variable of its own (`@_ret1`, `@_ret2`), and the statement reads them.
 * A return value used once, just after its call, stays as it was.
 */
import VM from '@smalruby/scratch-vm';
import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import { targetCodeToBlocks } from '../../../../src/lib/ruby-to-blocks-converter';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
    rubyToBlocksToRuby,
    blockTrees,
} from '../../helpers/ruby-roundtrip-helper';

// jsdom has no performance.mark / measure (scratch-vm calls them when it loads)
if (typeof performance.mark !== 'function') performance.mark = () => {};
if (typeof performance.measure !== 'function') performance.measure = () => {};

describe('Ruby Roundtrip: two return values in one statement (#1725)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test.each([
        [
            'the example of the issue',
            'say(("ab" * 3).length + "cd".reverse.length)',
            dedent`
                @_ret1 = "ab" * 3
                @_ret2 = "cd".reverse
                say(@_ret1.length + @_ret2.length)
            `,
        ],
        [
            'two methods joined',
            'say("ab".reverse + "cd".reverse)',
            dedent`
                @_ret1 = "ab".reverse
                @_ret2 = "cd".reverse
                say(@_ret1 + @_ret2)
            `,
        ],
        [
            'a chain and another method',
            'say(("ab" * 3).length + "cd".reverse.upcase.length)',
            dedent`
                @_ret1 = "ab" * 3
                @_ret2 = "cd".reverse.upcase
                say(@_ret1.length + @_ret2.length)
            `,
        ],
        [
            'an assignment in an event',
            dedent`
                when_flag_clicked do
                  @x = "ab".reverse + "cd".upcase
                end
            `,
            dedent`
                self.when(:flag_clicked) do
                  @_ret1 = "ab".reverse
                  @_ret2 = "cd".upcase
                  @x = @_ret1 + @_ret2
                end
            `,
        ],
        [
            'the condition of an if',
            dedent`
                if "ab".reverse == "cd".reverse
                  move(10)
                end
            `,
            dedent`
                @_ret1 = "ab".reverse
                @_ret2 = "cd".reverse
                if @_ret1 == @_ret2
                  move(10)
                end
            `,
        ],
        [
            'the condition of a while',
            dedent`
                while "ab".reverse == "cd".reverse
                  move(10)
                end
            `,
            dedent`
                @_ret1 = "ab".reverse
                @_ret2 = "cd".reverse
                while @_ret1 == @_ret2
                  move(10)
                end
            `,
        ],
        [
            'the condition of an until',
            dedent`
                until "ab".reverse == "cd".reverse
                  move(10)
                end
            `,
            dedent`
                @_ret1 = "ab".reverse
                @_ret2 = "cd".reverse
                until @_ret1 == @_ret2
                  move(10)
                end
            `,
        ],
        [
            'the last line of a method',
            dedent`
                def self.f
                  "ab".reverse + "cd".reverse
                end
            `,
            dedent`
                def self.f
                  @_ret1 = "ab".reverse
                  @_ret2 = "cd".reverse
                  @_ret1 + @_ret2
                end
            `,
        ],
        [
            'the condition of an elsif',
            dedent`
                if @a == 1
                  move(1)
                elsif "ab".reverse == "cd".reverse
                  move(2)
                end
            `,
            dedent`
                if @a == 1
                  move(1)
                else
                  @_ret1 = "ab".reverse
                  @_ret2 = "cd".reverse
                  if @_ret1 == @_ret2
                    move(2)
                  end
                end
            `,
        ],
        [
            // foo saves its values in @_ret1 and @_ret2 while the statement still has to read its own.
            'a method of the program called after a saved value',
            dedent`
                def self.foo
                  say("x".reverse + "y".reverse)
                  return 1
                end
                say(("ab" * 3).length + "cd".reverse.length + foo)
            `,
            dedent`
                def self.foo
                  @_ret1 = "x".reverse
                  @_ret2 = "y".reverse
                  say(@_ret1 + @_ret2)
                  return 1
                end

                @_ret3 = "ab" * 3
                @_ret4 = "cd".reverse
                say(@_ret3.length + @_ret4.length + foo)
            `,
        ],
        [
            'a method of the program called in the condition of a while',
            dedent`
                def self.foo
                  return 1
                end
                while "ab".reverse.length + foo < "cd".reverse.length
                  say("x".reverse + "y".reverse)
                end
            `,
            dedent`
                def self.foo
                  return 1
                end

                @_ret3 = "ab".reverse
                @_ret4 = "cd".reverse
                while @_ret3.length + foo < @_ret4.length
                  @_ret1 = "x".reverse
                  @_ret2 = "y".reverse
                  say(@_ret1 + @_ret2)
                end
            `,
        ],
        [
            'a name the code already uses is skipped',
            dedent`
                @_ret1 = 5
                say("ab".reverse + "cd".reverse)
            `,
            dedent`
                @_ret1 = 5
                @_ret2 = "ab".reverse
                @_ret3 = "cd".reverse
                say(@_ret2 + @_ret3)
            `,
        ],
    ])('%s', async (_name, code, expected) => {
        await expectRoundTrip(converter, target, code, expected);
        expect(expected).not.toContain('_rv_');
    });

    test.each([
        'say("ab".reverse)',
        'say("ab".reverse.upcase)',
        'say(("ab" * 3).length)',
        dedent`
            if "hello".reverse
              move(10)
            end
        `,
    ])('a return value used once stays: %s', async (code) => {
        await expectRoundTrip(converter, target, code);
    });

    test('a call of the method itself after a saved value is an error', async () => {
        // The call would run the statement again and overwrite `@_ret1` before the statement reads it.
        const code = dedent`
            def self.f(n)
              return "ab".reverse.length + f(n - 1)
            end
        `;
        expect(await converter.targetCodeToBlocks(target, code)).toBe(false);
        expect(converter.errors).toHaveLength(1);
        expect(converter.errors[0].text).toContain('calls "f" in "f" after another method call');
    });

    test('a line with two return values takes only the method just before it', () => {
        // Blocks made on the screen: both reporters give the value of "cd".reverse, so the Ruby must not
        // read as `"cd".reverse + "ab".reverse`.
        RubyGenerator.requires_ = {};
        RubyGenerator.prepares_ = {};
        const code = RubyGenerator.finishTargets('"ab".reverse\n"cd".reverse\nsay(_rv_ + _rv_)\n', {});
        expect(code).toBe('"ab".reverse\nsay("cd".reverse + _rv_)\n');
    });

    test('the Ruby made from the blocks gives the same blocks', async () => {
        const code = 'say(("ab" * 3).length + "cd".reverse.length)';
        const ruby = await rubyToBlocksToRuby(converter, target, code);
        const first = blockTrees(target);

        const again = makeSpriteTarget();
        const converter2 = makeConverter(again.target, again.runtime);
        expect(await rubyToBlocksToRuby(converter2, again.target, ruby)).toBe(ruby);
        expect(blockTrees(again.target)).toEqual(first);
    });
});

const costume = {
    name: 'costume1',
    assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
    md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
    dataFormat: 'svg',
    rotationCenterX: 0,
    rotationCenterY: 0,
};
const targetJson = (isStage, name) => ({
    isStage,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    costumes: [costume],
    sounds: [],
    currentCostume: 0,
    volume: 100,
    layerOrder: isStage ? 0 : 1,
    ...(isStage
        ? {}
        : { visible: true, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around' }),
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Two return values in one statement when the blocks run (#1725)', () => {
    let vm;

    afterEach(() => {
        vm.stopAll();
        vm.runtime.quit();
    });

    test('each call gives its own value', async () => {
        vm = new VM();
        await vm.loadProject({
            targets: [targetJson(true, 'Stage'), targetJson(false, 'Sprite1')],
            monitors: [],
            extensions: [],
            meta: { semver: '3.0.0' },
        });
        const sprite = vm.runtime.targets.find((t) => t.isOriginal && !t.isStage);
        vm.setEditingTarget(sprite.id);
        const code = [
            'when_flag_clicked do',
            '  @length = ("ab" * 3).length + "cd".reverse.length',
            '  @chain = ("ab" * 2).length + "cd".reverse.upcase.length',
            '  @s = "a"',
            // The loop checks the condition with the values of each check (the calls are made again
            // at the end of the body, and saved again).
            '  while @s.reverse.length + @s.upcase.length < 7',
            '    @s = @s + "a"',
            '  end',
            '  @loop_length = @s.length',
            'end',
        ].join('\n');
        const converter = await targetCodeToBlocks(vm, sprite, code, null, { version: '2' });
        expect(converter.errors).toEqual([]);
        await converter.apply();

        vm.start();
        vm.greenFlag();
        await sleep(300);

        const value = (name) => sprite.lookupVariableByNameAndType(name, '').value;
        expect(value('length')).toBe(8);
        expect(value('chain')).toBe(6);
        expect(value('loop_length')).toBe(4);
    }, 20000);
});

describe('Saved return values of the stage and of a method (#1725)', () => {
    let vm;

    afterEach(() => {
        vm.stopAll();
        vm.runtime.quit();
    });

    test('a sprite skips the names of the stage, and a method does not overwrite the values', async () => {
        vm = new VM();
        await vm.loadProject({
            targets: [targetJson(true, 'Stage'), targetJson(false, 'Sprite1')],
            monitors: [],
            extensions: [],
            meta: { semver: '3.0.0' },
        });
        const sprite = vm.runtime.targets.find((t) => t.isOriginal && !t.isStage);
        const stage = vm.runtime.getTargetForStage();
        vm.setEditingTarget(stage.id);
        // `@_ret1` of the stage is a variable for all sprites.
        const stageCode = ['when_flag_clicked do', '  @s = ("ab" * 2).length + "c".reverse.length', 'end'].join('\n');
        const stageConverter = await targetCodeToBlocks(vm, stage, stageCode, null, { version: '2' });
        expect(stageConverter.errors).toEqual([]);
        await stageConverter.apply();

        vm.setEditingTarget(sprite.id);
        const code = [
            'def self.foo',
            '  @y = ("x" * 5).length + "y".reverse.length',
            '  return 1',
            'end',
            'when_flag_clicked do',
            '  @v = ("ab" * 3).length + "cd".reverse.length + foo',
            // The calls of the condition made again at the end of the body save in the same variables.
            '  @w = "a"',
            '  while @w.reverse.length + foo < "abcd".reverse.length',
            '    @w = @w + "a"',
            '  end',
            '  @w_length = @w.length',
            'end',
        ].join('\n');
        const converter = await targetCodeToBlocks(vm, sprite, code, null, { version: '2' });
        expect(converter.errors).toEqual([]);
        await converter.apply();

        vm.start();
        vm.greenFlag();
        await sleep(300);

        expect(stage.lookupVariableByNameAndType('s', '').value).toBe(5);
        expect(sprite.lookupVariableByNameAndType('y', '').value).toBe(6);
        expect(sprite.lookupVariableByNameAndType('v', '').value).toBe(9);
        expect(sprite.lookupVariableByNameAndType('w_length', '').value).toBe(3);
    }, 20000);
});
