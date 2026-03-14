import RubyGenerator from '../../../../src/lib/ruby-generator';

/**
 * Comprehensive tests for RubyGenerator.finish() file output patterns.
 * Covers v1/v2, @ruby:class, withSpriteNew, auto-wrap, edge cases.
 */

// --- Helpers ---

const makeMockTarget = (name, index = 1, overrides = {}) => {
    const targets = [];
    const stage = {isStage: true, sprite: {name: 'Stage', costumes: [], sounds: []}};
    for (let i = 0; i < index; i++) {
        targets.push({
            isStage: false,
            sprite: {name: `OtherSprite${i + 1}`, costumes: [], sounds: []}
        });
    }
    const target = targets[index - 1];
    Object.assign(target, {
        x: 0, y: 0, direction: 90, visible: true, size: 100,
        currentCostume: 0, rotationStyle: 'all around', variables: {},
        ...overrides
    });
    target.sprite = {name, costumes: [], sounds: [], ...overrides.sprite};
    targets.unshift(stage);
    target.runtime = {targets};
    return {target, runtime: {targets}};
};

const makeMockStageTarget = (overrides = {}) => {
    const stage = {
        isStage: true,
        sprite: {name: 'Stage', costumes: [], sounds: [], ...overrides.sprite},
        currentCostume: 0, variables: {},
        ...overrides
    };
    // Re-apply sprite after overrides to merge correctly
    stage.sprite = {name: overrides.spriteName || 'Stage', costumes: [], sounds: [], ...overrides.sprite};
    const runtime = {targets: [stage]};
    stage.runtime = runtime;
    return {target: stage, runtime};
};

const setupGenerator = (version, target, commentTexts = []) => {
    RubyGenerator.init({version});
    RubyGenerator.definitions_ = {};
    RubyGenerator.requires_ = {};
    RubyGenerator.prepares_ = {};
    RubyGenerator.cache_ = {
        targetCommentTexts: commentTexts,
        comments: {}
    };
    RubyGenerator.currentTarget_ = target;
};

// ============================================================
// 1. Version 2 - No class, no withSpriteNew (Ruby tab)
// ============================================================
describe('Version 2 - No class, no withSpriteNew (Ruby tab)', () => {
    test('simple hat block returns code as-is', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toBe(code);
        expect(result).not.toContain('class ');
    });

    test('multiple hat blocks', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target);

        const code =
            'when_flag_clicked do\n  move(10)\nend\n\n' +
            'when_key_pressed("space") do\n  turn_right(15)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toBe(code);
    });

    test('empty code', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target);

        const result = RubyGenerator.finish('', {});

        expect(result).toBe('');
    });

    test('non-hat code without withSpriteNew returns as-is', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target);

        const code = 'move(10)\nturn_right(15)\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toBe(code);
    });
});

