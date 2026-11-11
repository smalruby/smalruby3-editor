/**
 * Data-shape coverage for the lesson courses (コース › レッスン › チャレンジ).
 *
 * The challenge contents arrive later (1-g), so the regressions guarded here are
 * the skeleton every later sub-issue builds on: ids are unique and stable, the
 * lesson clear rule matches the spec, every challenge has the normalized fields,
 * and every message id resolves in en / ja / ja-Hira.
 */
import {
    COURSES,
    LANGUAGES,
    defineChallenge,
    defineLesson,
    findChallenge,
    findCourse,
    findLesson,
    lessonClearRule,
} from '../../../../src/lib/lessons/courses';
import { validateGoal } from '../../../../src/lib/lessons/goal';
import en from '../../../../src/locales/en';
import ja from '../../../../src/locales/ja';
import jaHira from '../../../../src/locales/ja-Hira';

const LOCALES = { en, ja, 'ja-Hira': jaHira };

const LESSON1_CHALLENGE_NAMES = [
    '1 キーで音を鳴らそう',
    '2 矢印キーで動かそう',
    '3 押したら話そう',
    '4 くり返そう',
    '5 もし〜なら',
    '6 聞いて答えよう',
    '7 クイズを作ろう',
    '8 数えよう',
    '9 なかまに合図しよう',
    '10 しゃべらせよう',
    '11 メッセージをためよう',
];

const allChallenges = () =>
    COURSES.flatMap((course) => course.lessons.flatMap((lesson) => lesson.challenges));

const collectMessages = () => {
    const messages = [];
    COURSES.forEach((course) => {
        messages.push(course.name, course.badge);
        course.lessons.forEach((lesson) => {
            messages.push(lesson.name);
            lesson.challenges.forEach((challenge) => {
                messages.push(challenge.name);
                if (challenge.task) messages.push(challenge.task);
                challenge.skills.forEach((skill) => messages.push(skill.name));
                challenge.steps.forEach((step) => step.title && messages.push(step.title));
                challenge.debug.forEach((tip) => messages.push(tip));
            });
        });
    });
    return messages;
};

