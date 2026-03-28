import RubyGenerator from '../../../src/lib/ruby-generator';
import { makeSpriteTarget, makeConverter, setupRubyGenerator } from '../helpers/ruby-roundtrip-helper';

/**
 * Round trip: Ruby → Blocks → apply → Ruby (version 2, class syntax)
 */
const classRoundTrip = async (converter, target, code) => {
    const result = await converter.targetCodeToBlocks(target, code);
    if (!result) {
        throw new Error(
            `Failed to convert Ruby to blocks.\nErrors: ${JSON.stringify(converter.errors)}\nCode:\n${code}`,
        );
    }
    await converter.applyTargetBlocks(target);
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, { version: '2' }).trim();
};

describe('Ruby Roundtrip: class set_sprite/set_costumes/set_sounds', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        target.sprite = { name: 'スプライト1', costumes: [], sounds: [] };
        // Generator needs runtime.targets for sprite index calculation
        const stage = runtime.getTargetForStage();
        runtime.targets = [stage, target];
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test('set_sprite round trip', async () => {
        const input = [
            'class Sprite1',
            '  set_sprite "Dog1"',
            '',
            '  self.when(:flag_clicked) do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const expected = [
            'class Sprite1',
            '  set_sprite "Dog1"',
            '',
            '  when_flag_clicked do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const generated = await classRoundTrip(converter, target, input);
        expect(generated).toBe(expected);
    });

    test('set_costumes round trip', async () => {
        const input = [
            'class Sprite1',
            '  set_costumes ["Dog1-a", "Dog1-b"]',
            '',
            '  self.when(:flag_clicked) do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const expected = [
            'class Sprite1',
            '  set_costumes ["Dog1-a", "Dog1-b"]',
            '',
            '  when_flag_clicked do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const generated = await classRoundTrip(converter, target, input);
        expect(generated).toBe(expected);
    });

    test('set_sounds round trip', async () => {
        const input = [
            'class Sprite1',
            '  set_sounds ["Dog1", "Dog2"]',
            '',
            '  self.when(:flag_clicked) do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const expected = [
            'class Sprite1',
            '  set_sounds ["Dog1", "Dog2"]',
            '',
            '  when_flag_clicked do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const generated = await classRoundTrip(converter, target, input);
        expect(generated).toBe(expected);
    });

    test('set_costumes and set_sounds round trip', async () => {
        const input = [
            'class Sprite1',
            '  set_costumes ["Dog1-a", "Dog1-b"]',
            '  set_sounds ["Dog1", "Dog2"]',
            '',
            '  self.when(:flag_clicked) do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const expected = [
            'class Sprite1',
            '  set_costumes ["Dog1-a", "Dog1-b"]',
            '  set_sounds ["Dog1", "Dog2"]',
            '',
            '  when_flag_clicked do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const generated = await classRoundTrip(converter, target, input);
        expect(generated).toBe(expected);
    });

    test('set_sprite with set_x round trip', async () => {
        const input = [
            'class Sprite1',
            '  set_sprite "Dog1"',
            '  set_x 100',
            '',
            '  self.when(:flag_clicked) do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const expected = [
            'class Sprite1',
            '  set_sprite "Dog1"',
            '  set_x 100',
            '',
            '  when_flag_clicked do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const generated = await classRoundTrip(converter, target, input);
        expect(generated).toBe(expected);
    });

    test('set_sprite with named class round trip', async () => {
        const input = [
            'class Cat',
            '  set_name "ネコ"',
            '  set_sprite "Dog1"',
            '',
            '  self.when(:flag_clicked) do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        // Generator outputs in canonical order: sprite before name
        const expected = [
            'class Cat',
            '  set_sprite "Dog1"',
            '  set_name "ネコ"',
            '',
            '  when_flag_clicked do',
            '    move(10)',
            '  end',
            'end',
        ].join('\n');
        const generated = await classRoundTrip(converter, target, input);
        expect(generated).toBe(expected);
    });
});
