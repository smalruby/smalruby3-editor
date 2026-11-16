/**
 * Data-shape coverage for the lesson courses (コース › レッスン › チャレンジ).
 *
 * The regressions guarded here are the skeleton every sub-issue builds on (ids are
 * unique and stable, the 11 challenges are split into the 3 lessons of the spec, every challenge has the
 * normalized fields, every message id resolves in en / ja / ja-Hira) and the spec of
 * the challenges whose contents are in (task / palette / hints / goal / code).
 */
import { allowedBlockOpcode } from '../../../../src/lib/lessons/block-defaults';
import { setupForChallenge } from '../../../../src/lib/lessons/challenge-setup';
import {
    CATEGORIES,
    COURSES,
    LANGUAGES,
    UNDERSTAND_STEP_KIND,
    defineChallenge,
    defineLesson,
    findChallenge,
    findCourse,
    challengeCodeCandidates,
    challengeCodeFor,
    challengeQuiz,
    courseSize,
    findLesson,
    localizeCode,
    validateQuiz,
} from '../../../../src/lib/lessons/courses';
import { validateGoal } from '../../../../src/lib/lessons/goal';
import { rubyToBlocksXml } from '../../../../src/lib/lessons/hint-blocks';
import { HINT_TARGETS } from '../../../../src/lib/lessons/hint-targets';
import { ROLE_STEP_KIND } from '../../../../src/lib/lessons/lesson-role';
import { normalizePartner } from '../../../../src/lib/lessons/practice-partner';
import { hasAnswerProgram, isReadDiagram } from '../../../../src/lib/lessons/read-diagram';
import en from '../../../../src/locales/en';
import ja from '../../../../src/locales/ja';
import jaHira from '../../../../src/locales/ja-Hira';

// パレットのブロック（allowedBlocks）を opcode だけで比べる。初期値は block-defaults.test.js で見る
const allowedOpcodes = (challenge) =>
    Object.fromEntries(
        Object.entries(challenge.allowedBlocks).map(([category, entries]) => [
            category,
            entries.map(allowedBlockOpcode),
        ]),
    );

const LOCALES = { en, ja, 'ja-Hira': jaHira };

// 11 のチャレンジを 3 つのレッスンに分ける（#1529）。番号はレッスンの中の番号
const LESSONS = [
    {
        id: 'blocks-l1',
        names: { ja: 'うごかしてみよう', 'ja-Hira': 'うごかしてみよう', en: "Let's Move" },
        challenges: ['1 キーで音を鳴らそう', '2 矢印キーで動かそう', '3 押したら話そう', '4 くり返そう'],
    },
    {
        id: 'blocks-l2',
        names: { ja: 'えらんで たずねよう', 'ja-Hira': 'えらんで たずねよう', en: 'Choose and Ask' },
        challenges: ['1 もし〜なら', '2 聞いて答えよう', '3 クイズを作ろう'],
    },
    {
        id: 'blocks-l3',
        names: { ja: 'おぼえて つたえよう', 'ja-Hira': 'おぼえて つたえよう', en: 'Remember and Tell' },
        challenges: ['1 数えよう', '2 なかまに合図しよう', '3 しゃべらせよう', '4 メッセージをためよう'],
    },
];

const allChallenges = () => COURSES.flatMap((course) => course.lessons.flatMap((lesson) => lesson.challenges));

const collectMessages = () => {
    const messages = [];
    COURSES.forEach((course) => {
        messages.push(course.name);
        // #1780: the course description goes into assignment pages
        messages.push(course.description);
        course.lessons.forEach((lesson) => {
            messages.push(lesson.name);
            lesson.challenges.forEach((challenge) => {
                messages.push(challenge.name);
                if (challenge.task) messages.push(challenge.task);
                challenge.steps.forEach((step) => step.title && messages.push(step.title));
                // クラスに参加中の生徒に出す手順の文言（メッシュのつなぎ方）
                challenge.steps.forEach((step) => step.classroomTitle && messages.push(step.classroomTitle));
                challenge.debug.forEach((tip) => messages.push(tip));
                // ふりかえりのクイズ（#1639）
                if (challenge.quiz) {
                    messages.push(challenge.quiz.question, ...challenge.quiz.choices, challenge.quiz.explanation);
                }
            });
        });
    });
    return messages;
};

describe('reflection quiz (#1639)', () => {
    test('a challenge has no quiz unless its definition has one', () => {
        expect(defineChallenge({ id: 'x' }).quiz).toBeNull();
    });

    test('challengeQuiz makes the message ids of the question, the 3 choices and the explanation', () => {
        const quiz = challengeQuiz('chat-l1-x', 2);
        expect(quiz.question.id).toBe('gui.lessons.challenge.chat-l1-x.quiz.question');
        expect(quiz.choices.map((c) => c.id)).toEqual([
            'gui.lessons.challenge.chat-l1-x.quiz.choice1',
            'gui.lessons.challenge.chat-l1-x.quiz.choice2',
            'gui.lessons.challenge.chat-l1-x.quiz.choice3',
        ]);
        expect(quiz.answer).toBe(2);
        expect(quiz.explanation.id).toBe('gui.lessons.challenge.chat-l1-x.quiz.explanation');
        expect(validateQuiz(quiz)).toEqual([]);
        expect(defineChallenge({ id: 'chat-l1-x', quiz }).quiz).toBe(quiz);
    });

    test('validateQuiz finds what is wrong with a quiz', () => {
        const ok = challengeQuiz('y', 0);
        expect(validateQuiz(null)).toEqual(['quiz must be an object']);
        expect(validateQuiz({ ...ok, question: null })).toEqual(['question must be a message']);
        expect(validateQuiz({ ...ok, choices: ok.choices.slice(0, 2) })).toEqual(['choices must be 3 messages']);
        expect(validateQuiz({ ...ok, answer: 3 })).toEqual(['answer must be 0, 1 or 2 (the index of choices)']);
        expect(validateQuiz({ ...ok, answer: '1' })).toEqual(['answer must be 0, 1 or 2 (the index of choices)']);
        expect(validateQuiz({ ...ok, explanation: undefined })).toEqual(['explanation must be a message']);
    });

    // ja-Hira の問い・選択肢・解説に漢字を残さない（FYI2。クイズのあるチャレンジ全部）
    test('the ja-Hira words of every quiz have no kanji', () => {
        Object.keys(jaHira)
            .filter((id) => /^gui\.lessons\.challenge\.[^.]+\.quiz\./.test(id))
            .forEach((id) =>
                expect({ id, text: jaHira[id] }).toEqual({ id, text: expect.not.stringMatching(/\p{Script=Han}/u) }),
            );
        allChallenges()
            .filter((c) => c.quiz)
            .flatMap((c) => [c.quiz.question, ...c.quiz.choices, c.quiz.explanation])
            .forEach(({ id }) => expect(jaHira[id]).not.toMatch(/\p{Script=Han}/u));
    });

    test('every quiz of the courses is valid', () => {
        allChallenges()
            .filter((c) => c.quiz)
            .forEach((c) => expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] }));
    });
});