// ============================================================
// 2. Version 2 - No class, WITH withSpriteNew (file output, auto-wrap)
// ============================================================
describe('Version 2 - No class, WITH withSpriteNew (auto-wrap)', () => {
    test('simple sprite auto-wraps with class', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [{name: 'costume1'}], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('  set_costumes ["costume1"]');
        expect(result).toContain('  when_flag_clicked do');
        expect(result).toContain('end\n');
    });

    test('sprite with non-default x,y,direction,size,visible,rotation_style,currentCostume', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            x: 123, y: -45, direction: 270, size: 200,
            visible: false, rotationStyle: 'don\'t rotate',
            currentCostume: 3,
            sprite: {
                name: 'Sprite1',
                costumes: [{name: 'c1'}, {name: 'c2'}],
                sounds: [{name: 's1'}]
            }
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('set_x 123');
        expect(result).toContain('set_y -45');
        expect(result).toContain('set_direction 270');
        expect(result).toContain('set_size 200');
        expect(result).toContain('set_visible false');
        expect(result).toContain('set_rotation_style "don\'t rotate"');
        expect(result).toContain('set_current_costume 4');
        expect(result).toContain('set_costumes ["c1", "c2"]');
        expect(result).toContain('set_sounds ["s1"]');
    });

    test('sprite with costumes and sounds', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {
                name: 'Sprite1',
                costumes: [{name: 'walk-a'}, {name: 'walk-b'}, {name: 'walk-c'}],
                sounds: [{name: 'meow'}, {name: 'purr'}]
            }
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('set_costumes ["walk-a", "walk-b", "walk-c"]');
        expect(result).toContain('set_sounds ["meow", "purr"]');
    });

    test('sprite with uppercase name uses name as class name', () => {
        const {target} = makeMockTarget('Cat', 1, {
            sprite: {name: 'Cat', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Cat < ::Smalruby3::Sprite');
        expect(result).not.toContain('set_name');
    });

    test('sprite with Japanese name uses Sprite%index% and set_name', () => {
        const {target} = makeMockTarget('ネコ', 1, {
            sprite: {name: 'ネコ', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('set_name "ネコ"');
    });

    test('stage target auto-wraps with class Stage', () => {
        const {target} = makeMockStageTarget({
            sprite: {
                name: 'Stage',
                costumes: [{name: 'backdrop1'}],
                sounds: []
            }
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  switch_backdrop("Arctic")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Stage < ::Smalruby3::Sprite');
        expect(result).not.toContain('set_name');
        expect(result).toContain('set_backdrops ["backdrop1"]');
    });

    test('stage with non-default name generates set_name', () => {
        const {target} = makeMockStageTarget({
            spriteName: 'ステージ',
            sprite: {name: 'ステージ', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  broadcast("msg")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Stage < ::Smalruby3::Sprite');
        expect(result).toContain('set_name "ステージ"');
    });

    test('stage with backdrops and sounds', () => {
        const {target} = makeMockStageTarget({
            currentCostume: 2,
            sprite: {
                name: 'Stage',
                costumes: [{name: 'Arctic'}, {name: 'Beach'}],
                sounds: [{name: 'pop'}, {name: 'boing'}]
            }
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  broadcast("msg")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('set_current_backdrop 3');
        expect(result).toContain('set_backdrops ["Arctic", "Beach"]');
        expect(result).toContain('set_sounds ["pop", "boing"]');
    });

    test('empty code returns empty string (no auto-wrap for empty)', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}], sounds: []}
        });
        setupGenerator('2', target);

        const result = RubyGenerator.finish('', {withSpriteNew: true});

        expect(result).toBe('');
    });

    test('sprite with lowercase name uses Sprite%index% and set_name', () => {
        const {target} = makeMockTarget('mySprite', 1, {
            sprite: {name: 'mySprite', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('set_name "mySprite"');
    });
});

// ============================================================
// 3. Version 2 - With @ruby:class (user wrote class)
// ============================================================
describe('Version 2 - With @ruby:class', () => {
    test('@ruby:class WITHOUT withSpriteNew -> class format, no inheritance', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('class Sprite1');
        expect(result).not.toContain('< ::Smalruby3::Sprite');
    });

    test('@ruby:class WITH withSpriteNew -> class format WITH inheritance', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
    });

    test('@ruby:class:x,y with non-default x,y -> only set_x, set_y (not other attributes)', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            x: 100, y: -50, direction: 180, size: 50, visible: false,
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}], sounds: [{name: 's1'}]}
        });
        setupGenerator('2', target, ['@ruby:class:x,y']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('set_x 100');
        expect(result).toContain('set_y -50');
        expect(result).not.toContain('set_direction');
        expect(result).not.toContain('set_size');
        expect(result).not.toContain('set_visible');
        expect(result).not.toContain('set_costumes');
        expect(result).not.toContain('set_sounds');
    });

    test('@ruby:class:name with Japanese name -> class Sprite%index% + set_name', () => {
        const {target} = makeMockTarget('ネコ', 1);
        setupGenerator('2', target, ['@ruby:class:name']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('class Sprite1');
        expect(result).toContain('set_name "ネコ"');
    });

    test('@ruby:class:name=Cat -> class Cat', () => {
        const {target} = makeMockTarget('ネコ', 1);
        setupGenerator('2', target, ['@ruby:class:name=Cat']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('class Cat');
        expect(result).not.toContain('class Sprite1');
        expect(result).toContain('set_name "ネコ"');
    });

    test('@ruby:class:name=Cat with same sprite name -> no set_name', () => {
        const {target} = makeMockTarget('Cat', 1);
        setupGenerator('2', target, ['@ruby:class:name=Cat']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('class Cat');
        expect(result).not.toContain('set_name');
    });

    test('@ruby:class:costumes,sounds outputs set_costumes and set_sounds', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {
                name: 'Sprite1',
                costumes: [{name: 'Dog1-a'}, {name: 'Dog1-b'}],
                sounds: [{name: 'woof'}, {name: 'bark'}]
            }
        });
        setupGenerator('2', target, ['@ruby:class:costumes,sounds']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('set_costumes ["Dog1-a", "Dog1-b"]');
        expect(result).toContain('set_sounds ["woof", "bark"]');
    });

    test('stage: @ruby:class:backdrops,sounds -> set_backdrops and set_sounds', () => {
        const {target} = makeMockStageTarget({
            sprite: {
                name: 'Stage',
                costumes: [{name: 'Arctic'}, {name: 'Beach'}],
                sounds: [{name: 'pop'}]
            }
        });
        setupGenerator('2', target, ['@ruby:class:backdrops,sounds']);

        const code = 'when_flag_clicked do\n  broadcast("msg")\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('class Stage');
        expect(result).toContain('set_backdrops ["Arctic", "Beach"]');
        expect(result).toContain('set_sounds ["pop"]');
    });

    test('@ruby:class without attributes + withSpriteNew -> class with inheritance, auto set_xxx (isAutoWrap)', () => {
        // NOTE: @ruby:class (no attributes) + withSpriteNew triggers isAutoWrap=true,
        // meaning ALL non-default attributes are generated. This is by design:
        // allowedAttributes.length === 0 && forFileOutput === true
        const {target} = makeMockTarget('Sprite1', 1, {
            x: 100, y: -50, direction: 180,
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}], sounds: [{name: 's1'}]}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        // isAutoWrap=true means all non-default set_xxx are generated
        expect(result).toContain('set_x 100');
        expect(result).toContain('set_y -50');
        expect(result).toContain('set_direction 180');
        expect(result).toContain('set_costumes ["c1"]');
        expect(result).toContain('set_sounds ["s1"]');
    });

    test('@ruby:class:sprite=Dog1 outputs set_sprite', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}], sounds: [{name: 's1'}]}
        });
        setupGenerator('2', target, ['@ruby:class:sprite=Dog1']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('set_sprite "Dog1"');
        expect(result).not.toContain('set_costumes');
        expect(result).not.toContain('set_sounds');
    });
});

