// === Smalruby: This file is Smalruby-specific (lesson courses data) ===
// コース › レッスン › チャレンジのデータ。形の説明は docs/lessons/README.md。
// 文言は lessons.locale.js（message descriptor の id で引く）。

import { HINT_TARGETS } from './hint-targets';
import { ja } from './lessons.locale';

/** コースの言語。言語の中にコースが並ぶ。 */
export const LANGUAGES = Object.freeze({
    BLOCKS: 'blocks',
    RUBY: 'ruby',
    DNCL: 'dncl',
});

// defaultMessage は ja の文言（FormattedMessage が locale に無いときの表示）。
const message = (id) => ({ id, defaultMessage: ja[id] });

/**
 * チャレンジの定義に既定値を埋める。いまの deck の項目（allowedBlocks / setup /
 * steps / code）をそのまま持ち、レッスン用の項目を足す。読む側が項目の有無を
 * 毎回確かめなくてよいように、ここで全部そろえる。
 * @param {object} def - チャレンジの定義（id は必須。number は defineLesson が付ける）。
 * @returns {object} 正規化したチャレンジ。
 */
export const defineChallenge = (def) => ({
    name: message(`gui.lessons.challenge.${def.id}.name`),
    // 課題の 1 行（message descriptor）
    task: null,
    // できること: [{id, name}]。レッスンをまたいで id で重ねる
    skills: [],
    // できた の判定: 条件の配列（全部を満たしたら「できた」）。形は goal.js と
    // docs/lessons/README.md。null ならそのチャレンジは判定しない
    goal: null,
    required: false,
    // code のほかに、名前で決めたスプライトに入れるプログラム: [{sprite, code}]（`sprite` はライブラリの
    // スプライトの名前。いなければライブラリから足す）。このときの code は残りのスプライト（ネコ）に入る
    spriteCodes: [],
    allowedBlocks: null,
    setup: null,
    // 最後の手段の「プログラムを入れる」（いまの deck の code）
    code: null,
    // うまく動かないときは: [message descriptor]
    debug: [],
    ...def,
    // ヒント。title = 文言、target = 指す場所、blocks = 吹き出しに描くブロック、
    // spotlight = はじめて開いたチャレンジだけ周りを暗くして指す場所を照らす
    steps: (def.steps || []).map((step) => ({ title: null, target: null, blocks: null, spotlight: false, ...step })),
});

/**
 * レッスンを定義する。必須はチャレンジの `required` を正とし、クリア条件の
 * `required` はそこから作る（二重に書かない）。何個めか（`number`）も並びから
 * 付ける（並びを変えたときに番号がずれないように、定義には書かない）。
 * @param {object} def - レッスンの定義。
 * @param {string} def.id - レッスン id。
 * @param {number} def.count - クリアに要るチャレンジの数。
 * @param {Array<object>} def.challenges - チャレンジの定義（並び順）。
 * @returns {object} レッスン。
 */
export const defineLesson = ({ id, count, challenges }) => {
    const normalized = challenges.map((def, index) => defineChallenge({ ...def, number: index + 1 }));
    return {
        id,
        name: message(`gui.lessons.lesson.${id}.name`),
        challenges: normalized,
        clear: {
            count,
            required: normalized.filter((c) => c.required).map((c) => c.id),
        },
    };
};

/**
 * @param {object} def - コースの定義。
 * @param {string} def.id - コース id。
 * @param {string} def.language - 言語（`LANGUAGES`）。
 * @param {Array<object>} def.lessons - レッスン（並び順）。
 * @returns {object} コース。
 */
export const defineCourse = ({ id, language, lessons }) => ({
    id,
    language,
    name: message(`gui.lessons.course.${id}.name`),
    // クリアの印
    badge: message(`gui.lessons.course.${id}.badge`),
    lessons,
});

