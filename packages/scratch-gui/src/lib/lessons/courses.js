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

/**
 * チャレンジの「なかま」（パレットの色で見せる）。値はパレットのカテゴリ id と
 * 同じにして、レッスン表が色を引けるようにする。
 */
export const CATEGORIES = Object.freeze({
    MOTION: 'motion',
    LOOKS: 'looks',
    SOUND: 'sound',
    EVENTS: 'events',
    CONTROL: 'control',
    SENSING: 'sensing',
    OPERATORS: 'operators',
    VARIABLES: 'variables',
    LISTS: 'lists',
    EXTENSIONS: 'extensions',
});

// defaultMessage は ja の文言（FormattedMessage が locale に無いときの表示）。
const message = (id) => ({ id, defaultMessage: ja[id] });

// locale ごとに持つ Ruby（`code` / `spriteCodes[].code` / ヒントの `blocks`）で、いまの locale の
// キーが無いときに使う locale（en → ja の順）
const CODE_FALLBACK_LOCALES = ['en', 'ja'];

const isLocalizedCode = (value) => value !== null && typeof value === 'object';

/**
 * locale ごとに持てる Ruby から、いまの locale のものを選ぶ。作品の中の名前（ネコの音「ニャー」/
 * "Meow" など）は作品を作ったときの locale で変わるので、`code` などは文字列のほかに
 * `{ja: '...', 'ja-Hira': '...', en: '...'}` の形でも書ける。キーが無い locale は en、en も無ければ ja。
 * @param {?(string|object)} value - Ruby の文字列か、locale → Ruby のオブジェクト。
 * @param {string} locale - いまの locale（例: `ja` / `ja-Hira` / `en`）。
 * @returns {?string} Ruby。無ければ null。
 */
export const localizeCode = (value, locale) => {
    if (!isLocalizedCode(value)) return typeof value === 'string' ? value : null;
    const key = [locale, ...CODE_FALLBACK_LOCALES].find((l) => Object.prototype.hasOwnProperty.call(value, l));
    return key ? value[key] : null;
};

/**
 * 「プログラムを入れる」で入れる組（`code` と `spriteCodes`）を、locale の Ruby にして返す。
 * @param {object} challenge - チャレンジ。
 * @param {string} locale - いまの locale。
 * @returns {{code: ?string, spriteCodes: Array<{sprite: string, code: ?string}>}} 入れる組。
 */
export const challengeCodeFor = (challenge, locale) => ({
    code: localizeCode(challenge.code, locale),
    spriteCodes: (challenge.spriteCodes || []).map(({ sprite, code }) => ({
        sprite,
        code: localizeCode(code, locale),
    })),
});

/**
 * 「プログラムを入れる」で試す組を、使いたい順に返す（同じ中身は 1 つにまとめる）。先頭はいまの
 * locale の組。作品はそれを作ったときの locale の名前を持つので（日本語の作品を英語の UI で開く、
 * 先生が配った日本語の作品を英語の生徒が開く）、いまの locale の組が作品に合わないときは、ほかの
 * locale の組を試す。
 * @param {object} challenge - チャレンジ。
 * @param {string} locale - いまの locale。
 * @returns {Array<{code: ?string, spriteCodes: Array<object>}>} 試す組（1 つ以上）。
 */
