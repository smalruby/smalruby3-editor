import {
    makeSpriteTarget,
    makeStageTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

const V2_OPTIONS = {version: '2'};

describe('def initialize round-trip', () => {
    beforeEach(() => {
        setupRubyGenerator();
    });

    describe('sprite', () => {
        let target, stage, runtime, converter;

        beforeEach(() => {
            ({target, stage, runtime} = makeSpriteTarget());
            target.sprite = {name: 'Sprite1', costumes: []};
            runtime.targets = [stage, target];
            converter = makeConverter(target, runtime, {version: '2'});
        });

        test('basic variable initialization round-trips', async () => {
            const code = [
                'class Sprite1',
                '  def initialize',
                '    @x = 10',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('multiple variables round-trip in alphabetical order', async () => {
            const input = [
                'class Sprite1',
                '  def initialize',
                '    @z_var = 3',
                '    @a_var = 1',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            const expected = [
                'class Sprite1',
                '  def initialize',
                '    @a_var = 1',
                '    @z_var = 3',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, input, expected, V2_OPTIONS);
        });

        test('string variable round-trips', async () => {
            const code = [
                'class Sprite1',
                '  def initialize',
                '    @name = "hello"',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('list initialization round-trips', async () => {
            const code = [
                'class Sprite1',
                '  def initialize',
                '    @items = ["a", "b", "c"]',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('empty list round-trips', async () => {
            const code = [
                'class Sprite1',
                '  def initialize',
                '    @items = []',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('mixed variables and lists round-trip', async () => {
            const code = [
                'class Sprite1',
                '  def initialize',
                '    @count = 0',
                '    @items = ["x", "y"]',
                '    @name = "test"',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('initialize with arguments round-trips', async () => {
            const code = [
                'class Sprite1',
                '  def initialize(x, y)',
                '    @x = 10',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('initialize with super round-trips', async () => {
            const code = [
                'class Sprite1',
                '  def initialize',
                '    super',
                '    @x = 10',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('initialize with super(args) round-trips', async () => {
            const code = [
                'class Sprite1',
                '  def initialize(a)',
                '    super(a)',
                '    @x = 10',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('variable used in blocks also appears in initialize', async () => {
            const code = [
                'class Sprite1',
                '  def initialize',
                '    @x = 10',
                '  end',
                '',
                '  when_flag_clicked do',
                '    say(@x)',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });
    });

    describe('stage', () => {
        let target, runtime, converter;

        beforeEach(() => {
            ({target, runtime} = makeStageTarget());
            target.sprite = {name: 'Stage', costumes: []};
            runtime.targets = [target];
            converter = makeConverter(target, runtime, {version: '2'});
        });

        test('global variable initialization round-trips', async () => {
            const code = [
                'class Stage',
                '  def initialize',
                '    $score = 100',
                '  end',
                '',
                '  when_flag_clicked do',
                '    switch_backdrop("Arctic")',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });

        test('global list initialization round-trips', async () => {
            const code = [
                'class Stage',
                '  def initialize',
                '    $items = [1, 2, 3]',
                '  end',
                '',
                '  when_flag_clicked do',
                '    switch_backdrop("Arctic")',
                '  end',
                'end'
            ].join('\n');
            await expectRoundTrip(converter, target, code, null, V2_OPTIONS);
        });
    });

    describe('error cases', () => {
        test('invalid code in initialize produces error', async () => {
            const {target, runtime} = makeSpriteTarget();
            target.sprite = {name: 'Sprite1', costumes: []};
            const converter = makeConverter(target, runtime, {version: '2'});
            const code = [
                'class Sprite1',
                '  def initialize',
                '    say("hello")',
                '  end',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('set_variables in V2 produces error', async () => {
            const {target, runtime} = makeSpriteTarget();
            target.sprite = {name: 'Sprite1', costumes: []};
            const converter = makeConverter(target, runtime, {version: '2'});
            const code = [
                'class Sprite1',
                '  set_variables ["x"]',
                '',
                '  when_flag_clicked do',
                '    move(10)',
                '  end',
                'end'
            ].join('\n');
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/set_variables/);
        });
    });
});