describe('lesson courses', () => {
    test('the first course is the blocks course "きょうからプログラマー"', () => {
        const course = findCourse('kyou-kara-programmer');
        expect(course).toBeTruthy();
        expect(course.language).toBe(LANGUAGES.BLOCKS);
        expect(ja[course.name.id]).toBe('きょうからプログラマー');
        // クリアの印（「プログラマー デビュー！」）は無い。全部できたらレッスン表のコース名の前に ✓（#1530）
        expect(course.badge).toBeUndefined();
        expect(COURSES[0]).toBe(course);
    });

    test('every sprite a challenge starts with (setup.sprites, setup.spriteCodes) is in the sprite library', () => {
        // eslint-disable-next-line global-require
        const library = require('../../../../src/lib/libraries/sprites.json').map((s) => s.name);
        allChallenges().forEach((challenge) => {
            const setup = challenge.setup || {};
            const sprites = [...(setup.sprites || []), ...(setup.spriteCodes || []).map((s) => s.sprite)];
            sprites.forEach((name) =>
                expect({ challenge: challenge.id, name, known: library.includes(name) }).toEqual({
                    challenge: challenge.id,
                    name,
                    known: true,
                }),
            );
            if (setup.sprites) expect(Array.isArray(setup.sprites)).toBe(true);
        });
    });

    test('every challenge has a card with a color (category) and a main family, and no picture (#1543)', () => {
        const known = Object.values(CATEGORIES);
        allChallenges().forEach((challenge) => {
            expect(known).toContain(challenge.card.category);
            expect(known).toContain(challenge.card.main);
            // カードの絵はやめた（描き続けるのが難しい）。色の決め方は card-color.test.js
            expect(challenge.card).not.toHaveProperty('image');
            expect(challenge.card).not.toHaveProperty('symbol');
            expect(challenge).not.toHaveProperty('category');
        });
    });

    test('every course language is one of blocks / ruby / dncl', () => {
        COURSES.forEach((course) => {
            expect(Object.values(LANGUAGES)).toContain(course.language);
        });
    });

    test('the course has the 3 lessons with their challenges in order', () => {
        const course = findCourse('kyou-kara-programmer');
        expect(course.lessons.map((l) => l.id)).toEqual(LESSONS.map((l) => l.id));
        LESSONS.forEach(({ id, names, challenges }) => {
            const lesson = findLesson(id);
            Object.entries(names).forEach(([locale, name]) => expect(LOCALES[locale][lesson.name.id]).toBe(name));
            expect(lesson.challenges.map((c) => `${c.number} ${ja[c.name.id]}`)).toEqual(challenges);
        });
    });

    test('the lessons have no clear rule and the challenges no required / skills (removed in #1529)', () => {
        findCourse('kyou-kara-programmer').lessons.forEach((lesson) => {
            expect(lesson).not.toHaveProperty('clear');
            lesson.challenges.forEach((c) => {
                expect(c).not.toHaveProperty('required');
                expect(c).not.toHaveProperty('skills');
            });
        });
        ['en', 'ja', 'ja-Hira'].forEach((locale) => {
            expect(Object.keys(LOCALES[locale]).filter((id) => /^gui\.lessons\.skill\./.test(id))).toEqual([]);
            ['required', 'cleared', 'skillsTitle'].forEach((key) =>
                expect(LOCALES[locale]).not.toHaveProperty(`gui.lessonsLibrary.${key}`),
            );
            expect(LOCALES[locale]).not.toHaveProperty('gui.lessons.completed.skills');
        });
    });

    test('the main family of each challenge of the course (the color on a tie)', () => {
        const challenges = findCourse('kyou-kara-programmer').lessons.flatMap((l) => l.challenges);
        expect(challenges.map((c) => c.card.main)).toEqual([
            'sound',
            'motion',
            'looks',
            'control',
            'control',
            'sensing',
            'sensing',
            'variables',
            'events',
            'extensions',
            'lists',
        ]);
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
            steps: [{ target: 'palette', spotlight: true }, { blocks: 'move(10)' }],
        });
        expect(challenge).toEqual({
            id: 'x-y',
            name: { id: 'gui.lessons.challenge.x-y.name', defaultMessage: undefined },
            task: null,
            image: null,
            card: null,
            goal: null,
            spriteCodes: [],
            allowedBlocks: null,
            setup: null,
            code: null,
            codeTarget: null,
            debug: [],
            quiz: null,
            activityDiagram: false,
            partner: null,
            roles: false,
            mode: null,
            explanation: null,
            steps: [
                { title: null, target: 'palette', blocks: null, spotlight: true },
                { title: null, target: null, blocks: 'move(10)', spotlight: false },
            ],
        });
    });

    test('defineLesson numbers the challenges in order', () => {
        const lesson = defineLesson({ id: 'l', challenges: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
        expect(lesson.name.id).toBe('gui.lessons.lesson.l.name');
        expect(lesson.challenges.map((c) => c.number)).toEqual([1, 2, 3]);
    });

    // 日本語モードに切りかえてよいか（#1741）。書いていなければ切りかえ不可
    test('defineLesson does not allow the Japanese mode unless the lesson says so', () => {
        expect(defineLesson({ id: 'l', challenges: [] }).allowDnclMode).toBe(false);
        expect(defineLesson({ id: 'l', challenges: [], allowDnclMode: true }).allowDnclMode).toBe(true);
    });

    test('every lesson that starts a challenge in the Japanese mode allows the Japanese mode', () => {
        for (const course of COURSES) {
            for (const lesson of course.lessons) {
                const startsInDncl = lesson.challenges.some(
                    (challenge) => setupForChallenge(course, challenge).rubyMode === 'dncl',
                );
                if (startsInDncl)
                    expect({ lesson: lesson.id, allowDnclMode: lesson.allowDnclMode }).toEqual({
                        lesson: lesson.id,
                        allowDnclMode: true,
                    });
            }
        }
    });

    test('findChallenge returns the course and lesson the challenge belongs to', () => {
        const found = findChallenge('blocks-l1-broadcast');
        expect(found.course.id).toBe('kyou-kara-programmer');
        expect(found.lesson.id).toBe('blocks-l3');
        expect(found.challenge.number).toBe(2);
        expect(findChallenge('no-such-challenge')).toBeNull();
        expect(findCourse('no-such-course')).toBeNull();
        expect(findLesson('no-such-lesson')).toBeNull();
    });

    // チャレンジ 5〜8（Issue #1474 の仕様）
    describe('lesson 1 challenges 5-8 (the spec of the sub-issue)', () => {
        const challenge = (id) => findChallenge(id).challenge;
        const hints = (c) => c.steps.map((s) => [s.target, localizeCode(s.blocks, 'ja'), s.spotlight]);
        const jaText = (descriptor) => ja[descriptor.id];

        test('5 もし〜なら: says one line when the mouse touches the cat and another when it does not', () => {
            const c = challenge('blocks-l1-if');
            expect([findChallenge(c.id).lesson.id, c.number]).toEqual(['blocks-l2', 1]);
            // 課題の全文では読みやすいところで改行する（課題バーの 1 行ではつなぐ）
            expect(jaText(c.task)).toBe(
                'マウスでネコにさわったら「くすぐったい！」、\nさわっていないときは「さわってみて」と言うようにしよう',
            );
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenflagclicked'],
                control: ['control_forever', 'control_if', 'control_if_else'],
                sensing: ['sensing_touchingobject'],
                looks: ['looks_say'],
            });
            // タブはコースの言語の既定（ブロックのコース = コードタブ。challenge-setup.js）
            expect(c.setup).toBeNull();
            // 帽子のブロックを置く手順から。絵は置いてほしいブロックを置いてほしい並びのまま（#1564）
            expect(hints(c)).toEqual([
                ['palette', 'when_flag_clicked do\nend\n', false],
                ['palette', 'when_flag_clicked do\n  loop do\n  end\nend\n', false],
                // 「ずっと」の中・「もし」の穴に入れた並び（#1582）
                ['palette', 'loop do\n  if false\n  else\n  end\nend\n', false],
                ['palette', 'if touching?("_mouse_")\nelse\nend\n', false],
                [
                    'code-area',
                    'if touching?("_mouse_")\n  say("くすぐったい！")\nelse\n  say("さわってみて")\nend\n',
                    false,
                ],
                ['green-flag', null, true],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '黄色い「イベント」の「旗が押されたとき」をコードエリアへドラッグしよう。',
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
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_flag_clicked do\n  loop do\n    if touching?("_mouse_")\n      say("くすぐったい！")\n' +
                    '    else\n      say("さわってみて")\n    end\n  end\nend\n',
            );
        });

        test('6 聞いて答えよう: asks the name and says the answer and the seconds it took', () => {
            const c = challenge('blocks-l1-ask-answer');
            expect([findChallenge(c.id).lesson.id, c.number]).toEqual(['blocks-l2', 2]);
            expect(jaText(c.task)).toBe(
                'ネコを押したら名前を聞いて、\n答えた名前と、答えるまでにかかった秒数を言うようにしよう',
            );
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenthisspriteclicked'],
                sensing: ['sensing_resettimer', 'sensing_askandwait', 'sensing_answer', 'sensing_timer'],
                operators: ['operator_join'],
                looks: ['looks_sayforsecs'],
            });
            expect(hints(c)).toEqual([
                ['palette', 'when_clicked do\nend\n', false],
                // つなげる相手とつないだ並び（#1582）
                ['palette', 'when_clicked do\n  ask("なまえは？")\nend\n', false],
                ['palette', 'ask("なまえは？")\nsay(answer, 2)\n', false],
                // 「聞いて待つ」の上に入れるので、その下に「聞いて待つ」をつないだ絵（#1580）
                ['palette', 'timer.reset\nask("なまえは？")\n', false],
                // 「と」1 つだけを描く（`.to_s` を付けると「(タイマー) と ()」が入れ子になる）
                ['palette', 'say(answer, 2)\nsay(timer.value + "秒でした", 2)\n', false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '黄色い「イベント」の「このスプライトが押されたとき」をコードエリアへドラッグしよう。',
                '水色の「調べる」の「聞いて待つ」をつなげよう。「なまえは？」と聞くよ。',
                '「言う」をつなげて、白いところに、丸い「答え」のブロックを入れよう。',
                '「聞いて待つ」の上に「タイマーをリセット」を入れよう。タイマーは 0 から数えはじめるよ。',
                '「言う」をもう 1 つつなげて、緑の「演算」の「と」で、丸い「タイマー」と「秒でした」をつないで入れよう。',
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
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_clicked do\n  timer.reset\n  ask("なまえは？")\n  say(answer, 2)\n' +
                    '  say(timer.value + "秒でした", 2)\nend\n',
            );
        });

        test('7 クイズを作ろう: says 正解です for 7 and ちがいます for another number', () => {
            const c = challenge('blocks-l1-quiz');
            expect([findChallenge(c.id).lesson.id, c.number]).toEqual(['blocks-l2', 3]);
            expect(jaText(c.task)).toBe(
                'ネコを押したら「4＋3＝？」と聞いて、\n7 なら「正解です」、ちがえば「ちがいます」と言うようにしよう',
            );
            // 「もし〜なら」は 5 と同じできること（id で重ねる）
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenthisspriteclicked'],
                sensing: ['sensing_askandwait', 'sensing_answer'],
                control: ['control_if', 'control_if_else'],
                operators: ['operator_equals'],
                looks: ['looks_sayforsecs'],
            });
            expect(hints(c)).toEqual([
                ['palette', 'when_clicked do\nend\n', false],
                // つなげる相手・入れる相手とつないだ並び（#1582）
                ['palette', 'when_clicked do\n  ask("4+3=?")\nend\n', false],
                [
                    'palette',
                    'ask("4+3=?")\nif false\n  say("正解です", 2)\nelse\n  say("ちがいます", 2)\nend\n',
                    false,
                ],
                ['palette', 'if "" == 7\n  say("正解です", 2)\nelse\n  say("ちがいます", 2)\nend\n', false],
                ['code-area', 'answer == 7\n', false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '黄色い「イベント」の「このスプライトが押されたとき」をコードエリアへドラッグしよう。',
                '「聞いて待つ」をつなげて、問題を出そう。',
                'オレンジの「制御」の「もし〜なら でなければ」をつなげて、上と下に「言う」を入れよう。上は「正解です」、下は「ちがいます」にしよう。',
                '緑の「演算」の「=」を、「もし」の穴に入れよう。',
                '「=」の左に「答え」を入れよう。右は 7 のままでいいよ。',
                '7 と、7 じゃない数の両方をためそう。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                'いつも「ちがいます」になるときは、「=」の左に「答え」、右に 7 が入っているか見よう。数は半角の 7 で入れよう。',
            ]);
            expect(c.goal).toEqual([
                { type: 'said', text: /^(正解です|せいかいです|correct)$/i, answer: { eq: 7 } },
                { type: 'said', text: /^(ちがいます|wrong)$/i, answer: { ne: 7 } },
            ]);
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_clicked do\n  ask("4+3=?")\n  if answer == 7\n    say("正解です", 2)\n  else\n' +
                    '    say("ちがいます", 2)\n  end\nend\n',
            );
        });

        test('8 数えよう: counts the clicks in the variable 回数 and says it', () => {
            const c = challenge('blocks-l1-count');
            expect([findChallenge(c.id).lesson.id, c.number]).toEqual(['blocks-l3', 1]);
            expect(jaText(c.task)).toBe('ネコを押した回数を数えて、その数を言うようにしよう。\n3 回押してみよう');
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenflagclicked', 'event_whenthisspriteclicked'],
                data: ['data_setvariableto', 'data_changevariableby', 'data_variable'],
                looks: ['looks_say'],
            });
            expect(hints(c)).toEqual([
                ['palette', null, false],
                ['palette', 'when_flag_clicked do\n  $回数 = 0\nend\n', false],
                ['palette', 'when_clicked do\n  $回数 += 1\n  say($回数)\nend\n', false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                'オレンジの「変数」で「変数を作る」を押して、「回数」という変数を作ろう。',
                '1 つめのプログラム: 旗を押したら「回数」を 0 にもどそう。',
                '2 つめのプログラムを、旗のプログラムとはべつに作ろう。黄色い「イベント」の「このスプライトが押されたとき」を新しく置いて、その下で 1 ふやして、その数を言おう。',
                '旗を押してから、ネコを 3 回押そう。ステージの左上にも数が出るよ。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                '押すたびに 1 にもどるときは、「0 にする」が「押されたとき」のほうに入っていないか見よう。',
            ]);
            expect(c.goal).toEqual([
                { type: 'variable', name: ['回数', 'かいすう', 'count'], value: { gte: 3 } },
                { type: 'said', equalsVariable: ['回数', 'かいすう', 'count'] },
            ]);
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_flag_clicked do\n  $回数 = 0\nend\n\nwhen_clicked do\n  $回数 += 1\n  say($回数)\nend\n',
            );
        });

        test('the goals of 5-8 pass validateGoal', () => {
            ['blocks-l1-if', 'blocks-l1-ask-answer', 'blocks-l1-quiz', 'blocks-l1-count'].forEach((id) => {
                expect({ id, errors: validateGoal(challenge(id).goal) }).toEqual({ id, errors: [] });
            });
        });
    });

    // チャレンジ 9〜11（Issue #1475 の仕様）
    describe('lesson 1 challenges 9-11 (the spec of the sub-issue)', () => {
        const challenge = (id) => findChallenge(id).challenge;
        const hints = (c) => c.steps.map((s) => [s.target, localizeCode(s.blocks, 'ja'), s.spotlight]);
        const jaText = (descriptor) => ja[descriptor.id];

        test('9 なかまに合図しよう: clicking the cat broadcasts and the penguin says', () => {
            const c = challenge('blocks-l1-broadcast');
            expect([findChallenge(c.id).lesson.id, c.number]).toEqual(['blocks-l3', 2]);
            expect(jaText(c.task)).toBe('ペンギンを足して、\nネコを押したらペンギンが「やあ！」と言うようにしよう');
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenthisspriteclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
                looks: ['looks_sayforsecs'],
            });
            expect(c.setup).toBeNull();
            expect(hints(c)).toEqual([
                ['sprite-list', null, true],
                ['sprite-list', 'when_clicked do\n  broadcast("あいさつ")\nend\n', false],
                ['sprite-list', null, false],
                ['palette', 'when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n', false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '右下の「スプライトを選ぶ」から、ペンギンを足そう。',
                'ネコをえらんで、「押されたとき」と「送る」をつなげよう。▼の「新しいメッセージ」で「あいさつ」を作ろう。',
                'ペンギンをえらぶと、コードエリアが空になるよ。プログラムはスプライトごとにあるんだ。',
                'ペンギンに「受け取ったとき」と「言う」をつなげよう。',
                'ネコを押してみよう。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                'ペンギンが言わないときは、「送る」と「受け取ったとき」のメッセージの名前が同じか見よう。',
                'ペンギンのプログラムを、ネコに書いていないかも見よう。',
            ]);
            expect(c.goal).toEqual([
                { type: 'sprites', min: 2 },
                { type: 'uses', trigger: { hat: 'event_whenthisspriteclicked' }, blocks: ['event_broadcast'] },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' },
                    blocks: ['looks_sayforsecs'],
                },
            ]);
            // code はネコ、ペンギンのプログラムは spriteCodes（ライブラリの「Penguin」）
            expect(localizeCode(c.code, 'ja')).toBe('when_clicked do\n  broadcast("あいさつ")\nend\n');
            expect(challengeCodeFor(c, 'ja').spriteCodes).toEqual([
                { sprite: 'Penguin', code: 'when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n' },
            ]);
        });

        test('10 しゃべらせよう: the Text to Speech extension speaks when the cat is clicked', () => {
            const c = challenge('blocks-l1-speak');
            expect([findChallenge(c.id).lesson.id, c.number]).toEqual(['blocks-l3', 3]);
            expect(jaText(c.task)).toBe(
                '拡張機能「音声合成」を足して、\nネコを押したら「ボタンが押されました」としゃべるようにしよう',
            );
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenthisspriteclicked'],
                text2speech: ['text2speech_speakAndWait'],
            });
            // 拡張機能は子どもがヒント 1 で足す（setup では入れない）
            expect(c.setup).toBeNull();
            expect(hints(c)).toEqual([
                ['extension-button', null, true],
                ['palette', 'when_clicked do\n  text2speech.speak("ボタンが押されました")\nend\n', false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '左下のボタンから「音声合成」をえらぼう。パレットに新しいなかまがふえるよ。',
                '「押されたとき」に「しゃべる」をつなげよう。ことばは「ボタンが押されました」になっているよ。',
                'ネコを押してみよう。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                '声が出ないときは、パソコンの音量を見よう。音声合成はインターネットにつながっていないと使えないよ。',
            ]);
            expect(c.goal).toEqual([
                { type: 'extension', id: 'text2speech' },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: ['text2speech_speakAndWait'],
                },
            ]);
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_clicked do\n  text2speech.speak("ボタンが押されました")\nend\n',
            );
        });

        test('11 メッセージをためよう: keeps the answers in the list トーク', () => {
            const c = challenge('blocks-l1-message-list');
            expect([findChallenge(c.id).lesson.id, c.number]).toEqual(['blocks-l3', 4]);
            expect(jaText(c.task)).toBe(
                'ネコを押したら「メッセージは？」と聞いて、\n答えをリスト「トーク」にためよう。\n3 つためてみよう',
            );
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenflagclicked', 'event_whenthisspriteclicked'],
                data: ['data_deletealloflist', 'data_addtolist'],
                sensing: ['sensing_askandwait', 'sensing_answer'],
            });
            expect(hints(c)).toEqual([
                ['palette', null, false],
                ['palette', 'when_flag_clicked do\n  $トーク.clear\nend\n', false],
                ['palette', 'when_clicked do\n  ask("メッセージは？")\n  $トーク.push(answer)\nend\n', false],
                ['stage', null, false],
            ]);
            expect(c.steps.map((s) => jaText(s.title))).toEqual([
                '「変数」の下の「リストを作る」を押して、「トーク」というリストを作ろう。ステージに空の箱が出るよ。',
                '1 つめのプログラム: 旗を押したら「トーク」を空にしよう。',
                '2 つめのプログラムを、旗のプログラムとはべつに作ろう。黄色い「イベント」の「このスプライトが押されたとき」を新しく置いて、その下で「メッセージは？」と聞いて、答えを「トーク」に追加しよう。',
                '旗を押してから、ネコを 3 回押して、メッセージを書こう。ステージの箱に、書いた順にたまっていくよ。',
            ]);
            expect(c.debug.map(jaText)).toEqual([
                '1 つしかたまらないときは、「すべてを削除する」が「押されたとき」のほうに入っていないか見よう。',
                '「答え」という文字がたまるときは、丸い「答え」のブロックを入れたか見よう。',
            ]);
            expect(c.goal).toEqual([
                { type: 'list', name: ['トーク', 'talk'], length: { gte: 3 }, itemsFromAnswers: true },
            ]);
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_flag_clicked do\n  $トーク.clear\nend\n\nwhen_clicked do\n  ask("メッセージは？")\n' +
                    '  $トーク.push(answer)\nend\n',
            );
        });

        test('the goals of 9-11 pass validateGoal', () => {
            ['blocks-l1-broadcast', 'blocks-l1-speak', 'blocks-l1-message-list'].forEach((id) => {
                expect({ id, errors: validateGoal(challenge(id).goal) }).toEqual({ id, errors: [] });
            });
        });

        test('the ja-Hira strings of 9-11 have no kanji', () => {
            const ids = Object.keys(jaHira).filter((id) => /blocks-l1-(broadcast|speak|message-list)\./.test(id));
            expect(ids.length).toBeGreaterThan(20);
            ids.forEach((id) =>
                expect({ id, text: jaHira[id] }).toEqual({ id, text: expect.not.stringMatching(/\p{Script=Han}/u) }),
            );
        });
    });

    test.each(Object.keys(LOCALES))('every message id resolves in %s', (locale) => {
        collectMessages().forEach((message) => {
            expect(LOCALES[locale][message.id]).toEqual(expect.any(String));
        });
    });

    describe('lesson 1 challenges 1-4 (the spec of the sub-issue)', () => {
        const { PALETTE, CODE_AREA, STAGE, SPRITE_LIST, SOUNDS_TAB, COSTUMES_TAB, BACKDROP, KEYBOARD } = HINT_TARGETS;
        const challenge = (id) => findChallenge(id).challenge;
        const hints = (c) => c.steps.map((s) => [s.target, localizeCode(s.blocks, 'ja'), s.spotlight]);

        test('1 キーで音を鳴らそう: space key plays two sounds in order', () => {
            const c = challenge('blocks-l1-key-sound');
            expect(ja[c.task.id]).toBe(
                'スペースキーを押したら、\nネコが「ニャー」と鳴いたあと、「Owl」の音が鳴るようにしよう',
            );
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenkeypressed'],
                sound: ['sound_playuntildone', 'sound_play'],
            });
            expect(hints(c)).toEqual([
                [SOUNDS_TAB, null, false],
                [PALETTE, 'when_key_pressed("space") do\nend\n', true],
                // つなげる相手（その上のブロック）とつないだ並び（#1582）
                [PALETTE, 'when_key_pressed("space") do\n  play_until_done("ニャー")\nend\n', true],
                [CODE_AREA, 'play_until_done("ニャー")\nplay("Owl")\n', false],
                [KEYBOARD, null, true],
            ]);
            expect(c.debug).toHaveLength(2);
            expect(c.goal).toEqual([
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: 'space' },
                    blocks: ['sound_playuntildone', 'sound_play'],
                    order: ['sound_playuntildone', 'sound_play'],
                },
            ]);
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_key_pressed("space") do\n  play_until_done("ニャー")\n  play("Owl")\nend\n',
            );
            expect(c.codeTarget).toBeNull();
        });

        test('2 矢印キーで動かそう: up and down arrow keys change y both ways', () => {
            const c = challenge('blocks-l1-arrow-move');
            expect(ja[c.task.id]).toBe('上向き矢印キーで上へ、下向き矢印キーで下へ、ネコを動かそう');
            // 課題の全文に出す画像の例（jest では画像の import は fileMock の文字列）
            expect(typeof c.image.src).toBe('string');
            expect(ja[c.image.alt.id]).toBe('上向き矢印キーでネコが上へ、下向き矢印キーで下へ動く');
            expect(allowedOpcodes(c)).toEqual({ event: ['event_whenkeypressed'], motion: ['motion_changeyby'] });
            expect(hints(c)).toEqual([
                [PALETTE, 'when_key_pressed("up arrow") do\nend\n', false],
                [PALETTE, 'when_key_pressed("up arrow") do\n  self.y += 10\nend\n', false],
                [CODE_AREA, 'when_key_pressed("down arrow") do\n  self.y += -10\nend\n', false],
                [STAGE, null, false],
            ]);
            expect(c.debug).toHaveLength(2);
            expect(c.goal).toEqual([
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: 'up arrow' },
                    blocks: [{ opcode: 'motion_changeyby', args: { DY: { gt: 0 } } }],
                },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: 'down arrow' },
                    blocks: [{ opcode: 'motion_changeyby', args: { DY: { lt: 0 } } }],
                },
            ]);
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_key_pressed("up arrow") do\n  self.y += 10\nend\n\nwhen_key_pressed("down arrow") do\n  self.y += -10\nend\n',
            );
        });

        test('3 押したら話そう: add a costume, click the cat, say and next costume', () => {
            const c = challenge('blocks-l1-click-say');
            expect(ja[c.task.id]).toBe(
                'ネコに好きなコスチュームを足して、\n押したら「こんにちは！」と言って、見た目がかわるようにしよう',
            );
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenthisspriteclicked'],
                looks: ['looks_sayforsecs', 'looks_nextcostume'],
            });
            expect(hints(c)).toEqual([
                [COSTUMES_TAB, null, false],
                [PALETTE, 'when_clicked do\nend\n', true],
                [PALETTE, 'when_clicked do\n  say("こんにちは！", 2)\nend\n', true],
                [PALETTE, 'say("こんにちは！", 2)\nnext_costume\n', false],
                [CODE_AREA, null, true],
                [STAGE, null, true],
            ]);
            expect(c.debug).toHaveLength(2);
            expect(c.goal).toEqual([
                { type: 'costumes', added: 1 },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: ['looks_sayforsecs', 'looks_nextcostume'],
                },
            ]);
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_clicked do\n  say("こんにちは！", 2)\n  next_costume\nend\n',
            );
        });

        test('4 くり返そう: the stage switches the backdrop 6 times on the 1 key', () => {
            const c = challenge('blocks-l1-repeat');
            expect(ja[c.task.id]).toBe('1 のキーを押したら、\n背景が「Canyon」と「Arctic」に 3 回かわるようにしよう');
            expect(allowedOpcodes(c)).toEqual({
                event: ['event_whenkeypressed'],
                control: ['control_repeat', 'control_wait'],
                looks: ['looks_switchbackdropto'],
            });
            expect(hints(c)).toEqual([
                [BACKDROP, null, false],
                [SPRITE_LIST, null, false],
                // 帽子のブロックを置く手順（#1564）
                [PALETTE, 'when_key_pressed("1") do\nend\n', false],
                [PALETTE, 'when_key_pressed("1") do\n  3.times\nend\n', false],
                // 「繰り返す」の中に入れる 4 つを、「繰り返す」に入れた並びのまま描く（#1582）
                [
                    CODE_AREA,
                    '3.times do\n  switch_backdrop("Canyon")\n  sleep(1)\n  switch_backdrop("Arctic")\n  sleep(1)\nend\n',
                    false,
                ],
                [KEYBOARD, null, false],
            ]);
            expect(c.debug).toHaveLength(2);
            expect(c.goal).toEqual([
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: '1', target: 'stage' },
                    blocks: ['control_repeat', { opcode: 'looks_switchbackdropto', count: 6 }],
                },
            ]);
            // ステージのプログラムなので、「プログラムを入れる」はステージに入れる
            expect(c.codeTarget).toBe('stage');
            expect(localizeCode(c.code, 'ja')).toBe(
                'when_key_pressed("1") do\n  3.times do\n    switch_backdrop("Canyon")\n    sleep(1)\n' +
                    '    switch_backdrop("Arctic")\n    sleep(1)\n  end\nend\n',
            );
        });

        test('the hint texts of challenges 1-4 are the spec, and ja-Hira is all kana', () => {
            const expectJa = (id, texts) => {
                const c = challenge(id);
                expect(c.steps.map((s) => ja[s.title.id])).toEqual(texts.steps);
                expect(c.debug.map((d) => ja[d.id])).toEqual(texts.debug);
                [...c.steps.map((s) => s.title.id), ...c.debug.map((d) => d.id), c.task.id].forEach((messageId) => {
                    // 漢字を使わない（ひらがな・カタカナ・記号・英数字だけ）
                    expect({ messageId, text: jaHira[messageId] }).toEqual({
                        messageId,
                        text: expect.not.stringMatching(/[\u4e00-\u9fff]/),
                    });
                    expect(en[messageId]).toEqual(expect.any(String));
                });
            };
            expectJa('blocks-l1-key-sound', {
                steps: [
                    '上の「音」タブを開いて、左下のボタンから「Owl」をえらんで足そう。',
                    '「コード」タブにもどって、黄色い「イベント」のブロックをコードエリアへドラッグしよう。',
                    'このブロックを、下にくっつけよう。カチッとはまれば OK。',
                    'もう 1 つ音のブロックをつなげて、▼で「Owl」をえらぼう。',
                    'スペースキーを押してみよう。',
                ],
                debug: [
                    '鳴らないときは、パソコンの音量と、▼でえらんだ音の名前を見よう。',
                    'ブロックがはなれていると、下のブロックは動かないよ。',
                ],
            });
            expectJa('blocks-l1-arrow-move', {
                steps: [
                    '黄色い「イベント」の「上向き矢印キーが押されたとき」をコードエリアへドラッグしよう。▼が「上向き矢印」になっているか見よう。',
                    'その下に、青い「動き」の「y座標を 10 ずつ変える」をくっつけよう。上下は y、左右は x。',
                    'できたかたまりを右クリックして「複製」。もう 1 つできたら、「下向き矢印」と「-10」に変えよう。',
                    '矢印キーで、ネコが上と下に動くか見よう。',
                ],
                debug: [
                    '動かないときは、ステージを 1 回クリックしてからキーを押そう。',
                    '下に動かないときは、数が「-10」（マイナス）になっているか見よう。',
                ],
            });
            expectJa('blocks-l1-click-say', {
                steps: [
                    '上の「コスチューム」タブを開いて、左下のボタンから好きなコスチュームを足そう。えらんでも、筆で描いてもいいよ。',
                    '「コード」タブにもどって、「押されたとき」のブロックをコードエリアへドラッグしよう。',
                    '紫の「見た目」のブロックをくっつけよう。白いところは「こんにちは！」になっているよ。',
                    'その下に、これもくっつけよう。',
                    'まちがえて置いたブロックは、パレットへドラッグしてもどすと消えるよ。',
                    'ステージのスプライトをクリックしてみよう。',
                ],
                debug: [
                    '何も起きないときは、ステージのスプライトそのものを押しているか見よう。',
                    'プログラムを入れたスプライトと、押したスプライトが同じか、右下のスプライトリストで確かめよう。',
                ],
            });
            expectJa('blocks-l1-repeat', {
                steps: [
                    '右下の「背景を選ぶ」から、「Canyon」と「Arctic」を足そう。',
                    '右の「ステージ」をえらぼう。ステージにもプログラムを書けるよ。',
                    '黄色い「イベント」の「1 キーが押されたとき」をコードエリアへドラッグしよう。▼が「1」になっているか見よう。',
                    'その下に、オレンジの「制御」の「繰り返す」をつなげよう。',
                    '中に「背景を…にする」「1 秒待つ」を 2 組入れよう。',
                    '1 のキーを押してみよう。',
                ],
                debug: [
                    '1 回しかかわらないときは、ブロックが「繰り返す」の口の中に入っているか見よう。',
                    'すぐ終わるときは「1 秒待つ」が入っているか見よう。',
                ],
            });
        });

        // 「できた」になる操作（キーを押す・ステージのスプライトを押す・旗を押す・答えを入れる）を促すヒントを
        // 最後にする（docs/lessons/design.md の「ヒント」・#1576）。できたら吹き出しが閉じるので、そのあとの
        // ヒントは見られない。試す操作のヒントは、ステージ・キーボード・旗を指すものだけ
        test('the hint that asks to try it out is the last one', () => {
            const tryTargets = [HINT_TARGETS.STAGE, HINT_TARGETS.KEYBOARD, HINT_TARGETS.GREEN_FLAG];
            // 読んで作るチャレンジのヒントは決まった 3 ページ（どれもステージの左に出す・read-diagram.js）なので除く
            allChallenges()
                .filter((c) => !isReadDiagram(c))
                .forEach((c) => {
                    // 「課題の説明と、アクティビティ図を理解しよう」の 1 ページ目は、図が読めるようステージの左に出す
                    // だけで、試す操作のページではない
                    const targets = c.steps.filter((s) => s.kind !== UNDERSTAND_STEP_KIND).map((s) => s.target);
                    expect({ id: c.id, last: tryTargets.includes(targets[targets.length - 1]) }).toEqual({
                        id: c.id,
                        last: true,
                    });
                    expect({ id: c.id, before: targets.slice(0, -1).filter((t) => tryTargets.includes(t)) }).toEqual({
                        id: c.id,
                        before: [],
                    });
                });
        });

        // ヒントは帽子のブロックを置く手順を抜かさない（docs/lessons/design.md の「ヒント」・#1564）:
        // できあがりのプログラムの帽子のブロック（`when_...`）は、どれもいずれかのヒントの絵に描く。ただし、最初から
        // 入っていて書きかえないスプライトのプログラム（4-4 のシマネコ）は生徒が置かないので除く（2 つのスプライトの
        // プログラムは吹き出しに入りきらない・教員レビュー）
        test.each(['ja', 'ja-Hira', 'en'])('every hat block of the answer is drawn in a hint (%s)', (locale) => {
            allChallenges().forEach((c) => {
                const { code, spriteCodes } = challengeCodeFor(c, locale);
                const setupCodes = ((c.setup && c.setup.spriteCodes) || []).map(
                    (s) => `${s.sprite}\u0000${localizeCode(s.code, locale)}`,
                );
                const built = spriteCodes.filter((s) => !setupCodes.includes(`${s.sprite}\u0000${s.code}`));
                const hats = [code, ...built.map((s) => s.code)]
                    .join('\n')
                    .split('\n')
                    .filter((line) => /^when_\w+/.test(line))
                    .map((line) => line.replace(/ do$/, ''));
                expect(hats.length).toBeGreaterThan(0);
                const drawn = c.steps.map((s) => localizeCode(s.blocks, locale) || '');
                // 最初から入っているプログラムのスクリプト（そのまま残るもの）は、生徒が置かないので描かなくてよい
                // （2 つのスプライトの最初のプログラムを説明するページは、絵を描かずに文で書く）
                const scriptsOf = (one) =>
                    (localizeCode(one, locale) || '')
                        .split(/\n(?=when_)/)
                        .map((script) => script.trim())
                        .filter((script) => /^when_\w+/.test(script));
                const setup = c.setup || {};
                const given = [setup.code, setup.stageCode, ...(setup.spriteCodes || []).map((s) => s.code)].flatMap(
                    scriptsOf,
                );
                const kept = [c.code, ...c.spriteCodes.map((s) => s.code)]
                    .flatMap(scriptsOf)
                    .filter((script) => given.includes(script))
                    .map((script) => script.split('\n')[0].replace(/ do$/, ''));
                hats.filter((hat) => !kept.includes(hat)).forEach((hat) => {
                    expect({
                        id: c.id,
                        hat,
                        drawn: drawn.some((b) => b.split('\n').some((l) => l.startsWith(`${hat} do`))),
                    }).toEqual({ id: c.id, hat, drawn: true });
                });
            });
        });

        test('codeTarget is null or "stage" on every challenge', () => {
            allChallenges().forEach((c) => expect([null, 'stage']).toContain(c.codeTarget));
        });
    });

    // 「プログラムを入れる」の code は locale ごとに持てる（Issue #1488）。作品の中の名前（ネコの音
    // 「ニャー」/ "Meow"）は作品を作ったときの locale で変わるため
    describe('code per locale (ja / ja-Hira / en)', () => {
        const challenge = (id) => findChallenge(id).challenge;
        // 新しい作品のネコの音の名前（scratch-l10n の gui.defaultProject.meow。ja-Hira は訳が無く Meow）
        const CAT_SOUND = { ja: 'ニャー', 'ja-Hira': 'Meow', en: 'Meow' };
        // その locale の新しい作品に、チャレンジで足すもの（Owl・コスチューム・Canyon / Arctic）を足した状態
        const projectFor = (locale) => {
            const stage = {
                id: 'stage',
                isStage: true,
                getSounds: () => [{ name: 'pop' }],
                getCostumes: () => [{ name: 'backdrop1' }, { name: 'Canyon' }, { name: 'Arctic' }],
            };
            const cat = {
                id: 'cat',
                isStage: false,
                getSounds: () => [{ name: CAT_SOUND[locale] }, { name: 'Owl' }],
                getCostumes: () => [{ name: 'costume1' }, { name: 'costume2' }],
            };
            return { vm: { runtime: { getTargetForStage: () => stage } }, stage, cat };
        };

        test('localizeCode: a string as is, the locale, else en, else ja', () => {
            expect(localizeCode('move(10)\n', 'en')).toBe('move(10)\n');
            expect(localizeCode(null, 'en')).toBeNull();
            const all = { ja: 'a', 'ja-Hira': 'b', en: 'c' };
            expect(localizeCode(all, 'ja')).toBe('a');
            expect(localizeCode(all, 'ja-Hira')).toBe('b');
            expect(localizeCode(all, 'en')).toBe('c');
            expect(localizeCode(all, 'zh-cn')).toBe('c');
            expect(localizeCode({ ja: 'a' }, 'en')).toBe('a');
            expect(localizeCode({ ja: 'a', en: 'c' }, 'ja-Hira')).toBe('c');
        });

        test('challengeCodeCandidates: the UI locale first, then the other locales, without duplicates', () => {
            const c = challenge('blocks-l1-key-sound');
            expect(challengeCodeCandidates(c, 'en').map((x) => x.code)).toEqual([
                localizeCode(c.code, 'en'),
                localizeCode(c.code, 'ja'),
            ]);
            expect(challengeCodeCandidates(c, 'ja').map((x) => x.code)).toEqual([
                localizeCode(c.code, 'ja'),
                localizeCode(c.code, 'en'),
            ]);
            // locale で分けないチャレンジ（2: 矢印キー）は 1 つ
            const arrow = challenge('blocks-l1-arrow-move');
            expect(challengeCodeCandidates(arrow, 'en')).toEqual([challengeCodeFor(arrow, 'ja')]);
        });

        test('challenge 1 plays the cat sound of the project of the locale', () => {
            const c = challenge('blocks-l1-key-sound');
            expect(localizeCode(c.code, 'ja')).toContain('play_until_done("ニャー")');
            expect(localizeCode(c.code, 'en')).toContain('play_until_done("Meow")');
            expect(localizeCode(c.steps[2].blocks, 'en')).toBe(
                'when_key_pressed("space") do\n  play_until_done("Meow")\nend\n',
            );
            expect(localizeCode(c.steps[3].blocks, 'en')).toBe('play_until_done("Meow")\nplay("Owl")\n');
        });

        test('the en code says the lines the en task and hints write', () => {
            const en = (id) => localizeCode(challenge(id).code, 'en');
            expect(en('blocks-l1-click-say')).toContain('say("Hello!", 2)');
            expect(en('blocks-l1-if')).toContain('say("That tickles!")');
            expect(en('blocks-l1-if')).toContain('say("Touch me")');
            expect(en('blocks-l1-ask-answer')).toContain('ask("What\'s your name?")');
            expect(en('blocks-l1-ask-answer')).toContain('timer.value + " seconds"');
            expect(en('blocks-l1-quiz')).toContain('say("Correct", 2)');
            expect(en('blocks-l1-quiz')).toContain('say("Wrong", 2)');
        });

        // 8〜11 で子どもが作る名前は、en では英語（Ruby の変数名に使える小文字の英語・#1514）
        test('the en code and hints of 8-11 use the English names the en task and hints write', () => {
            const enCode = (id) => challengeCodeFor(challenge(id), 'en');
            const enHints = (id) => challenge(id).steps.map((s) => localizeCode(s.blocks, 'en'));
            const enText = (descriptor) => en[descriptor.id];
            expect(enCode('blocks-l1-count').code).toBe(
                'when_flag_clicked do\n  $count = 0\nend\n\nwhen_clicked do\n  $count += 1\n  say($count)\nend\n',
            );
            expect(enHints('blocks-l1-count')).toEqual([
                null,
                'when_flag_clicked do\n  $count = 0\nend\n',
                'when_clicked do\n  $count += 1\n  say($count)\nend\n',
                null,
            ]);
            expect(enText(challenge('blocks-l1-count').steps[0].title)).toContain('"count"');

            expect(enCode('blocks-l1-broadcast')).toEqual({
                code: 'when_clicked do\n  broadcast("hello")\nend\n',
                spriteCodes: [{ sprite: 'Penguin', code: 'when_receive("hello") do\n  say("Hi!", 2)\nend\n' }],
            });
            expect(enHints('blocks-l1-broadcast')).toEqual([
                null,
                'when_clicked do\n  broadcast("hello")\nend\n',
                null,
                'when_receive("hello") do\n  say("Hi!", 2)\nend\n',
                null,
            ]);
            expect(enText(challenge('blocks-l1-broadcast').task)).toContain('"Hi!"');
            expect(enText(challenge('blocks-l1-broadcast').steps[1].title)).toContain('"hello"');

            expect(enCode('blocks-l1-speak').code).toBe(
                'when_clicked do\n  text2speech.speak("The button was clicked")\nend\n',
            );
            expect(enHints('blocks-l1-speak')).toEqual([
                null,
                'when_clicked do\n  text2speech.speak("The button was clicked")\nend\n',
                null,
            ]);
            expect(enText(challenge('blocks-l1-speak').task)).toContain('"The button was clicked"');

            expect(enCode('blocks-l1-message-list').code).toBe(
                'when_flag_clicked do\n  $talk.clear\nend\n\nwhen_clicked do\n  ask("Message?")\n' +
                    '  $talk.push(answer)\nend\n',
            );
            expect(enHints('blocks-l1-message-list')).toEqual([
                null,
                'when_flag_clicked do\n  $talk.clear\nend\n',
                'when_clicked do\n  ask("Message?")\n  $talk.push(answer)\nend\n',
                null,
            ]);
            expect(enText(challenge('blocks-l1-message-list').task)).toContain('"talk"');
            expect(enText(challenge('blocks-l1-message-list').task)).toContain('"Message?"');
        });

        test('the en texts of 8-11 do not ask for Japanese names', () => {
            ['blocks-l1-count', 'blocks-l1-broadcast', 'blocks-l1-speak', 'blocks-l1-message-list'].forEach((id) => {
                const c = challenge(id);
                const ids = [c.name, c.task, ...c.steps.map((s) => s.title), ...c.debug].map((d) => d.id);
                ids.forEach((key) => {
                    // ▼ や ✓ などの記号はよい。かな・漢字が無いこと
                    expect({ key, text: en[key] }).toEqual({
                        key,
                        text: expect.not.stringMatching(/[\u3040-\u30ff\u4e00-\u9fff]/),
                    });
                });
            });
        });

        test('the ja-Hira code uses the kana names its hints write', () => {
            const hira = (id) => localizeCode(challenge(id).code, 'ja-Hira');
            expect(hira('blocks-l1-count')).toContain('$かいすう');
            expect(hira('blocks-l1-quiz')).toContain('say("せいかいです", 2)');
            expect(hira('blocks-l1-ask-answer')).toContain('"びょうでした"');
            expect(hira('blocks-l1-speak')).toContain('"ボタンがおされました"');
        });

        test('the goals accept what the code of every locale says (7: Correct / Wrong)', () => {
            const [correct, wrong] = challenge('blocks-l1-quiz').goal;
            ['正解です', 'せいかいです', 'Correct'].forEach((text) => expect(correct.text.test(text)).toBe(true));
            ['ちがいます', 'Wrong'].forEach((text) => expect(wrong.text.test(text)).toBe(true));
            const count = challenge('blocks-l1-count').goal;
            expect(count[0].name).toEqual(expect.arrayContaining(['回数', 'かいすう', 'count']));
            expect(count[1].equalsVariable).toEqual(expect.arrayContaining(['回数', 'かいすう', 'count']));
            const talk = challenge('blocks-l1-message-list').goal[0];
            expect(talk.name).toEqual(expect.arrayContaining(['トーク', 'talk']));
        });

        test.each(['ja', 'ja-Hira', 'en'])(
            'every challenge code (%s) converts to blocks in a new project of that locale',
            async (locale) => {
                const { vm, stage, cat } = projectFor(locale);
                const challenges = allChallenges().filter((c) => c.code);
                // どのチャレンジにも「プログラムを入れる」（読んで作るは答え）の code がある
                expect(challenges).toHaveLength(allChallenges().length);
                for (const c of challenges) {
                    const { code, spriteCodes } = challengeCodeFor(c, locale);
                    const target = c.codeTarget === 'stage' ? stage : cat;
                    // validateAssets: 「プログラムを入れる」の前と同じく、音・背景が作品にあるかも確かめる
                    const options = { version: '2', validateAssets: true };
                    const { errors } = await rubyToBlocksXml(vm, target, code, null, options);
                    expect({ id: c.id, locale, errors }).toEqual({ id: c.id, locale, errors: [] });
                    for (const entry of spriteCodes) {
                        // ペンギンはライブラリから足すので target なしで確かめる（lesson-hint.jsx と同じ）
                        const result = await rubyToBlocksXml(vm, null, entry.code, null, options);
                        expect({ id: c.id, locale, sprite: entry.sprite, errors: result.errors }).toEqual({
                            id: c.id,
                            locale,
                            sprite: entry.sprite,
                            errors: [],
                        });
                    }
                }
            },
        );

        test('the en code of challenge 1 does not fit a ja project (so it falls back to the ja code)', async () => {
            const { vm, cat } = projectFor('ja');
            const c = challenge('blocks-l1-key-sound');
            const options = { version: '2', validateAssets: true };
            const enResult = await rubyToBlocksXml(vm, cat, localizeCode(c.code, 'en'), null, options);
            expect(enResult.errors).toHaveLength(1);
            const jaResult = await rubyToBlocksXml(vm, cat, localizeCode(c.code, 'ja'), null, options);
            expect(jaResult.errors).toEqual([]);
        });
    });

    test('every read-and-build challenge (mode readDiagram) has an answer program (code or spriteCodes)', () => {
        // 答えが無いと、図も答えのページの絵も出ない（読んで作るチャレンジは図と答えだけで指示する）
        const missing = allChallenges()
            .filter(isReadDiagram)
            .filter((challenge) => !hasAnswerProgram(challenge))
            .map((challenge) => challenge.id);
        expect(missing).toEqual([]);
    });
});