// チャレンジ id は記録（localStorage・クラスへの引き継ぎ）のキーなので、並びを
// 変えても変わらない名前にする（番号を入れない）。中身は 1-g で入れる。
const blocksLesson1 = defineLesson({
    id: 'blocks-l1',
    count: 7,
    challenges: [
        { id: 'blocks-l1-key-sound' },
        { id: 'blocks-l1-arrow-move' },
        {
            id: 'blocks-l1-click-say',
            required: true,
            task: message('gui.lessons.challenge.blocks-l1-click-say.task'),
            allowedBlocks: {
                looks: ['looks_say', 'looks_sayforsecs', 'looks_nextcostume'],
                event: ['event_whenthisspriteclicked'],
            },
            setup: { tab: 'code' },
            // ヒントは仮（1-g で仕様の文言に置き換える）。吹き出しの部品の動作確認用
            steps: [
                { title: message('gui.lessons.challenge.blocks-l1-click-say.step1'), target: HINT_TARGETS.COSTUMES_TAB },
                {
                    title: message('gui.lessons.challenge.blocks-l1-click-say.step2'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'when_clicked do\nend\n',
                    spotlight: true,
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-click-say.step3'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'say("こんにちは！", 2)\n',
                    spotlight: true,
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-click-say.step4'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'next_costume\n',
                },
                { title: message('gui.lessons.challenge.blocks-l1-click-say.step5'), target: HINT_TARGETS.STAGE, spotlight: true },
                {
                    title: message('gui.lessons.challenge.blocks-l1-click-say.step6'),
                    target: HINT_TARGETS.CODE_AREA,
                    spotlight: true,
                },
            ],
            debug: [
                message('gui.lessons.challenge.blocks-l1-click-say.debug1'),
                message('gui.lessons.challenge.blocks-l1-click-say.debug2'),
            ],
            code: 'when_clicked do\n  say("こんにちは！", 2)\n  next_costume\nend\n',
        },
        { id: 'blocks-l1-repeat' },
        // === チャレンジ 5〜8 ===
        // 5 もし〜なら（制御）: マウスがさわっているか・いないかでセリフを変える
        {
            id: 'blocks-l1-if',
            task: message('gui.lessons.challenge.blocks-l1-if.task'),
            skills: [
                { id: 'if', name: message('gui.lessons.skill.if') },
                { id: 'forever', name: message('gui.lessons.skill.forever') },
                { id: 'touching', name: message('gui.lessons.skill.touching') },
            ],
            // パレットは仕様の「もし <> なら」と、ヒント 2 の「もし〜なら でなければ」の両方を出す
            allowedBlocks: {
                event: ['event_whenflagclicked'],
                control: ['control_forever', 'control_if', 'control_if_else'],
                sensing: ['sensing_touchingobject'],
                looks: ['looks_say'],
            },
            setup: { tab: 'code' },
            steps: [
                {
                    title: message('gui.lessons.challenge.blocks-l1-if.step1'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'loop do\nend\n',
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-if.step2'),
                    target: HINT_TARGETS.PALETTE,
                    // `false` は空の穴として描く（hint-blocks.js）
                    blocks: 'if false\nelse\nend\n',
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-if.step3'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'touching?("_mouse_")\n',
                },
                { title: message('gui.lessons.challenge.blocks-l1-if.step4'), target: HINT_TARGETS.CODE_AREA },
                {
                    title: message('gui.lessons.challenge.blocks-l1-if.step5'),
                    target: HINT_TARGETS.GREEN_FLAG,
                    spotlight: true,
                },
            ],
            debug: [
                message('gui.lessons.challenge.blocks-l1-if.debug1'),
                message('gui.lessons.challenge.blocks-l1-if.debug2'),
            ],
            // then と else の両方の「言う」が動いた = ちがうセリフを 2 種類言った
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: ['sensing_touchingobject', { opcode: 'looks_say', distinct: 'MESSAGE', count: 2 }],
                },
            ],
            code:
                'when_flag_clicked do\n  loop do\n    if touching?("_mouse_")\n      say("くすぐったい！")\n' +
                '    else\n      say("さわってみて")\n    end\n  end\nend\n',
        },
        // 6 聞いて答えよう（調べる・必須）: 名前を聞いて、答えと、かかった秒数を言う
        {
            id: 'blocks-l1-ask-answer',
            required: true,
            task: message('gui.lessons.challenge.blocks-l1-ask-answer.task'),
            skills: [
                { id: 'ask-answer', name: message('gui.lessons.skill.ask-answer') },
                { id: 'timer', name: message('gui.lessons.skill.timer') },
                { id: 'join', name: message('gui.lessons.skill.join') },
            ],
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                sensing: ['sensing_resettimer', 'sensing_askandwait', 'sensing_answer', 'sensing_timer'],
                operators: ['operator_join'],
                looks: ['looks_sayforsecs'],
            },
            setup: { tab: 'code' },
            steps: [
                {
                    title: message('gui.lessons.challenge.blocks-l1-ask-answer.step1'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'ask("なまえは？")\n',
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-ask-answer.step2'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'answer\n',
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-ask-answer.step3'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'timer.reset\n',
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-ask-answer.step4'),
                    target: HINT_TARGETS.PALETTE,
                    // 「と」1 つを描く。code の `timer.value.to_s + ...` は「(タイマー) と ()」が中に入った
                    // 「と」2 つになるので、吹き出しは子どもが作るのと同じ形の Ruby にする
                    blocks: 'timer.value + "秒でした"\n',
                },
                { title: message('gui.lessons.challenge.blocks-l1-ask-answer.step5'), target: HINT_TARGETS.STAGE },
            ],
            debug: [
                message('gui.lessons.challenge.blocks-l1-ask-answer.debug1'),
                message('gui.lessons.challenge.blocks-l1-ask-answer.debug2'),
            ],
            // 秒数は 3.217 のような小数のまま言う（四捨五入は入れない）
            goal: [
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
            ],
            code:
                'when_clicked do\n  timer.reset\n  ask("なまえは？")\n  say(answer, 2)\n' +
                '  say(timer.value.to_s + "秒でした", 2)\nend\n',
        },
        // 7 クイズを作ろう（演算）: 答えが 7 なら「正解です」、ちがえば「ちがいます」
        {
            id: 'blocks-l1-quiz',
            task: message('gui.lessons.challenge.blocks-l1-quiz.task'),
            skills: [
                { id: 'compare', name: message('gui.lessons.skill.compare') },
                { id: 'if', name: message('gui.lessons.skill.if') },
            ],
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                sensing: ['sensing_askandwait', 'sensing_answer'],
                control: ['control_if', 'control_if_else'],
                operators: ['operator_equals'],
                looks: ['looks_sayforsecs'],
            },
            setup: { tab: 'code' },
            steps: [
                { title: message('gui.lessons.challenge.blocks-l1-quiz.step1'), target: HINT_TARGETS.PALETTE },
                {
                    title: message('gui.lessons.challenge.blocks-l1-quiz.step2'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: '"" == 7\n',
                },
                { title: message('gui.lessons.challenge.blocks-l1-quiz.step3'), target: HINT_TARGETS.CODE_AREA },
                { title: message('gui.lessons.challenge.blocks-l1-quiz.step4'), target: HINT_TARGETS.STAGE },
            ],
            debug: [message('gui.lessons.challenge.blocks-l1-quiz.debug1')],
            // 比べ方は Scratch と同じなので、全角の「７」は 7 と等しくない（「ちがいます」の側に入る）
            goal: [
                { type: 'said', text: '正解です', answer: { eq: 7 } },
                { type: 'said', text: 'ちがいます', answer: { ne: 7 } },
            ],
            code:
                'when_clicked do\n  ask("4+3=?")\n  if answer == 7\n    say("正解です", 2)\n  else\n' +
                '    say("ちがいます", 2)\n  end\nend\n',
        },
        // 8 数えよう（変数・必須）: 押した回数を変数「回数」で数えて言う
        {
            id: 'blocks-l1-count',
            required: true,
            task: message('gui.lessons.challenge.blocks-l1-count.task'),
            skills: [
                { id: 'make-variable', name: message('gui.lessons.skill.make-variable') },
                { id: 'variable', name: message('gui.lessons.skill.variable') },
            ],
            // 変数のカテゴリはパレットを絞っても全部出る（make-toolbox-xml）。ここは使うブロックの記録
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_whenthisspriteclicked'],
                data: ['data_setvariableto', 'data_changevariableby', 'data_variable'],
                looks: ['looks_say'],
            },
            setup: { tab: 'code' },
            steps: [
                { title: message('gui.lessons.challenge.blocks-l1-count.step1'), target: HINT_TARGETS.PALETTE },
                {
                    title: message('gui.lessons.challenge.blocks-l1-count.step2'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: '$回数 = 0\n',
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-count.step3'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: '$回数 += 1\n',
                },
                { title: message('gui.lessons.challenge.blocks-l1-count.step4'), target: HINT_TARGETS.STAGE },
            ],
            debug: [message('gui.lessons.challenge.blocks-l1-count.debug1')],
            // `$回数` はステージの変数 =「変数を作る」の既定（すべてのスプライト用）と同じ
            goal: [
                { type: 'variable', name: '回数', value: { gte: 3 } },
                { type: 'said', equalsVariable: '回数' },
            ],
            code: 'when_flag_clicked do\n  $回数 = 0\nend\n\nwhen_clicked do\n  $回数 += 1\n  say($回数)\nend\n',
        },
        // === ここまで チャレンジ 5〜8 ===
        // === チャレンジ 9〜11 ===
        // 9 なかまに合図しよう（イベント・必須）: ネコを押したら合図を送り、受け取ったペンギンが言う
        {
            id: 'blocks-l1-broadcast',
            required: true,
            task: message('gui.lessons.challenge.blocks-l1-broadcast.task'),
            skills: [
                { id: 'add-sprite', name: message('gui.lessons.skill.add-sprite') },
                { id: 'broadcast', name: message('gui.lessons.skill.broadcast') },
                { id: 'sprite-program', name: message('gui.lessons.skill.sprite-program') },
            ],
            allowedBlocks: {
                event: ['event_whenthisspriteclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
                looks: ['looks_sayforsecs'],
            },
            setup: { tab: 'code' },
            steps: [
                {
                    title: message('gui.lessons.challenge.blocks-l1-broadcast.step1'),
                    target: HINT_TARGETS.SPRITE_LIST,
                    spotlight: true,
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-broadcast.step2'),
                    target: HINT_TARGETS.SPRITE_LIST,
                    blocks: 'broadcast("あいさつ")\n',
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-broadcast.step3'),
                    target: HINT_TARGETS.SPRITE_LIST,
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-broadcast.step4'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'when_receive("あいさつ") do\nend\n',
                },
                { title: message('gui.lessons.challenge.blocks-l1-broadcast.step5'), target: HINT_TARGETS.STAGE },
            ],
            debug: [
                message('gui.lessons.challenge.blocks-l1-broadcast.debug1'),
                message('gui.lessons.challenge.blocks-l1-broadcast.debug2'),
            ],
            goal: [
                { type: 'sprites', min: 2 },
                { type: 'uses', trigger: { hat: 'event_whenthisspriteclicked' }, blocks: ['event_broadcast'] },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' },
                    blocks: ['looks_sayforsecs'],
                },
            ],
            // code はネコのプログラム。ペンギンのプログラムは spriteCodes で入れる（ペンギンがいなければ
            // ライブラリから足す。insert-sprite-code.js）
            code: 'when_clicked do\n  broadcast("あいさつ")\nend\n',
            spriteCodes: [{ sprite: 'Penguin', code: 'when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n' }],
        },
        // 10 しゃべらせよう（拡張機能）: 音声合成を足して、ネコを押したらしゃべる
        {
            id: 'blocks-l1-speak',
            task: message('gui.lessons.challenge.blocks-l1-speak.task'),
            skills: [
                { id: 'add-extension', name: message('gui.lessons.skill.add-extension') },
                { id: 'text2speech', name: message('gui.lessons.skill.text2speech') },
            ],
            // 拡張機能のカテゴリはパレットを絞っても全部出る（make-toolbox-xml）。ここは使うブロックの記録
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                text2speech: ['text2speech_speakAndWait'],
            },
            // 拡張機能は子どもがヒント 1 で足す（setup.extensions では入れない）
            setup: { tab: 'code' },
            steps: [
                {
                    title: message('gui.lessons.challenge.blocks-l1-speak.step1'),
                    target: HINT_TARGETS.EXTENSION_BUTTON,
                    spotlight: true,
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-speak.step2'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: 'text2speech.speak("ボタンが押されました")\n',
                },
                { title: message('gui.lessons.challenge.blocks-l1-speak.step3'), target: HINT_TARGETS.STAGE },
            ],
            debug: [message('gui.lessons.challenge.blocks-l1-speak.debug1')],
            goal: [
                { type: 'extension', id: 'text2speech' },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: ['text2speech_speakAndWait'],
                },
            ],
            // 拡張機能を足す前に入れても、変換が音声合成を読み込む（target-applier）
            code: 'when_clicked do\n  text2speech.speak("ボタンが押されました")\nend\n',
        },
        // 11 メッセージをためよう（リスト・必須）: 聞いた答えをリスト「トーク」にためる
        {
            id: 'blocks-l1-message-list',
            required: true,
            task: message('gui.lessons.challenge.blocks-l1-message-list.task'),
            skills: [
                { id: 'make-list', name: message('gui.lessons.skill.make-list') },
                { id: 'add-to-list', name: message('gui.lessons.skill.add-to-list') },
            ],
            // リストのカテゴリはパレットを絞っても全部出る（make-toolbox-xml）。ここは使うブロックの記録
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_whenthisspriteclicked'],
                data: ['data_deletealloflist', 'data_addtolist'],
                sensing: ['sensing_askandwait', 'sensing_answer'],
            },
            setup: { tab: 'code' },
            steps: [
                {
                    title: message('gui.lessons.challenge.blocks-l1-message-list.step1'),
                    target: HINT_TARGETS.PALETTE,
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-message-list.step2'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: '$トーク.clear\n',
                },
                {
                    title: message('gui.lessons.challenge.blocks-l1-message-list.step3'),
                    target: HINT_TARGETS.PALETTE,
                    blocks: '$トーク.push(answer)\n',
                },
                { title: message('gui.lessons.challenge.blocks-l1-message-list.step4'), target: HINT_TARGETS.STAGE },
            ],
            debug: [
                message('gui.lessons.challenge.blocks-l1-message-list.debug1'),
                message('gui.lessons.challenge.blocks-l1-message-list.debug2'),
            ],
            // `$トーク` はステージのリスト =「リストを作る」の既定（すべてのスプライト用）と同じ
            goal: [{ type: 'list', name: 'トーク', length: { gte: 3 }, itemsFromAnswers: true }],
            code:
                'when_flag_clicked do\n  $トーク.clear\nend\n\nwhen_clicked do\n  ask("メッセージは？")\n' +
                '  $トーク.push(answer)\nend\n',
        },
        // === ここまで チャレンジ 9〜11 ===
    ],
});