// ============================================================
// 4. Version 2 - Hat block format in class with file output
// ============================================================
describe('Version 2 - Hat block format in class', () => {
    test('v2 hat blocks in class with withSpriteNew are inside class', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('  when_flag_clicked do');
        expect(result).not.toContain('# when_flag_clicked');
    });

    test('def blocks are inside class in file output', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'def my_method\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('  def my_method');
        expect(result).not.toContain('# def my_method');
    });

    test('multiple hat and def blocks all inside class', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code =
            'when_flag_clicked do\n  move(10)\nend\n\n' +
            'def my_method\n  turn_right(15)\nend\n\n' +
            'when_key_pressed("space") do\n  move(20)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  when_flag_clicked do');
        expect(result).toContain('  def my_method');
        expect(result).toContain('  when_key_pressed("space") do');
        expect(result).not.toMatch(/^# when_flag_clicked/m);
        expect(result).not.toMatch(/^# def my_method/m);
    });

    test('v1-style self.when in v2 with auto-wrap still includes inside class', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('  self.when(:flag_clicked) do');
    });
});

// ============================================================
// 5. Non-hat code in file output
// ============================================================
describe('Non-hat code in file output', () => {
    test('non-hat code with withSpriteNew and @ruby:class -> commented out outside class', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'move(10)\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('end\n');
        expect(result).toMatch(/^# move\(10\)$/m);
    });

    test('hat + non-hat mix -> hat inside, non-hat commented outside', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code =
            'when_flag_clicked do\n  move(10)\nend\n\n' +
            'move(20)\nturn_right(15)\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  when_flag_clicked do');
        expect(result).toMatch(/^# move\(20\)$/m);
        expect(result).toMatch(/^# turn_right\(15\)$/m);
    });

    test('non-hat code in Ruby tab (no withSpriteNew) stays inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code =
            'when_flag_clicked do\n  move(10)\nend\n\n' +
            'move(20)\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('class Sprite1');
        // In Ruby tab, non-hat code should be inside class, NOT commented
        expect(result).not.toMatch(/^# move\(20\)$/m);
        expect(result).toContain('  move(20)');
    });

    test('only non-hat code in auto-wrap file output -> all commented outside class', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'move(10)\nturn_right(15)\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toMatch(/^# move\(10\)$/m);
        expect(result).toMatch(/^# turn_right\(15\)$/m);
    });
});

