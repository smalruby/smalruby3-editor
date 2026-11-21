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
import { normalizePartner } from '../../../../src/lib/lessons/practice-partner';
import { isReadDiagram } from '../../../../src/lib/lessons/read-diagram';
import en from '../../../../src/locales/en';
import ja from '../../../../src/locales/ja';
import jaHira from '../../../../src/locales/ja-Hira';

const COURSE_ID = 'jidou-sensor-motor';
const L1 = ['ctrl-l1-measure', 'ctrl-l1-blink', 'ctrl-l1-touch-led', 'ctrl-l1-threshold'];
const L2 = ['ctrl-l2-auto-light', 'ctrl-l2-near-light', 'ctrl-l2-read-diagram'];
const L4 = ['ctrl-l4-send', 'ctrl-l4-receive-led', 'ctrl-l4-signal-motor'];
const L5 = ['ctrl-l5-hallway', 'ctrl-l5-fridge', 'ctrl-l5-trash-can', 'ctrl-l5-slow-car', 'ctrl-l5-doorbell'];
const L3 = ['ctrl-l3-dc-motor', 'ctrl-l3-servo', 'ctrl-l3-auto-switch', 'ctrl-l3-bumper-car'];
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
        expect(course.lessons.map((l) => l.id)).toEqual(['ctrl-l1', 'ctrl-l2', 'ctrl-l3', 'ctrl-l4', 'ctrl-l5']);
        expect(courseSize(course)).toEqual({ lessonCount: 5, challengeCount: 19 });
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

describe('control course lesson 2 "自動で動かそう" (#2171)', () => {
    test('has the 3 challenges in order, all with the extension loaded and the diagram', () => {
        const lesson = findLesson('ctrl-l2');
        expect(ja[lesson.name.id]).toBe('自動で動かそう');
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(L2.map((id, i) => `${i + 1} ${id}`));
        L2.map(challenge).forEach((c) => {
            expect({ id: c.id, setup: c.setup }).toEqual({ id: c.id, setup: { extensions: ['smalrubotS1'] } });
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
        });
        expect(isReadDiagram(challenge('ctrl-l2-read-diagram'))).toBe(true);
        expect(challenge('ctrl-l2-read-diagram').steps.map((s) => s.kind)).toEqual(['read', 'try', 'answer']);
        expect(L2.map((id) => ja[challenge(id).quiz.choices[challenge(id).quiz.answer].id])).toEqual([
            '1 回はかるだけで、あとは変わらない',
            '何を計測したいか',
            '「〜かつ〜」',
        ]);
    });

    test('the palettes are the spec', () => {
        expect(allowedOpcodes(challenge('ctrl-l2-auto-light'))).toEqual({
            event: ['event_whenflagclicked'],
            control: ['control_forever', 'control_if_else'],
            operators: ['operator_lt'],
            data: ['data_setvariableto', 'data_variable'],
            smalrubotS1: [ext('getSensorValue'), ext('turnLedOn'), ext('turnLedOff')],
        });
        expect(allowedOpcodes(challenge('ctrl-l2-near-light')).operators).toEqual(['operator_gt']);
        expect(allowedOpcodes(challenge('ctrl-l2-read-diagram')).operators).toEqual([
            'operator_and',
            'operator_lt',
            'operator_equals',
        ]);
    });

    const autoRun = (facts, extra = []) =>
        flagRun(facts, [
            ['control_forever'],
            [ext('getSensorValue'), { POSITION: 'light' }],
            ['data_setvariableto', { VARIABLE: 'あかるさ', VALUE: 100 }],
            ['control_if_else'],
            ...extra,
        ]);

    test('2-1: on when dark and off when bright, whatever border value the student chose', () => {
        const c = challenge('ctrl-l2-auto-light');
        const facts = createFacts();
        autoRun(facts);
        // さかい目を 300 にした生徒: 100 でつけ、800 で消した
        board(facts, [read(100), led('on'), read(800), led('off')]);
        expect(satisfied(c, facts)).toBe(true);
        // 逆（明るいときにつけた）は通らない
        const wrong = createFacts();
        autoRun(wrong);
        board(wrong, [read(100), led('off'), read(800), led('on')]);
        expect(satisfied(c, wrong)).toBe(false);
        // 命令だけを順に出すプログラム（分岐が無い）は通らない
        const noBranch = createFacts();
        flagRun(noBranch, [['control_forever'], [ext('getSensorValue'), { POSITION: 'light' }]]);
        board(noBranch, [read(100), led('on'), read(800), led('off')]);
        expect(satisfied(c, noBranch)).toBe(false);
    });

    test('2-2: on when near (a large value) and off when far, with any sensor', () => {
        const c = challenge('ctrl-l2-near-light');
        const facts = createFacts();
        flagRun(facts, [['control_forever'], ['control_if_else'], [ext('getSensorValue'), { POSITION: 'ir_a4' }]]);
        board(facts, [
            read(50, 'A4', 'irPhotoreflector'),
            led('off'),
            read(900, 'A4', 'irPhotoreflector'),
            led('on'),
        ]);
        expect(satisfied(c, facts)).toBe(true);
    });

    test('2-3: two sensors read with "and"; on when both are small, off when it is bright', () => {
        const c = challenge('ctrl-l2-read-diagram');
        const facts = createFacts();
        flagRun(facts, [
            ['control_forever'],
            ['control_if_else'],
            ['operator_and'],
            [ext('getSensorValue'), { POSITION: 'light' }],
            [ext('getSensorValue'), { POSITION: 'touch' }],
        ]);
        board(facts, [read(100), read(0, 'A2', 'touch'), led('on')]);
        expect(satisfied(c, facts)).toBe(false);
        board(facts, [read(900), read(0, 'A2', 'touch'), led('off')]);
        expect(satisfied(c, facts)).toBe(true);
    });
});

