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
});