// コース「チャットをつくろう」（中学 2 年・EPIC #1616）のレッスン 1（#1641）
describe('chat course lesson 1 "手順を図にしよう" (#1641)', () => {
    const CHAT_L1 = ['chat-l1-sequence', 'chat-l1-repeat', 'chat-l1-branch', 'chat-l1-read-diagram'];
    const challenge = (id) => findChallenge(id).challenge;

    test('the course "チャットをつくろう" is the second blocks course and its lesson 1 has 4 challenges', () => {
        const course = findCourse('chat-wo-tsukurou');
        expect(COURSES[1]).toBe(course);
        expect(course.language).toBe(LANGUAGES.BLOCKS);
        expect(ja[course.name.id]).toBe('チャットをつくろう');
        expect(course.lessons.map((l) => l.id)).toEqual(['chat-l1', 'chat-l2', 'chat-l3', 'chat-l4', 'chat-l5']);
        const lesson = findLesson('chat-l1');
        expect(ja[lesson.name.id]).toBe('手順を図にしよう');
        expect(lesson.allowDnclMode).toBe(false);
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(CHAT_L1.map((id, i) => `${i + 1} ${id}`));
        expect(courseSize(course)).toEqual({ lessonCount: 5, challengeCount: 20 });
    });

    test('every challenge starts with Shimaraby instead of the cat, shows the diagram and has a quiz', () => {
        CHAT_L1.map(challenge).forEach((c) => {
            expect({ id: c.id, sprites: c.setup.sprites }).toEqual({ id: c.id, sprites: ['Shimaraby'] });
            expect({ id: c.id, diagram: c.activityDiagram }).toEqual({ id: c.id, diagram: true });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
            expect(c.partner).toBeNull();
        });
        // 答え（クイズの正解）は教科書の用語: ②順次処理 ③反復処理 ①分岐処理 ②またね
        expect(CHAT_L1.map((id) => ja[challenge(id).quiz.choices[challenge(id).quiz.answer].id])).toEqual([
            '順次処理',
            '反復処理',
            '分岐処理',
            'またね',
        ]);
    });

    test('the palettes are the spec', () => {
        expect(allowedOpcodes(challenge('chat-l1-sequence'))).toEqual({
            event: ['event_whenflagclicked'],
            sensing: ['sensing_askandwait', 'sensing_answer'],
            data: ['data_setvariableto', 'data_variable'],
            looks: ['looks_sayforsecs'],
        });
        expect(allowedOpcodes(challenge('chat-l1-repeat'))).toEqual({
            event: ['event_whenflagclicked'],
            sensing: ['sensing_askandwait', 'sensing_answer'],
            control: ['control_forever'],
            data: ['data_setvariableto', 'data_variable'],
        });
        expect(allowedOpcodes(challenge('chat-l1-branch'))).toEqual({
            event: ['event_whenflagclicked'],
            sensing: ['sensing_askandwait', 'sensing_answer'],
            control: ['control_if_else'],
            operators: ['operator_equals'],
            data: ['data_setvariableto', 'data_variable'],
            looks: ['looks_sayforsecs'],
        });
        expect(allowedOpcodes(challenge('chat-l1-read-diagram'))).toEqual({
            event: ['event_whenflagclicked'],
            control: ['control_repeat_until'],
            operators: ['operator_equals'],
            sensing: ['sensing_askandwait', 'sensing_answer'],
            looks: ['looks_sayforsecs', 'looks_say'],
        });
    });

    test('1-4 is a read-and-build challenge with the 3 fixed hint pages and its own explanation', () => {
        const c = challenge('chat-l1-read-diagram');
        expect(isReadDiagram(c)).toBe(true);
        expect(c.steps.map((s) => s.kind)).toEqual(['read', 'try', 'answer']);
        expect(c.steps[0].title).toBe(c.explanation);
        expect(ja[c.explanation.id]).toMatch(/図だけを見て作ってみよう/);
    });

    test('the ja-Hira strings of the course have no kanji', () => {
        Object.keys(jaHira)
            .filter((id) => /^gui\.lessons\.(course\.chat-wo-tsukurou|lesson\.chat-l1|challenge\.chat-l1-)/.test(id))
            .forEach((id) =>
                expect({ id, text: jaHira[id] }).not.toEqual({ id, text: expect.stringMatching(/\p{Script=Han}/u) }),
            );
    });

    test.each(['ja', 'ja-Hira', 'en'])(
        'the code (%s) uses the names the task and hints of that locale write',
        (locale) => {
            const variable = locale === 'en' ? '$shimaraby_message' : '$シマラビのメッセージ';
            ['chat-l1-sequence', 'chat-l1-repeat', 'chat-l1-branch'].forEach((id) => {
                expect(localizeCode(challenge(id).code, locale)).toContain(variable);
            });
            // ja-Hira の Ruby（言うこと・質問）にも漢字を使わない
            if (locale === 'ja-Hira') {
                CHAT_L1.forEach((id) =>
                    expect(localizeCode(challenge(id).code, locale)).not.toMatch(/\p{Script=Han}/u),
                );
            }
        },
    );

    test('the goals accept the words the code of every locale says', () => {
        const emptyText = challenge('chat-l1-branch').goal[1];
        ['何か書いてね', 'なにか かいてね', 'Write something'].forEach((text) =>
            expect(emptyText.text.test(text)).toBe(true),
        );
        const bye = challenge('chat-l1-read-diagram').goal[1];
        const byeBlock = challenge('chat-l1-read-diagram').goal[0].blocks[2].args.MESSAGE;
        ['またね', 'Bye!'].forEach((text) => expect(byeBlock.test(text)).toBe(true));
        ['またね', 'Bye!'].forEach((text) => expect(bye.text.test(text)).toBe(true));
        expect(challenge('chat-l1-repeat').goal[1].equalsVariable).toEqual([
            'シマラビのメッセージ',
            'shimaraby_message',
        ]);
    });
});

