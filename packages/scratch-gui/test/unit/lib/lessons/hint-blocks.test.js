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

    test('self.y += -10 becomes "change y by -10" (challenge 2 duplicates the up script with -10)', async () => {
        const { xml, errors } = await rubyToBlocksXml(null, null, 'self.y += -10\n');
        expect(errors).toEqual([]);
        expect(xml).toContain('type="motion_changeyby"');
        expect(xml).toContain('<field name="NUM">-10</field>');
    });

    test('"3.times" without a block draws an empty "repeat 3" C block (challenge 4 hint)', async () => {
        // `3.times do ... end` は中身が無いと変換できないので、ヒントは中身の無い `3.times` で描く
        const { xml, errors } = await rubyToBlocksXml(null, null, '3.times\n');
        expect(errors).toEqual([]);
        expect(xml).toMatch(/<block id="[^"]+" type="control_repeat">/);
        expect(xml).toContain('<field name="NUM">3</field>');
    });

    test('draws sound and backdrop blocks even when the project does not have the asset yet', async () => {
        // ヒントは「Owl の音を鳴らす」のように、これから足すものを描く。作品にその音・背景が
        // 無くてもエラーにしない（code を入れるときの変換は従来どおり確かめる）
        const target = { id: 't', isStage: false, getSounds: () => [{ name: 'Meow' }], getCostumes: () => [] };
        const vm = { runtime: { getTargetForStage: () => ({ getCostumes: () => [{ name: 'backdrop1' }] }) } };
        const sound = await rubyToBlocksXml(vm, target, 'play("Owl")\n');
        expect(sound.errors).toEqual([]);
        expect(sound.xml).toContain('type="sound_play"');
        expect(sound.xml).toContain('<field name="SOUND_MENU">Owl</field>');
        const backdrop = await rubyToBlocksXml(vm, target, 'switch_backdrop("Arctic")\n');
        expect(backdrop.errors).toEqual([]);
        expect(backdrop.xml).toContain('type="looks_switchbackdropto"');
        expect(backdrop.xml).toContain('<field name="BACKDROP">Arctic</field>');
    });

    test('with validateAssets: true, a sound the project does not have is an error (checked before inserting)', async () => {
        const target = { id: 't', isStage: false, getSounds: () => [{ name: 'Meow' }], getCostumes: () => [] };
        const { xml, errors } = await rubyToBlocksXml(null, target, 'play("Owl")\n', null, {
            version: '2',
            validateAssets: true,
        });
        expect(xml).toBeNull();
        expect(errors).toHaveLength(1);
        expect(errors[0].text).toContain('Owl');
    });

    test('returns errors instead of xml for Ruby that does not parse', async () => {
        const { xml, errors } = await rubyToBlocksXml(null, null, 'when_clicked do\n');
        expect(xml).toBeNull();
        expect(errors.length).toBeGreaterThan(0);
    });

    test('"if false" draws "if <  > then else" with an empty hole (challenge 5 hint)', async () => {
        // ブロック → Ruby は空の穴を `if false` と書くので、ヒントでは `false` を空の穴として描く
        const { xml, errors } = await rubyToBlocksXml(null, null, 'if false\nelse\nend\n');
        expect(errors).toEqual([]);
        expect(xml).toMatch(/^<xml[^>]*><block id="[^"]+" type="control_if_else"><\/block><\/xml>$/);
    });

    test('a condition that is not the false literal stays in the hole', async () => {
        const { xml } = await rubyToBlocksXml(null, null, 'if 0 < 1\nend\n');
        expect(xml).toContain('<value name="CONDITION"><block id=');
        expect(xml).toContain('type="operator_lt"');
        const touching = await rubyToBlocksXml(null, null, 'if touching?("_mouse_")\nend\n');
        expect(touching.xml).toContain('type="sensing_touchingobject"');
    });

    test('"timer.value + text" draws one join block (challenge 6 hint)', async () => {
        const { xml, errors } = await rubyToBlocksXml(null, null, 'timer.value + "秒でした"\n');
        expect(errors).toEqual([]);
        expect(xml.match(/type="operator_join"/g)).toHaveLength(1);
        expect(xml).toContain('type="sensing_timer"');
        expect(xml).toContain('<field name="TEXT">秒でした</field>');
    });

    test('a Japanese global variable name draws the stage variable blocks (challenge 8 hints)', async () => {
        const set = await rubyToBlocksXml(null, null, '$回数 = 0\n');
        expect(set.errors).toEqual([]);
        expect(set.xml).toContain('type="data_setvariableto"');
        expect(set.xml).toMatch(/<field name="VARIABLE" id="[^"]+" variabletype="">回数<\/field>/);
        const change = await rubyToBlocksXml(null, null, '$回数 += 1\n');
        expect(change.xml).toContain('type="data_changevariableby"');
        expect(change.xml).toContain('>回数</field>');
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
