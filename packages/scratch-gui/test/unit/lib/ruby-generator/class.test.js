import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator/Class', () => {
    beforeEach(() => {
        RubyGenerator.init({version: '2'});
        RubyGenerator.definitions_ = {};
        RubyGenerator.requires_ = {};
        RubyGenerator.prepares_ = {};
        // Reset cache
        RubyGenerator.cache_ = {
            targetCommentTexts: [],
            comments: {}
        };
    });

    const makeMockTarget = (name, index = 1) => {
        const targets = [];
        const stage = {isStage: true};
        for (let i = 0; i < index; i++) {
            targets.push({isStage: false, sprite: {name: `OtherSprite${i + 1}`}});
        }
        const target = targets[index - 1];
        target.sprite = {name: name};
        targets.unshift(stage);
        return {
            target,
            runtime: {targets}
        };
    };

    describe('@ruby:class comment wrapping', () => {
        test('@ruby:class wraps code with class Sprite%index%', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Sprite1');
            expect(result).toContain('end\n');
            expect(result).toContain('  self.when(:flag_clicked) do');
            // Should NOT output @ruby:class as a comment line
            expect(result).not.toContain('# @ruby:class');
        });

        test('@ruby:class:name wraps code with class using sprite name (uppercase start)', () => {
            const {target, runtime} = makeMockTarget('Cat', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Cat');
            expect(result).not.toContain('set_name');
            expect(result).not.toContain('# @ruby:class');
        });

        test('@ruby:class:name with non-uppercase sprite name generates set_name', () => {
            const {target, runtime} = makeMockTarget('ネコ', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Sprite1');
            expect(result).toContain('set_name "ネコ"');
            expect(result).not.toContain('# @ruby:class');
        });

        test('@ruby:class:name with sprite at index 2', () => {
            // Create a runtime with multiple sprites
            const stage = {isStage: true};
            const sprite1 = {isStage: false, sprite: {name: 'Sprite1'}};
            const sprite2 = {isStage: false, sprite: {name: 'ネコ'}};
            const targets = [stage, sprite1, sprite2];
            sprite2.runtime = {targets};
            RubyGenerator.currentTarget_ = sprite2;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Sprite2');
            expect(result).toContain('set_name "ネコ"');
        });

        test('@ruby:class:name=Cat with different sprite name generates set_name', () => {
            const {target, runtime} = makeMockTarget('ネコ', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name=Cat'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Cat');
            expect(result).not.toContain('class Sprite1');
            // When class name (Cat) differs from sprite name (ネコ), set_name should be generated
            expect(result).toContain('set_name "ネコ"');
            expect(result).not.toContain('# @ruby:class');
        });

        test('@ruby:class:name=Cat with same sprite name does not generate set_name', () => {
            const {target, runtime} = makeMockTarget('Cat', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name=Cat'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Cat');
            expect(result).not.toContain('set_name');
        });

        test('@ruby:class:name=Cat,x,y uses Cat and generates set_xxx', () => {
            const {target, runtime} = makeMockTarget('ネコ', 1);
            target.runtime = runtime;
            target.x = 100;
            target.y = -50;
            target.direction = 180;
            target.visible = true;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name=Cat,x,y'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Cat');
            expect(result).toContain('set_name "ネコ"');
            expect(result).toContain('set_x 100');
            expect(result).toContain('set_y -50');
            expect(result).not.toContain('set_direction');
        });

        test('no @ruby:class comment does not wrap with class', () => {
            RubyGenerator.cache_.targetCommentTexts = [];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).not.toContain('class ');
        });

        test('@ruby:class with empty code', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const result = RubyGenerator.finish('', {});

            expect(result).toContain('class Sprite1');
            expect(result).toContain('end');
        });

        test('other target comments are preserved alongside @ruby:class', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class', 'some user comment'];

            const code = 'move(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Sprite1');
            // Other comments should be inside the class
            expect(result).toContain('# some user comment');
            expect(result).not.toContain('# @ruby:class');
        });
    });

    describe('set_xxx method generation', () => {
        test('@ruby:class:x,y outputs only set_x and set_y', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 100;
            target.y = -50;
            target.direction = 180;
            target.visible = false;
            target.size = 50;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:x,y'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_x 100');
            expect(result).toContain('set_y -50');
            expect(result).not.toContain('set_direction');
            expect(result).not.toContain('set_visible');
            expect(result).not.toContain('set_size');
        });

        test('@ruby:class:direction outputs only set_direction', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 100;
            target.y = -50;
            target.direction = 180;
            target.visible = true;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:direction'];

            const code = 'move(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_direction 180');
            expect(result).not.toContain('set_x');
            expect(result).not.toContain('set_y');
        });

        test('@ruby:class:visible outputs set_visible', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 100;
            target.y = -50;
            target.direction = 90;
            target.visible = false;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:visible'];

            const code = 'move(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_visible false');
            expect(result).not.toContain('set_x');
            expect(result).not.toContain('set_y');
        });

        test('@ruby:class:size outputs set_size', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 0;
            target.y = 0;
            target.direction = 90;
            target.visible = true;
            target.size = 50;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:size'];

            const code = 'move(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_size 50');
        });

        test('@ruby:class:rotation_style outputs set_rotation_style', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 0;
            target.y = 0;
            target.direction = 90;
            target.visible = true;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'left-right';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:rotation_style'];

            const code = 'move(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_rotation_style "left-right"');
        });

        test('@ruby:class without attributes produces no set_xxx even with non-default values', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 100;
            target.y = -50;
            target.direction = 180;
            target.visible = false;
            target.size = 50;
            target.currentCostume = 2;
            target.rotationStyle = 'left-right';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const code = 'move(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Sprite1');
            expect(result).not.toContain('set_x');
            expect(result).not.toContain('set_y');
            expect(result).not.toContain('set_direction');
            expect(result).not.toContain('set_visible');
            expect(result).not.toContain('set_size');
            expect(result).not.toContain('set_current_costume');
            expect(result).not.toContain('set_rotation_style');
        });

        test('@ruby:class:x,y,direction outputs only listed attributes', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 100;
            target.y = -50;
            target.direction = 180;
            target.visible = false;
            target.size = 50;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:x,y,direction'];

            const code = 'move(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_x 100');
            expect(result).toContain('set_y -50');
            expect(result).toContain('set_direction 180');
            expect(result).not.toContain('set_visible');
            expect(result).not.toContain('set_size');
        });

        test('@ruby:class:name,x,y outputs set_name, set_x, set_y', () => {
            const {target, runtime} = makeMockTarget('ネコ', 1);
            target.runtime = runtime;
            target.x = 100;
            target.y = -50;
            target.direction = 180;
            target.visible = true;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name,x,y'];

            const code = 'move(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Sprite1');
            expect(result).toContain('set_name "ネコ"');
            expect(result).toContain('set_x 100');
            expect(result).toContain('set_y -50');
            expect(result).not.toContain('set_direction');
        });
    });

    describe('withSpriteNew (version 1 file output)', () => {
        test('@ruby:class with withSpriteNew uses Sprite.new instead of class', () => {
            RubyGenerator.init({version: '1'});
            const {target, runtime} = makeMockTarget('ネコ', 1);
            target.runtime = runtime;
            target.x = 90;
            target.y = -50;
            target.direction = 45;
            target.visible = true;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.isStage = false;
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name,x,y,direction'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {withSpriteNew: true, version: '1'});

            expect(result).toContain('Sprite.new("ネコ"');
            expect(result).toContain('x: 90');
            expect(result).toContain('y: -50');
            expect(result).toContain('direction: 45');
            expect(result).not.toContain('class ');
            expect(result).not.toContain('set_name');
            expect(result).not.toContain('set_x');
        });

        test('@ruby:class without attributes and withSpriteNew uses Sprite.new with defaults', () => {
            RubyGenerator.init({version: '1'});
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 0;
            target.y = 0;
            target.direction = 90;
            target.visible = true;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.isStage = false;
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {withSpriteNew: true, version: '1'});

            expect(result).toContain('Sprite.new("Sprite1")');
            expect(result).not.toContain('class ');
        });

        test('@ruby:class with version 2 still uses class format even with withSpriteNew', () => {
            RubyGenerator.init({version: '2'});
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 0;
            target.y = 0;
            target.direction = 90;
            target.visible = true;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.isStage = false;
            target.sprite.costumes = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {withSpriteNew: true, version: '2'});

            expect(result).toContain('class Sprite1');
            expect(result).not.toContain('Sprite.new');
        });
    });
});