export const challengeCodeCandidates = (challenge, locale) => {
    const locales = [locale, ...CODE_FALLBACK_LOCALES];
    [challenge.code, ...(challenge.spriteCodes || []).map((s) => s.code)]
        .filter(isLocalizedCode)
        .forEach((value) => locales.push(...Object.keys(value)));
    const seen = new Set();
    return locales
        .map((l) => challengeCodeFor(challenge, l))
        .filter((candidate) => {
            const key = JSON.stringify(candidate);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

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
    // なかま（パレットの色）。`CATEGORIES` の値。無ければ null（レッスン表は色無しで出す）
    category: null,
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
    // 最後の手段の「プログラムを入れる」（いまの deck の code）。Ruby の文字列か、作品の中の名前が
    // locale で変わるときは locale ごとの `{ja, 'ja-Hira', en}`（`localizeCode`）。spriteCodes の code と
    // ヒントの blocks も同じ
    code: null,
    // code を入れる相手。null = いま編集中のスプライト、'stage' = ステージ（ステージのプログラムの
    // チャレンジ。入れる前にステージをえらぶ）
    codeTarget: null,
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

// できること。レッスンをまたいで id で重ねるので、文言は id ごとに 1 つ
const skill = (id) => ({ id, name: message(`gui.lessons.skill.${id}`) });

// チャレンジの文言（task / stepN / debugN）を id から引く
const challengeMessage = (challengeId, field) => message(`gui.lessons.challenge.${challengeId}.${field}`);
// ヒントの文言は並びの番号（step1, step2, ...）で引く
const withTitles = (challengeId, steps) =>
    steps.map((step, i) => ({ ...step, title: challengeMessage(challengeId, `step${i + 1}`) }));
// 「言う」の初期値「こんにちは！」（仕様の表記。ツールボックスの初期値は半角の「こんにちは!」なので書く）
const SAY_HELLO = { MESSAGE: { ja: 'こんにちは！', 'ja-Hira': 'こんにちは！', en: 'Hello!' } };
const debugTips = (challengeId, count) =>
    Array.from({ length: count }, (_, i) => challengeMessage(challengeId, `debug${i + 1}`));

// チャレンジ id は記録（localStorage・クラスへの引き継ぎ）のキーなので、並びを
// 変えても変わらない名前にする（番号を入れない）。中身（仕様）は EPIC #1466 の sub-issue。
const blocksLesson1 = defineLesson({
    id: 'blocks-l1',
    count: 7,
    challenges: [
        // 1 キーで音を鳴らそう（音）: スペースキーで「ニャー」のあと「Owl」が鳴る
        {
            id: 'blocks-l1-key-sound',
            category: CATEGORIES.SOUND,
            task: challengeMessage('blocks-l1-key-sound', 'task'),
            skills: [skill('key-control'), skill('play-sound'), skill('add-sound')],
            allowedBlocks: {
                event: [{ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: 'space' } }],
                // 音の ▼ は、足した「Owl」ではなくネコの音（作品を作った locale の名前）
                sound: [
                    { opcode: 'sound_playuntildone', inputs: { SOUND_MENU: { ja: 'ニャー', 'ja-Hira': 'Meow', en: 'Meow' } } },
                    { opcode: 'sound_play', inputs: { SOUND_MENU: { ja: 'ニャー', 'ja-Hira': 'Meow', en: 'Meow' } } },
                ],
            },
            steps: withTitles('blocks-l1-key-sound', [
                { target: HINT_TARGETS.SOUNDS_TAB },
                { target: HINT_TARGETS.PALETTE, blocks: 'when_key_pressed("space") do\nend\n', spotlight: true },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'play_until_done("ニャー")\n',
                        'ja-Hira': 'play_until_done("Meow")\n',
                        en: 'play_until_done("Meow")\n',
                    },
                    spotlight: true,
                },
                { target: HINT_TARGETS.CODE_AREA, blocks: 'play("Owl")\n' },
                { target: HINT_TARGETS.KEYBOARD, spotlight: true },
            ]),
            debug: debugTips('blocks-l1-key-sound', 2),
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: 'space' },
                    blocks: ['sound_playuntildone', 'sound_play'],
                    order: ['sound_playuntildone', 'sound_play'],
                },
            ],
            // ネコの音の名前は作品を作ったときの locale で変わる（ja =「ニャー」、en = "Meow"。ja-Hira は
            // scratch-l10n に訳が無く "Meow"）。作品に合わないときは、ほかの locale の code を試す（lesson-hint.jsx）
            code: {
                ja: 'when_key_pressed("space") do\n  play_until_done("ニャー")\n  play("Owl")\nend\n',
                'ja-Hira': 'when_key_pressed("space") do\n  play_until_done("Meow")\n  play("Owl")\nend\n',
                en: 'when_key_pressed("space") do\n  play_until_done("Meow")\n  play("Owl")\nend\n',
            },
        },
        // 2 矢印キーで動かそう（動き）: 上下の矢印キーで y 座標を変える
        {
            id: 'blocks-l1-arrow-move',
            category: CATEGORIES.MOTION,
            task: challengeMessage('blocks-l1-arrow-move', 'task'),
            skills: [skill('move-by-coordinates'), skill('duplicate-blocks')],
            allowedBlocks: {
                event: [{ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: 'up arrow' } }],
                motion: ['motion_changeyby'],
            },
            steps: withTitles('blocks-l1-arrow-move', [
                { target: HINT_TARGETS.PALETTE, blocks: 'self.y += 10\n' },
                { target: HINT_TARGETS.PALETTE, blocks: 'when_key_pressed("up arrow") do\nend\n' },
                { target: HINT_TARGETS.CODE_AREA },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('blocks-l1-arrow-move', 2),
            goal: [
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
            ],
            code: 'when_key_pressed("up arrow") do\n  self.y += 10\nend\n\nwhen_key_pressed("down arrow") do\n  self.y += -10\nend\n',
        },
        // 3 押したら話そう（見た目・必須）: コスチュームを足して、押したらセリフと次のコスチューム
        {
            id: 'blocks-l1-click-say',
            category: CATEGORIES.LOOKS,
            required: true,
            task: challengeMessage('blocks-l1-click-say', 'task'),
            skills: [skill('click-trigger'), skill('say'), skill('add-costume')],
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: SAY_HELLO }, 'looks_nextcostume'],
            },
            steps: withTitles('blocks-l1-click-say', [
                { target: HINT_TARGETS.COSTUMES_TAB },
                { target: HINT_TARGETS.PALETTE, blocks: 'when_clicked do\nend\n', spotlight: true },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'say("こんにちは！", 2)\n',
                        'ja-Hira': 'say("こんにちは！", 2)\n',
                        en: 'say("Hello!", 2)\n',
                    },
                    spotlight: true,
                },
                { target: HINT_TARGETS.PALETTE, blocks: 'next_costume\n' },
                { target: HINT_TARGETS.STAGE, spotlight: true },
                { target: HINT_TARGETS.CODE_AREA, spotlight: true },
            ]),
            debug: debugTips('blocks-l1-click-say', 2),
            goal: [
                { type: 'costumes', added: 1 },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: ['looks_sayforsecs', 'looks_nextcostume'],
                },
            ],
            // セリフは課題の文言に合わせる（en の課題は "Hello!"）
            code: {
                ja: 'when_clicked do\n  say("こんにちは！", 2)\n  next_costume\nend\n',
                'ja-Hira': 'when_clicked do\n  say("こんにちは！", 2)\n  next_costume\nend\n',
                en: 'when_clicked do\n  say("Hello!", 2)\n  next_costume\nend\n',
            },
        },
        // 4 くり返そう（制御）: ステージのプログラム。1 のキーで背景が 3 回（6 回）かわる
        {
            id: 'blocks-l1-repeat',
            category: CATEGORIES.CONTROL,
            task: challengeMessage('blocks-l1-repeat', 'task'),
            skills: [skill('repeat'), skill('add-backdrop'), skill('stage-program')],
            allowedBlocks: {
                event: [{ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: '1' } }],
                control: [{ opcode: 'control_repeat', inputs: { TIMES: 3 } }, 'control_wait'],
                // 背景の名前はライブラリの名前（locale で変わらない）。足す前は ▼ に無いので、ツールボックスの初期値になる
                looks: [{ opcode: 'looks_switchbackdropto', inputs: { BACKDROP: 'Canyon' } }],
            },
            steps: withTitles('blocks-l1-repeat', [
                { target: HINT_TARGETS.BACKDROP },
                { target: HINT_TARGETS.SPRITE_LIST },
                { target: HINT_TARGETS.PALETTE, blocks: '3.times\n' }, // 中身の無い「繰り返す」。do...end は中身が無いと変換できない
                { target: HINT_TARGETS.CODE_AREA, blocks: 'switch_backdrop("Arctic")\n' },
                { target: HINT_TARGETS.KEYBOARD },
            ]),
            debug: debugTips('blocks-l1-repeat', 2),
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: '1', target: 'stage' },
                    blocks: ['control_repeat', { opcode: 'looks_switchbackdropto', count: 6 }],
                },
            ],
            // ステージのプログラムなので、「プログラムを入れる」はステージに入れる
            codeTarget: 'stage',
            code:
                'when_key_pressed("1") do\n  3.times do\n    switch_backdrop("Canyon")\n    sleep(1)\n' +
                '    switch_backdrop("Arctic")\n    sleep(1)\n  end\nend\n',
        },
        // 5 もし〜なら（制御）: マウスがさわっているか・いないかでセリフを変える
        {
            id: 'blocks-l1-if',
            category: CATEGORIES.CONTROL,
            task: challengeMessage('blocks-l1-if', 'task'),
            skills: [skill('if'), skill('forever'), skill('touching')],
            // パレットは仕様の「もし <> なら」と、ヒント 2 の「もし〜なら でなければ」の両方を出す
            allowedBlocks: {
                event: ['event_whenflagclicked'],
                control: ['control_forever', 'control_if', 'control_if_else'],
                sensing: ['sensing_touchingobject'],
                looks: [
                    {
                        opcode: 'looks_say',
                        inputs: { MESSAGE: { ja: 'くすぐったい！', 'ja-Hira': 'くすぐったい！', en: 'That tickles!' } },
                    },
                ],
            },
            steps: withTitles('blocks-l1-if', [
                { target: HINT_TARGETS.PALETTE, blocks: 'loop do\nend\n' },
                // `false` は空の穴として描く（Ruby → ブロック変換が条件の穴の `false` を空の穴にする）
                { target: HINT_TARGETS.PALETTE, blocks: 'if false\nelse\nend\n' },
                { target: HINT_TARGETS.PALETTE, blocks: 'touching?("_mouse_")\n' },
                { target: HINT_TARGETS.CODE_AREA },
                { target: HINT_TARGETS.GREEN_FLAG, spotlight: true },
            ]),
            debug: debugTips('blocks-l1-if', 2),
            // then と else の両方の「言う」が動いた = ちがうセリフを 2 種類言った
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: ['sensing_touchingobject', { opcode: 'looks_say', distinct: 'MESSAGE', count: 2 }],
                },
            ],
            code:
                {
                    ja:
                        'when_flag_clicked do\n  loop do\n    if touching?("_mouse_")\n      say("くすぐったい！")\n' +
                        '    else\n      say("さわってみて")\n    end\n  end\nend\n',
                    'ja-Hira':
                        'when_flag_clicked do\n  loop do\n    if touching?("_mouse_")\n      say("くすぐったい！")\n' +
                        '    else\n      say("さわってみて")\n    end\n  end\nend\n',
                    en:
                        'when_flag_clicked do\n  loop do\n    if touching?("_mouse_")\n      say("That tickles!")\n' +
                        '    else\n      say("Touch me")\n    end\n  end\nend\n',
                },
        },
        // 6 聞いて答えよう（調べる・必須）: 名前を聞いて、答えと、かかった秒数を言う
        {
            id: 'blocks-l1-ask-answer',
            category: CATEGORIES.SENSING,
            required: true,
            task: challengeMessage('blocks-l1-ask-answer', 'task'),
            skills: [skill('ask-answer'), skill('timer'), skill('join')],
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                sensing: [
                    'sensing_resettimer',
                    {
                        opcode: 'sensing_askandwait',
                        inputs: { QUESTION: { ja: 'なまえは？', 'ja-Hira': 'なまえは？', en: "What's your name?" } },
                    },
                    'sensing_answer',
                    'sensing_timer',
                ],
                operators: ['operator_join'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: SAY_HELLO }],
            },
            steps: withTitles('blocks-l1-ask-answer', [
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: { ja: 'ask("なまえは？")\n', 'ja-Hira': 'ask("なまえは？")\n', en: 'ask("What\'s your name?")\n' },
                },
                { target: HINT_TARGETS.PALETTE, blocks: 'answer\n' },
                { target: HINT_TARGETS.PALETTE, blocks: 'timer.reset\n' },
                // 「(タイマー) と (秒でした)」の「と」1 つ（code と同じ書き方）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'timer.value + "秒でした"\n',
                        'ja-Hira': 'timer.value + "びょうでした"\n',
                        en: 'timer.value + " seconds"\n',
                    },
                },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('blocks-l1-ask-answer', 2),
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
            // 仕様の Ruby は `timer.value.to_s + "秒でした"` だが、`.to_s` も「(タイマー) と ()」の「と」に
            // なり、入れると子どもが作るのとちがう入れ子の「と」2 つになる。子どもが作ったブロックから
            // 生成される Ruby と同じ `timer.value + "秒でした"`（「と」1 つ）にする
            code:
                {
                    ja:
                        'when_clicked do\n  timer.reset\n  ask("なまえは？")\n  say(answer, 2)\n' +
                        '  say(timer.value + "秒でした", 2)\nend\n',
                    'ja-Hira':
                        'when_clicked do\n  timer.reset\n  ask("なまえは？")\n  say(answer, 2)\n' +
                        '  say(timer.value + "びょうでした", 2)\nend\n',
                    en:
                        'when_clicked do\n  timer.reset\n  ask("What\'s your name?")\n  say(answer, 2)\n' +
                        '  say(timer.value + " seconds", 2)\nend\n',
                },
        },
        // 7 クイズを作ろう（演算）: 答えが 7 なら「正解です」、ちがえば「ちがいます」
        {
            id: 'blocks-l1-quiz',
            category: CATEGORIES.OPERATORS,
            task: challengeMessage('blocks-l1-quiz', 'task'),
            skills: [skill('compare'), skill('if')],
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: '4+3=?' } }, 'sensing_answer'],
                control: ['control_if', 'control_if_else'],
                operators: [{ opcode: 'operator_equals', inputs: { OPERAND2: 7 } }],
                looks: [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: { MESSAGE: { ja: '正解です', 'ja-Hira': 'せいかいです', en: 'Correct' } },
                    },
                ],
            },
            steps: withTitles('blocks-l1-quiz', [
                { target: HINT_TARGETS.PALETTE },
                { target: HINT_TARGETS.PALETTE, blocks: '"" == 7\n' },
                { target: HINT_TARGETS.CODE_AREA },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('blocks-l1-quiz', 1),
            // 比べ方は Scratch と同じなので、全角の「７」は 7 と等しくない（「ちがいます」の側に入る）
            // ja-Hira の課題は「せいかいです」、en の課題は "Correct" / "Wrong" と書くので、どれで言っても数える
            goal: [
                { type: 'said', text: /^(正解です|せいかいです|correct)$/i, answer: { eq: 7 } },
                { type: 'said', text: /^(ちがいます|wrong)$/i, answer: { ne: 7 } },
            ],
            code: {
                ja:
                    'when_clicked do\n  ask("4+3=?")\n  if answer == 7\n    say("正解です", 2)\n  else\n' +
                    '    say("ちがいます", 2)\n  end\nend\n',
                'ja-Hira':
                    'when_clicked do\n  ask("4+3=?")\n  if answer == 7\n    say("せいかいです", 2)\n  else\n' +
                    '    say("ちがいます", 2)\n  end\nend\n',
                en:
                    'when_clicked do\n  ask("4+3=?")\n  if answer == 7\n    say("Correct", 2)\n  else\n' +
                    '    say("Wrong", 2)\n  end\nend\n',
            },
        },
        // 8 数えよう（変数・必須）: 押した回数を変数「回数」（en は count）で数えて言う
        {
            id: 'blocks-l1-count',
            category: CATEGORIES.VARIABLES,
            required: true,
            task: challengeMessage('blocks-l1-count', 'task'),
            skills: [skill('make-variable'), skill('variable')],
            // 変数のカテゴリと中のブロックもこの allowedBlocks で絞る（lesson-dynamic-categories.js）。
            // 「変数を作る」と変数のレポーター（モニターのチェックボックス）は、変数のブロックがあれば出る
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_whenthisspriteclicked'],
                data: ['data_setvariableto', 'data_changevariableby', 'data_variable'],
                looks: [{ opcode: 'looks_say', inputs: SAY_HELLO }],
            },
            steps: withTitles('blocks-l1-count', [
                { target: HINT_TARGETS.PALETTE },
                // en の文言は「count」という変数を作ろうと書く（#1514）
                { target: HINT_TARGETS.PALETTE, blocks: { ja: '$回数 = 0\n', 'ja-Hira': '$かいすう = 0\n', en: '$count = 0\n' } },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: { ja: '$回数 += 1\n', 'ja-Hira': '$かいすう += 1\n', en: '$count += 1\n' },
                },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('blocks-l1-count', 1),
            // `$回数` はステージの変数 =「変数を作る」の既定（すべてのスプライト用）と同じ
            // ja-Hira のヒントは「かいすう」、en は「count」という変数を作ろうと書く。locale を途中で
            // 変えた作品（ja で作って en で開く等）でも通るよう、判定はどの名前でもよい
            goal: [
                { type: 'variable', name: ['回数', 'かいすう', 'count'], value: { gte: 3 } },
                { type: 'said', equalsVariable: ['回数', 'かいすう', 'count'] },
            ],
            code: {
                ja: 'when_flag_clicked do\n  $回数 = 0\nend\n\nwhen_clicked do\n  $回数 += 1\n  say($回数)\nend\n',
                'ja-Hira': 'when_flag_clicked do\n  $かいすう = 0\nend\n\nwhen_clicked do\n  $かいすう += 1\n  say($かいすう)\nend\n',
                en: 'when_flag_clicked do\n  $count = 0\nend\n\nwhen_clicked do\n  $count += 1\n  say($count)\nend\n',
            },
        },
        // 9 なかまに合図しよう（イベント・必須）: ネコを押したら合図を送り、受け取ったペンギンが言う
        {
            id: 'blocks-l1-broadcast',
            category: CATEGORIES.EVENTS,
            required: true,
            task: challengeMessage('blocks-l1-broadcast', 'task'),
            skills: [skill('add-sprite'), skill('broadcast'), skill('sprite-program')],
            allowedBlocks: {
                // メッセージの ▼（あいさつ）は、子どもが「新しいメッセージ」で作るのでツールボックスの初期値のまま
                event: ['event_whenthisspriteclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: { MESSAGE: 'やあ！' } }],
            },
            steps: withTitles('blocks-l1-broadcast', [
                { target: HINT_TARGETS.SPRITE_LIST, spotlight: true },
                {
                    target: HINT_TARGETS.SPRITE_LIST,
                    blocks: {
                        ja: 'broadcast("あいさつ")\n',
                        'ja-Hira': 'broadcast("あいさつ")\n',
                        en: 'broadcast("hello")\n',
                    },
                },
                { target: HINT_TARGETS.SPRITE_LIST },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_receive("あいさつ") do\nend\n',
                        'ja-Hira': 'when_receive("あいさつ") do\nend\n',
                        en: 'when_receive("hello") do\nend\n',
                    },
                },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('blocks-l1-broadcast', 2),
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
            // ライブラリから足す。insert-sprite-code.js）。メッセージとセリフは ja / ja-Hira が「あいさつ」「やあ！」、
            // en が "hello" / "Hi!"（#1514）。キーの無い locale は en に戻るので、ja と同じ ja-Hira も書く
            code: {
                ja: 'when_clicked do\n  broadcast("あいさつ")\nend\n',
                'ja-Hira': 'when_clicked do\n  broadcast("あいさつ")\nend\n',
                en: 'when_clicked do\n  broadcast("hello")\nend\n',
            },
            spriteCodes: [
                {
                    sprite: 'Penguin',
                    code: {
                        ja: 'when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n',
                        'ja-Hira': 'when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n',
                        en: 'when_receive("hello") do\n  say("Hi!", 2)\nend\n',
                    },
                },
            ],
        },
        // 10 しゃべらせよう（拡張機能）: 音声合成を足して、ネコを押したらしゃべる
        {
            id: 'blocks-l1-speak',
            category: CATEGORIES.EXTENSIONS,
            task: challengeMessage('blocks-l1-speak', 'task'),
            skills: [skill('add-extension'), skill('text2speech')],
            // 拡張機能のカテゴリはパレットを絞っても全部出る（make-toolbox-xml）。ここは使うブロックの記録。
            // 拡張機能は子どもがヒント 1 で足す（setup.extensions では入れない）
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                text2speech: [
                    {
                        opcode: 'text2speech_speakAndWait',
                        inputs: {
                            WORDS: { ja: 'ボタンが押されました', 'ja-Hira': 'ボタンがおされました', en: 'The button was clicked' },
                        },
                    },
                ],
            },
            steps: withTitles('blocks-l1-speak', [
                { target: HINT_TARGETS.EXTENSION_BUTTON, spotlight: true },
                // en の課題は "The button was clicked" としゃべると書く（#1514）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'text2speech.speak("ボタンが押されました")\n',
                        'ja-Hira': 'text2speech.speak("ボタンがおされました")\n',
                        en: 'text2speech.speak("The button was clicked")\n',
                    },
                },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('blocks-l1-speak', 1),
            goal: [
                { type: 'extension', id: 'text2speech' },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: ['text2speech_speakAndWait'],
                },
            ],
            // 拡張機能を足す前に入れても、変換が音声合成を読み込む（target-applier）
            code: {
                ja: 'when_clicked do\n  text2speech.speak("ボタンが押されました")\nend\n',
                'ja-Hira': 'when_clicked do\n  text2speech.speak("ボタンがおされました")\nend\n',
                en: 'when_clicked do\n  text2speech.speak("The button was clicked")\nend\n',
            },
        },
        // 11 メッセージをためよう（リスト・必須）: 聞いた答えをリスト「トーク」（en は talk）にためる
        {
            id: 'blocks-l1-message-list',
            category: CATEGORIES.LISTS,
            required: true,
            task: challengeMessage('blocks-l1-message-list', 'task'),
            skills: [skill('make-list'), skill('add-to-list')],
            // 変数のカテゴリと中のブロックもこの allowedBlocks で絞る（lesson-dynamic-categories.js）。
            // 「リストを作る」とリストのレポーター（作ったリストをステージに出すチェックボックス）は、
            // リストのブロックがあれば出る
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_whenthisspriteclicked'],
                data: ['data_deletealloflist', 'data_addtolist'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: 'メッセージは？' } }, 'sensing_answer'],
            },
            steps: withTitles('blocks-l1-message-list', [
                { target: HINT_TARGETS.PALETTE },
                { target: HINT_TARGETS.PALETTE, blocks: { ja: '$トーク.clear\n', 'ja-Hira': '$トーク.clear\n', en: '$talk.clear\n' } },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: { ja: '$トーク.push(answer)\n', 'ja-Hira': '$トーク.push(answer)\n', en: '$talk.push(answer)\n' },
                },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('blocks-l1-message-list', 2),
            // `$トーク` はステージのリスト =「リストを作る」の既定（すべてのスプライト用）と同じ。
            // en の課題はリスト "talk"・質問 "Message?" と書く（#1514）。判定はどちらのリストの名前でもよい
            goal: [{ type: 'list', name: ['トーク', 'talk'], length: { gte: 3 }, itemsFromAnswers: true }],
            code: {
                ja:
                    'when_flag_clicked do\n  $トーク.clear\nend\n\nwhen_clicked do\n  ask("メッセージは？")\n' +
                    '  $トーク.push(answer)\nend\n',
                'ja-Hira':
                    'when_flag_clicked do\n  $トーク.clear\nend\n\nwhen_clicked do\n  ask("メッセージは？")\n' +
                    '  $トーク.push(answer)\nend\n',
                en:
                    'when_flag_clicked do\n  $talk.clear\nend\n\nwhen_clicked do\n  ask("Message?")\n' +
                    '  $talk.push(answer)\nend\n',
            },
        },
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
