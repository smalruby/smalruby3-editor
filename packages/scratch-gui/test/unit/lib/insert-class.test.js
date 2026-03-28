// === Smalruby: This file is Smalruby-specific (unit tests for insert-class utility) ===
import { wrapCurrentCodeWithClass } from '../../../src/lib/insert-class';

// Helper to create a mock target
const makeTarget = (overrides = {}) => ({
    isStage: false,
    x: 0,
    y: 0,
    direction: 90,
    visible: true,
    size: 100,
    currentCostume: 0,
    rotationStyle: 'all around',
    sprite: {
        name: 'Sprite1',
        costumes: [{ name: 'costume1' }],
        sounds: [{ name: 'pop' }],
    },
    runtime: {
        targets: [
            { isStage: true },
            // will be replaced with the target itself
        ],
    },
    ...overrides,
});

const makeStageTarget = (overrides = {}) => ({
    isStage: true,
    currentCostume: 0,
    sprite: {
        name: 'Stage',
        costumes: [{ name: 'backdrop1' }],
        sounds: [{ name: 'pop' }],
    },
    runtime: {
        targets: [{ isStage: true }],
    },
    ...overrides,
});

describe('wrapCurrentCodeWithClass', () => {
    test('returns null if code already contains a class definition', () => {
        const code = 'class Cat\n  def setup\n  end\nend\n';
        const target = makeTarget();
        expect(wrapCurrentCodeWithClass(code, target)).toBeNull();
    });

    test('returns null for class with inheritance', () => {
        const code = 'class Cat < Animal\nend\n';
        const target = makeTarget();
        expect(wrapCurrentCodeWithClass(code, target)).toBeNull();
    });

    test('wraps simple code with class', () => {
        const code = 'self.when(:flag_clicked) do\n  move(10)\nend';
        const target = makeTarget();
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass(code, target);
        expect(result).toContain('class Sprite1');
        expect(result).toContain('  self.when(:flag_clicked) do');
        expect(result).toContain('    move(10)');
        expect(result).toContain('  end');
        expect(result).toMatch(/^class Sprite1 < ::Smalruby3::Sprite\n/);
        expect(result).toMatch(/\nend\n$/);
    });

    test('wraps empty code with class (no body)', () => {
        const code = '';
        const target = makeTarget();
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass(code, target);
        expect(result).toBe('class Sprite1 < ::Smalruby3::Sprite\nend\n');
    });

    test('generates set_x when x is non-default', () => {
        const target = makeTarget({ x: 100 });
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('  set_x 100');
    });

    test('generates set_y when y is non-default', () => {
        const target = makeTarget({ y: -50 });
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('  set_y -50');
    });

    test('generates set_direction when direction is non-default', () => {
        const target = makeTarget({ direction: 45 });
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('  set_direction 45');
    });

    test('generates set_visible when not visible', () => {
        const target = makeTarget({ visible: false });
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('  set_visible false');
    });

    test('generates set_size when size is non-default', () => {
        const target = makeTarget({ size: 50 });
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('  set_size 50');
    });

    test('generates set_current_costume when costume is non-default', () => {
        const target = makeTarget({ currentCostume: 2 });
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('  set_current_costume 3');
    });

    test('generates set_rotation_style when non-default', () => {
        const target = makeTarget({ rotationStyle: 'left-right' });
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('  set_rotation_style "left-right"');
    });

    test('uses sprite name as class name when valid', () => {
        const target = makeTarget();
        target.sprite.name = 'Cat';
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('class Cat');
    });

    test('uses Sprite<index> when name is not a valid class name', () => {
        const target = makeTarget();
        target.sprite.name = 'my cat';
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('class Sprite1');
        expect(result).toContain('  set_name "my cat"');
    });

    test('comments out non-hat/non-def top-level code', () => {
        const code = 'x = 1\n\nself.when(:flag_clicked) do\n  move(10)\nend';
        const target = makeTarget();
        target.runtime.targets.push(target);
        const result = wrapCurrentCodeWithClass(code, target);
        expect(result).toContain('# x = 1');
        expect(result).toContain('  self.when(:flag_clicked) do');
    });

    test('handles Stage target', () => {
        const target = makeStageTarget();
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('class Stage');
    });

    test('generates set_current_backdrop for Stage', () => {
        const target = makeStageTarget({ currentCostume: 1 });
        const result = wrapCurrentCodeWithClass('', target);
        expect(result).toContain('  set_current_backdrop 2');
    });

    test('does not match class in comments or strings', () => {
        const code = '# class Foo\nself.when(:flag_clicked) do\nend';
        const target = makeTarget();
        target.runtime.targets.push(target);
        // A comment containing "class" should NOT be treated as existing class
        const result = wrapCurrentCodeWithClass(code, target);
        expect(result).not.toBeNull();
    });

    test('does match actual class definition even with leading whitespace', () => {
        const code = '  class Foo\n  end';
        const target = makeTarget();
        expect(wrapCurrentCodeWithClass(code, target)).toBeNull();
    });
});