export const COURSES = [
    defineCourse({
        id: 'kyou-kara-programmer',
        language: LANGUAGES.BLOCKS,
        lessons: [blocksLesson1],
    }),
];

/**
 * @param {string} courseId - コース id。
 * @param {Array} [courses] - 探すコース（テスト用）。
 * @returns {?object} コース。無ければ null。
 */
export const findCourse = (courseId, courses = COURSES) => courses.find((c) => c.id === courseId) || null;

/**
 * @param {string} lessonId - レッスン id。
 * @param {Array} [courses] - 探すコース（テスト用）。
 * @returns {?object} レッスン。無ければ null。
 */
export const findLesson = (lessonId, courses = COURSES) => {
    for (const course of courses) {
        const lesson = course.lessons.find((l) => l.id === lessonId);
        if (lesson) return lesson;
    }
    return null;
};

/**
 * チャレンジと、それが入っているコース・レッスンを探す。
 * @param {string} challengeId - チャレンジ id。
 * @param {Array} [courses] - 探すコース（テスト用）。
 * @returns {?{course: object, lesson: object, challenge: object}} 無ければ null。
 */
export const findChallenge = (challengeId, courses = COURSES) => {
    for (const course of courses) {
        for (const lesson of course.lessons) {
            const challenge = lesson.challenges.find((c) => c.id === challengeId);
            if (challenge) return { course, lesson, challenge };
        }
    }
    return null;
};

/**
 * レッスンのクリア条件。
 * @param {object} lesson - レッスン。
 * @returns {{count: number, required: Array<string>}} n 個と必須のチャレンジ id。
 */
export const lessonClearRule = (lesson) => lesson.clear;
