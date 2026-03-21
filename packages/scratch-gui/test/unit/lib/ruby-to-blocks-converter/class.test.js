import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected
} from '../../../helpers/expect-to-equal-blocks';
import {
    makeSpriteTarget,
    makeStageTarget,
    makeConverter
} from '../../helpers/ruby-roundtrip-helper';

describe('RubyToBlocksConverter/Class', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
        expected = null;
    });

    describe('basic class syntax', () => {
        test('class Sprite1 with when_flag_clicked', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            // @ruby:class comment should be created with blockId=null
            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class');
        });

        test('class with multiple event handlers', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end

                  when_key_pressed("space") do
                    move(20)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end

                when_key_pressed("space") do
                  move(20)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class');
        });

        test('class with top-level statements outside', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end
                end

                bounce_if_on_edge
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end

                bounce_if_on_edge
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class');
        });

        test('empty class', async () => {
            code = `
                class Sprite1
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class');
        });

        test('class with superclass < ::Smalruby3::Sprite preserves superclass in comment', async () => {
            code = `
                class Sprite1 < ::Smalruby3::Sprite
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:<=//Smalruby3/Sprite');
        });

        test('class with superclass < Smalruby3::Sprite preserves superclass in comment', async () => {
            code = `
                class Sprite1 < Smalruby3::Sprite
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:<=Smalruby3/Sprite');
        });

        test('class with superclass < Sprite preserves superclass in comment', async () => {
            code = `
                class Sprite1 < Sprite
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:<=Sprite');
        });

        test('class with superclass < Foo preserves superclass in comment', async () => {
            code = `
                class Sprite1 < Foo
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:<=Foo');
        });

        test('class without superclass has no <= in comment', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class');
        });

    });

    describe('class name and set_name', () => {
        test('class Cat changes sprite name and generates @ruby:class:name=Cat', async () => {
            code = `
                class Cat
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            // @ruby:class:name=Cat comment should be created
            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:name=Cat');

            // classInfo should record the new name
            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('Cat');
        });

        test('class Sprite1 with set_name changes sprite name and generates @ruby:class:name', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                when_flag_clicked do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            // @ruby:class:name comment should be created
            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:name');

            // classInfo should record the set_name value
            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('ネコ');
        });

        test('set_name is not converted to blocks', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // set_name should not create any blocks
            const blocks = converter.blocks;
            const blockOpcodes = Object.values(blocks).map(b => b.opcode);
            expect(blockOpcodes).not.toContain('ruby_statement');
        });

        test('class Sprite1 without set_name generates @ruby:class', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // Should be @ruby:class (not @ruby:class:name) since class name matches Sprite%d% pattern
            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class');
        });
    });

    describe('set_xxx class methods', () => {
        test('set_x, set_y, set_direction are stored in classInfo', async () => {
            code = `
                class Sprite1
                  set_x 100
                  set_y -50
                  set_direction 180

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.x).toEqual(100);
            expect(converter._context.classInfo.y).toEqual(-50);
            expect(converter._context.classInfo.direction).toEqual(180);

            // Comment should list the attributes
            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:x,y,direction');
        });

        test('set_visible false is stored in classInfo', async () => {
            code = `
                class Sprite1
                  set_visible false

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.visible).toEqual(false);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:visible');
        });

        test('set_size and set_current_costume are stored in classInfo', async () => {
            code = `
                class Sprite1
                  set_size 50
                  set_current_costume 2

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.size).toEqual(50);
            expect(converter._context.classInfo.current_costume).toEqual(2);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:size,current_costume');
        });

        test('set_rotation_style is stored in classInfo', async () => {
            code = `
                class Sprite1
                  set_rotation_style "left-right"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.rotation_style).toEqual('left-right');

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:rotation_style');
        });

        test('set_xxx methods are not converted to blocks', async () => {
            code = `
                class Sprite1
                  set_x 100
                  set_y -50
                  set_direction 180
                  set_visible false
                  set_size 50
                  set_current_costume 2
                  set_rotation_style "left-right"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // set_xxx should not create ruby_statement blocks
            const blocks = converter.blocks;
            const blockOpcodes = Object.values(blocks).map(b => b.opcode);
            expect(blockOpcodes).not.toContain('ruby_statement');
        });

        test('class Cat with set_x generates @ruby:class:name=Cat,x', async () => {
            code = `
                class Cat
                  set_x 100

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:name=Cat,x');

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('Cat');
            expect(converter._context.classInfo.x).toEqual(100);
        });

        test('class Sprite1 with set_name and set_x generates @ruby:class:name,x', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"
                  set_x 100

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:name,x');

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('ネコ');
            expect(converter._context.classInfo.x).toEqual(100);
        });

        test('class Cat with set_name generates @ruby:class:name=Cat', async () => {
            code = `
                class Cat
                  set_name "ネコ"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // name=Cat preserves class name; set_name value is in classInfo.name
            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:name=Cat');

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('ネコ');
        });

        test('class Cat without set_name generates @ruby:class:name=Cat', async () => {
            code = `
                class Cat
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:name=Cat');

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('Cat');
        });

        test('class Sprite1 with set_name still generates @ruby:class:name (no name=)', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            // Sprite\d+ pattern should NOT have name= prefix
            expect(targetComments[0].text).toEqual('@ruby:class:name');
        });

        test('class Cat with set_x generates @ruby:class:name=Cat,x', async () => {
            code = `
                class Cat
                  set_x 100

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:name=Cat,x');

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('Cat');
            expect(converter._context.classInfo.x).toEqual(100);
        });

        test('set_xxx without class generates error', async () => {
            code = `
                set_x 100
                when_flag_clicked do
                  move(10)
                end
            `;
            // set_x outside class should be treated as unknown call
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('class with only set_name converts without error', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('ネコ');
        });

        test('class with only set_x and set_y converts without error', async () => {
            code = `
                class Sprite1
                  set_x 100
                  set_y -50
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.x).toEqual(100);
            expect(converter._context.classInfo.y).toEqual(-50);
        });

        test('class with all set_xxx only converts without error', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"
                  set_x 100
                  set_y -50
                  set_direction 180
                  set_visible false
                  set_size 50
                  set_current_costume 2
                  set_rotation_style "left-right"
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('ネコ');
            expect(converter._context.classInfo.x).toEqual(100);
            expect(converter._context.classInfo.y).toEqual(-50);
            expect(converter._context.classInfo.direction).toEqual(180);
            expect(converter._context.classInfo.visible).toEqual(false);
            expect(converter._context.classInfo.size).toEqual(50);
            expect(converter._context.classInfo.current_costume).toEqual(2);
            expect(converter._context.classInfo.rotation_style).toEqual('left-right');
        });
    });

    describe('set_sprite, set_costumes, set_sounds', () => {
        test('set_sprite stores sprite name in classInfo', async () => {
            code = `
                class Sprite1
                  set_sprite "Dog1"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.sprite).toEqual('Dog1');

            // Comment should use sprite=Dog1 format
            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:sprite=Dog1');
        });

        test('set_costumes stores array in classInfo', async () => {
            code = `
                class Sprite1
                  set_costumes ["Dog1-a", "Dog1-b"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.costumes).toEqual(['Dog1-a', 'Dog1-b']);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:costumes');
        });

        test('set_sounds stores array in classInfo', async () => {
            code = `
                class Sprite1
                  set_sounds ["Dog1", "Dog2"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.sounds).toEqual(['Dog1', 'Dog2']);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:sounds');
        });

        test('set_costumes and set_sounds together', async () => {
            code = `
                class Sprite1
                  set_costumes ["Dog1-a", "Dog1-b"]
                  set_sounds ["Dog1", "Dog2"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.costumes).toEqual(['Dog1-a', 'Dog1-b']);
            expect(converter._context.classInfo.sounds).toEqual(['Dog1', 'Dog2']);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:costumes,sounds');
        });

        test('set_sprite with set_x generates sprite=Dog1,x in comment', async () => {
            code = `
                class Sprite1
                  set_sprite "Dog1"
                  set_x 100

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            expect(converter._context.classInfo.sprite).toEqual('Dog1');
            expect(converter._context.classInfo.x).toEqual(100);

            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:sprite=Dog1,x');
        });

        test('set_sprite and set_costumes together is an error (mutual exclusion)', async () => {
            code = `
                class Sprite1
                  set_sprite "Dog1"
                  set_costumes ["Dog1-a", "Dog1-b"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('set_sprite and set_sounds together is an error (mutual exclusion)', async () => {
            code = `
                class Sprite1
                  set_sprite "Dog1"
                  set_sounds ["Dog1", "Dog2"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('set_sprite with invalid sprite name is an error', async () => {
            code = `
                class Sprite1
                  set_sprite "NonExistentSprite999"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('set_costumes with invalid costume name is an error', async () => {
            code = `
                class Sprite1
                  set_costumes ["Dog1-a", "NonExistentCostume999"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('set_sounds with invalid sound name is an error', async () => {
            code = `
                class Sprite1
                  set_sounds ["Dog1", "NonExistentSound999"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('set_sprite is not converted to blocks', async () => {
            code = `
                class Sprite1
                  set_sprite "Dog1"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blocks = converter.blocks;
            const blockOpcodes = Object.values(blocks).map(b => b.opcode);
            expect(blockOpcodes).not.toContain('ruby_statement');
        });

        test('set_costumes is not converted to blocks', async () => {
            code = `
                class Sprite1
                  set_costumes ["Dog1-a", "Dog1-b"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blocks = converter.blocks;
            const blockOpcodes = Object.values(blocks).map(b => b.opcode);
            expect(blockOpcodes).not.toContain('ruby_statement');
        });

        test('set_sounds is not converted to blocks', async () => {
            code = `
                class Sprite1
                  set_sounds ["Dog1", "Dog2"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blocks = converter.blocks;
            const blockOpcodes = Object.values(blocks).map(b => b.opcode);
            expect(blockOpcodes).not.toContain('ruby_statement');
        });

        test('set_sprite outside class generates error', async () => {
            code = `
                set_sprite "Dog1"
                when_flag_clicked do
                  move(10)
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('set_costumes outside class generates error', async () => {
            code = `
                set_costumes ["Dog1-a", "Dog1-b"]
                when_flag_clicked do
                  move(10)
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('set_sounds outside class generates error', async () => {
            code = `
                set_sounds ["Dog1", "Dog2"]
                when_flag_clicked do
                  move(10)
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });
    });

    describe('class body validation', () => {
        test('value block inside class generates error', async () => {
            code = `
                class Sprite1
                  1 + 2
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('non-hat statement block inside class generates error', async () => {
            code = `
                class Sprite1
                  move(10)
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('error message reports the specific statement, not the class', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end
                  move(10)
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            const errorText = converter.errors[0].text;
            // The error part (before \n hint) should not contain newlines from source
            const errorPart = errorText.split('\n')[0];
            expect(errorPart).not.toMatch(/\n/);
            expect(errorText).toMatch(/move\(10\)/);
            expect(errorText).not.toMatch(/class Sprite1/);
            expect(errorText).toMatch(/class definition/);
        });

        test('hat block inside class is allowed', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });

        test('def (procedures_definition) inside class is allowed', async () => {
            code = `
                class Sprite1
                  def func
                    move(10)
                  end

                  when_flag_clicked do
                    func
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });

        test('hat block with non-hat statement after it inside class is allowed', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                    bounce_if_on_edge
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('applyTargetBlocks applies classInfo to target', () => {
        let spriteTarget, runtime, vmConverter;

        beforeEach(() => {
            ({target: spriteTarget, runtime} = makeSpriteTarget());
            spriteTarget.sprite = {name: 'スプライト1', costumes: []};
            vmConverter = makeConverter(spriteTarget, runtime, {version: '2'});
        });

        test('class Sprite1 applies sprite name Sprite1', async () => {
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            // Sprite name should remain 'スプライト1' because class Sprite1 has no name attribute
            // (Sprite1 matches Sprite%d% pattern, so no name change)
            expect(spriteTarget.sprite.name).toEqual('スプライト1');
        });

        test('class Cat applies sprite name Cat', async () => {
            code = `
                class Cat
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.sprite.name).toEqual('Cat');
        });

        test('set_name applies sprite name', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.sprite.name).toEqual('ネコ');
        });

        test('set_x and set_y apply to target', async () => {
            code = `
                class Sprite1
                  set_x 100
                  set_y -50

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.x).toEqual(100);
            expect(spriteTarget.y).toEqual(-50);
        });

        test('set_direction applies to target', async () => {
            code = `
                class Sprite1
                  set_direction 180

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.direction).toEqual(180);
        });

        test('set_visible false applies to target', async () => {
            spriteTarget.visible = true;
            code = `
                class Sprite1
                  set_visible false

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.visible).toEqual(false);
        });

        test('set_size applies to target', async () => {
            code = `
                class Sprite1
                  set_size 50

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.size).toEqual(50);
        });

        test('set_rotation_style applies to target', async () => {
            code = `
                class Sprite1
                  set_rotation_style "left-right"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.rotationStyle).toEqual('left-right');
        });

        test('set_current_costume applies to target', async () => {
            code = `
                class Sprite1
                  set_current_costume 2

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.currentCostume).toEqual(1);
        });

        test('set_sprite replaces costumes and sounds from sprite library', async () => {
            spriteTarget.sprite.costumes = [{name: 'old-costume', assetId: 'old', md5ext: 'old.svg'}];
            spriteTarget.sprite.sounds = [{name: 'old-sound', assetId: 'old', md5ext: 'old.wav'}];
            code = `
                class Sprite1
                  set_sprite "Dog1"

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            // Costumes and sounds should be replaced with Dog1's library data
            expect(spriteTarget.sprite.costumes.length).toBeGreaterThan(0);
            expect(spriteTarget.sprite.costumes[0].name).not.toEqual('old-costume');
            expect(spriteTarget.sprite.sounds.length).toBeGreaterThan(0);
            expect(spriteTarget.sprite.sounds[0].name).not.toEqual('old-sound');
        });

        test('set_costumes replaces costumes from costume library', async () => {
            spriteTarget.sprite.costumes = [{name: 'old-costume', assetId: 'old', md5ext: 'old.svg'}];
            code = `
                class Sprite1
                  set_costumes ["Dog1-a", "Dog1-b"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.sprite.costumes).toHaveLength(2);
            expect(spriteTarget.sprite.costumes[0].name).toEqual('Dog1-a');
            expect(spriteTarget.sprite.costumes[1].name).toEqual('Dog1-b');
        });

        test('set_sounds replaces sounds from sound library', async () => {
            spriteTarget.sprite.sounds = [{name: 'old-sound', assetId: 'old', md5ext: 'old.wav'}];
            code = `
                class Sprite1
                  set_sounds ["Dog1", "Dog2"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.sprite.sounds).toHaveLength(2);
            expect(spriteTarget.sprite.sounds[0].name).toEqual('Dog1');
            expect(spriteTarget.sprite.sounds[1].name).toEqual('Dog2');
        });

        test('set_costumes and set_sounds together replace both', async () => {
            spriteTarget.sprite.costumes = [{name: 'old-costume'}];
            spriteTarget.sprite.sounds = [{name: 'old-sound'}];
            code = `
                class Sprite1
                  set_costumes ["Dog1-a", "Dog1-b"]
                  set_sounds ["Dog1", "Dog2"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            expect(spriteTarget.sprite.costumes).toHaveLength(2);
            expect(spriteTarget.sprite.costumes[0].name).toEqual('Dog1-a');
            expect(spriteTarget.sprite.sounds).toHaveLength(2);
            expect(spriteTarget.sprite.sounds[0].name).toEqual('Dog1');
        });

        test('class without classInfo does not change target attributes', async () => {
            spriteTarget.x = 10;
            spriteTarget.y = 20;
            code = `
                class Sprite1
                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
            expect(vmConverter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            await vmConverter.applyTargetBlocks(spriteTarget);

            // x and y should remain unchanged
            expect(spriteTarget.x).toEqual(10);
            expect(spriteTarget.y).toEqual(20);
            expect(spriteTarget.sprite.name).toEqual('スプライト1');
        });
    });

    describe('class Stage', () => {
        describe('stage superclass handling', () => {
            test('class Stage < ::Smalruby3::Stage is accepted (no <= in comment)', async () => {
                code = `
                    class Stage < ::Smalruby3::Stage
                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                expected = await rubyToExpected(converter, target, `
                    when_flag_clicked do
                      switch_backdrop("Arctic")
                    end
                `);
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const comments = converter._context.comments;
                const targetComments = Object.values(comments).filter(c => c.blockId === null);
                expect(targetComments).toHaveLength(1);
                expect(targetComments[0].text).toEqual('@ruby:class');
            });

            test('class Stage < Smalruby3::Stage is accepted (no <= in comment)', async () => {
                code = `
                    class Stage < Smalruby3::Stage
                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                expected = await rubyToExpected(converter, target, `
                    when_flag_clicked do
                      switch_backdrop("Arctic")
                    end
                `);
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const comments = converter._context.comments;
                const targetComments = Object.values(comments).filter(c => c.blockId === null);
                expect(targetComments).toHaveLength(1);
                expect(targetComments[0].text).toEqual('@ruby:class');
            });

            test('class Stage < Foo is rejected', async () => {
                code = `
                    class Stage < Foo
                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(res).toBeFalsy();
                expect(converter.errors).toHaveLength(1);
            });
        });

        describe('basic stage class syntax', () => {
            test('class Stage with when_flag_clicked', async () => {
                code = `
                    class Stage
                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                expected = await rubyToExpected(converter, target, `
                    when_flag_clicked do
                      switch_backdrop("Arctic")
                    end
                `);
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const comments = converter._context.comments;
                const targetComments = Object.values(comments).filter(c => c.blockId === null);
                expect(targetComments).toHaveLength(1);
                expect(targetComments[0].text).toEqual('@ruby:class');
            });

            test('empty class Stage', async () => {
                code = `
                    class Stage
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();

                const comments = converter._context.comments;
                const targetComments = Object.values(comments).filter(c => c.blockId === null);
                expect(targetComments).toHaveLength(1);
                expect(targetComments[0].text).toEqual('@ruby:class');
            });
        });

        describe('stage set_xxx methods', () => {
            test('set_current_backdrop stores in classInfo', async () => {
                code = `
                    class Stage
                      set_current_backdrop 1

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();

                expect(converter._context.classInfo).toBeDefined();
                expect(converter._context.classInfo.current_backdrop).toEqual(1);

                const comments = converter._context.comments;
                const targetComments = Object.values(comments).filter(c => c.blockId === null);
                expect(targetComments).toHaveLength(1);
                expect(targetComments[0].text).toEqual('@ruby:class:current_backdrop');
            });

            test('set_backdrops stores array in classInfo', async () => {
                code = `
                    class Stage
                      set_backdrops ["Arctic", "Baseball 1"]

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();

                expect(converter._context.classInfo).toBeDefined();
                expect(converter._context.classInfo.backdrops).toEqual(['Arctic', 'Baseball 1']);

                const comments = converter._context.comments;
                const targetComments = Object.values(comments).filter(c => c.blockId === null);
                expect(targetComments).toHaveLength(1);
                expect(targetComments[0].text).toEqual('@ruby:class:backdrops');
            });

            test('set_sounds stores array in classInfo for stage', async () => {
                code = `
                    class Stage
                      set_sounds ["Dog1", "Dog2"]

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();

                expect(converter._context.classInfo).toBeDefined();
                expect(converter._context.classInfo.sounds).toEqual(['Dog1', 'Dog2']);
            });

            test('set_backdrops and set_sounds together', async () => {
                code = `
                    class Stage
                      set_backdrops ["Arctic", "Baseball 1"]
                      set_sounds ["Dog1", "Dog2"]

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();

                expect(converter._context.classInfo).toBeDefined();
                expect(converter._context.classInfo.backdrops).toEqual(['Arctic', 'Baseball 1']);
                expect(converter._context.classInfo.sounds).toEqual(['Dog1', 'Dog2']);

                const comments = converter._context.comments;
                const targetComments = Object.values(comments).filter(c => c.blockId === null);
                expect(targetComments).toHaveLength(1);
                expect(targetComments[0].text).toEqual('@ruby:class:backdrops,sounds');
            });

            test('set_name is allowed for stage', async () => {
                code = `
                    class Stage
                      set_name "ステージ"

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();

                expect(converter._context.classInfo).toBeDefined();
                expect(converter._context.classInfo.name).toEqual('ステージ');
            });

            test('all stage set_xxx only converts without error', async () => {
                code = `
                    class Stage
                      set_name "ステージ"
                      set_current_backdrop 1
                      set_backdrops ["Arctic", "Baseball 1"]
                      set_sounds ["Dog1", "Dog2"]
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(converter.errors).toHaveLength(0);
                expect(res).toBeTruthy();

                expect(converter._context.classInfo).toBeDefined();
                expect(converter._context.classInfo.name).toEqual('ステージ');
                expect(converter._context.classInfo.current_backdrop).toEqual(1);
                expect(converter._context.classInfo.backdrops).toEqual(['Arctic', 'Baseball 1']);
                expect(converter._context.classInfo.sounds).toEqual(['Dog1', 'Dog2']);
            });
        });

        describe('stage-forbidden methods', () => {
            test('set_x is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_x 100
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_y is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_y -50
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_direction is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_direction 180
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_visible is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_visible false
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_size is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_size 50
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_rotation_style is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_rotation_style "left-right"
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_sprite is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_sprite "Dog1"
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_costumes is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_costumes ["Dog1-a", "Dog1-b"]
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_current_costume is not allowed in class Stage', async () => {
                code = `
                    class Stage
                      set_current_costume 2
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });
        });

        describe('stage-specific methods not allowed in sprite class', () => {
            test('set_current_backdrop is not allowed in sprite class', async () => {
                code = `
                    class Sprite1
                      set_current_backdrop 1
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });

            test('set_backdrops is not allowed in sprite class', async () => {
                code = `
                    class Sprite1
                      set_backdrops ["Arctic", "Baseball 1"]
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });
        });

        describe('backdrop library validation', () => {
            test('set_backdrops with invalid backdrop name is an error', async () => {
                code = `
                    class Stage
                      set_backdrops ["Arctic", "NonExistentBackdrop999"]
                    end
                `;
                await converter.targetCodeToBlocks(target, code);
                expect(converter.errors.length).toBeGreaterThan(0);
            });
        });

        describe('applyTargetBlocks applies stage classInfo', () => {
            let stageTarget, runtime, vmConverter;

            beforeEach(() => {
                ({target: stageTarget, runtime} = makeStageTarget());
                stageTarget.sprite = {name: 'Stage', costumes: []};
                vmConverter = makeConverter(stageTarget, runtime, {version: '2'});
            });

            test('set_name applies to stage', async () => {
                code = `
                    class Stage
                      set_name "ステージ"

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await vmConverter.targetCodeToBlocks(stageTarget, code);
                expect(vmConverter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
                await vmConverter.applyTargetBlocks(stageTarget);

                expect(stageTarget.sprite.name).toEqual('ステージ');
            });

            test('set_current_backdrop applies to stage', async () => {
                code = `
                    class Stage
                      set_current_backdrop 2

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await vmConverter.targetCodeToBlocks(stageTarget, code);
                expect(vmConverter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
                await vmConverter.applyTargetBlocks(stageTarget);

                expect(stageTarget.currentCostume).toEqual(1);
            });

            test('set_backdrops replaces costumes from backdrop library', async () => {
                stageTarget.sprite.costumes = [{name: 'old-backdrop', assetId: 'old', md5ext: 'old.svg'}];
                code = `
                    class Stage
                      set_backdrops ["Arctic", "Baseball 1"]

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await vmConverter.targetCodeToBlocks(stageTarget, code);
                expect(vmConverter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
                await vmConverter.applyTargetBlocks(stageTarget);

                expect(stageTarget.sprite.costumes).toHaveLength(2);
                expect(stageTarget.sprite.costumes[0].name).toEqual('Arctic');
                expect(stageTarget.sprite.costumes[1].name).toEqual('Baseball 1');
            });

            test('set_sounds replaces sounds for stage', async () => {
                stageTarget.sprite.sounds = [{name: 'old-sound', assetId: 'old', md5ext: 'old.wav'}];
                code = `
                    class Stage
                      set_sounds ["Dog1", "Dog2"]

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await vmConverter.targetCodeToBlocks(stageTarget, code);
                expect(vmConverter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
                await vmConverter.applyTargetBlocks(stageTarget);

                expect(stageTarget.sprite.sounds).toHaveLength(2);
                expect(stageTarget.sprite.sounds[0].name).toEqual('Dog1');
                expect(stageTarget.sprite.sounds[1].name).toEqual('Dog2');
            });
        });
    });

    describe('def initialize', () => {
        test('sprite: parses @var = value assignments', async () => {
            code = `
                class Sprite1
                  def initialize
                    @x = 10
                    @name = "hello"
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const iv = converter._context.initializeValues;
            expect(iv).toBeDefined();
            expect(iv.x).toEqual({value: 10, type: ''});
            expect(iv.name).toEqual({value: 'hello', type: ''});
        });

        test('sprite: parses @list = [...] assignments', async () => {
            code = `
                class Sprite1
                  def initialize
                    @items = ["a", "b", "c"]
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const iv = converter._context.initializeValues;
            expect(iv).toBeDefined();
            expect(iv.items).toEqual({value: ['a', 'b', 'c'], type: 'list'});
        });

        test('sprite: parses empty list @list = []', async () => {
            code = `
                class Sprite1
                  def initialize
                    @items = []
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const iv = converter._context.initializeValues;
            expect(iv).toBeDefined();
            expect(iv.items).toEqual({value: [], type: 'list'});
        });

        test('stage: parses $var = value assignments', async () => {
            code = `
                class Stage
                  def initialize
                    $score = 100
                    $title = "game"
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const iv = converter._context.initializeValues;
            expect(iv).toBeDefined();
            expect(iv.score).toEqual({value: 100, type: ''});
            expect(iv.title).toEqual({value: 'game', type: ''});
        });

        test('stage: parses $list = [...] assignments', async () => {
            code = `
                class Stage
                  def initialize
                    $items = [1, 2, 3]
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const iv = converter._context.initializeValues;
            expect(iv).toBeDefined();
            expect(iv.items).toEqual({value: [1, 2, 3], type: 'list'});
        });

        test('sprite: @var in stage class is an error', async () => {
            code = `
                class Stage
                  def initialize
                    @var = 10
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('stage: $var in sprite class is an error', async () => {
            code = `
                class Sprite1
                  def initialize
                    $var = 10
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('invalid statement in initialize is an error', async () => {
            code = `
                class Sprite1
                  def initialize
                    say("hello")
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('arguments are preserved in comment', async () => {
            code = `
                class Sprite1
                  def initialize(x, y)
                    @x = 10
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const initComments = Object.values(comments).filter(c =>
                c.text && c.text.startsWith('@ruby:initialize')
            );
            expect(initComments).toHaveLength(1);
            expect(initComments[0].text).toMatch(/args=/);
            expect(initComments[0].text).toMatch(/x, y/);
        });

        test('super is preserved in comment', async () => {
            code = `
                class Sprite1
                  def initialize
                    super
                    @x = 10
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const initComments = Object.values(comments).filter(c =>
                c.text && c.text.startsWith('@ruby:initialize')
            );
            expect(initComments).toHaveLength(1);
            expect(initComments[0].text).toMatch(/super/);
        });

        test('super with args is preserved in comment', async () => {
            code = `
                class Sprite1
                  def initialize(a)
                    super(a)
                    @x = 10
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const comments = converter._context.comments;
            const initComments = Object.values(comments).filter(c =>
                c.text && c.text.startsWith('@ruby:initialize')
            );
            expect(initComments).toHaveLength(1);
            expect(initComments[0].text).toMatch(/args=\(a\)/);
            expect(initComments[0].text).toMatch(/super=\(a\)/);
        });

        test('def initialize is not converted to blocks', async () => {
            code = `
                class Sprite1
                  def initialize
                    @x = 10
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // def initialize should not create procedures_definition blocks
            const blocks = converter.blocks;
            const blockOpcodes = Object.values(blocks).map(b => b.opcode);
            expect(blockOpcodes).not.toContain('procedures_definition');
        });

        test('empty def initialize is allowed', async () => {
            code = `
                class Sprite1
                  def initialize
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });

        test('variables in initialize are registered in context', async () => {
            code = `
                class Sprite1
                  def initialize
                    @x = 10
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // Variable should be registered in context
            expect(converter._context.variables.x).toBeDefined();
        });

        test('lists in initialize are registered in context', async () => {
            code = `
                class Sprite1
                  def initialize
                    @items = ["a", "b"]
                  end

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // List should be registered in context
            expect(converter._context.lists.items).toBeDefined();
        });

        describe('applyTargetBlocks applies initialize values', () => {
            let spriteTarget, stageTarget, runtime, vmConverter;

            beforeEach(() => {
                ({target: spriteTarget, stage: stageTarget, runtime} = makeSpriteTarget());
                spriteTarget.sprite = {name: 'Sprite1', costumes: []};
                stageTarget.sprite = {name: 'Stage', costumes: []};
            });

            test('sprite: variable values are applied to target', async () => {
                vmConverter = makeConverter(spriteTarget, runtime, {version: '2'});
                code = `
                    class Sprite1
                      def initialize
                        @x = 10
                        @name = "hello"
                      end

                      when_flag_clicked do
                        move(10)
                      end
                    end
                `;
                const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
                expect(vmConverter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
                await vmConverter.applyTargetBlocks(spriteTarget);

                // Find instance variables on the sprite target
                const xVar = spriteTarget.lookupVariableByNameAndType('x', '');
                const nameVar = spriteTarget.lookupVariableByNameAndType('name', '');
                expect(xVar).not.toBeNull();
                expect(nameVar).not.toBeNull();
                expect(xVar.value).toEqual(10);
                expect(nameVar.value).toEqual('hello');
            });

            test('sprite: list values are applied to target', async () => {
                vmConverter = makeConverter(spriteTarget, runtime, {version: '2'});
                code = `
                    class Sprite1
                      def initialize
                        @items = ["a", "b", "c"]
                      end

                      when_flag_clicked do
                        move(10)
                      end
                    end
                `;
                const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
                expect(vmConverter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
                await vmConverter.applyTargetBlocks(spriteTarget);

                const itemsList = spriteTarget.lookupVariableByNameAndType('items', 'list');
                expect(itemsList).not.toBeNull();
                expect(itemsList.value).toEqual(['a', 'b', 'c']);
            });

            test('stage: global variable values are applied', async () => {
                vmConverter = makeConverter(stageTarget, runtime, {version: '2'});
                code = `
                    class Stage
                      def initialize
                        $score = 100
                      end

                      when_flag_clicked do
                        switch_backdrop("Arctic")
                      end
                    end
                `;
                const res = await vmConverter.targetCodeToBlocks(stageTarget, code);
                expect(vmConverter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
                await vmConverter.applyTargetBlocks(stageTarget);

                const scoreVar = stageTarget.lookupVariableByNameAndType('score', '');
                expect(scoreVar).not.toBeNull();
                expect(scoreVar.value).toEqual(100);
            });

            test('empty list is applied correctly', async () => {
                vmConverter = makeConverter(spriteTarget, runtime, {version: '2'});
                code = `
                    class Sprite1
                      def initialize
                        @items = []
                      end

                      when_flag_clicked do
                        move(10)
                      end
                    end
                `;
                const res = await vmConverter.targetCodeToBlocks(spriteTarget, code);
                expect(vmConverter.errors).toHaveLength(0);
                expect(res).toBeTruthy();
                await vmConverter.applyTargetBlocks(spriteTarget);

                const itemsList = spriteTarget.lookupVariableByNameAndType('items', 'list');
                expect(itemsList).not.toBeNull();
                expect(itemsList.value).toEqual([]);
            });
        });
    });

    describe('set_variables/set_lists rejected in V2', () => {
        test('set_variables in sprite class is an error in V2', async () => {
            code = `
                class Sprite1
                  set_variables ["x", "y"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/set_variables/);
        });

        test('set_lists in sprite class is an error in V2', async () => {
            code = `
                class Sprite1
                  set_lists ["items"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/set_lists/);
        });

        test('set_variables in stage class is an error in V2', async () => {
            code = `
                class Stage
                  set_variables ["score"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/set_variables/);
        });

        test('set_lists in stage class is an error in V2', async () => {
            code = `
                class Stage
                  set_lists ["items"]

                  when_flag_clicked do
                    move(10)
                  end
                end
            `;
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/set_lists/);
        });
    });
});