// コース「チャットをつくろう」のレッスン 2「データとイベント」（#1642）
describe('chat course lesson 2 "データとイベント" (#1642)', () => {
    const CHAT_L2 = ['chat-l2-omikuji', 'chat-l2-timer', 'chat-l2-janken'];
    const challenge = (id) => findChallenge(id).challenge;

    test('the lesson 2 has the 3 challenges in order', () => {
        const lesson = findLesson('chat-l2');
        expect(findCourse('chat-wo-tsukurou').lessons[1]).toBe(lesson);
        expect(ja[lesson.name.id]).toBe('データとイベント');
        expect(en[lesson.name.id]).toBe('Data and Events');
        expect(lesson.allowDnclMode).toBe(false);
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(CHAT_L2.map((id, i) => `${i + 1} ${id}`));
    });

    test('every challenge starts with Shimaraby, shows the diagram and has a quiz', () => {
        CHAT_L2.map(challenge).forEach((c) => {
            expect({ id: c.id, sprites: c.setup.sprites }).toEqual({ id: c.id, sprites: ['Shimaraby'] });
            expect({ id: c.id, diagram: c.activityDiagram }).toEqual({ id: c.id, diagram: true });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect(c.partner).toBeNull();
            expect(isReadDiagram(c)).toBe(false);
        });
        expect(CHAT_L2.map((id) => ja[challenge(id).quiz.choices[challenge(id).quiz.answer].id])).toEqual([
            '3 回に 1 回',
            '使う時間を自分で制御できなくなる',
            '値を入れておき、あとで比べるのに使う',
        ]);
    });

    test('the palettes are the spec', () => {
        expect(allowedOpcodes(challenge('chat-l2-omikuji'))).toEqual({
            event: ['event_whenthisspriteclicked'],
            data: ['data_setvariableto', 'data_variable'],
            operators: ['operator_random', 'operator_equals'],
            control: ['control_if_else'],
            looks: ['looks_sayforsecs'],
        });
        expect(allowedOpcodes(challenge('chat-l2-timer'))).toEqual({
            event: ['event_whenflagclicked'],
            sensing: ['sensing_resettimer', 'sensing_timer'],
            control: ['control_wait_until'],
            operators: ['operator_gt'],
            looks: ['looks_say'],
        });
        expect(allowedOpcodes(challenge('chat-l2-janken'))).toEqual({
            event: ['event_whenthisspriteclicked'],
            sensing: ['sensing_askandwait', 'sensing_answer'],
            data: ['data_setvariableto', 'data_variable'],
            operators: ['operator_random', 'operator_equals'],
            control: ['control_if_else'],
            looks: ['looks_sayforsecs'],
        });
    });

    test('the ja-Hira strings and code of lesson 2 have no kanji', () => {
        Object.keys(jaHira)
            .filter((id) => /^gui\.lessons\.(lesson\.chat-l2|challenge\.chat-l2-)/.test(id))
            .forEach((id) =>
                expect({ id, text: jaHira[id] }).not.toEqual({ id, text: expect.stringMatching(/\p{Script=Han}/u) }),
            );
        CHAT_L2.forEach((id) => {
            const c = challenge(id);
            expect(localizeCode(c.code, 'ja-Hira')).not.toMatch(/\p{Script=Han}/u);
            c.steps.forEach((step) =>
                expect(localizeCode(step.blocks, 'ja-Hira') || '').not.toMatch(/\p{Script=Han}/u),
            );
        });
    });

    test('the task of the timer says 600 seconds for the real one and the code waits 10 seconds', () => {
        const c = challenge('chat-l2-timer');
        expect(ja[c.task.id]).toMatch(/600 秒/);
        expect(jaHira[c.task.id]).toMatch(/600 びょう/);
        expect(en[c.task.id]).toMatch(/600 seconds/);
        ['ja', 'ja-Hira', 'en'].forEach((locale) =>
            expect(localizeCode(c.code, locale)).toContain('wait until timer.value > 10'),
        );
    });

    test.each(['ja', 'ja-Hira', 'en'])(
        'the code (%s) uses the names the task and hints of that locale write',
        (locale) => {
            const names = {
                ja: { kuji: '$くじ', te: '$手' },
                'ja-Hira': { kuji: '$くじ', te: '$て' },
                en: { kuji: '$fortune', te: '$hand' },
            }[locale];
            expect(localizeCode(challenge('chat-l2-omikuji').code, locale)).toContain(`${names.kuji} = rand(1..3)`);
            expect(localizeCode(challenge('chat-l2-janken').code, locale)).toContain(`${names.te} = rand(0..2)`);
            const messages = LOCALES[locale];
            expect(messages[challenge('chat-l2-omikuji').task.id]).toContain(names.kuji.slice(1));
            expect(messages[challenge('chat-l2-janken').task.id]).toContain(names.te.slice(1));
        },
    );

    test('the goals accept the words and names the code of every locale uses', () => {
        const [, great, small] = challenge('chat-l2-omikuji').goal;
        ['大吉', 'だいきち', 'Great luck'].forEach((text) => expect(great.text.test(text)).toBe(true));
        ['小吉', 'しょうきち', 'Small luck'].forEach((text) => expect(small.text.test(text)).toBe(true));
        expect(great.variable.name).toEqual(['くじ', 'fortune']);
        const timeUp = challenge('chat-l2-timer').goal[1];
        ['10秒たったよ', '10びょう たったよ', '10 seconds passed'].forEach((text) =>
            expect(timeUp.text.test(text)).toBe(true),
        );
        const [, tie, noTie] = challenge('chat-l2-janken').goal;
        ['あいこ', 'Tie'].forEach((text) => expect(tie.text.test(text)).toBe(true));
        ['勝負あり', 'しょうぶあり', 'No tie'].forEach((text) => expect(noTie.text.test(text)).toBe(true));
        // 「あいこ」と「勝負あり」は取りちがえない（en の "No tie" は "Tie" の条件に入らない）
        expect(tie.text.test('No tie')).toBe(false);
        expect(tie.variable.name).toEqual(['手', 'て', 'hand']);
    });
});

