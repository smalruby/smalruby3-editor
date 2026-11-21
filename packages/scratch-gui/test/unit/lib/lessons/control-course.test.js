/**
 * コース「自動でセンサーとモーターでうごかそう」（中学 3 年・計測・制御・EPIC #2158）の仕様。
 * 判定は拡張機能（アーテックロボ）の命令とセンサーの値の記録で見るので、記録（recordBoardEntry）と
 * ブロックの実行（recordExecution）を答えのプログラムどおりに並べて、goal を満たす／満たさないを確かめる。
 */
import { allowedBlockOpcode } from '../../../../src/lib/lessons/block-defaults';
import {
    COURSES,
    LANGUAGES,
    courseSize,
    findChallenge,
    findCourse,
    findLesson,
    localizeCode,
    validateQuiz,
} from '../../../../src/lib/lessons/courses';
import {
    createFacts,
    evaluateGoal,
    recordBoardEntry,
    recordExecution,
    recordSay,
    startRun,
    validateGoal,
} from '../../../../src/lib/lessons/goal';
import { HINT_TARGETS } from '../../../../src/lib/lessons/hint-targets';
import en from '../../../../src/locales/en';
import ja from '../../../../src/locales/ja';
import jaHira from '../../../../src/locales/ja-Hira';

const COURSE_ID = 'jidou-sensor-motor';
const L1 = ['ctrl-l1-measure', 'ctrl-l1-blink', 'ctrl-l1-touch-led', 'ctrl-l1-threshold'];
const challenge = (id) => findChallenge(id).challenge;
const ext = (name) => `smalrubotS1_${name}`;

const allowedOpcodes = (c) =>
    Object.fromEntries(
        Object.entries(c.allowedBlocks).map(([category, entries]) => [category, entries.map(allowedBlockOpcode)]),
    );

// 旗のスクリプトの 1 回の実行を記録する。ops は [opcode, args] の並び
const flagRun = (facts, ops) => {
    const run = startRun(facts, { trigger: { hat: 'event_whenflagclicked' }, targetId: 'cat' });
    ops.forEach(([opcode, args]) => recordExecution(facts, run, opcode, args));
    return run;
};
const read = (value, port = 'A6', sensor = 'light') => ({ kind: 'sensorRead', port, sensor, value });
const led = (value, port = 'A0') => ({ kind: 'led', port, value });
const board = (facts, entries) =>
    entries.forEach((entry) => recordBoardEntry(facts, { board: 'practice', ...entry }));
const satisfied = (c, facts, snapshot = { isExtensionLoaded: (id) => id === 'smalrubotS1' }) =>
    evaluateGoal(c.goal, facts, snapshot).satisfied;

describe('control course "自動でセンサーとモーターでうごかそう" (#2158)', () => {
    test('is the third blocks course', () => {
        const course = findCourse(COURSE_ID);
        expect(COURSES[2]).toBe(course);
        expect(course.language).toBe(LANGUAGES.BLOCKS);
        expect(ja[course.name.id]).toBe('自動でセンサーとモーターでうごかそう');
        expect(course.lessons.map((l) => l.id)).toEqual(['ctrl-l1']);
        expect(courseSize(course)).toEqual({ lessonCount: 1, challengeCount: 4 });
    });

    test('every message of the course is in en / ja / ja-Hira, and ja-Hira has no kanji', () => {
        const ids = Object.keys(ja).filter((id) =>
            /^gui\.lessons\.(course\.jidou-sensor-motor|lesson\.ctrl-|challenge\.ctrl-)/.test(id),
        );
        expect(ids.length).toBeGreaterThan(0);
        ids.forEach((id) => {
            expect({ id, en: typeof en[id] }).toEqual({ id, en: 'string' });
            expect({ id, hira: typeof jaHira[id] }).toEqual({ id, hira: 'string' });
            expect({ id, text: jaHira[id] }).toEqual({ id, text: expect.not.stringMatching(/\p{Script=Han}/u) });
        });
        // 3 つの locale が同じキーを持つ（片方だけの文言を残さない）
        const keysOf = (locale) =>
            Object.keys(locale)
                .filter((id) => /^gui\.lessons\.(course\.jidou-sensor-motor|lesson\.ctrl-|challenge\.ctrl-)/.test(id))
                .sort();
        expect(keysOf(jaHira)).toEqual(keysOf(ja));
        expect(keysOf(en)).toEqual(keysOf(ja));
    });

    test('the hint texts do not say the color of the blocks', () => {
        Object.keys(ja)
            .filter((id) => /^gui\.lessons\.challenge\.ctrl-/.test(id))
            .forEach((id) =>
                expect({ id, text: ja[id] }).toEqual({
                    id,
                    text: expect.not.stringMatching(/(黄色|オレンジ|水色|紫|ピンク|青い|緑色)/),
                }),
            );
    });
});

