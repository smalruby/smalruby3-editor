import { generatePreviewCode } from '../../../src/lib/ruby-script-preview';
import {
    makeSpriteTarget,
    makeStageTarget,
    setupRubyGenerator,
    makeConverter,
} from '../helpers/ruby-roundtrip-helper';

/**
 * Add sprite/costume properties that RubyGenerator._wrapWithClass and
 * spriteNew need when generating with withSpriteNew: true.
 */
const enrichTarget = (target, name = 'Sprite1') => {
    target.sprite = target.sprite || {
        name,
        costumes: [{ name: 'costume1', md5ext: 'abc.svg', dataFormat: 'svg' }],
        sounds: [],
    };
    target.currentCostume = target.currentCostume || 0;
    target.x = target.x || 0;
    target.y = target.y || 0;
    target.direction = target.direction || 90;
    target.visible = target.visible !== undefined ? target.visible : true;
    target.size = target.size || 100;
    target.rotationStyle = target.rotationStyle || 'all around';
    target.getName = target.getName || (() => name);
    return target;
};

/**
 * Create a global list variable on the given (stage) target.
 */
const addGlobalList = (target, name) => {
    const id = `list-${name}`;
    target.createVariable(id, name, 'list');
    return id;
};

describe('generatePreviewCode', () => {
    beforeEach(() => {
        setupRubyGenerator();
    });

    test('returns empty string when target is null', () => {
        expect(generatePreviewCode(null, '2')).toBe('');
    });

    test('generates code with require and class for a sprite target (version 2)', async () => {
        const { target, runtime } = makeSpriteTarget();
        enrichTarget(target, 'Sprite1');
        const converter = makeConverter(target, runtime, { version: '2' });
        const rubyCode = 'self.when(:flag_clicked) { move(10) }';
        await converter.targetCodeToBlocks(target, rubyCode);
        await converter.applyTargetBlocks(target);

        const code = generatePreviewCode(target, '2');

        expect(code).toMatch(/^require "smalruby3"/);
        expect(code).toMatch(/class Sprite1 < ::Smalruby3::Sprite/);
        expect(code).toMatch(/move\s*\(\s*10\s*\)/);
    });

    test('generates code with require and class for a stage target (version 2)', async () => {
        const { target, runtime } = makeStageTarget();
        enrichTarget(target, 'Stage');
        target.sprite.name = 'Stage';
        const converter = makeConverter(target, runtime, { version: '2' });
        const rubyCode = 'self.when(:flag_clicked) { bounce_if_on_edge }';
        await converter.targetCodeToBlocks(target, rubyCode);
        await converter.applyTargetBlocks(target);

        const code = generatePreviewCode(target, '2');

        expect(code).toMatch(/^require "smalruby3"/);
        expect(code).toMatch(/class Stage/);
    });

    test('generates code with Sprite.new for version 1', async () => {
        const { target, runtime } = makeSpriteTarget();
        enrichTarget(target, 'Sprite1');
        const converter = makeConverter(target, runtime, { version: '1' });
        const rubyCode = 'self.when(:flag_clicked) { move(10) }';
        await converter.targetCodeToBlocks(target, rubyCode);
        await converter.applyTargetBlocks(target);

        const code = generatePreviewCode(target, '1');

        expect(code).toMatch(/^require "smalruby3"/);
        expect(code).toMatch(/Sprite\.new/);
    });

    // Issue #827: include the stage so global lists/variables created as
    // "for all sprites" get initialized, even when only one sprite is sent.
    test('includes the stage that initializes a global list when editing a sprite (version 2)', async () => {
        const { target, stage, runtime } = makeSpriteTarget();
        enrichTarget(target, 'Player1');
        enrichTarget(stage, 'Stage');
        stage.sprite.name = 'Stage';
        addGlobalList(stage, '最短経路');

        const converter = makeConverter(target, runtime, { version: '2' });
        const rubyCode = 'self.when(:flag_clicked) { move(10) }';
        await converter.targetCodeToBlocks(target, rubyCode);
        await converter.applyTargetBlocks(target);

        const code = generatePreviewCode(target, '2');

        // Stage must come first and initialize the global list.
        expect(code).toMatch(/class Stage/);
        expect(code).toMatch(/\$最短経路 = \[\]/);
        expect(code).toMatch(/class Player1 < ::Smalruby3::Sprite/);
        expect(code.indexOf('class Stage')).toBeLessThan(code.indexOf('class Player1'));
    });

    test('includes the stage that initializes a global list when editing a sprite (version 1)', async () => {
        const { target, stage, runtime } = makeSpriteTarget();
        enrichTarget(target, 'Player1');
        enrichTarget(stage, 'Stage');
        stage.sprite.name = 'Stage';
        addGlobalList(stage, '最短経路');

        const converter = makeConverter(target, runtime, { version: '1' });
        const rubyCode = 'self.when(:flag_clicked) { move(10) }';
        await converter.targetCodeToBlocks(target, rubyCode);
        await converter.applyTargetBlocks(target);

        const code = generatePreviewCode(target, '1');

        expect(code).toMatch(/Stage\.new\(/);
        expect(code).toMatch(/lists:/);
        expect(code).toMatch(/最短経路/);
        expect(code).toMatch(/Sprite\.new/);
    });

    // Issue #827 bug: v2 stage with no scripts but a global list must still
    // emit `class Stage` + `def initialize` to initialize the global list.
    test('emits class Stage with initialize for a scriptless stage holding a global list (version 2)', () => {
        const { target: stage } = makeStageTarget();
        enrichTarget(stage, 'Stage');
        stage.sprite.name = 'Stage';
        addGlobalList(stage, '最短経路');

        const code = generatePreviewCode(stage, '2');

        expect(code).toMatch(/^require "smalruby3"/);
        expect(code).toMatch(/class Stage/);
        expect(code).toMatch(/def initialize/);
        expect(code).toMatch(/\$最短経路 = \[\]/);
    });

    test('does not emit class Stage for a scriptless stage with no variables (version 2)', () => {
        const { target: stage } = makeStageTarget();
        enrichTarget(stage, 'Stage');
        stage.sprite.name = 'Stage';

        const code = generatePreviewCode(stage, '2');

        expect(code).not.toMatch(/class Stage/);
    });
});