// ============================================================
// 6. Edge cases
// ============================================================
describe('Edge cases', () => {
    test('sprite at index 2 -> correct Sprite2', () => {
        const {target} = makeMockTarget('ネコ', 2, {
            sprite: {name: 'ネコ', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite2 < ::Smalruby3::Sprite');
        expect(result).toContain('set_name "ネコ"');
    });

    test('sprite at index 3 -> correct Sprite3', () => {
        const {target} = makeMockTarget('ネコ', 3, {
            sprite: {name: 'ネコ', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite3 < ::Smalruby3::Sprite');
    });

    test('very long costume list', () => {
        const costumes = [];
        for (let i = 0; i < 20; i++) {
            costumes.push({name: `costume${i + 1}`});
        }
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes, sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('set_costumes [');
        for (let i = 0; i < 20; i++) {
            expect(result).toContain(`"costume${i + 1}"`);
        }
    });

    test('very long sound list', () => {
        const sounds = [];
        for (let i = 0; i < 15; i++) {
            sounds.push({name: `sound${i + 1}`});
        }
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('set_sounds [');
        for (let i = 0; i < 15; i++) {
            expect(result).toContain(`"sound${i + 1}"`);
        }
    });

    test('special characters in sprite name (quotes) - sanitized to Sprite%index% + set_name', () => {
        // Names with special chars fail _isValidClassName, so fallback to Sprite%index% + set_name
        const {target} = makeMockTarget('Sprite "1"', 1, {
            sprite: {name: 'Sprite "1"', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1');
        expect(result).toContain('set_name "Sprite \\"1\\""');
    });

    test('special characters in sprite name (backslashes) - sanitized to Sprite%index% + set_name', () => {
        // Names with special chars fail _isValidClassName, so fallback to Sprite%index% + set_name
        const {target} = makeMockTarget('Sprite\\1', 1, {
            sprite: {name: 'Sprite\\1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1');
        expect(result).toContain('set_name "Sprite\\\\1"');
    });

    test('special characters in lowercase sprite name -> set_name escapes properly', () => {
        // When name does NOT start with uppercase, it goes through set_name which IS escaped
        const {target} = makeMockTarget('sprite "1"', 1, {
            sprite: {name: 'sprite "1"', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1');
        expect(result).toContain('set_name "sprite \\"1\\""');
    });

    test('special characters in costume name', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [{name: 'costume "special"'}], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('set_costumes ["costume \\"special\\""]');
    });

    test('target with variables does not crash', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            variables: {
                'var1': {name: 'myVar', value: 42, type: ''},
                'var2': {name: 'myList', value: [1, 2, 3], type: 'list'}
            },
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';

        // Should not throw
        expect(() => {
            RubyGenerator.finish(code, {withSpriteNew: true});
        }).not.toThrow();
    });

    test('definitions_ are extracted and placed before code', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target);
        RubyGenerator.definitions_.my_def = 'MY_CONSTANT = 42';

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('MY_CONSTANT = 42');
        expect(result.indexOf('MY_CONSTANT')).toBeLessThan(result.indexOf('when_flag_clicked'));
    });

    test('definitions_ with require__ are moved to requires_', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target);
        RubyGenerator.definitions_.require__smalruby3 = 'require "smalruby3"';

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        // require should be moved to requires_, not in defs output
        expect(result).not.toContain('require "smalruby3"');
        expect(RubyGenerator.requires_.require__smalruby3).toBe('require "smalruby3"');
    });

    test('definitions_ with prepare__ are moved to prepares_', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target);
        RubyGenerator.definitions_.prepare__init = 'init_runtime';

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).not.toContain('init_runtime');
        expect(RubyGenerator.prepares_.prepare__init).toBe('init_runtime');
    });

    test('both definitions and code are empty returns empty string', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target);

        const result = RubyGenerator.finish('', {});

        expect(result).toBe('');
    });

    test('definitions present but code empty -> outputs definitions only', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target);
        RubyGenerator.definitions_.my_const = 'MY_CONST = 1';

        const result = RubyGenerator.finish('', {});

        expect(result).toBe('MY_CONST = 1\n\n');
    });

    test('target comments (non-class) are prepended as # comments', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['A user comment', 'Another note']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('# A user comment');
        expect(result).toContain('# Another note');
    });

    test('@ruby:class comment is NOT output as a regular comment', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class', 'A user comment']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).not.toContain('# @ruby:class');
        expect(result).toContain('# A user comment');
        expect(result).toContain('class Sprite1');
    });

    test('empty costumes array does not generate set_costumes', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class:costumes']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        // costumes is listed but array is empty - it still generates set_costumes
        // because has('costumes') is true and costumes exist (even if empty array)
        expect(result).toContain('set_costumes []');
    });

    test('empty sounds array does not generate set_sounds', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class:sounds']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        // sounds is listed but array is empty
        expect(result).toContain('set_sounds []');
    });

    test('v1 stage with costumes uses Stage.new and includes costume hashes', () => {
        const {target} = makeMockStageTarget({
            sprite: {
                name: 'Stage',
                costumes: [{
                    assetId: 'abc123', name: 'backdrop1',
                    bitmapResolution: 1, dataFormat: 'svg',
                    rotationCenterX: 240, rotationCenterY: 180
                }],
                sounds: []
            }
        });
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  switch_backdrop("backdrop1")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Stage.new("Stage"');
        expect(result).toContain('asset_id: "abc123"');
        expect(result).toContain('name: "backdrop1"');
    });

    test('default values produce no set_xxx in auto-wrap (v2)', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            x: 0, y: 0, direction: 90, visible: true, size: 100,
            currentCostume: 0, rotationStyle: 'all around',
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).not.toContain('set_x');
        expect(result).not.toContain('set_y');
        expect(result).not.toContain('set_direction');
        expect(result).not.toContain('set_visible');
        expect(result).not.toContain('set_size');
        expect(result).not.toContain('set_current_costume');
        expect(result).not.toContain('set_rotation_style');
        expect(result).not.toContain('set_name');
    });

    test('class output has proper indentation: set_xxx and code are indented 2 spaces', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            x: 50,
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        const lines = result.split('\n');
        expect(lines[0]).toBe('class Sprite1 < ::Smalruby3::Sprite');
        // set_xxx lines are indented
        const setLines = lines.filter(l => l.includes('set_'));
        for (const line of setLines) {
            expect(line).toMatch(/^ {2}set_/);
        }
        // Code is indented
        expect(lines.find(l => l.includes('when_flag_clicked'))).toMatch(/^ {2}when_flag_clicked/);
        expect(lines[lines.length - 2]).toBe('end');
    });

    test('separator between set_xxx and code body is a single blank line', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            x: 50,
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        // The separator adds one \n between setCode and indented code.
        // setCode ends with \n (from the last set_ line), separator is \n, then code starts
        // This means there's a blank line between set_xxx and code body.
        // But auto-wrap also adds sounds=[] so check that pattern
        expect(result).toMatch(/set_sounds \[\]\n\n {2}when_flag_clicked/);
    });

    test('no separator when only set_xxx (no code body)', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            x: 50,
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class:x']);

        const result = RubyGenerator.finish('', {});

        expect(result).toContain('class Sprite1');
        expect(result).toContain('  set_x 50');
        // No double blank line before end
        expect(result).not.toMatch(/set_x 50\n\nend/);
    });

    test('currentCostume at 0 is default, not output', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            currentCostume: 0,
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).not.toContain('set_current_costume');
    });

    test('currentCostume at 1 is non-default, output', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            currentCostume: 1,
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}, {name: 'c2'}], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('set_current_costume 2');
    });

    test('visible: true is default, not output', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            visible: true,
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).not.toContain('set_visible');
    });

    test('stage currentCostume 0 is default, not output as set_current_backdrop', () => {
        const {target} = makeMockStageTarget({
            currentCostume: 0,
            sprite: {name: 'Stage', costumes: [{name: 'b1'}], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  broadcast("msg")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).not.toContain('set_current_backdrop');
    });

    test('multiple @ruby:class comments: only first takes effect', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class', '@ruby:class:x,y']);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        // The second @ruby:class:x,y should take precedence (it overwrites classComment)
        expect(result).toContain('class Sprite1');
    });

    test('non-string definitions are ignored', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target);
        RubyGenerator.definitions_.num_def = 42;
        RubyGenerator.definitions_.null_def = null;
        RubyGenerator.definitions_.str_def = 'REAL_DEF = true';

        const code = 'move(10)\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toContain('REAL_DEF = true');
        expect(result).not.toContain('42');
    });

    test('v2 auto-wrap with only def blocks -> def inside class', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'def my_method\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('  def my_method');
        expect(result).not.toMatch(/^# def my_method/m);
    });

    test('v2 multiple blank-line-separated sections are split correctly', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code =
            'when_flag_clicked do\n  move(10)\nend\n\n' +
            'x = 1\ny = 2\n\n' +
            'def helper\n  move(5)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        // hat and def inside class
        expect(result).toContain('  when_flag_clicked do');
        expect(result).toContain('  def helper');
        // non-hat code commented outside
        expect(result).toMatch(/^# x = 1$/m);
        expect(result).toMatch(/^# y = 2$/m);
    });

    test('v1 Sprite.new with variables includes variable data', () => {
        const {target} = makeMockTarget('Cat', 1, {
            variables: {
                'v1': {name: 'score', value: 0, type: ''},
                'v2': {name: 'items', value: ['a', 'b'], type: 'list'}
            },
            sprite: {name: 'Cat', costumes: [], sounds: []}
        });
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Sprite.new("Cat"');
        // variables with value 0 should NOT have value field
        expect(result).toContain('name: "score"');
        expect(result).toContain('name: "items"');
        expect(result).toContain('"a"');
    });

    test('v1 Sprite.new currentCostume > 1 includes current_costume', () => {
        const {target} = makeMockTarget('Cat', 1, {
            currentCostume: 3,
            sprite: {name: 'Cat', costumes: [], sounds: []}
        });
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        // spriteNew uses currentCostume > 1 (not > 0) and subtracts 1
        expect(result).toContain('current_costume: 2');
    });

    test('v1 Sprite.new currentCostume == 1 does NOT include current_costume', () => {
        const {target} = makeMockTarget('Cat', 1, {
            currentCostume: 1,
            sprite: {name: 'Cat', costumes: [], sounds: []}
        });
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).not.toContain('current_costume');
    });

    test('v2 class wrapping with set_current_costume uses 1-based index', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            currentCostume: 2,
            sprite: {name: 'Sprite1', costumes: [{name: 'c1'}, {name: 'c2'}, {name: 'c3'}], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        // v2 uses currentCostume + 1 (1-based)
        expect(result).toContain('set_current_costume 3');
    });

    test('stage name "Stage" in auto-wrap does NOT generate set_name', () => {
        const {target} = makeMockStageTarget({
            sprite: {name: 'Stage', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  broadcast("msg")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Stage');
        expect(result).not.toContain('set_name');
    });

    test('sprite name matching Sprite%index% does NOT generate set_name in auto-wrap', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).not.toContain('set_name');
    });

    test('uppercase sprite name at index 2 uses sprite name as class name (not Sprite2)', () => {
        // FINDING: When sprite name starts with uppercase, auto-wrap uses it as class name
        // regardless of index. "Sprite1" at index 2 becomes "class Sprite1", NOT "class Sprite2"
        const {target} = makeMockTarget('Sprite1', 2, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        // Uses sprite name directly since it starts with uppercase
        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).not.toContain('set_name');
    });

    test('lowercase sprite name at index 2 uses Sprite2 and generates set_name', () => {
        const {target} = makeMockTarget('cat', 2, {
            sprite: {name: 'cat', costumes: [], sounds: []}
        });
        setupGenerator('2', target);

        const code = 'when_flag_clicked do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite2 < ::Smalruby3::Sprite');
        expect(result).toContain('set_name "cat"');
    });

    test('newline in code with no trailing newline handled correctly', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'when_flag_clicked do\n  move(10)\nend';  // no trailing newline
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('  when_flag_clicked do');
    });
});