describe('lesson courses', () => {
    test('the first course is the blocks course "きょうからプログラマー"', () => {
        const course = findCourse('kyou-kara-programmer');
        expect(course).toBeTruthy();
        expect(course.language).toBe(LANGUAGES.BLOCKS);
        expect(ja[course.name.id]).toBe('きょうからプログラマー');
        expect(ja[course.badge.id]).toBe('プログラマー デビュー！');
        expect(COURSES[0]).toBe(course);
    });

    test('every course language is one of blocks / ruby / dncl', () => {
        COURSES.forEach((course) => {
            expect(Object.values(LANGUAGES)).toContain(course.language);
        });
    });

    test('lesson 1 is "ブロックのなかま" with the 11 challenges in order', () => {
        const lesson = findLesson('blocks-l1');
        expect(ja[lesson.name.id]).toBe('ブロックのなかま');
        expect(lesson.challenges.map((c) => `${c.number} ${ja[c.name.id]}`)).toEqual(LESSON1_CHALLENGE_NAMES);
    });

    test('lesson 1 clears with 7 challenges including the 3rd, 6th, 8th, 9th and 11th', () => {
        const lesson = findLesson('blocks-l1');
        const rule = lessonClearRule(lesson);
        expect(rule.count).toBe(7);
        const requiredNumbers = rule.required.map((id) => findChallenge(id).challenge.number);
        expect(requiredNumbers).toEqual([3, 6, 8, 9, 11]);
        lesson.challenges.forEach((c) => {
            expect(c.required).toBe([3, 6, 8, 9, 11].includes(c.number));
        });
    });

    test('challenge numbers follow the order in the lesson', () => {
        COURSES.forEach((course) =>
            course.lessons.forEach((lesson) => {
                expect(lesson.challenges.map((c) => c.number)).toEqual(lesson.challenges.map((_, i) => i + 1));
            }),
        );
    });

    test('challenge ids are unique across all courses (they are the record keys)', () => {
        const ids = allChallenges().map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
    });

    test('course and lesson ids are unique', () => {
        const courseIds = COURSES.map((c) => c.id);
        const lessonIds = COURSES.flatMap((c) => c.lessons.map((l) => l.id));
        expect(new Set(courseIds).size).toBe(courseIds.length);
        expect(new Set(lessonIds).size).toBe(lessonIds.length);
    });

    test('every challenge carries the normalized fields', () => {
        allChallenges().forEach((c) => {
            expect(c).toEqual(
                expect.objectContaining({
                    id: expect.any(String),
                    number: expect.any(Number),
                    required: expect.any(Boolean),
                    skills: expect.any(Array),
                    steps: expect.any(Array),
                    debug: expect.any(Array),
                }),
            );
            expect(c).toHaveProperty('task');
            expect(c).toHaveProperty('goal');
            // A malformed goal would silently never be met (attachGoalMonitor does not validate)
            if (c.goal !== null) expect(validateGoal(c.goal)).toEqual([]);
            expect(c).toHaveProperty('allowedBlocks');
            expect(c).toHaveProperty('setup');
            expect(c).toHaveProperty('code');
            c.steps.forEach((step) => {
                expect(step).toHaveProperty('target');
                expect(step).toHaveProperty('blocks');
            });
        });
    });

    test('defineChallenge fills the defaults and keeps what the definition gives', () => {
        const challenge = defineChallenge({
            id: 'x-y',
            required: true,
            steps: [{ target: 'palette', spotlight: true }, { blocks: 'move(10)' }],
        });
        expect(challenge).toEqual({
            id: 'x-y',
            name: { id: 'gui.lessons.challenge.x-y.name', defaultMessage: undefined },
            task: null,
            skills: [],
            goal: null,
            required: true,
            allowedBlocks: null,
            setup: null,
            code: null,
            debug: [],
            steps: [
                { title: null, target: 'palette', blocks: null, spotlight: true },
                { title: null, target: null, blocks: 'move(10)', spotlight: false },
            ],
        });
    });

    test('defineLesson numbers the challenges in order and derives the required ids', () => {
        const lesson = defineLesson({
            id: 'l',
            count: 2,
            challenges: [{ id: 'a' }, { id: 'b', required: true }, { id: 'c', required: true }],
        });
        expect(lesson.name.id).toBe('gui.lessons.lesson.l.name');
        expect(lesson.challenges.map((c) => c.number)).toEqual([1, 2, 3]);
        expect(lesson.clear).toEqual({ count: 2, required: ['b', 'c'] });
    });

    test('the clear count never exceeds the number of challenges and covers the required ones', () => {
        COURSES.forEach((course) =>
            course.lessons.forEach((lesson) => {
                const rule = lessonClearRule(lesson);
                expect(rule.count).toBeLessThanOrEqual(lesson.challenges.length);
                expect(rule.count).toBeGreaterThanOrEqual(rule.required.length);
            }),
        );
    });

    test('findChallenge returns the course and lesson the challenge belongs to', () => {
        const found = findChallenge('blocks-l1-broadcast');
        expect(found.course.id).toBe('kyou-kara-programmer');
        expect(found.lesson.id).toBe('blocks-l1');
        expect(found.challenge.number).toBe(9);
        expect(findChallenge('no-such-challenge')).toBeNull();
        expect(findCourse('no-such-course')).toBeNull();
        expect(findLesson('no-such-lesson')).toBeNull();
    });

    // チャレンジ 5〜8（Issue #1474 の仕様）
    describe('lesson 1 challenges 5-8 (the spec of the sub-issue)', () => {
        const challenge = (id) => findChallenge(id).challenge;
        const hints = (c) => c.steps.map((s) => [s.target, s.blocks, s.spotlight]);
        const jaText = (descriptor) => ja[descriptor.id];

        test('5 もし〜なら: says one line when the mouse touches the cat and another when it does not', () => {
            const c = challenge('blocks-l1-if');
            expect(c.number).toBe(5);
            expect(c.required).toBe(false);
            expect(jaText(c.task)).toBe(
                'マウスでネコにさわったら「くすぐったい！」、さわっていないときは「さわってみて」と言うようにしよう',
            );
            expect(c.skills.map((s) => jaText(s.name))).toEqual(['もし〜なら', 'ずっと', 'さわったか調べる']);
            expect(c.allowedBlocks).toEqual({
                event: ['event_whenflagclicked'],
                control: ['control_forever', 'control_if', 'control_if_else'],
                sensing: ['sensing_touchingobject'],
                looks: ['looks_say'],
            });
            expect(c.setup).toEqual({ tab: 'code' });
            expect(hints(c)).toEqual([
                ['palette', 'loop do\nend\n', false],
                ['palette', 'if false\nelse\nend\n', false],
                ['palette', 'touching?("_mouse_")\n', false],
                ['code-area', null, false],
                ['green-flag', null, true],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '旗のブロックの下に「ずっと」をつなげよう。',
                '「ずっと」の中に「もし〜なら でなければ」を入れよう。',
                '水色の「調べる」から、六角形のブロックを「もし」の六角形の穴に入れよう。',
                '上と下に「言う」を入れて、それぞれのセリフを書こう。',
                '旗を押して、マウスをネコに重ねたり、はなしたりしよう。止めるときは赤い●。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                'セリフがかわらないときは、「言う」が「もし」の中と「でなければ」の中に 1 つずつ入っているか見よう。',
                '1 回しか調べないときは、「ずっと」の中に入っているか見よう。',
            ]);
            expect(c.goal).toEqual([
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: ['sensing_touchingobject', { opcode: 'looks_say', distinct: 'MESSAGE', count: 2 }],
                },
            ]);
            expect(c.code).toBe(
                'when_flag_clicked do\n  loop do\n    if touching?("_mouse_")\n      say("くすぐったい！")\n' +
                    '    else\n      say("さわってみて")\n    end\n  end\nend\n',
            );
        });

        test('6 聞いて答えよう (required): asks the name and says the answer and the seconds it took', () => {
            const c = challenge('blocks-l1-ask-answer');
            expect(c.number).toBe(6);
            expect(c.required).toBe(true);
            expect(jaText(c.task)).toBe(
                'ネコを押したら名前を聞いて、答えた名前と、答えるまでにかかった秒数を言うようにしよう',
            );
            expect(c.skills.map((s) => jaText(s.name))).toEqual(['聞いて答える', 'タイマー', 'ことばをつなぐ']);
            expect(c.allowedBlocks).toEqual({
                event: ['event_whenthisspriteclicked'],
                sensing: ['sensing_resettimer', 'sensing_askandwait', 'sensing_answer', 'sensing_timer'],
                operators: ['operator_join'],
                looks: ['looks_sayforsecs'],
            });
            expect(hints(c)).toEqual([
                ['palette', 'ask("なまえは？")\n', false],
                ['palette', 'answer\n', false],
                ['palette', 'timer.reset\n', false],
                // 「と」1 つだけを描く（`.to_s` を付けると「(タイマー) と ()」が入れ子になる）
                ['palette', 'timer.value + "秒でした"\n', false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '水色の「調べる」の「聞いて待つ」をつなげて、「なまえは？」と書こう。',
                '「言う」をつなげて、白いところに、丸い「答え」のブロックを入れよう。',
                '聞く前に「タイマーをリセット」を入れよう。タイマーは 0 から数えはじめるよ。',
                '緑の「演算」の「と」で、丸い「タイマー」と「秒でした」をつないで、もう 1 つの「言う」に入れよう。',
                'ネコを押して、下に出る入力らんに名前を書いて ✓ を押そう。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                '「答え」という文字を言ってしまうときは、文字を書いたのではなく、丸い「答え」のブロックを入れたか見よう。',
                '秒数がとても大きいときは、「タイマーをリセット」が「聞いて待つ」の前にあるか見よう。',
            ]);
            expect(c.goal).toEqual([
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: [
                        'sensing_resettimer',
                        'sensing_askandwait',
                        'sensing_answer',
                        'sensing_timer',
                        { opcode: 'looks_sayforsecs', count: 2 },
                    ],
                    order: ['sensing_resettimer', 'sensing_askandwait'],
                },
                { type: 'said', equalsAnswer: true },
            ]);
            expect(c.code).toBe(
                'when_clicked do\n  timer.reset\n  ask("なまえは？")\n  say(answer, 2)\n' +
                    '  say(timer.value.to_s + "秒でした", 2)\nend\n',
            );
        });

        test('7 クイズを作ろう: says 正解です for 7 and ちがいます for another number', () => {
            const c = challenge('blocks-l1-quiz');
            expect(c.number).toBe(7);
            expect(c.required).toBe(false);
            expect(jaText(c.task)).toBe(
                'ネコを押したら「4＋3＝？」と聞いて、7 なら「正解です」、ちがえば「ちがいます」と言うようにしよう',
            );
            expect(c.skills.map((s) => jaText(s.name))).toEqual(['くらべる', 'もし〜なら']);
            // 「もし〜なら」は 5 と同じできること（id で重ねる）
            expect(c.skills.map((s) => s.id)).toContain(challenge('blocks-l1-if').skills[0].id);
            expect(c.allowedBlocks).toEqual({
                event: ['event_whenthisspriteclicked'],
                sensing: ['sensing_askandwait', 'sensing_answer'],
                control: ['control_if', 'control_if_else'],
                operators: ['operator_equals'],
                looks: ['looks_sayforsecs'],
            });
            expect(hints(c)).toEqual([
                ['palette', null, false],
                ['palette', '"" == 7\n', false],
                ['code-area', null, false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '「聞いて待つ」で問題を出そう。',
                '緑の「演算」の「=」を、「もし」の穴に入れよう。',
                '「=」の左に「答え」、右に 7 を入れよう。',
                '7 と、7 じゃない数の両方をためそう。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                'いつも「ちがいます」になるときは、「=」の左に「答え」、右に 7 が入っているか見よう。数は半角の 7 で入れよう。',
            ]);
            expect(c.goal).toEqual([
                { type: 'said', text: '正解です', answer: { eq: 7 } },
                { type: 'said', text: 'ちがいます', answer: { ne: 7 } },
            ]);
            expect(c.code).toBe(
                'when_clicked do\n  ask("4+3=?")\n  if answer == 7\n    say("正解です", 2)\n  else\n' +
                    '    say("ちがいます", 2)\n  end\nend\n',
            );
        });

        test('8 数えよう (required): counts the clicks in the variable 回数 and says it', () => {
            const c = challenge('blocks-l1-count');
            expect(c.number).toBe(8);
            expect(c.required).toBe(true);
            expect(jaText(c.task)).toBe('ネコを押した回数を数えて、その数を言うようにしよう。3 回押してみよう');
            expect(c.skills.map((s) => jaText(s.name))).toEqual(['変数を作る', '変数']);
            expect(c.allowedBlocks).toEqual({
                event: ['event_whenflagclicked', 'event_whenthisspriteclicked'],
                data: ['data_setvariableto', 'data_changevariableby', 'data_variable'],
                looks: ['looks_say'],
            });
            expect(hints(c)).toEqual([
                ['palette', null, false],
                ['palette', '$回数 = 0\n', false],
                ['palette', '$回数 += 1\n', false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                'オレンジの「変数」で「変数を作る」を押して、「回数」という変数を作ろう。',
                '旗を押したら 0 にもどすプログラムを作ろう。',
                '押されたら 1 ふやして、その数を言うプログラムを作ろう。',
                '旗を押してから、ネコを 3 回押そう。ステージの左上にも数が出るよ。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                '押すたびに 1 にもどるときは、「0 にする」が「押されたとき」のほうに入っていないか見よう。',
            ]);
            expect(c.goal).toEqual([
                { type: 'variable', name: '回数', value: { gte: 3 } },
                { type: 'said', equalsVariable: '回数' },
            ]);
            expect(c.code).toBe('when_flag_clicked do\n  $回数 = 0\nend\n\nwhen_clicked do\n  $回数 += 1\n  say($回数)\nend\n');
        });

        test('the goals of 5-8 pass validateGoal', () => {
            ['blocks-l1-if', 'blocks-l1-ask-answer', 'blocks-l1-quiz', 'blocks-l1-count'].forEach((id) => {
                expect({ id, errors: validateGoal(challenge(id).goal) }).toEqual({ id, errors: [] });
            });
        });
    });

    test.each(Object.keys(LOCALES))('every message id resolves in %s', (locale) => {
        collectMessages().forEach((message) => {
            expect(LOCALES[locale][message.id]).toEqual(expect.any(String));
        });
    });
});