describe('control course lesson 3 "モーターで動かそう" (#2172)', () => {
    const motor = (value, port = 'M1') => ({ kind: 'motor', port, value, speed: value === 'stop' ? 0 : 50 });
    const servo = (value) => ({ kind: 'servo', port: 'D10', value });

    test('has the 4 challenges in order, all with the extension loaded', () => {
        const lesson = findLesson('ctrl-l3');
        expect(ja[lesson.name.id]).toBe('モーターで動かそう');
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(L3.map((id, i) => `${i + 1} ${id}`));
        L3.map(challenge).forEach((c) => {
            expect({ id: c.id, setup: c.setup }).toEqual({ id: c.id, setup: { extensions: ['smalrubotS1'] } });
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
        });
        // トルク・ギヤ比はクイズで少しふれるだけ（#2158 Q13）
        expect(L3.map((id) => ja[challenge(id).quiz.choices[challenge(id).quiz.answer].id])).toEqual([
            '逆転させる',
            '決めた角度で止まる',
            'ギヤ比を変えて大きい歯車を回す',
            'エレベーターのドア',
        ]);
        expect(allowedOpcodes(challenge('ctrl-l3-dc-motor')).smalrubotS1).toEqual([ext('controlMotorAndStopAfter')]);
        expect(allowedOpcodes(challenge('ctrl-l3-servo')).smalrubotS1).toEqual([ext('bendArm')]);
        expect(allowedOpcodes(challenge('ctrl-l3-bumper-car')).smalrubotS1).toEqual([
            ext('getSensorValue'),
            ext('action'),
        ]);
    });

    test('3-1: the DC motor turned forward and in reverse', () => {
        const c = challenge('ctrl-l3-dc-motor');
        const facts = createFacts();
        flagRun(facts, [[ext('controlMotorAndStopAfter')], ['control_wait', { DURATION: 1 }]]);
        board(facts, [motor('normal'), motor('stop')]);
        expect(satisfied(c, facts)).toBe(false);
        board(facts, [motor('reverse'), motor('stop')]);
        expect(satisfied(c, facts)).toBe(true);
    });

    test('3-2: the arm moved to a small angle and to a large angle', () => {
        const c = challenge('ctrl-l3-servo');
        const facts = createFacts();
        flagRun(facts, [[ext('bendArm')], ['control_wait'], [ext('bendArm')]]);
        board(facts, [servo(0), servo(45)]);
        expect(satisfied(c, facts)).toBe(false);
        board(facts, [servo(80)]);
        expect(satisfied(c, facts)).toBe(true);
    });

    test('3-3: the arm went up when dark and down when bright', () => {
        const c = challenge('ctrl-l3-auto-switch');
        const run = [['control_forever'], ['control_if_else'], [ext('getSensorValue')], [ext('bendArm')]];
        const facts = createFacts();
        flagRun(facts, run);
        board(facts, [read(100), servo(90), read(900), servo(0)]);
        expect(satisfied(c, facts)).toBe(true);
        const wrong = createFacts();
        flagRun(wrong, run);
        board(wrong, [read(100), servo(0), read(900), servo(90)]);
        expect(satisfied(c, wrong)).toBe(false);
    });

    test('3-4: the car went while released and stopped when it bumped', () => {
        const c = challenge('ctrl-l3-bumper-car');
        const facts = createFacts();
        flagRun(facts, [['control_forever'], ['control_if_else'], [ext('getSensorValue')], [ext('action')]]);
        board(facts, [
            read(1, 'A2', 'touch'),
            motor('normal', 'M1'),
            motor('normal', 'M2'),
            read(0, 'A2', 'touch'),
            motor('stop', 'M1'),
            motor('stop', 'M2'),
        ]);
        expect(satisfied(c, facts)).toBe(true);
    });
});