// ============================================================
// 7. finishTargets and initTargets
// ============================================================
describe('finishTargets and initTargets', () => {
    test('initTargets sets up requires_ and prepares_', () => {
        RubyGenerator.initTargets({requires: ['smalruby3']});

        expect(RubyGenerator.requires_).toEqual({
            require__smalruby3: 'require "smalruby3"'
        });
        expect(RubyGenerator.prepares_).toEqual({});
    });

    test('finishTargets prepends requires and prepares to code', () => {
        RubyGenerator.requires_ = {
            require__smalruby3: 'require "smalruby3"'
        };
        RubyGenerator.prepares_ = {
            prepare__init: 'Smalruby3.init'
        };

        const code = 'class Cat < ::Smalruby3::Sprite\nend\n';
        const result = RubyGenerator.finishTargets(code, {});

        expect(result).toContain('require "smalruby3"');
        expect(result).toContain('Smalruby3.init');
        expect(result.indexOf('require')).toBeLessThan(result.indexOf('class Cat'));
        expect(result.indexOf('Smalruby3.init')).toBeLessThan(result.indexOf('class Cat'));
    });

    test('finishTargets with empty requires/prepares just returns code', () => {
        RubyGenerator.requires_ = {};
        RubyGenerator.prepares_ = {};

        const code = 'class Cat < ::Smalruby3::Sprite\nend\n';
        const result = RubyGenerator.finishTargets(code, {});

        expect(result).toBe(code);
    });
});

