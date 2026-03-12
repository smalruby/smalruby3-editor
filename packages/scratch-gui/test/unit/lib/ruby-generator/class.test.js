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

    describe('set_sprite/set_costumes/set_sounds generation', () => {
        test('@ruby:class:sprite=Dog1 outputs set_sprite "Dog1"', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.sprite.costumes = [{name: 'Dog1-a'}, {name: 'Dog1-b'}];
            target.sprite.sounds = [{name: 'Dog1'}];
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:sprite=Dog1'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_sprite "Dog1"');
            expect(result).not.toContain('set_costumes');
            expect(result).not.toContain('set_sounds');
        });

        test('@ruby:class:sprite=Dog1,x outputs set_sprite and set_x', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.x = 100;
            target.y = 0;
            target.direction = 90;
            target.visible = true;
            target.size = 100;
            target.currentCostume = 0;
            target.rotationStyle = 'all around';
            target.sprite.costumes = [{name: 'Dog1-a'}];
            target.sprite.sounds = [{name: 'Dog1'}];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:sprite=Dog1,x'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_sprite "Dog1"');
            expect(result).toContain('set_x 100');
        });

        test('@ruby:class:costumes outputs set_costumes with array', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.sprite.costumes = [{name: 'Dog1-a'}, {name: 'Dog1-b'}];
            target.sprite.sounds = [];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:costumes'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_costumes ["Dog1-a", "Dog1-b"]');
            expect(result).not.toContain('set_sprite');
        });

        test('@ruby:class:sounds outputs set_sounds with array', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.sprite.costumes = [];
            target.sprite.sounds = [{name: 'Dog1'}, {name: 'Dog2'}];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:sounds'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_sounds ["Dog1", "Dog2"]');
            expect(result).not.toContain('set_sprite');
        });

        test('@ruby:class:costumes,sounds outputs both', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.sprite.costumes = [{name: 'Dog1-a'}, {name: 'Dog1-b'}];
            target.sprite.sounds = [{name: 'Dog1'}, {name: 'Dog2'}];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:costumes,sounds'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_costumes ["Dog1-a", "Dog1-b"]');
            expect(result).toContain('set_sounds ["Dog1", "Dog2"]');
        });

        test('@ruby:class without sprite/costumes/sounds does not output them', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            target.sprite.costumes = [{name: 'Dog1-a'}];
            target.sprite.sounds = [{name: 'Dog1'}];
            target.variables = {};
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).not.toContain('set_sprite');
            expect(result).not.toContain('set_costumes');
            expect(result).not.toContain('set_sounds');
        });
    });

    describe('top-level code outside class (version 2 file output)', () => {
        test('non-hat code after class end is commented out in version 2 file output', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            // hat code + non-hat code (separated by blank line as in real output)
            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n\nmove(10)\n';
            const result = RubyGenerator.finish(code, {withSpriteNew: true});

            expect(result).toContain('class Sprite1');
            // hat code should be inside class
            expect(result).toContain('  self.when(:flag_clicked) do');
            // non-hat code should be outside class and commented out
            expect(result).toMatch(/^# move\(10\)$/m);
        });

        test('non-hat code is not commented out in Ruby tab (no withSpriteNew)', () => {
            const {target, runtime} = makeMockTarget('Sprite1', 1);
            target.runtime = runtime;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const code = 'self.when(:flag_clicked) do\n  move(10)\nend\n\nmove(10)\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Sprite1');
            // In Ruby tab (no withSpriteNew), non-hat code should be inside class, not commented
            expect(result).toContain('  move(10)');
            expect(result).not.toMatch(/^# move\(10\)$/m);
        });
    });

    describe('class Stage generation', () => {
        const makeMockStageTarget = () => {
            const stage = {
                isStage: true,
                sprite: {name: 'Stage', costumes: [], sounds: []},
                currentCostume: 0,
                variables: {}
            };
            const runtime = {targets: [stage]};
            stage.runtime = runtime;
            return {target: stage, runtime};
        };

        test('@ruby:class on stage wraps code with class Stage', () => {
            const {target} = makeMockStageTarget();
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Stage');
            expect(result).not.toContain('class Sprite');
            expect(result).not.toContain('# @ruby:class');
        });

        test('@ruby:class:current_backdrop outputs set_current_backdrop', () => {
            const {target} = makeMockStageTarget();
            target.currentCostume = 2;
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:current_backdrop'];

            const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Stage');
            expect(result).toContain('set_current_backdrop 2');
            expect(result).not.toContain('set_current_costume');
        });

        test('@ruby:class:backdrops outputs set_backdrops with array', () => {
            const {target} = makeMockStageTarget();
            target.sprite.costumes = [{name: 'Arctic'}, {name: 'Baseball 1'}];
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:backdrops'];

            const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Stage');
            expect(result).toContain('set_backdrops ["Arctic", "Baseball 1"]');
            expect(result).not.toContain('set_costumes');
        });

        test('@ruby:class:sounds outputs set_sounds for stage', () => {
            const {target} = makeMockStageTarget();
            target.sprite.sounds = [{name: 'Dog1'}, {name: 'Dog2'}];
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:sounds'];

            const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Stage');
            expect(result).toContain('set_sounds ["Dog1", "Dog2"]');
        });

        test('@ruby:class:backdrops,sounds outputs both for stage', () => {
            const {target} = makeMockStageTarget();
            target.sprite.costumes = [{name: 'Arctic'}, {name: 'Baseball 1'}];
            target.sprite.sounds = [{name: 'Dog1'}];
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:backdrops,sounds'];

            const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('set_backdrops ["Arctic", "Baseball 1"]');
            expect(result).toContain('set_sounds ["Dog1"]');
        });

        test('@ruby:class:name outputs set_name for stage', () => {
            const {target} = makeMockStageTarget();
            target.sprite.name = 'ステージ';
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:name'];

            const code = '';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Stage');
            expect(result).toContain('set_name "ステージ"');
        });

        test('@ruby:class without attributes produces no set_xxx for stage', () => {
            const {target} = makeMockStageTarget();
            target.currentCostume = 2;
            target.sprite.costumes = [{name: 'Arctic'}];
            target.sprite.sounds = [{name: 'Dog1'}];
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class'];

            const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
            const result = RubyGenerator.finish(code, {});

            expect(result).toContain('class Stage');
            expect(result).not.toContain('set_current_backdrop');
            expect(result).not.toContain('set_backdrops');
            expect(result).not.toContain('set_sounds');
            expect(result).not.toContain('set_name');
        });

        test('stage without @ruby:class and withSpriteNew auto-wraps with class Stage in version 2', () => {
            RubyGenerator.init({version: '2'});
            const {target} = makeMockStageTarget();
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = [];

            const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
            const result = RubyGenerator.finish(code, {withSpriteNew: true});

            expect(result).toContain('class Stage');
            expect(result).not.toContain('Stage.new');
        });

        test('stage without @ruby:class in version 1 uses Stage.new format', () => {
            RubyGenerator.init({version: '1'});
            const {target} = makeMockStageTarget();
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = [];

            const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
            const result = RubyGenerator.finish(code, {withSpriteNew: true});

            expect(result).toContain('Stage.new');
            expect(result).not.toContain('class Stage');
        });

        test('@ruby:class with withSpriteNew keeps version 2 hat blocks inside class', () => {
            RubyGenerator.init({version: '2'});
            const {target} = makeMockStageTarget();
            target.sprite.costumes = [{name: 'Arctic'}, {name: 'Baseball 1'}];
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = ['@ruby:class:backdrops'];

            const code = 'when_flag_clicked do\n  broadcast("message1")\nend\n';
            const result = RubyGenerator.finish(code, {withSpriteNew: true});

            expect(result).toContain('class Stage');
            expect(result).toContain('  when_flag_clicked do');
            expect(result).toContain('    broadcast("message1")');
            expect(result).not.toContain('# when_flag_clicked');
        });

        test('empty stage code auto-wraps with class Stage in version 2', () => {
            RubyGenerator.init({version: '2'});
            const {target} = makeMockStageTarget();
            RubyGenerator.currentTarget_ = target;
            RubyGenerator.cache_.targetCommentTexts = [];

            const result = RubyGenerator.finish('', {withSpriteNew: true});

            // Empty stage should not produce any output
            expect(result).toEqual('');
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