describe('control course lesson 4 "はなれた場所から計測・制御しよう（IoT）" (#2173)', () => {
    test('has the 3 challenges, all with the extension and the mesh loaded and the practice partner', () => {
        const lesson = findLesson('ctrl-l4');
        expect(ja[lesson.name.id]).toBe('はなれた場所から計測・制御しよう（IoT）');
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(L4.map((id, i) => `${i + 1} ${id}`));
        L4.map(challenge).forEach((c) => {
            expect({ id: c.id, setup: c.setup }).toEqual({
                id: c.id,
                setup: { extensions: ['smalrubotS1', 'meshV2'] },
            });
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
            // 2 ページ目はメッシュのつなぎ方（チャットのコースと同じ文）
            expect({ id: c.id, connect: c.steps[1].title.id }).toEqual({
                id: c.id,
                connect: 'gui.lessons.chat.connect.pair',
            });
        });
    });

    test('the practice partner: 4-1 only watches the brightness, 4-2 changes it, 4-3 sends the signal', () => {
        expect(normalizePartner(challenge('ctrl-l4-send').partner, 'ja')).toEqual({
            name: 'シマネコ',
            buttons: [],
            replies: [],
            watch: ['あかるさ'],
        });
        const led = normalizePartner(challenge('ctrl-l4-receive-led').partner, 'ja-Hira');
        expect(led.buttons.map((b) => [b.label, b.set[0].name, b.set[0].value])).toEqual([
            ['あかるくする', 'あかるさ', '800'],
            ['くらくする', 'あかるさ', '100'],
        ]);
        expect(normalizePartner(challenge('ctrl-l4-signal-motor').partner, 'en').buttons[0].broadcast).toBe('move');
    });

    test('the names that go over the mesh are the same in ja and ja-Hira (no kanji)', () => {
        L4.forEach((id) => {
            expect(localizeCode(challenge(id).code, 'ja')).toBe(localizeCode(challenge(id).code, 'ja-Hira'));
            expect(localizeCode(challenge(id).code, 'ja')).not.toMatch(/\p{Script=Han}/u);
        });
    });

    test('4-1: the sensor value went into the shared variable, with 2 values or more', () => {
        const c = challenge('ctrl-l4-send');
        const facts = createFacts();
        const run = flagRun(facts, [
            ['control_forever'],
            [ext('getSensorValue')],
            ['data_setvariableto', { VARIABLE: 'あかるさ', VALUE: 100 }],
        ]);
        const snapshot = { variables: [{ name: 'あかるさ', value: 100, isStage: true }] };
        expect(evaluateGoal(c.goal, facts, snapshot).satisfied).toBe(false);
        recordExecution(facts, run, 'data_setvariableto', { VARIABLE: 'あかるさ', VALUE: 700 });
        expect(evaluateGoal(c.goal, facts, snapshot).results[0]).toBe(true);
    });

    test('4-2: the LED followed the brightness that arrived over the mesh', () => {
        const c = challenge('ctrl-l4-receive-led');
        const facts = createFacts();
        flagRun(facts, [
            ['control_forever'],
            ['control_if_else'],
            ['meshV2_getSensorValue', { NAME: 'あかるさ' }],
            [ext('turnLedOn')],
            [ext('turnLedOff')],
        ]);
        board(facts, [led('on'), led('off')]);
        expect(satisfied(c, facts)).toBe(true);
    });

    test('4-3: the space key sent うごけ and the script that received it ran the motor', () => {
        const c = challenge('ctrl-l4-signal-motor');
        const facts = createFacts();
        const send = startRun(facts, { trigger: { hat: 'event_whenkeypressed', fields: { KEY_OPTION: 'space' } } });
        recordExecution(facts, send, 'event_broadcast', { BROADCAST_OPTION: 'うごけ' });
        const receive = startRun(facts, {
            trigger: { hat: 'event_whenbroadcastreceived', fields: { BROADCAST_OPTION: 'うごけ' } },
        });
        recordExecution(facts, receive, ext('controlMotorAndStopAfter'));
        board(facts, [{ kind: 'motor', port: 'M1', value: 'normal', speed: 50 }]);
        expect(satisfied(c, facts)).toBe(true);
    });
});