// ============================================================
// 8. quote_ edge cases
// ============================================================
describe('quote_ edge cases', () => {
    test('escapes double quotes', () => {
        expect(RubyGenerator.quote_('hello "world"')).toBe('"hello \\"world\\""');
    });

    test('escapes backslashes', () => {
        expect(RubyGenerator.quote_('path\\to\\file')).toBe('"path\\\\to\\\\file"');
    });

    test('escapes newlines', () => {
        expect(RubyGenerator.quote_('line1\nline2')).toBe('"line1\\nline2"');
    });

    test('escapes tabs', () => {
        expect(RubyGenerator.quote_('col1\tcol2')).toBe('"col1\\tcol2"');
    });

    test('handles empty string', () => {
        expect(RubyGenerator.quote_('')).toBe('""');
    });

    test('handles non-string input (number)', () => {
        expect(RubyGenerator.quote_(42)).toBe('"42"');
    });

    test('handles null byte', () => {
        expect(RubyGenerator.quote_('\0')).toBe('"\\0"');
    });

    test('multiple special chars combined', () => {
        expect(RubyGenerator.quote_('"hello\\\n"')).toBe('"\\"hello\\\\\\n\\""');
    });
});

// ============================================================
// 9. spriteNew edge cases
// ============================================================
describe('spriteNew edge cases', () => {
    test('returns null for null target', () => {
        expect(RubyGenerator.spriteNew(null)).toBeNull();
    });

    test('returns null for undefined target', () => {
        expect(RubyGenerator.spriteNew(undefined)).toBeNull();
    });

    test('all default values produce minimal output', () => {
        const target = {
            x: 0, y: 0, direction: 90, visible: true, size: 100,
            currentCostume: 0, rotationStyle: 'all around',
            isStage: false, variables: {},
            sprite: {name: 'Cat', costumes: [], sounds: []}
        };

        const result = RubyGenerator.spriteNew(target);

        expect(result).toBe('Sprite.new("Cat")');
    });

    test('stage minimal output', () => {
        const target = {
            x: 0, y: 0, direction: 90, visible: true, size: 100,
            currentCostume: 0, rotationStyle: 'all around',
            isStage: true, variables: {},
            sprite: {name: 'Stage', costumes: [], sounds: []}
        };

        const result = RubyGenerator.spriteNew(target);

        expect(result).toBe('Stage.new("Stage")');
    });

    test('variable with value 0 omits value field', () => {
        const target = {
            x: 0, y: 0, direction: 90, visible: true, size: 100,
            currentCostume: 0, rotationStyle: 'all around',
            isStage: false,
            variables: {
                'v1': {name: 'score', value: 0, type: ''}
            },
            sprite: {name: 'Cat', costumes: [], sounds: []}
        };

        const result = RubyGenerator.spriteNew(target);

        expect(result).toContain('name: "score"');
        expect(result).not.toMatch(/value:/);
    });

    test('variable with non-zero value includes value field', () => {
        const target = {
            x: 0, y: 0, direction: 90, visible: true, size: 100,
            currentCostume: 0, rotationStyle: 'all around',
            isStage: false,
            variables: {
                'v1': {name: 'score', value: 100, type: ''}
            },
            sprite: {name: 'Cat', costumes: [], sounds: []}
        };

        const result = RubyGenerator.spriteNew(target);

        expect(result).toContain('name: "score"');
        expect(result).toContain('value: 100');
    });

    test('list variable with empty value omits value field', () => {
        const target = {
            x: 0, y: 0, direction: 90, visible: true, size: 100,
            currentCostume: 0, rotationStyle: 'all around',
            isStage: false,
            variables: {
                'v1': {name: 'items', value: [], type: 'list'}
            },
            sprite: {name: 'Cat', costumes: [], sounds: []}
        };

        const result = RubyGenerator.spriteNew(target);

        expect(result).toContain('name: "items"');
        expect(result).not.toMatch(/value:/);
    });

    test('list variable with values includes value field', () => {
        const target = {
            x: 0, y: 0, direction: 90, visible: true, size: 100,
            currentCostume: 0, rotationStyle: 'all around',
            isStage: false,
            variables: {
                'v1': {name: 'items', value: ['a', 'b', 'c'], type: 'list'}
            },
            sprite: {name: 'Cat', costumes: [], sounds: []}
        };

        const result = RubyGenerator.spriteNew(target);

        expect(result).toContain('name: "items"');
        expect(result).toContain('value: ["a", "b", "c"]');
    });
});