describe('control course lesson 1 "センサーと LED をためそう" (#2170)', () => {
    test('has the 4 challenges in order', () => {
        const lesson = findLesson('ctrl-l1');
        expect(ja[lesson.name.id]).toBe('センサーと LED をためそう');
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(L1.map((id, i) => `${i + 1} ${id}`));
    });

    test('1-1 adds the extension itself, the others start with it loaded', () => {
        expect(challenge('ctrl-l1-measure').setup).toBeNull();
        expect(challenge('ctrl-l1-measure').steps[1].target).toBe(HINT_TARGETS.EXTENSION_BUTTON);
        L1.slice(1).forEach((id) =>
            expect({ id, setup: challenge(id).setup }).toEqual({ id, setup: { extensions: ['smalrubotS1'] } }),
        );
    });

    test('every challenge shows the diagram, has a valid goal and quiz', () => {
        L1.map(challenge).forEach((c) => {
            expect({ id: c.id, diagram: c.activityDiagram }).toEqual({ id: c.id, diagram: true });
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
        });
        expect(L1.map((id) => ja[challenge(id).quiz.choices[challenge(id).quiz.answer].id])).toEqual([
            'Studuino（インタフェース）',
            '仕事を行う部分',
            'デジタル',
            '部屋の明るさで値が変わるから',
        ]);
    });

    test('the page to try it out is the last one and points at the practice board or the green flag', () => {
        expect(L1.map((id) => challenge(id).steps.at(-1).target)).toEqual([
            HINT_TARGETS.PRACTICE_BOARD,
            HINT_TARGETS.GREEN_FLAG,
            HINT_TARGETS.PRACTICE_BOARD,
            HINT_TARGETS.PRACTICE_BOARD,
        ]);
    });

    test('the palettes are the spec', () => {
        expect(allowedOpcodes(challenge('ctrl-l1-measure'))).toEqual({
            event: ['event_whenflagclicked'],
            control: ['control_forever'],
            data: ['data_setvariableto', 'data_variable'],
            looks: ['looks_say'],
            smalrubotS1: [ext('getSensorValue')],
        });
        expect(allowedOpcodes(challenge('ctrl-l1-blink'))).toEqual({
            event: ['event_whenflagclicked'],
            control: ['control_forever', 'control_wait'],
            smalrubotS1: [ext('turnLedOn'), ext('turnLedOff')],
        });
        expect(allowedOpcodes(challenge('ctrl-l1-touch-led'))).toEqual({
            event: ['event_whenflagclicked'],
            control: ['control_forever', 'control_if_else'],
            operators: ['operator_equals'],
            smalrubotS1: [ext('getSensorValue'), ext('turnLedOn'), ext('turnLedOff')],
        });
        expect(allowedOpcodes(challenge('ctrl-l1-threshold'))).toEqual({
            event: ['event_whenflagclicked'],
            control: ['control_forever', 'control_if_else'],
            operators: ['operator_lt'],
            looks: ['looks_say', 'looks_say'],
            smalrubotS1: [ext('getSensorValue')],
        });
    });

    test.each(['ja', 'ja-Hira', 'en'])(
        'the code (%s) writes the Ruby of the extension with `studuino.`',
        (locale) => {
            L1.forEach((id) => {
                const code = localizeCode(challenge(id).code, locale);
                expect(code).toMatch(/studuino\./);
                if (locale === 'ja-Hira') expect(code).not.toMatch(/\p{Script=Han}/u);
            });
            const variable = { ja: '$明るさ', 'ja-Hira': '$あかるさ', en: '$brightness' }[locale];
            expect(localizeCode(challenge('ctrl-l1-measure').code, locale)).toContain(variable);
        },
    );

    describe('the goals', () => {
        test('1-1: the sensor value changed while it was said forever (any sensor)', () => {
            const c = challenge('ctrl-l1-measure');
            const facts = createFacts();
            flagRun(facts, [
                ['control_forever'],
                [ext('getSensorValue'), { POSITION: 'light' }],
                ['data_setvariableto', { VARIABLE: '明るさ', VALUE: 120 }],
                ['looks_say', { MESSAGE: 120 }],
            ]);
            board(facts, [read(120)]);
            expect(satisfied(c, facts)).toBe(false);
            // 手をかざした（スライダーを動かした）
            const run = facts.runs[0];
            recordExecution(facts, run, 'looks_say', { MESSAGE: 700 });
            expect(satisfied(c, facts)).toBe(true);
            // 拡張機能が無ければ通らない
            expect(satisfied(c, facts, { isExtensionLoaded: () => false })).toBe(false);
        });

        test('1-2: the LED blinked twice in the forever loop', () => {
            const c = challenge('ctrl-l1-blink');
            const facts = createFacts();
            const blinkOnce = [
                [ext('turnLedOn'), { POSITION: 'left' }],
                ['control_wait', { DURATION: 1 }],
                [ext('turnLedOff'), { POSITION: 'left' }],
                ['control_wait', { DURATION: 1 }],
            ];
            flagRun(facts, [['control_forever'], ...blinkOnce]);
            board(facts, [led('on'), led('off')]);
            expect(satisfied(c, facts)).toBe(false);
            blinkOnce.forEach(([opcode, args]) => recordExecution(facts, facts.runs[0], opcode, args));
            expect(satisfied(c, facts)).toBe(true);
        });

        test('1-3: the LED was on while the sensor was 0 and off while it was 1 (another sensor will do)', () => {
            const c = challenge('ctrl-l1-touch-led');
            const facts = createFacts();
            flagRun(facts, [
                ['control_forever'],
                ['control_if_else'],
                [ext('getSensorValue'), { POSITION: 'touch' }],
            ]);
            board(facts, [read(1, 'A2', 'touch'), led('off'), read(0, 'A2', 'touch'), led('on')]);
            expect(satisfied(c, facts)).toBe(true);
            // 押していないのにつけ、押したのに消した（逆）
            const wrong = createFacts();
            flagRun(wrong, [
                ['control_forever'],
                ['control_if_else'],
                [ext('getSensorValue'), { POSITION: 'touch' }],
            ]);
            board(wrong, [read(1, 'A2', 'touch'), led('on'), read(0, 'A2', 'touch'), led('off')]);
            expect(satisfied(c, wrong)).toBe(false);
            // 赤外線センサーで代わりに試した
            const ir = createFacts();
            flagRun(ir, [['control_forever'], ['control_if_else'], [ext('getSensorValue'), { POSITION: 'ir_a4' }]]);
            board(ir, [
                read(300, 'A4', 'irPhotoreflector'),
                led('off'),
                read(0, 'A4', 'irPhotoreflector'),
                led('on'),
            ]);
            expect(satisfied(c, ir)).toBe(true);
        });

        test('1-4: said both 暗い and 明るい by comparing the sensor value', () => {
            const c = challenge('ctrl-l1-threshold');
            const facts = createFacts();
            flagRun(facts, [
                ['control_forever'],
                ['control_if_else'],
                [ext('getSensorValue'), { POSITION: 'light' }],
                ['operator_lt', { OPERAND1: 100, OPERAND2: 500 }],
            ]);
            recordSay(facts, { text: '暗い', targetId: 'cat' });
            expect(satisfied(c, facts)).toBe(false);
            recordSay(facts, { text: '明るい', targetId: 'cat' });
            expect(satisfied(c, facts)).toBe(true);
            ['くらい', 'dark'].forEach((text) => expect(c.goal[1].text.test(text)).toBe(true));
            ['あかるい', 'bright'].forEach((text) => expect(c.goal[2].text.test(text)).toBe(true));
        });
    });
});
