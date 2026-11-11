/**
 * rubyToBlocksXml: ヒントの `blocks`（Ruby）を本物のブロックの XML にする。
 * 変換はいまの code と同じ ruby-to-blocks-converter（prism）を使う。
 */
import { COURSES } from '../../../../src/lib/lessons/courses';
import { rubyToBlocksXml } from '../../../../src/lib/lessons/hint-blocks';

const allSteps = () =>
    COURSES.flatMap((course) =>
        course.lessons.flatMap((lesson) =>
            lesson.challenges.flatMap((challenge) =>
                challenge.steps.filter((step) => step.blocks).map((step) => ({ challenge, step })),
            ),
        ),
    );

describe('rubyToBlocksXml', () => {
    test('converts a hat block with a stack into Blockly XML', async () => {
        const { xml, errors } = await rubyToBlocksXml(null, null, 'when_clicked do\n  say("こんにちは！", 2)\nend\n');
        expect(errors).toEqual([]);
        expect(xml).toMatch(/<block id="[^"]+" type="event_whenthisspriteclicked">/);
        expect(xml).toContain('type="looks_sayforsecs"');
        expect(xml).toContain('<field name="TEXT">こんにちは！</field>');
        expect(xml).toContain('<field name="NUM">2</field>');
    });

    test('a single block without a hat is also a script', async () => {
        const { xml } = await rubyToBlocksXml(null, null, 'next_costume\n');
        expect(xml).toMatch(/^<xml[^>]*><block id="[^"]+" type="looks_nextcostume"><\/block><\/xml>$/);
    });

    test('returns errors instead of xml for Ruby that does not parse', async () => {
        const { xml, errors } = await rubyToBlocksXml(null, null, 'when_clicked do\n');
        expect(xml).toBeNull();
        expect(errors.length).toBeGreaterThan(0);
    });

    test('every hint block in the courses converts to blocks', async () => {
        const steps = allSteps();
        expect(steps.length).toBeGreaterThan(0);
        for (const { challenge, step } of steps) {
            const { xml, errors } = await rubyToBlocksXml(null, null, step.blocks);
            expect({ id: challenge.id, blocks: step.blocks, errors }).toEqual({
                id: challenge.id,
                blocks: step.blocks,
                errors: [],
            });
            expect(xml).toMatch(/<block /);
        }
    });

    test('every challenge code converts to blocks', async () => {
        const challenges = COURSES.flatMap((c) => c.lessons.flatMap((l) => l.challenges)).filter((c) => c.code);
        expect(challenges.length).toBeGreaterThan(0);
        for (const challenge of challenges) {
            const { errors } = await rubyToBlocksXml(null, null, challenge.code);
            expect({ id: challenge.id, errors }).toEqual({ id: challenge.id, errors: [] });
        }
    });
});
