/**
 * ヒントの絵（`steps[].blocks` の Ruby から描くブロック）が、文言の言うブロックになっているかを
 * 「描かれたブロックの opcode」で確かめる（#1578）。
 * 本番のビルドはクラス名を縮めるので（prism のノードの `constructor.name` が 'ElseNode' でなくなる）、
 * 同じようにクラス名を変えた状態でも、絵が変わらないことを確かめる（ブランチプレビューで
 * 「もし〜なら でなければ」が「もし〜なら」で描かれていたのはこれ）。
 */
import * as prismNodes from '@ruby/prism/src/nodes.js';
import { COURSES, findChallenge, localizeCode } from '../../../../src/lib/lessons/courses';
import { rubyToBlocksXml } from '../../../../src/lib/lessons/hint-blocks';

const LOCALES = ['ja', 'ja-Hira', 'en'];

const hintSteps = () =>
    COURSES.flatMap((course) =>
        course.lessons.flatMap((lesson) =>
            lesson.challenges.flatMap((challenge) =>
                challenge.steps
                    .map((step, index) => ({ id: challenge.id, step: index + 1, blocks: step.blocks }))
                    .filter((entry) => entry.blocks),
            ),
        ),
    );

// 描かれたブロックの opcode（shadow = 数や文字の白い穴は除く）を XML の並び順で
const opcodesOf = (xml) => Array.from(xml.matchAll(/<block id="[^"]*" type="([^"]+)"/g), (m) => m[1]);

const drawAll = async () => {
    const result = [];
    for (const { id, step, blocks } of hintSteps()) {
        for (const locale of LOCALES) {
            const ruby = localizeCode(blocks, locale);
            const { xml } = await rubyToBlocksXml(null, null, ruby);
            result.push({ id, step, locale, ruby, xml, opcodes: opcodesOf(xml) });
        }
    }
    return result;
};

// 本番のビルドと同じように、prism のノードのクラス名を変えて描く
const drawAllWithRenamedClasses = async () => {
    const originalNames = new Map();
    Object.values(prismNodes).forEach((klass, i) => {
        if (typeof klass === 'function') {
            originalNames.set(klass, klass.name);
            Object.defineProperty(klass, 'name', { value: `m${i}` });
        }
    });
    try {
        expect(prismNodes.ElseNode.name).not.toBe('ElseNode');
        return await drawAll();
    } finally {
        originalNames.forEach((name, klass) => Object.defineProperty(klass, 'name', { value: name }));
    }
};

const hintOf = (drawn, id, step, locale = 'ja') =>
    drawn.find((d) => d.id === id && d.step === step && d.locale === locale);

describe('hint pictures', () => {
    let drawn;
    let drawnInProduction;

    beforeAll(async () => {
        drawn = await drawAll();
        drawnInProduction = await drawAllWithRenamedClasses();
    });

    test('every hint picture is the same blocks with the class names renamed as in the production build', () => {
        expect(drawn.length).toBeGreaterThan(0);
        expect(drawnInProduction.map(({ id, step, locale, opcodes }) => ({ id, step, locale, opcodes }))).toEqual(
            drawn.map(({ id, step, locale, opcodes }) => ({ id, step, locale, opcodes })),
        );
    });

    test('an "if" with "else" in the Ruby of a hint draws "if then else" (an empty else is kept)', () => {
        [drawn, drawnInProduction].forEach((all) => {
            all.forEach(({ id, step, locale, ruby, opcodes }) => {
                const ifs = (ruby.match(/^\s*if\b/gm) || []).length;
                const elses = (ruby.match(/^\s*else\s*$/gm) || []).length;
                const count = (opcode) => opcodes.filter((o) => o === opcode).length;
                expect({ id, step, locale, ifElse: count('control_if_else'), if: count('control_if') }).toEqual({
                    id,
                    step,
                    locale,
                    ifElse: elses,
                    if: ifs - elses,
                });
            });
        });
    });

    describe('もし〜なら (blocks-l1-if)', () => {
        test('the step 2 picture is "forever" under "when green flag clicked"', () => {
            expect(findChallenge('blocks-l1-if').challenge.steps[1].title.id).toBe(
                'gui.lessons.challenge.blocks-l1-if.step2',
            );
            [drawn, drawnInProduction].forEach((all) => {
                LOCALES.forEach((locale) => {
                    const { xml, opcodes } = hintOf(all, 'blocks-l1-if', 2, locale);
                    expect(opcodes).toEqual(['event_whenflagclicked', 'control_forever']);
                    expect(xml).toMatch(
                        /type="event_whenflagclicked"><next><block id="[^"]*" type="control_forever">/,
                    );
                });
            });
        });

        test('the step 3 picture is "if <  > then else" with an empty hole', () => {
            [drawn, drawnInProduction].forEach((all) => {
                LOCALES.forEach((locale) => {
                    const { xml, opcodes } = hintOf(all, 'blocks-l1-if', 3, locale);
                    expect(opcodes).toEqual(['control_if_else']);
                    expect(xml).not.toContain('name="CONDITION"');
                });
            });
        });
    });
});
