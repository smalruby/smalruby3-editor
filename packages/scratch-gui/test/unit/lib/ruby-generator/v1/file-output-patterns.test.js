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

const makeMockStageTarget = (overrides = {}) => {
    const stage = {
        isStage: true,
        sprite: {name: 'Stage', costumes: [], sounds: [], ...overrides.sprite},
        currentCostume: 0, variables: {},
        ...overrides
    };
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

describe('Version 1 - No class (standard v1 output)', () => {
    test('simple hat block without withSpriteNew returns code as-is', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toBe(code);
        expect(result).not.toContain('class ');
        expect(result).not.toContain('Sprite.new');
    });

    test('multiple hat blocks without withSpriteNew', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target);

        const code =
            'self.when(:flag_clicked) do\n  move(10)\nend\n\n' +
            'self.when(:flag_clicked) do\n  turn_right(15)\nend\n';
        const result = RubyGenerator.finish(code, {});

        expect(result).toBe(code);
        expect(result).not.toContain('class ');
    });

    test('hat block with withSpriteNew uses Sprite.new format', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Sprite.new("Sprite1")');
        expect(result).toContain('  self.when(:flag_clicked) do');
        expect(result).toContain('end\n');
        expect(result).not.toContain('class ');
    });

    test('stage target with withSpriteNew uses Stage.new format', () => {
        const {target} = makeMockStageTarget({
            x: 0, y: 0, direction: 90, visible: true, size: 100,
            currentCostume: 0, rotationStyle: 'all around',
            sprite: {name: 'Stage', costumes: [], sounds: []}
        });
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Stage.new("Stage")');
        expect(result).not.toContain('class ');
    });

    test('empty code returns empty string', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target);

        const result = RubyGenerator.finish('', {});

        expect(result).toBe('');
    });

    test('empty code with withSpriteNew still wraps with Sprite.new', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('1', target);

        const result = RubyGenerator.finish('', {withSpriteNew: true});

        expect(result).toContain('Sprite.new("Sprite1")');
        expect(result).toContain('do\n');
        expect(result).toContain('end\n');
    });

    test('Sprite.new includes non-default attributes', () => {
        const {target} = makeMockTarget('Cat', 1, {
            x: 50, y: -30, direction: 45, visible: false, size: 75,
            sprite: {
                name: 'Cat',
                costumes: [{
                    assetId: 'abc', name: 'costume1',
                    bitmapResolution: 1, dataFormat: 'svg',
                    rotationCenterX: 48, rotationCenterY: 50
                }],
                sounds: []
            },
            rotationStyle: 'left-right'
        });
        setupGenerator('1', target);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Sprite.new("Cat"');
        expect(result).toContain('x: 50');
        expect(result).toContain('y: -30');
        expect(result).toContain('direction: 45');
        expect(result).toContain('visible: false');
        expect(result).toContain('size: 75');
        expect(result).toContain('rotation_style: "left-right"');
    });
});

describe('Version 1 - With @ruby:class', () => {
    test('@ruby:class with withSpriteNew uses Sprite.new (NOT class)', () => {
        const {target} = makeMockTarget('Sprite1', 1, {
            sprite: {name: 'Sprite1', costumes: [], sounds: []}
        });
        setupGenerator('1', target, ['@ruby:class']);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Sprite.new("Sprite1")');
        expect(result).not.toContain('class ');
    });

    test('@ruby:class:x,y with withSpriteNew uses Sprite.new with attributes', () => {
        const {target} = makeMockTarget('ネコ', 1, {
            x: 100, y: -50, direction: 45,
            sprite: {name: 'ネコ', costumes: [], sounds: []}
        });
        setupGenerator('1', target, ['@ruby:class:x,y']);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Sprite.new("ネコ"');
        expect(result).toContain('x: 100');
        expect(result).toContain('y: -50');
        expect(result).toContain('direction: 45');
        expect(result).not.toContain('class ');
    });

    test('@ruby:class WITHOUT withSpriteNew does NOT wrap with class in v1', () => {
        const {target} = makeMockTarget('Sprite1');
        setupGenerator('1', target, ['@ruby:class']);

        const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
        const result = RubyGenerator.finish(code, {});

        // v1 ignores @ruby:class entirely
        expect(result).not.toContain('class ');
        expect(result).toContain('self.when(:flag_clicked)');
    });
});
