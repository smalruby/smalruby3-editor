import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Class', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
        expected = null;
    });

    describe('basic class syntax', () => {
        test('class Sprite1 with when_flag_clicked', async () => {
            code = `
                class Sprite1
                  self.when(:flag_clicked) do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                self.when(:flag_clicked) do
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
                  self.when(:flag_clicked) do
                    move(10)
                  end

                  self.when(:key_pressed, "space") do
                    move(20)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                self.when(:flag_clicked) do
                  move(10)
                end

                self.when(:key_pressed, "space") do
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
                  self.when(:flag_clicked) do
                    move(10)
                  end
                end

                bounce_if_on_edge
            `;
            expected = await rubyToExpected(converter, target, `
                self.when(:flag_clicked) do
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
    });

    describe('class name and set_name', () => {
        test('class Cat changes sprite name and generates @ruby:class:name', async () => {
            code = `
                class Cat
                  self.when(:flag_clicked) do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                self.when(:flag_clicked) do
                  move(10)
                end
            `);
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            // @ruby:class:name comment should be created
            const comments = converter._context.comments;
            const targetComments = Object.values(comments).filter(c => c.blockId === null);
            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toEqual('@ruby:class:name');

            // classInfo should record the new name
            expect(converter._context.classInfo).toBeDefined();
            expect(converter._context.classInfo.name).toEqual('Cat');
        });

        test('class Sprite1 with set_name changes sprite name and generates @ruby:class:name', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"

                  self.when(:flag_clicked) do
                    move(10)
                  end
                end
            `;
            expected = await rubyToExpected(converter, target, `
                self.when(:flag_clicked) do
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

                  self.when(:flag_clicked) do
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
                  self.when(:flag_clicked) do
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

                  self.when(:flag_clicked) do
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

                  self.when(:flag_clicked) do
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

                  self.when(:flag_clicked) do
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

                  self.when(:flag_clicked) do
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

                  self.when(:flag_clicked) do
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

        test('class Cat with set_x generates @ruby:class:name,x', async () => {
            code = `
                class Cat
                  set_x 100

                  self.when(:flag_clicked) do
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
            expect(converter._context.classInfo.name).toEqual('Cat');
            expect(converter._context.classInfo.x).toEqual(100);
        });

        test('class Sprite1 with set_name and set_x generates @ruby:class:name,x', async () => {
            code = `
                class Sprite1
                  set_name "ネコ"
                  set_x 100

                  self.when(:flag_clicked) do
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

        test('set_xxx without class generates error', async () => {
            code = `
                set_x 100
                self.when(:flag_clicked) do
                  move(10)
                end
            `;
            // set_x outside class should be treated as unknown call
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors.length).toBeGreaterThan(0);
        });
    });
});
