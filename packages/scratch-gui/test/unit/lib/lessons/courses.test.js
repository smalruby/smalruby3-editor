/**
 * Data-shape coverage for the lesson courses (コース › レッスン › チャレンジ).
 *
 * The regressions guarded here are the skeleton every sub-issue builds on (ids are
 * unique and stable, the lesson clear rule matches the spec, every challenge has the
 * normalized fields, every message id resolves in en / ja / ja-Hira) and the spec of
 * the challenges whose contents are in (task / palette / hints / goal / code).
 */
import {
    CATEGORIES,
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
import { HINT_TARGETS } from '../../../../src/lib/lessons/hint-targets';
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

    test('every lesson 1 challenge has a category (the block family shown in the lessons library)', () => {
        const lesson = findLesson('blocks-l1');
        const known = Object.values(CATEGORIES);
        lesson.challenges.forEach((c) => expect(known).toContain(c.category));
        expect(lesson.challenges.map((c) => c.category)).toEqual([
            'sound',
            'motion',
            'looks',
            'control',
            'control',
            'sensing',
            'operators',
            'variables',
            'events',
            'extensions',
            'lists',
        ]);
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
            category: null,
            skills: [],
            goal: null,
            required: true,
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

    test.each(Object.keys(LOCALES))('every message id resolves in %s', (locale) => {
        collectMessages().forEach((message) => {
            expect(LOCALES[locale][message.id]).toEqual(expect.any(String));
        });
    });

    describe('lesson 1 challenges 1-4 (the spec of the sub-issue)', () => {
        const { PALETTE, CODE_AREA, STAGE, SPRITE_LIST, SOUNDS_TAB, COSTUMES_TAB, BACKDROP, KEYBOARD } = HINT_TARGETS;
        const challenge = (id) => findChallenge(id).challenge;
        const hints = (c) => c.steps.map((s) => [s.target, s.blocks, s.spotlight]);

        test('1 キーで音を鳴らそう: space key plays two sounds in order', () => {
            const c = challenge('blocks-l1-key-sound');
            expect(c.required).toBe(false);
            expect(ja[c.task.id]).toBe('スペースキーを押したら、ネコが「ニャー」と鳴いたあと、「Owl」の音が鳴るようにしよう');
            expect(c.skills.map((s) => ja[s.name.id])).toEqual(['キーで動かす', '音を鳴らす', '音を足す']);
            expect(c.allowedBlocks).toEqual({
                event: ['event_whenkeypressed'],
                sound: ['sound_playuntildone', 'sound_play'],
            });
            expect(hints(c)).toEqual([
                [SOUNDS_TAB, null, false],
                [PALETTE, 'when_key_pressed("space") do\nend\n', true],
                [PALETTE, 'play_until_done("ニャー")\n', true],
                [CODE_AREA, 'play("Owl")\n', false],
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
            expect(c.code).toBe('when_key_pressed("space") do\n  play_until_done("ニャー")\n  play("Owl")\nend\n');
            expect(c.codeTarget).toBeNull();
        });

        test('2 矢印キーで動かそう: up and down arrow keys change y both ways', () => {
            const c = challenge('blocks-l1-arrow-move');
            expect(c.required).toBe(false);
            expect(ja[c.task.id]).toBe('上向き矢印キーで上へ、下向き矢印キーで下へ、ネコを動かそう');
            expect(c.skills.map((s) => ja[s.name.id])).toEqual(['座標で動かす', 'ブロックを複製する']);
            expect(c.allowedBlocks).toEqual({ event: ['event_whenkeypressed'], motion: ['motion_changeyby'] });
            expect(hints(c)).toEqual([
                [PALETTE, 'self.y += 10\n', false],
                [PALETTE, 'when_key_pressed("up arrow") do\nend\n', false],
                [CODE_AREA, null, false],
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
            expect(c.code).toBe(
                'when_key_pressed("up arrow") do\n  self.y += 10\nend\n\nwhen_key_pressed("down arrow") do\n  self.y += -10\nend\n',
            );
        });

        test('3 押したら話そう (required): add a costume, click the cat, say and next costume', () => {
            const c = challenge('blocks-l1-click-say');
            expect(c.required).toBe(true);
            expect(ja[c.task.id]).toBe(
                'ネコに好きなコスチュームを足して、押したら「こんにちは！」と言って、見た目がかわるようにしよう',
            );
            expect(c.skills.map((s) => ja[s.name.id])).toEqual(['押したら動く', 'セリフを言う', 'コスチュームを足す']);
            expect(c.allowedBlocks).toEqual({
                event: ['event_whenthisspriteclicked'],
                looks: ['looks_sayforsecs', 'looks_nextcostume'],
            });
            expect(hints(c)).toEqual([
                [COSTUMES_TAB, null, false],
                [PALETTE, 'when_clicked do\nend\n', true],
                [PALETTE, 'say("こんにちは！", 2)\n', true],
                [PALETTE, 'next_costume\n', false],
                [STAGE, null, true],
                [CODE_AREA, null, true],
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
            expect(c.code).toBe('when_clicked do\n  say("こんにちは！", 2)\n  next_costume\nend\n');
        });

        test('4 くり返そう: the stage switches the backdrop 6 times on the 1 key', () => {
            const c = challenge('blocks-l1-repeat');
            expect(c.required).toBe(false);
            expect(ja[c.task.id]).toBe('1 のキーを押したら、背景が「Canyon」と「Arctic」に 3 回かわるようにしよう');
            expect(c.skills.map((s) => ja[s.name.id])).toEqual(['くり返し', '背景を足す', 'ステージのプログラム']);
            expect(c.allowedBlocks).toEqual({
                event: ['event_whenkeypressed'],
                control: ['control_repeat', 'control_wait'],
                looks: ['looks_switchbackdropto'],
            });
            expect(hints(c)).toEqual([
                [BACKDROP, null, false],
                [SPRITE_LIST, null, false],
                [PALETTE, '3.times\n', false],
                [CODE_AREA, 'switch_backdrop("Arctic")\n', false],
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
            expect(c.code).toBe(
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
                    '「動き」の青いブロックを使うよ。上下は y、左右は x。',
                    'キーのブロックの下にくっつけて、▼で「上向き矢印」をえらぼう。',
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
                    '紫の「見た目」のブロックをくっつけて、白いところをクリックして「こんにちは！」と書こう。',
                    'その下に、これもくっつけよう。',
                    'ステージのネコをクリックしてみよう。',
                    'いらないブロックは、パレットへドラッグしてもどすと消えるよ。',
                ],
                debug: [
                    '何も起きないときは、ステージのネコそのものを押しているか見よう。',
                    'プログラムを入れたスプライトと、押したスプライトが同じか、右下のスプライトリストで確かめよう。',
                ],
            });
            expectJa('blocks-l1-repeat', {
                steps: [
                    '右下の「背景を選ぶ」から、「Canyon」と「Arctic」を足そう。',
                    '右の「ステージ」をえらぼう。ステージにもプログラムを書けるよ。',
                    'オレンジの「制御」の「繰り返す」で、ブロックをはさもう。',
                    '中に「背景を…にする」「1 秒待つ」を 2 組入れよう。',
                    '1 のキーを押してみよう。',
                ],
                debug: [
                    '1 回しかかわらないときは、ブロックが「繰り返す」の口の中に入っているか見よう。',
                    'すぐ終わるときは「1 秒待つ」が入っているか見よう。',
                ],
            });
        });

        test('codeTarget is null or "stage" on every challenge', () => {
            allChallenges().forEach((c) => expect([null, 'stage']).toContain(c.codeTarget));
        });
    });
});