// ============================================================
// 10. Version comparison edge cases
// ============================================================
describe('Version comparison edge cases', () => {
    test('version defaults to "1" when not specified', () => {
        RubyGenerator.init({});
        expect(RubyGenerator.version).toBe('1');
    });

    test('version defaults to "1" when options is null', () => {
        RubyGenerator.init(null);
        expect(RubyGenerator.version).toBe('1');
    });

    test('numeric version is converted to string', () => {
        RubyGenerator.init({version: 2});
        expect(RubyGenerator.version).toBe('2');
    });

    test('v1 ignores @ruby:class completely (no class wrapping)', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target, ['@ruby:class']);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).not.toContain('class ');
        expect(result).toContain('self.when(:flag_clicked)');
    });

    test('v1 with @ruby:class and withSpriteNew uses Sprite.new', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('1', target, ['@ruby:class:x,y']);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Sprite.new("Sprite1")');
        expect(result).not.toContain('class ');
    });
});

// ============================================================
// 11. Extension hat blocks inside class
// ============================================================
describe('Extension hat blocks inside class', () => {
    test('microbit.when_button_is inside class with @ruby:class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'microbit.when_button_is("A", "down") do\n  puts("hello")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1');
        expect(result).toContain('  microbit.when_button_is("A", "down") do');
        expect(result).not.toContain('# microbit');
    });

    test('microbit.when_button_is inside auto-wrapped class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target);

        const code = 'microbit.when_button_is("A", "down") do\n  puts("hello")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1 < ::Smalruby3::Sprite');
        expect(result).toContain('  microbit.when_button_is("A", "down") do');
        expect(result).not.toContain('# microbit');
    });

    test('face_sensing.when_face_tilted inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'face_sensing.when_face_tilted("left") do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('class Sprite1');
        expect(result).toContain('  face_sensing.when_face_tilted("left") do');
        expect(result).not.toContain('# face_sensing');
    });

    test('ev3.when_button_pressed inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'ev3.when_button_pressed(1) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  ev3.when_button_pressed(1) do');
        expect(result).not.toContain('# ev3');
    });

    test('video_sensing.when_video_motion_greater_than inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'video_sensing.when_video_motion_greater_than(10) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  video_sensing.when_video_motion_greater_than(10) do');
        expect(result).not.toContain('# video_sensing');
    });

    test('mixed core and extension hat blocks inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code =
            'when_flag_clicked do\n  move(10)\nend\n\n' +
            'microbit.when_button_is("A", "down") do\n  puts("hello")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  when_flag_clicked do');
        expect(result).toContain('  microbit.when_button_is("A", "down") do');
        expect(result).not.toContain('# microbit');
        expect(result).not.toContain('# when_flag_clicked');
    });

    test('SpriteName.when(:boost_color) inside class (boost pattern)', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'Sprite1.when(:boost_color, "any") do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  Sprite1.when(:boost_color, "any") do');
        expect(result).not.toContain('# Sprite1.when');
    });

    test('wedo2.when_distance inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'wedo2.when_distance("<", 50) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  wedo2.when_distance("<", 50) do');
        expect(result).not.toContain('# wedo2');
    });

    test('makey.when_key_pressed inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'makey.when_key_pressed("space") do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  makey.when_key_pressed("space") do');
        expect(result).not.toContain('# makey');
    });

    test('microbit_v1.when_button_pressed inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'microbit_v1.when_button_pressed("A") do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  microbit_v1.when_button_pressed("A") do');
        expect(result).not.toContain('# microbit_v1');
    });

    test('gdx_for.when_gesture inside class', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('2', target, ['@ruby:class']);

        const code = 'gdx_for.when_gesture("shaken") do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('  gdx_for.when_gesture("shaken") do');
        expect(result).not.toContain('# gdx_for');
    });
});