// コース「チャットをつくろう」のレッスン 3「メッシュでつながろう」（#1643）
describe('chat course lesson 3 "メッシュでつながろう" (#1643)', () => {
    const CHAT_L3 = ['chat-l3-local-message', 'chat-l3-mesh-signal', 'chat-l3-mesh-variable'];
    const challenge = (id) => findChallenge(id).challenge;

    test('the lesson 3 has the 3 challenges in order', () => {
        const lesson = findLesson('chat-l3');
        expect(findCourse('chat-wo-tsukurou').lessons[2]).toBe(lesson);
        expect(ja[lesson.name.id]).toBe('メッシュでつながろう');
        expect(en[lesson.name.id]).toBe('Connect with Mesh');
        expect(lesson.allowDnclMode).toBe(false);
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(CHAT_L3.map((id, i) => `${i + 1} ${id}`));
    });

    test('3-1 starts with Shimaraby only, 3-2 with both, 3-3 also loads the mesh', () => {
        expect(challenge('chat-l3-local-message').setup).toEqual({ sprites: ['Shimaraby'] });
        // 3-2 は拡張機能「メッシュ」を生徒が足す
        expect(challenge('chat-l3-mesh-signal').setup).toEqual({ sprites: ['Shimaraby', 'Shimacat'] });
        expect(challenge('chat-l3-mesh-variable').setup).toEqual({
            sprites: ['Shimaraby', 'Shimacat'],
            extensions: ['meshV2'],
        });
        CHAT_L3.map(challenge).forEach((c) => {
            expect({ id: c.id, diagram: c.activityDiagram }).toEqual({ id: c.id, diagram: true });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect(c.spriteCodes.map((s) => s.sprite)).toEqual(['Shimacat']);
            expect(isReadDiagram(c)).toBe(false);
        });
        expect(challenge('chat-l3-local-message').partner).toBeNull();
        // クイズの正解は教科書の用語
        expect(CHAT_L3.map((id) => ja[challenge(id).quiz.choices[challenge(id).quiz.answer].id])).toEqual([
            '「送ったよ」という知らせだけ',
            'プロトコル',
            'IP アドレス',
        ]);
    });

    test('the palettes are the spec', () => {
        expect(allowedOpcodes(challenge('chat-l3-local-message'))).toEqual({
            event: ['event_whenflagclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
            sensing: ['sensing_askandwait', 'sensing_answer'],
            data: ['data_setvariableto', 'data_variable'],
            looks: ['looks_sayforsecs'],
        });
        expect(allowedOpcodes(challenge('chat-l3-mesh-signal'))).toEqual({
            event: ['event_whenkeypressed', 'event_broadcast', 'event_whenbroadcastreceived'],
            looks: ['looks_sayforsecs'],
        });
        expect(allowedOpcodes(challenge('chat-l3-mesh-variable'))).toEqual({
            event: ['event_whenkeypressed', 'event_whenthisspriteclicked'],
            data: ['data_setvariableto', 'data_variable'],
            looks: ['looks_sayforsecs'],
            meshV2: ['meshV2_getSensorValue'],
        });
    });

    test('the practice partners: 3-2 waves, 3-3 sets its mood and watches the mood of Shimaraby', () => {
        expect(challenge('chat-l3-mesh-signal').partner).toEqual({
            name: { ja: 'シマネコ', 'ja-Hira': 'シマネコ', en: 'Shimacat' },
            buttons: [
                {
                    label: { ja: 'てをふる', 'ja-Hira': 'てをふる', en: 'wave' },
                    broadcast: { ja: 'てをふる', 'ja-Hira': 'てをふる', en: 'wave' },
                },
            ],
            replies: [],
        });
        const partner = challenge('chat-l3-mesh-variable').partner;
        expect(partner.buttons.map((b) => [b.label.ja, b.set.variable.ja, b.set.value.ja])).toEqual([
            ['うれしい', 'シマネコのきぶん', 'うれしい'],
            ['ねむい', 'シマネコのきぶん', 'ねむい'],
        ]);
        expect(partner.watch).toEqual([
            { ja: 'シマラビのきぶん', 'ja-Hira': 'シマラビのきぶん', en: 'shimaraby_mood' },
        ]);
    });

    test('the names that reach the other side over the mesh are the same in ja and ja-Hira', () => {
        ['chat-l3-mesh-signal', 'chat-l3-mesh-variable'].forEach((id) => {
            const c = challenge(id);
            expect(localizeCode(c.code, 'ja')).toBe(localizeCode(c.code, 'ja-Hira'));
            c.spriteCodes.forEach((s) => expect(localizeCode(s.code, 'ja')).toBe(localizeCode(s.code, 'ja-Hira')));
            expect(JSON.stringify(normalizePartner(c.partner, 'ja'))).toBe(
                JSON.stringify(normalizePartner(c.partner, 'ja-Hira')),
            );
        });
    });

    test('the ja-Hira strings and code of lesson 3 have no kanji', () => {
        Object.keys(jaHira)
            .filter((id) => /^gui\.lessons\.(lesson\.chat-l3|challenge\.chat-l3-)/.test(id))
            .forEach((id) =>
                expect({ id, text: jaHira[id] }).not.toEqual({ id, text: expect.stringMatching(/\p{Script=Han}/u) }),
            );
        CHAT_L3.forEach((id) => {
            const c = challenge(id);
            expect(localizeCode(c.code, 'ja-Hira')).not.toMatch(/\p{Script=Han}/u);
            c.spriteCodes.forEach((s) => expect(localizeCode(s.code, 'ja-Hira')).not.toMatch(/\p{Script=Han}/u));
            c.steps.forEach((step) =>
                expect(localizeCode(step.blocks, 'ja-Hira') || '').not.toMatch(/\p{Script=Han}/u),
            );
        });
    });

    test.each(['ja', 'ja-Hira', 'en'])('the code (%s) uses the names the task of that locale writes', (locale) => {
        const names = {
            ja: { wave: 'てをふる', mood: 'シマラビのきぶん', partnerMood: 'シマネコのきぶん' },
            'ja-Hira': { wave: 'てをふる', mood: 'シマラビのきぶん', partnerMood: 'シマネコのきぶん' },
            en: { wave: 'wave', mood: 'shimaraby_mood', partnerMood: 'shimacat_mood' },
        }[locale];
        const messages = LOCALES[locale];
        const signal = challenge('chat-l3-mesh-signal');
        expect(localizeCode(signal.code, locale)).toContain(`broadcast("${names.wave}")`);
        expect(messages[signal.task.id]).toContain(names.wave);
        const variable = challenge('chat-l3-mesh-variable');
        expect(localizeCode(variable.code, locale)).toContain(`$${names.mood} = `);
        expect(localizeCode(variable.spriteCodes[0].code, locale)).toContain(
            `mesh.sensor_value("${names.partnerMood}")`,
        );
        expect(messages[variable.task.id]).toContain(names.mood);
        expect(messages[variable.task.id]).toContain(names.partnerMood);
    });
});

describe('chat course: how to connect over the mesh, in and outside a class', () => {
    const challenge = (id) => findChallenge(id).challenge;
    const CONNECT_STEPS = [
        ['chat-l3-mesh-signal', 3],
        ['chat-l4-send-once', 4],
    ];

    // 「メッシュにつなごう」を 2 ページ目に足したチャレンジ（#2060。文はどれも同じ共通の文言）
    const SHARED_CONNECT = [
        ['chat-l3-mesh-variable', 'pair'],
        ['chat-l4-send-repeat', 'pair'],
        ['chat-l4-both-ways', 'pair'],
        ['chat-l4-group', 'group'],
        ['chat-l4-dm', 'group'],
        ['chat-l5-read-receipt', 'pair'],
        ['chat-l5-ng-word', 'pair'],
        ['chat-l5-auto-reply', 'pair'],
        ['chat-l5-password', 'pair'],
        ['chat-l5-stamp', 'pair'],
    ];
    const ALL_CONNECT = [...CONNECT_STEPS, ...SHARED_CONNECT.map(([id]) => [id, 2])];

    test.each(SHARED_CONNECT)('%s has "connect to the mesh" on page 2 (%s)', (id, kind) => {
        const step = challenge(id).steps[1];
        expect(step.title.id).toBe(`gui.lessons.chat.connect.${kind}`);
        expect(step.classroomTitle.id).toBe(`gui.lessons.chat.connect.${kind}.inClass`);
        expect(step.target).toBe('practice-partner');
    });

    test.each(Object.keys(LOCALES))('the shared connect page says to go on if already connected (%s)', (locale) => {
        const next = {
            ja: 'つながっていれば次へ',
            'ja-Hira': 'つながっていれば つぎへ',
            en: 'if already connected, go on',
        }[locale];
        ['pair', 'group'].forEach((kind) => {
            expect(LOCALES[locale][`gui.lessons.chat.connect.${kind}`]).toContain(next);
            expect(LOCALES[locale][`gui.lessons.chat.connect.${kind}.inClass`]).toContain(next);
        });
    });

    test.each(Object.keys(LOCALES))('4-1 and 4-2 tell a pair to check the mesh status and history (%s)', (locale) => {
        const word = { ja: '状態と履歴', 'ja-Hira': 'じょうたいとりれき', en: 'status and history' }[locale];
        // 相手の画面の「受け取った」の行を見る（自分の「送った」では相手に届いたかわからない）
        const received = { ja: '「受け取った」', 'ja-Hira': '「うけとった」', en: '"received"' }[locale];
        [
            ['chat-l4-send-once', 6],
            ['chat-l4-send-repeat', 6],
        ].forEach(([id, number]) => {
            const step = challenge(id).steps[number - 1];
            expect(step.target).toBe('green-flag');
            expect(LOCALES[locale][step.title.id].toLowerCase()).toContain(word);
            expect(LOCALES[locale][step.title.id].toLowerCase()).toContain(received);
        });
    });

    test.each(Object.keys(LOCALES))('the shared connect page for a pair is short (%s)', (locale) => {
        // 役を決めるのは次のページ（roleStep）なので、ここには書かない
        const limit = { ja: 105, 'ja-Hira': 135, en: 240 }[locale];
        expect(LOCALES[locale]['gui.lessons.chat.connect.pair'].length).toBeLessThanOrEqual(limit);
        expect(LOCALES[locale]['gui.lessons.chat.connect.pair.inClass'].length).toBeLessThanOrEqual(limit);
    });

    test.each(Object.keys(LOCALES))(
        '3-3 tells a pair to look at the status window on the partner screen (%s)',
        (locale) => {
            const word = { ja: '状態と履歴', 'ja-Hira': 'じょうたいとりれき', en: 'status and history' }[locale];
            const step = challenge('chat-l3-mesh-variable').steps[8];
            expect(LOCALES[locale][step.title.id].toLowerCase()).toContain(word);
        },
    );

    test.each(CONNECT_STEPS)('%s step %d has a text for a student in a class', (id, number) => {
        const step = challenge(id).steps[number - 1];
        expect(step.title.id).toBe(`gui.lessons.challenge.${id}.step${number}`);
        expect(step.classroomTitle.id).toBe(`gui.lessons.challenge.${id}.step${number}.inClass`);
        expect(step.classroom).toBeUndefined();
    });

    test.each(Object.keys(LOCALES))(
        'in a class it says seat numbers, outside it says host and join (%s)',
        (locale) => {
            const words = {
                ja: { seat: '出席番号でつながる', host: 'ホスト' },
                'ja-Hira': { seat: 'しゅっせきばんごうで つながる', host: 'ホスト' },
                en: { seat: 'Connect by seat number', host: 'host' },
            }[locale];
            ALL_CONNECT.forEach(([id, number]) => {
                const step = challenge(id).steps[number - 1];
                expect(LOCALES[locale][step.classroomTitle.id]).toContain(words.seat);
                expect(LOCALES[locale][step.classroomTitle.id]).not.toContain(words.host);
                expect(LOCALES[locale][step.title.id].toLowerCase()).toContain(words.host.toLowerCase());
            });
        },
    );

    test('only the steps that tell how to connect have a classroom text', () => {
        const withClassroom = allChallenges().flatMap((c) =>
            c.steps.map((s, i) => (s.classroomTitle ? `${c.id}:${i + 1}` : null)).filter(Boolean),
        );
        expect(withClassroom.sort()).toEqual(ALL_CONNECT.map(([id, number]) => `${id}:${number}`).sort());
    });
});

describe('chat course: deciding the roles on a page of its own', () => {
    const challenge = (id) => findChallenge(id).challenge;
    // 役のあるチャレンジと、「役を決めよう」のページの番号（つなぐページのすぐ次。4-1 はつなぎ方の手順の次）
    const ROLE_PAGES = [
        ['chat-l3-mesh-variable', 3],
        ['chat-l4-send-once', 5],
        ['chat-l4-send-repeat', 3],
        ['chat-l4-both-ways', 3],
        ['chat-l5-read-receipt', 3],
        ['chat-l5-ng-word', 3],
        ['chat-l5-auto-reply', 3],
        ['chat-l5-password', 3],
        ['chat-l5-stamp', 3],
    ];

    test('every challenge with roles is listed', () => {
        expect(
            allChallenges()
                .filter((c) => c.roles)
                .map((c) => c.id)
                .sort(),
        ).toEqual(ROLE_PAGES.map(([id]) => id).sort());
    });

    test.each(ROLE_PAGES)('%s has the shared role page on page %d, right after connecting', (id, number) => {
        const steps = challenge(id).steps;
        const step = steps[number - 1];
        expect(step.kind).toBe(ROLE_STEP_KIND);
        expect(step.title.id).toBe('gui.lessons.chat.role');
        // 吹き出しのしっぽは課題バーの役のボタンを指す
        expect(step.target).toBe(HINT_TARGETS.ROLE_PICKER);
        expect(step.blocks || null).toBeNull();
        // すぐ前のページがつなぎ方（練習相手のパネルを指す・クラスの中の文がある）
        expect(steps[number - 2].target).toBe(HINT_TARGETS.PRACTICE_PARTNER);
        expect(steps[number - 2].classroomTitle).toBeTruthy();
        expect(steps.filter((s) => s.kind === ROLE_STEP_KIND)).toHaveLength(1);
    });

    test('challenges without roles have no role page', () => {
        allChallenges()
            .filter((c) => !c.roles)
            .forEach((c) =>
                expect({ id: c.id, role: c.steps.some((s) => s.kind === ROLE_STEP_KIND) }).toEqual({
                    id: c.id,
                    role: false,
                }),
            );
    });

    test.each(Object.keys(LOCALES))('the role page tells the buttons, and what to do alone (%s)', (locale) => {
        const words = {
            ja: ['課題バー', '「シマラビの役」', '「シマネコの役」', 'ひとりなら'],
            'ja-Hira': ['かだいバー', '「シマラビの やく」', '「シマネコの やく」', 'ひとりなら'],
            en: ['task bar', '"Shimaraby"', '"Shimacat"', 'On your own'],
        }[locale];
        const text = LOCALES[locale]['gui.lessons.chat.role'];
        words.forEach((word) => expect(text).toContain(word));
        // シマネコの役でも名前を入れかえない（ボタンの名前・ひとりのときの既定の役）
        expect(LOCALES[locale]['gui.lessons.chat.role.asShimacat']).toBe(text);
        expect(text.length).toBeLessThanOrEqual({ ja: 90, 'ja-Hira': 120, en: 200 }[locale]);
    });

    test.each(Object.keys(LOCALES))(
        'the connect pages and the 4-1 task no longer talk about the roles (%s)',
        (locale) => {
            const role = { ja: '役', 'ja-Hira': 'やく', en: 'role' }[locale];
            ['pair', 'pair.inClass', 'group', 'group.inClass'].forEach((kind) =>
                expect(LOCALES[locale][`gui.lessons.chat.connect.${kind}`]).not.toContain(role),
            );
            expect(LOCALES[locale][challenge('chat-l4-send-once').task.id]).not.toContain(role);
        },
    );
});

describe('chat course: hints that make a new message and get ready to receive', () => {
    const NEW_MESSAGE = {
        ja: '**▼ の「新しいメッセージ」で**',
        'ja-Hira': '**▼ の「あたらしいメッセージ」で**',
        en: '**with "New message" in its ▼**',
    };
    const RAW_NEW_MESSAGE = {
        ja: '「新しいメッセージ」',
        'ja-Hira': '「あたらしいメッセージ」',
        en: '"New message"',
    };
    const chatHintIds = () =>
        findCourse('chat-wo-tsukurou').lessons.flatMap((lesson) =>
            lesson.challenges.flatMap((c) => c.steps.flatMap((s) => [s.title, s.classroomTitle]).filter(Boolean)),
        );

    test.each(Object.keys(LOCALES))('every hint that makes a new message emphasizes the ▼ menu (%s)', (locale) => {
        const ids = chatHintIds().map(({ id }) => id);
        const making = ids.filter((id) => LOCALES[locale][id].includes(RAW_NEW_MESSAGE[locale]));
        expect(making.length).toBe(8);
        making.forEach((id) =>
            expect({ id, text: LOCALES[locale][id] }).toEqual({
                id,
                text: expect.stringContaining(NEW_MESSAGE[locale]),
            }),
        );
    });

    test.each(Object.keys(LOCALES))(
        'the pages that only make the partner send say they are a preparation (%s)',
        (locale) => {
            const ready = { ja: '準備をしよう', 'ja-Hira': 'じゅんびを しよう', en: 'Get ready' }[locale];
            [
                'gui.lessons.challenge.chat-l3-mesh-variable.step7',
                'gui.lessons.challenge.chat-l4-both-ways.step6',
            ].forEach((id) => expect(LOCALES[locale][id]).toContain(ready));
            expect(LOCALES.ja['gui.lessons.challenge.chat-l4-both-ways.step6']).toBe(
                'メッセージを受け取る準備をしよう。ひとりなら、練習相手のパネルの「こんにちは」を押そう（ペアなら、相手に送ってもらう）。' +
                    '相手のメッセージが届くと、「メッシュ」の「(　) センサーの値」の ▼ に「シマネコのメッセージ」が出る。',
            );
        },
    );
});

describe('the emphasis marks (**) in the hints', () => {
    test.each(Object.keys(LOCALES))('are in pairs and are the same in number across locales (%s)', (locale) => {
        allChallenges().forEach((c) => {
            [...c.steps.flatMap((s) => [s.title, s.classroomTitle]), ...c.debug].filter(Boolean).forEach(({ id }) => {
                const text = LOCALES[locale][id];
                const marks = (text.match(/\*\*/g) || []).length;
                expect({ id, even: marks % 2 }).toEqual({ id, even: 0 });
                expect({ id, marks }).toEqual({ id, marks: (LOCALES.ja[id].match(/\*\*/g) || []).length });
            });
        });
    });

    test('the chat hints that make you select the other sprite are emphasized', () => {
        expect(ja['gui.lessons.challenge.chat-l3-local-message.step3']).toMatch(
            /^\*\*シマラビをえらびなおして\*\*、/,
        );
        expect(ja['gui.lessons.challenge.chat-l3-local-message.step5']).toMatch(/^\*\*シマネコをえらんで\*\*、/);
    });

    test('the activity diagram hints describe the shapes, not pentagons or boxes', () => {
        Object.keys(LOCALES).forEach((locale) =>
            Object.entries(LOCALES[locale])
                .filter(([id]) => id.startsWith('gui.lessons.challenge.'))
                .forEach(([id, text]) =>
                    expect({ id, text }).toEqual({
                        id,
                        text: expect.not.stringMatching(
                            /五角形|へこんだ箱|ごかくけい|へこんだ はこ|pentagon|notched box/,
                        ),
                    }),
                ),
        );
    });
});

describe('chat course lesson 4 "チャットを作ろう" (#1644)', () => {
    const CHAT_L4 = ['chat-l4-send-once', 'chat-l4-send-repeat', 'chat-l4-both-ways', 'chat-l4-group', 'chat-l4-dm'];
    const challenge = (id) => findChallenge(id).challenge;

    test('the lesson 4 has the 5 challenges in order', () => {
        const lesson = findLesson('chat-l4');
        expect(findCourse('chat-wo-tsukurou').lessons[3]).toBe(lesson);
        expect(ja[lesson.name.id]).toBe('チャットを作ろう');
        expect(jaHira[lesson.name.id]).toBe('チャットを つくろう');
        expect(en[lesson.name.id]).toBe('Make a Chat');
        expect(lesson.allowDnclMode).toBe(false);
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(CHAT_L4.map((id, i) => `${i + 1} ${id}`));
    });

    test('every stage starts from the answer of the stage before, with both sprites and the mesh', () => {
        const ids = CHAT_L4.map(challenge);
        ids.forEach((c) => {
            expect({ id: c.id, sprites: c.setup.sprites, extensions: c.setup.extensions }).toEqual({
                id: c.id,
                sprites: ['Shimaraby', 'Shimacat'],
                extensions: ['meshV2'],
            });
            expect({ id: c.id, diagram: c.activityDiagram }).toEqual({ id: c.id, diagram: true });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect(isReadDiagram(c)).toBe(false);
            expect(c.partner).not.toBeNull();
        });
        const [once, repeat, both, group, dm] = ids;
        expect(once.setup.code).toBeUndefined();
        // 4-2・4-3 は前の段の答え（シマラビ）、4-5 は 4-4 の答え（シマラビとシマネコ）
        expect(repeat.setup.code).toBe(once.code);
        expect(both.setup.code).toBe(repeat.code);
        expect(dm.setup.code).toBe(group.code);
        expect(dm.setup.spriteCodes).toEqual(group.spriteCodes);
        // 4-4 は 4-3 を「みんなで 1 つ」の変数・メッセージに置きかえた形（シマネコはみんなの発言を言う）
        ['ja', 'ja-Hira', 'en'].forEach((locale) => {
            const name = locale === 'en' ? 'message' : 'メッセージ';
            const start = localizeCode(group.setup.code, locale);
            expect(start).toContain(`$${name} = answer`);
            expect(start).toContain(`broadcast("${name}")`);
            expect(localizeCode(group.setup.spriteCodes[0].code, locale)).toBe(
                `when_receive("${name}") do\n  say(mesh.sensor_value("${name}"))\nend\n`,
            );
        });
        expect(CHAT_L4.map((id) => challenge(id).spriteCodes.map((s) => s.sprite))).toEqual([
            [],
            [],
            ['Shimacat'],
            ['Shimacat'],
            ['Shimacat'],
        ]);
        // クイズの正解は教科書の用語
        expect(CHAT_L4.map((id) => ja[challenge(id).quiz.choices[challenge(id).quiz.answer].id])).toEqual([
            'パケット',
            'サーバ',
            '「(変数) を言う」を「(〜のセンサーの値) を言う」に変えた',
            '人が増えるたびに、変数と受け取るプログラムを足すことになる',
            '機密性',
        ]);
    });

    test('the palettes are the spec', () => {
        const send = {
            event: ['event_whenflagclicked', 'event_broadcast'],
            sensing: ['sensing_askandwait', 'sensing_answer'],
            data: ['data_setvariableto', 'data_variable'],
        };
        expect(allowedOpcodes(challenge('chat-l4-send-once'))).toEqual(send);
        expect(allowedOpcodes(challenge('chat-l4-send-repeat'))).toEqual({ ...send, control: ['control_forever'] });
        expect(allowedOpcodes(challenge('chat-l4-both-ways'))).toEqual({
            ...send,
            event: ['event_whenflagclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
            control: ['control_forever'],
            looks: ['looks_say'],
            meshV2: ['meshV2_getSensorValue'],
        });
        expect(allowedOpcodes(challenge('chat-l4-group')).operators).toEqual(['operator_join']);
        expect(allowedOpcodes(challenge('chat-l4-dm'))).toEqual({
            event: ['event_whenflagclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
            control: ['control_forever', 'control_if'],
            sensing: ['sensing_askandwait', 'sensing_answer'],
            data: ['data_setvariableto', 'data_variable'],
            operators: ['operator_join', 'operator_equals'],
            looks: ['looks_say'],
            meshV2: ['meshV2_getSensorValue'],
        });
    });

    test('the practice partners: 4-1〜4-3 talk with Shimacat, 4-4 sends as two people, 4-5 sends DMs', () => {
        const pair = normalizePartner(challenge('chat-l4-send-once').partner, 'ja');
        expect(pair.buttons.map((b) => [b.label, b.set, b.broadcast])).toEqual([
            ['こんにちは', [{ name: 'シマネコのメッセージ', value: 'こんにちは' }], 'シマネコのメッセージ'],
            ['元気？', [{ name: 'シマネコのメッセージ', value: '元気？' }], 'シマネコのメッセージ'],
        ]);
        expect(pair.replies.map((r) => [r.onBroadcast, r.set, r.broadcast])).toEqual([
            ['シマラビのメッセージ', [{ name: 'シマネコのメッセージ', value: 'とどいたよ' }], 'シマネコのメッセージ'],
        ]);
        ['chat-l4-send-repeat', 'chat-l4-both-ways'].forEach((id) =>
            expect(normalizePartner(challenge(id).partner, 'ja')).toEqual(pair),
        );
        const group = normalizePartner(challenge('chat-l4-group').partner, 'ja');
        expect(group.buttons.map((b) => [b.label, b.set, b.broadcast])).toEqual([
            ['シマネコとして送る', [{ name: 'メッセージ', value: 'シマネコ：こんにちは' }], 'メッセージ'],
            ['ミミとして送る', [{ name: 'メッセージ', value: 'ミミ：よろしくね' }], 'メッセージ'],
        ]);
        const dm = normalizePartner(challenge('chat-l4-dm').partner, 'ja');
        expect(dm.buttons.map((b) => [b.label, b.set, b.broadcast])).toEqual([
            [
                'あなたに DM',
                [
                    // あて先は押したときの生徒の名前。まだ入れていなければ送らない（教員レビュー）
                    { name: 'あてさき', fromVariable: 'なまえ', orVariables: ['名前', 'name'], required: true },
                    { name: 'メッセージ', value: 'シマネコ：ないしょだよ' },
                ],
                'メッセージ',
            ],
            [
                'ミミに DM',
                [
                    { name: 'あてさき', value: 'ミミ' },
                    { name: 'メッセージ', value: 'シマネコ：ミミにだけ' },
                ],
                'メッセージ',
            ],
        ]);
    });

    test('the names that reach the other side over the mesh are the same in ja and ja-Hira', () => {
        CHAT_L4.forEach((id) => {
            const c = challenge(id);
            const names = (code) =>
                [...code.matchAll(/(?:\$|broadcast\("|when_receive\("|sensor_value\(")([^\s"=)]+)/g)].map(
                    (m) => m[1],
                );
            expect(names(localizeCode(c.code, 'ja'))).toEqual(names(localizeCode(c.code, 'ja-Hira')));
            c.spriteCodes.forEach((s) =>
                expect(names(localizeCode(s.code, 'ja'))).toEqual(names(localizeCode(s.code, 'ja-Hira'))),
            );
            const partnerNamesOf = (locale) => {
                const p = normalizePartner(c.partner, locale);
                return [...p.buttons, ...p.replies].map((a) => [
                    a.broadcast,
                    a.onBroadcast,
                    a.set.map((x) => x.name),
                ]);
            };
            expect(partnerNamesOf('ja')).toEqual(partnerNamesOf('ja-Hira'));
        });
    });

    test('the ja-Hira strings and code of lesson 4 have no kanji', () => {
        Object.keys(jaHira)
            .filter((id) => /^gui\.lessons\.(lesson\.chat-l4|challenge\.chat-l4-)/.test(id))
            .forEach((id) =>
                expect({ id, text: jaHira[id] }).not.toEqual({ id, text: expect.stringMatching(/\p{Script=Han}/u) }),
            );
        CHAT_L4.forEach((id) => {
            const c = challenge(id);
            expect(localizeCode(c.code, 'ja-Hira')).not.toMatch(/\p{Script=Han}/u);
            c.spriteCodes.forEach((s) => expect(localizeCode(s.code, 'ja-Hira')).not.toMatch(/\p{Script=Han}/u));
            c.steps.forEach((step) =>
                expect(localizeCode(step.blocks, 'ja-Hira') || '').not.toMatch(/\p{Script=Han}/u),
            );
            expect(JSON.stringify(normalizePartner(c.partner, 'ja-Hira'))).not.toMatch(/\p{Script=Han}/u);
        });
    });

    test.each(['ja', 'ja-Hira', 'en'])('the code (%s) uses the names the task of that locale writes', (locale) => {
        const names = {
            ja: {
                mine: 'シマラビのメッセージ',
                theirs: 'シマネコのメッセージ',
                group: 'メッセージ',
                name: 'なまえ',
                to: 'あてさき',
            },
            'ja-Hira': {
                mine: 'シマラビのメッセージ',
                theirs: 'シマネコのメッセージ',
                group: 'メッセージ',
                name: 'なまえ',
                to: 'あてさき',
            },
            en: { mine: 'shimaraby_message', theirs: 'shimacat_message', group: 'message', name: 'name', to: 'to' },
        }[locale];
        const messages = LOCALES[locale];
        const code = (id) => localizeCode(challenge(id).code, locale);
        expect(code('chat-l4-send-once')).toContain(`broadcast("${names.mine}")`);
        expect(messages[challenge('chat-l4-send-once').task.id]).toContain(names.mine);
        expect(localizeCode(challenge('chat-l4-both-ways').spriteCodes[0].code, locale)).toContain(
            `mesh.sensor_value("${names.theirs}")`,
        );
        expect(messages[challenge('chat-l4-both-ways').task.id]).toContain(names.theirs);
        expect(code('chat-l4-group')).toContain(`$${names.group} = $${names.name} + `);
        expect(messages[challenge('chat-l4-group').task.id]).toContain(names.name);
        expect(code('chat-l4-dm')).toContain(`$${names.to} = answer`);
        expect(localizeCode(challenge('chat-l4-dm').spriteCodes[0].code, locale)).toContain(
            `if mesh.sensor_value("${names.to}") == $${names.name}`,
        );
        expect(messages[challenge('chat-l4-dm').task.id]).toContain(names.to);
    });
});

describe('chat course lesson 5 "チャットを改良しよう" (#1645)', () => {
    const CHAT_L5 = [
        'chat-l5-read-receipt',
        'chat-l5-ng-word',
        'chat-l5-auto-reply',
        'chat-l5-password',
        'chat-l5-stamp',
    ];
    const challenge = (id) => findChallenge(id).challenge;

    test('the lesson 5 has the 5 themes in order, and one theme is enough for its ✓', () => {
        const lesson = findLesson('chat-l5');
        expect(findCourse('chat-wo-tsukurou').lessons[4]).toBe(lesson);
        expect(ja[lesson.name.id]).toBe('チャットを改良しよう');
        expect(jaHira[lesson.name.id]).toBe('チャットを かいりょう しよう');
        expect(en[lesson.name.id]).toBe('Improve the Chat');
        expect(lesson.allowDnclMode).toBe(false);
        expect(lesson.checkCount).toBe(1);
        expect(lesson.challenges.map((c) => `${c.number} ${c.id}`)).toEqual(CHAT_L5.map((id, i) => `${i + 1} ${id}`));
        // ほかのレッスンは全部できたら ✓
        findCourse('chat-wo-tsukurou')
            .lessons.slice(0, 4)
            .forEach((l) =>
                expect({ id: l.id, required: l.checkCount }).toEqual({ id: l.id, required: l.challenges.length }),
            );
    });

    test('every theme starts from the answer of 4-3 (the chat of two), with both sprites and the mesh', () => {
        const both = challenge('chat-l4-both-ways');
        CHAT_L5.map(challenge).forEach((c) => {
            expect({ id: c.id, sprites: c.setup.sprites, extensions: c.setup.extensions }).toEqual({
                id: c.id,
                sprites: ['Shimaraby', 'Shimacat'],
                extensions: ['meshV2'],
            });
            expect({ id: c.id, code: c.setup.code, spriteCodes: c.setup.spriteCodes }).toEqual({
                id: c.id,
                code: both.code,
                spriteCodes: both.spriteCodes,
            });
            expect({ id: c.id, diagram: c.activityDiagram }).toEqual({ id: c.id, diagram: true });
            expect({ id: c.id, errors: validateQuiz(c.quiz) }).toEqual({ id: c.id, errors: [] });
            expect({ id: c.id, errors: validateGoal(c.goal) }).toEqual({ id: c.id, errors: [] });
            expect(isReadDiagram(c)).toBe(false);
            expect(c.partner).not.toBeNull();
            // どのテーマも、課題の全文の最後に「さらに工夫するなら」（判定しない）
            ['ja', 'ja-Hira', 'en'].forEach((locale) =>
                expect(LOCALES[locale][c.task.id]).toMatch(
                    /\n(さらに工夫するなら|さらに くふう するなら|To go further): [^\n]+$/,
                ),
            );
        });
        // 5-2 だけ、ステージにリスト「NGワード」を用意するプログラムを入れて始める
        expect(CHAT_L5.filter((id) => challenge(id).setup.stageCode)).toEqual(['chat-l5-ng-word']);
        expect(localizeCode(challenge('chat-l5-ng-word').setup.stageCode, 'ja')).toBe(
            'when_flag_clicked do\n  $NGワード.clear\n  $NGワード.push("ばか")\n  $NGワード.push("きらい")\nend\n',
        );
        // 答えは 4-3 の答えに足した形（シマラビの送る側はどのテーマにも入っている）
        CHAT_L5.forEach((id) =>
            ['ja', 'ja-Hira', 'en'].forEach((locale) =>
                expect(localizeCode(challenge(id).code, locale)).toContain(
                    locale === 'en' ? 'broadcast("shimaraby_message")' : 'broadcast("シマラビのメッセージ")',
                ),
            ),
        );
        // クイズの正解は教科書の用語
        expect(CHAT_L5.map((id) => ja[challenge(id).quiz.choices[challenge(id).quiz.answer].id])).toEqual([
            '双方向性',
            'フィルタリング',
            '一度も返信しない',
            '認証システム',
            '静止画',
        ]);
    });

    test('the sound and costumes of the answers are the real ones of the library Shimacat', () => {
        const spritesJson = require('../../../../src/lib/libraries/sprites.json');
        const shimacat = spritesJson.find((sprite) => sprite.name === 'Shimacat');
        ['ja', 'ja-Hira', 'en'].forEach((locale) => {
            const read = localizeCode(challenge('chat-l5-read-receipt').spriteCodes[0].code, locale);
            expect(read).toContain('play("Meow")');
            expect(shimacat.sounds.map((sound) => sound.name)).toContain('Meow');
            const stamp = localizeCode(challenge('chat-l5-stamp').spriteCodes[0].code, locale);
            ['shimacat-a', 'shimacat-b'].forEach((name) => {
                expect(stamp).toContain(`switch_costume("${name}")`);
                expect(shimacat.costumes.map((costume) => costume.name)).toContain(name);
            });
        });
    });

    test('the practice partners: 5-1 talks and reads, 5-3 has no automatic reply, 5-5 sends stamps and replies', () => {
        const pair = normalizePartner(challenge('chat-l4-both-ways').partner, 'ja');
        ['chat-l5-ng-word', 'chat-l5-password'].forEach((id) =>
            expect(normalizePartner(challenge(id).partner, 'ja')).toEqual(pair),
        );
        const read = normalizePartner(challenge('chat-l5-read-receipt').partner, 'ja');
        expect(read.buttons.map((b) => [b.label, b.set, b.broadcast])).toEqual([
            ['発言する', [{ name: 'シマネコのメッセージ', value: '明日の持ち物は？' }], 'シマネコのメッセージ'],
            ['既読にする', [], 'シマネコがよんだ'],
        ]);
        expect(read.replies).toEqual(pair.replies);
        // 自動返信どうしが行き来し続けないように、練習相手は自動の返事をしない
        const auto = normalizePartner(challenge('chat-l5-auto-reply').partner, 'ja');
        expect(auto.buttons).toEqual(pair.buttons);
        expect(auto.replies).toEqual([]);
        const stamp = normalizePartner(challenge('chat-l5-stamp').partner, 'ja');
        expect(stamp.buttons.map((b) => [b.label, b.broadcast])).toEqual([['スタンプを送る', 'シマネコのスタンプ']]);
        // 「とどいたよ」の返事も残す（最初から入っている、相手のメッセージを言うプログラムが動くように）
        expect(stamp.replies.map((r) => [r.onBroadcast, r.broadcast])).toEqual([
            ['シマラビのメッセージ', 'シマネコのメッセージ'],
            ['シマラビのスタンプ', 'シマネコのスタンプ'],
        ]);
        expect(stamp.replies[0]).toEqual(pair.replies[0]);
    });

    test('the names that reach the other side over the mesh are the same in ja and ja-Hira', () => {
        CHAT_L5.forEach((id) => {
            const c = challenge(id);
            const names = (code) =>
                [...code.matchAll(/(?:\$|broadcast\("|when_receive\("|sensor_value\(")([^\s"=)]+)/g)].map(
                    (m) => m[1],
                );
            expect(names(localizeCode(c.code, 'ja'))).toEqual(names(localizeCode(c.code, 'ja-Hira')));
            c.spriteCodes.forEach((s) =>
                expect(names(localizeCode(s.code, 'ja'))).toEqual(names(localizeCode(s.code, 'ja-Hira'))),
            );
            const partnerNamesOf = (locale) => {
                const p = normalizePartner(c.partner, locale);
                return [...p.buttons, ...p.replies].map((a) => [
                    a.broadcast,
                    a.onBroadcast,
                    a.set.map((x) => x.name),
                ]);
            };
            expect(partnerNamesOf('ja')).toEqual(partnerNamesOf('ja-Hira'));
        });
    });

    test('the ja-Hira strings and code of lesson 5 have no kanji', () => {
        Object.keys(jaHira)
            .filter((id) => /^gui\.lessons\.(lesson\.chat-l5|challenge\.chat-l5-)/.test(id))
            .forEach((id) =>
                expect({ id, text: jaHira[id] }).not.toEqual({ id, text: expect.stringMatching(/\p{Script=Han}/u) }),
            );
        CHAT_L5.forEach((id) => {
            const c = challenge(id);
            expect(localizeCode(c.code, 'ja-Hira')).not.toMatch(/\p{Script=Han}/u);
            c.spriteCodes.forEach((s) => expect(localizeCode(s.code, 'ja-Hira')).not.toMatch(/\p{Script=Han}/u));
            expect(localizeCode(c.setup.stageCode, 'ja-Hira') || '').not.toMatch(/\p{Script=Han}/u);
            c.steps.forEach((step) =>
                expect(localizeCode(step.blocks, 'ja-Hira') || '').not.toMatch(/\p{Script=Han}/u),
            );
            expect(JSON.stringify(normalizePartner(c.partner, 'ja-Hira'))).not.toMatch(/\p{Script=Han}/u);
        });
    });

    test('the hint pages that point at the practice partner panel target it', () => {
        // パネルを押すページは practice-partner を指す（ヒントの吹き出しがパネルにかからないように）
        CHAT_L5.forEach((id) => {
            const c = challenge(id);
            c.steps.forEach((step, i) => {
                const text = ja[step.title.id];
                if (/練習相手のパネル/.test(text) && step.target !== HINT_TARGETS.GREEN_FLAG) {
                    expect({ id, step: i + 1, target: step.target }).toEqual({
                        id,
                        step: i + 1,
                        target: HINT_TARGETS.PRACTICE_PARTNER,
                    });
                }
            });
        });
    });

    test.each(['ja', 'ja-Hira', 'en'])('the code (%s) uses the names the task of that locale writes', (locale) => {
        const names = {
            ja: { read: 'シマラビがよんだ', list: 'NGワード', password: 'もみじ', stamp: 'シマラビのスタンプ' },
            'ja-Hira': {
                read: 'シマラビがよんだ',
                list: 'NGワード',
                password: 'もみじ',
                stamp: 'シマラビのスタンプ',
            },
            en: { read: 'shimaraby_read', list: 'ng_words', password: 'maple', stamp: 'shimaraby_stamp' },
        }[locale];
        const messages = LOCALES[locale];
        const code = (id) => localizeCode(challenge(id).code, locale);
        expect(localizeCode(challenge('chat-l5-read-receipt').spriteCodes[0].code, locale)).toContain(
            `broadcast("${names.read}")`,
        );
        expect(messages[challenge('chat-l5-read-receipt').task.id]).toContain(names.read);
        expect(code('chat-l5-ng-word')).toContain(`$${names.list}.include?(answer)`);
        expect(messages[challenge('chat-l5-ng-word').task.id]).toContain(names.list);
        expect(code('chat-l5-auto-reply')).toContain('if Time.now.hour > 21');
        expect(messages[challenge('chat-l5-auto-reply').task.id]).toContain('21');
        expect(code('chat-l5-password')).toContain(`if answer == "${names.password}"`);
        expect(messages[challenge('chat-l5-password').task.id]).toContain(names.password);
        expect(code('chat-l5-stamp')).toContain(`broadcast("${names.stamp}")`);
        expect(messages[challenge('chat-l5-stamp').task.id]).toContain(names.stamp);
    });
});

// ヒントの形（コース「チャットをつくろう」全体）: 1 ページ目は「課題の説明と、アクティビティ図を理解しよう」で、
// 図はこのページだけに出す（lesson-hint.jsx は index 0 だけに図を描く）。手順は 2 ページ目から。
// ヒント・つまずき・課題の文に色の言葉を書かない（ブロックの絵が付くので、色は絵に任せる。カテゴリ名だけで書く）
describe('chat course hints: the diagram page first and no color words', () => {
    const chatChallenges = () => findCourse('chat-wo-tsukurou').lessons.flatMap((l) => l.challenges);
    const FIRST = {
        ja: '課題の説明と、アクティビティ図を理解しよう。',
        'ja-Hira': 'かだいの せつめいと、アクティビティずを りかいしよう。',
        en: 'Understand the task and the activity diagram.',
    };
    // ブロックのなかまの色（ja / ja-Hira / en）
    const COLOR_WORDS =
        /黄色|オレンジ|紫|水色|緑|ピンク|青|きいろ|むらさき|みずいろ|みどり|あおい|\b(yellow|orange|purple|light blue|green|pink|blue)\b/i;

    test('every challenge shows the diagram and its first hint page is the diagram page', () => {
        chatChallenges()
            .filter((c) => !isReadDiagram(c))
            .forEach((c) => {
                expect({ id: c.id, diagram: c.activityDiagram }).toEqual({ id: c.id, diagram: true });
                const [first, ...rest] = c.steps;
                expect({ id: c.id, kind: first.kind, target: first.target, blocks: first.blocks }).toEqual({
                    id: c.id,
                    kind: UNDERSTAND_STEP_KIND,
                    target: HINT_TARGETS.STAGE,
                    blocks: null,
                });
                Object.entries(FIRST).forEach(([locale, text]) =>
                    expect({ id: c.id, locale, first: LOCALES[locale][first.title.id].startsWith(text) }).toEqual({
                        id: c.id,
                        locale,
                        first: true,
                    }),
                );
                // 2 ページ目からは手順だけ（図のページは 1 つ）
                expect({ id: c.id, more: rest.filter((s) => s.kind === UNDERSTAND_STEP_KIND).length }).toEqual({
                    id: c.id,
                    more: 0,
                });
                expect(rest.length).toBeGreaterThan(0);
            });
    });

    test('the read-and-build challenge keeps its own diagram page first', () => {
        chatChallenges()
            .filter(isReadDiagram)
            .forEach((c) => expect(c.steps[0].kind).toBe('read'));
    });

    test('the hints, the debug tips and the task of every challenge have no color words (en / ja / ja-Hira)', () => {
        chatChallenges().forEach((c) => {
            const ids = [c.task, ...c.steps.map((s) => s.title), ...c.debug].filter(Boolean).map((d) => d.id);
            Object.entries(LOCALES).forEach(([locale, messages]) =>
                ids
                    .filter((id) => messages[id])
                    .forEach((id) =>
                        expect({ locale, id, text: messages[id] }).not.toEqual({
                            locale,
                            id,
                            text: expect.stringMatching(COLOR_WORDS),
                        }),
                    ),
            );
        });
    });
});

describe('courseSize (#1888)', () => {
    test('counts the lessons and the challenges of a course from its data', () => {
        const course = findCourse('kyou-kara-programmer');
        expect(courseSize(course)).toEqual({
            lessonCount: course.lessons.length,
            challengeCount: course.lessons.reduce((sum, lesson) => sum + lesson.challenges.length, 0),
        });
        expect(courseSize(course)).toEqual({ lessonCount: 3, challengeCount: 11 });
    });
});
