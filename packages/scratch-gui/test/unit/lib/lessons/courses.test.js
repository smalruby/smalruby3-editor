/**
 * Data-shape coverage for the lesson courses (コース › レッスン › チャレンジ).
 *
 * The regressions guarded here are the skeleton every sub-issue builds on (ids are
 * unique and stable, the 11 challenges are split into the 3 lessons of the spec, every challenge has the
 * normalized fields, every message id resolves in en / ja / ja-Hira) and the spec of
 * the challenges whose contents are in (task / palette / hints / goal / code).
 */
import { allowedBlockOpcode } from '../../../../src/lib/lessons/block-defaults';
import {
    CATEGORIES,
    COURSES,
    LANGUAGES,
    defineChallenge,
    defineLesson,
    findChallenge,
    findCourse,
    challengeCodeCandidates,
    challengeCodeFor,
    findLesson,
    localizeCode,
} from '../../../../src/lib/lessons/courses';
import { validateGoal } from '../../../../src/lib/lessons/goal';
import { rubyToBlocksXml } from '../../../../src/lib/lessons/hint-blocks';
import { HINT_TARGETS } from '../../../../src/lib/lessons/hint-targets';
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
        course.lessons.forEach((lesson) => {
            messages.push(lesson.name);
            lesson.challenges.forEach((challenge) => {
                messages.push(challenge.name);
                if (challenge.task) messages.push(challenge.task);
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
        // クリアの印（「プログラマー デビュー！」）は無い。全部できたらレッスン表のコース名の前に ✓（#1530）
        expect(course.badge).toBeUndefined();
        expect(COURSES[0]).toBe(course);
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
                '旗を押したら 0 にもどすプログラムを作ろう。',
                '押されたら 1 ふやして、その数を言うプログラムを作ろう。',
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
                '旗を押したら、トークを空にするプログラムを作ろう。',
                '押されたら聞いて、答えをトークに追加するプログラムを作ろう。',
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
            allChallenges().forEach((c) => {
                const targets = c.steps.map((s) => s.target);
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
        // できあがりのプログラムの帽子のブロック（`when_...`）は、どれもいずれかのヒントの絵に描く
        test.each(['ja', 'ja-Hira', 'en'])('every hat block of the answer is drawn in a hint (%s)', (locale) => {
            allChallenges().forEach((c) => {
                const { code, spriteCodes } = challengeCodeFor(c, locale);
                const hats = [code, ...spriteCodes.map((s) => s.code)]
                    .join('\n')
                    .split('\n')
                    .filter((line) => /^when_\w+/.test(line))
                    .map((line) => line.replace(/ do$/, ''));
                expect(hats.length).toBeGreaterThan(0);
                const drawn = c.steps.map((s) => localizeCode(s.blocks, locale) || '');
                hats.forEach((hat) => {
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
                expect(challenges).toHaveLength(11);
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
});