describe('control course lesson 5 "計測・制御システムを作ろう" (#2174)', () => {
    test('has 5 themes, a ✓ with one of them, and a read-and-build challenge', () => {
        const lesson = findLesson('ctrl-l5');
        expect(ja[lesson.name.id]).toBe('計測・制御システムを作ろう');
        expect(lesson.checkCount).toBe(1);
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(L5.map((id, i) => `${i + 1} ${id}`));
        expect(isReadDiagram(challenge('ctrl-l5-hallway'))).toBe(true);
        L5.map(challenge).forEach((c) => {
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
        });
    });

    test('5-4 and 5-5 start with the program of the earlier lessons (setup.code)', () => {
        const car = challenge('ctrl-l5-slow-car');
        expect(car.setup.code).toMatch(/studuino\.action\("stop"\)/);
        expect(car.code).toContain('set_motor_speed');
        const bell = challenge('ctrl-l5-doorbell');
        expect(localizeCode(bell.setup.code, 'ja')).toMatch(/^when_receive\("よびだし"\)/);
        expect(localizeCode(bell.code, 'en')).toContain('broadcast("call")');
        expect(bell.setup.extensions).toEqual(['smalrubotS1', 'meshV2']);
    });

    test('5-2: blinks while bright and is off while dark', () => {
        const c = challenge('ctrl-l5-fridge');
        const facts = createFacts();
        flagRun(facts, [
            ['control_forever'],
            ['control_if_else'],
            [ext('getSensorValue')],
            [ext('turnLedOn')],
            ['control_wait'],
            [ext('turnLedOn')],
        ]);
        board(facts, [read(900), led('on'), led('off'), read(100), led('off')]);
        expect(satisfied(c, facts)).toBe(true);
    });

    test('5-3: opens when near and closes again', () => {
        const c = challenge('ctrl-l5-trash-can');
        const facts = createFacts();
        flagRun(facts, [
            ['control_forever'],
            ['control_if'],
            [ext('getSensorValue')],
            [ext('bendArm')],
            ['control_wait'],
            [ext('bendArm')],
        ]);
        board(facts, [
            read(800, 'A4', 'irPhotoreflector'),
            { kind: 'servo', port: 'D10', value: 90 },
            { kind: 'servo', port: 'D10', value: 0 },
        ]);
        expect(satisfied(c, facts)).toBe(true);
    });

    test('5-4: moved slowly and fast, and stopped', () => {
        const c = challenge('ctrl-l5-slow-car');
        const facts = createFacts();
        flagRun(facts, [['control_forever'], [ext('getSensorValue')], [ext('setMotorSpeed')], [ext('action')]]);
        const motor = (value, speed) => ({ kind: 'motor', port: 'M1', value, speed });
        board(facts, [motor('normal', 60), motor('stop', 0)]);
        expect(satisfied(c, facts)).toBe(false);
        board(facts, [motor('normal', 20)]);
        expect(satisfied(c, facts)).toBe(true);
    });
});
