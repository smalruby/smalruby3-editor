/**
 * V1-specific fuzz/random tests for RubyGenerator file output.
 * Extracted from fuzz-hunt.test.js.
 */
import RubyGenerator from '../../../../../src/lib/ruby-generator';

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
// v1 output - extensions should NOT be in class
// ============================================================
describe('v1 output with extensions', () => {
    test('v1 with withSpriteNew wraps in Sprite.new, not class', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('1', target);

        const code = 'microbit.when_button_is("A", "down") do\n  puts("hello")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).not.toContain('class ');
        expect(result).toContain('Sprite.new("Sprite1")');
        expect(result).toContain('microbit.when_button_is');
    });

    test('v1 without withSpriteNew returns code as-is', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target);

        const code = 'microbit.when_button_is("A", "down") do\n  puts("hello")\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toBe(code);
        expect(result).not.toContain('class ');
    });
});

// ============================================================
// v1 extension hat blocks (self.when style)
// ============================================================
describe('v1 extension hat blocks', () => {
    test('self.when(:flag_clicked) in v1 without withSpriteNew', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toBe(code);
    });

    test('self.when(:flag_clicked) in v1 with withSpriteNew', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Sprite.new("Sprite1") do');
        expect(result).toContain('  self.when(:flag_clicked) do');
    });
});
