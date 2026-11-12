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
import { ja } from '../../../../src/lib/lessons/lessons.locale';

const LOCALES = ['ja', 'ja-Hira', 'en'];

const hintSteps = () =>
    COURSES.flatMap((course) =>
        course.lessons.flatMap((lesson) =>
            lesson.challenges.flatMap((challenge) =>
                challenge.steps
                    .map((step, index) => ({
                        id: challenge.id,
                        step: index + 1,
                        title: ja[step.title.id],
                        blocks: step.blocks,
                    }))
                    .filter((entry) => entry.blocks),
            ),
        ),
    );

// 描かれたブロックの opcode（shadow = 数や文字の白い穴は除く）を XML の並び順で
const opcodesOf = (xml) => Array.from(xml.matchAll(/<block id="[^"]*" type="([^"]+)"/g), (m) => m[1]);

const drawAll = async () => {
    const result = [];
    for (const { id, step, title, blocks } of hintSteps()) {
        for (const locale of LOCALES) {
            const ruby = localizeCode(blocks, locale);
            const { xml } = await rubyToBlocksXml(null, null, ruby);
            result.push({ id, step, title, locale, ruby, xml, opcodes: opcodesOf(xml) });
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

// 絵のかたまり（先頭のブロックごとのスクリプト）の数
const scriptsOf = (xml) =>
    Array.from(new DOMParser().parseFromString(xml, 'text/xml').documentElement.children).filter(
        (node) => node.tagName === 'block',
    ).length;

// つなげる相手・置く位置を言う文言（「〜の下に」「〜の上に」「〜の中に」「穴に」「つなげ」など・#1582）
const NAMES_A_PARTNER = /つなげ|つない|くっつけ|の下に|の上に|中に|穴に|の左に/;

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

    // 文言がつなげる相手・置く位置を言うページの絵は、相手のブロックとつないだ 1 つのかたまり
    // （docs/lessons/design.md の「ヒント」・#1582）。相手だけ・置くブロックだけの絵にしない
    test('a hint that names where to put a block draws it connected with its partner', () => {
        const named = drawn.filter(({ title }) => NAMES_A_PARTNER.test(title));
        expect(named.length).toBeGreaterThan(0);
        named.forEach(({ id, step, locale, xml, opcodes }) => {
            expect({ id, step, locale, scripts: scriptsOf(xml), connected: opcodes.length >= 2 }).toEqual({
                id,
                step,
                locale,
                scripts: 1,
                connected: true,
            });
        });
    });

    test('every hint text that names a partner has a picture', () => {
        COURSES.forEach((course) =>
            course.lessons.forEach((lesson) =>
                lesson.challenges.forEach((challenge) =>
                    challenge.steps.forEach((step, index) => {
                        if (!NAMES_A_PARTNER.test(ja[step.title.id])) return;
                        expect({ id: challenge.id, step: index + 1, blocks: !!step.blocks }).toEqual({
                            id: challenge.id,
                            step: index + 1,
                            blocks: true,
                        });
                    }),
                ),
            ),
        );
    });

    describe('くり返そう (blocks-l1-repeat)', () => {
        test('the step 4 picture is "repeat" under the hat and the step 5 picture has the 4 blocks in "repeat"', () => {
            [drawn, drawnInProduction].forEach((all) => {
                LOCALES.forEach((locale) => {
                    expect(hintOf(all, 'blocks-l1-repeat', 4, locale).opcodes).toEqual([
                        'event_whenkeypressed',
                        'control_repeat',
                    ]);
                    const { xml, opcodes } = hintOf(all, 'blocks-l1-repeat', 5, locale);
                    expect(opcodes).toEqual([
                        'control_repeat',
                        'looks_switchbackdropto',
                        'control_wait',
                        'looks_switchbackdropto',
                        'control_wait',
                    ]);
                    expect(xml).toMatch(/<value name="SUBSTACK"><block id="[^"]*" type="looks_switchbackdropto">/);
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

        test('the step 3 picture is "if <  > then else" with an empty hole in "forever"', () => {
            [drawn, drawnInProduction].forEach((all) => {
                LOCALES.forEach((locale) => {
                    const { xml, opcodes } = hintOf(all, 'blocks-l1-if', 3, locale);
                    expect(opcodes).toEqual(['control_forever', 'control_if_else']);
                    expect(xml).toMatch(
                        /type="control_forever"><value name="SUBSTACK"><block id="[^"]*" type="control_if_else">/,
                    );
                    expect(xml).not.toContain('name="CONDITION"');
                });
            });
        });
    });

    describe('聞いて答えよう (blocks-l1-ask-answer)', () => {
        test('the step 4 picture is "reset timer" above "ask and wait" (#1580)', () => {
            const question = { ja: 'なまえは？', 'ja-Hira': 'なまえは？', en: "What's your name?" };
            [drawn, drawnInProduction].forEach((all) => {
                LOCALES.forEach((locale) => {
                    const { xml, opcodes } = hintOf(all, 'blocks-l1-ask-answer', 4, locale);
                    expect(opcodes).toEqual(['sensing_resettimer', 'sensing_askandwait']);
                    expect(xml).toMatch(
                        /type="sensing_resettimer"><next><block id="[^"]*" type="sensing_askandwait">/,
                    );
                    expect(xml).toContain(`<field name="TEXT">${question[locale].replace(/'/g, '&apos;')}</field>`);
                });
            });
        });
    });
});
