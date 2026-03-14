import RubyGenerator from '../../../../../src/lib/ruby-generator';

describe('RubyGenerator/Class (v1)', () => {
    beforeEach(() => {
        RubyGenerator.init({version: '1'});
        RubyGenerator.definitions_ = {};
        RubyGenerator.requires_ = {};
        RubyGenerator.prepares_ = {};
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

    test('stage without @ruby:class in version 1 uses Stage.new format', () => {
        const {target} = makeMockStageTarget();
        RubyGenerator.currentTarget_ = target;
        RubyGenerator.cache_.targetCommentTexts = [];

        const code = 'self.when(:flag_clicked) do\n  switch_backdrop("Arctic")\nend\n';
        const result = RubyGenerator.finish(code, {withSpriteNew: true});

        expect(result).toContain('Stage.new');
        expect(result).not.toContain('class Stage');
    });

    describe('withSpriteNew (version 1 file output)', () => {
        test('@ruby:class with withSpriteNew uses Sprite.new instead of class', () => {
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
    });
});
