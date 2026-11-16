// === Smalruby: This file is Smalruby-specific (lesson courses data) ===
// コース › レッスン › チャレンジのデータ。形の説明は docs/lessons/README.md。
// 文言は lessons.locale.js（message descriptor の id で引く）。
import { HINT_TARGETS } from './hint-targets';
import arrowKeysImage from './images/arrow-keys.svg';
import { ja } from './lessons.locale';
import { applyChallengeMode } from './read-diagram';

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
export const defineChallenge = (def) =>
    applyChallengeMode({
        name: message(`gui.lessons.challenge.${def.id}.name`),
        // 課題の 1 行（message descriptor）。課題バーの下に出す全文では改行（\n）をそのまま出すので、
        // 長い課題は読みやすいところで改行しておく（バーの 1 行では改行を取ってつなぐ）
        task: null,
        // 課題の全文といっしょに出す画像（任意）: {src, alt}。src は import した画像の URL
        // （webpack の asset。チュートリアルの deck の画像と同じ扱い）、alt は message descriptor
        image: null,
        // レッスン表のカード: {category, main}。category = カードの左の帯の色（なかま。`CATEGORIES` の値）、
        // main = そのチャレンジで覚えるメインのなかま。category は「できあがりのプログラム（code と
        // spriteCodes）でいちばん多いなかま、同じ数なら main」（card-color.js・docs/lessons/design.md の「カード」）。
        // 決め方どおりかは test/unit/lib/lessons/card-color.test.js が本物の変換で数えて確かめる。
        // 無ければ null（レッスン表は色無しで出す）
        card: null,
        // できた の判定: 条件の配列（全部を満たしたら「できた」）。形は goal.js と
        // docs/lessons/README.md。null ならそのチャレンジは判定しない
        goal: null,
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
        // 答えのプログラム（code と spriteCodes）から描くアクティビティ図を、課題の全文とヒントの 1 ページ目に
        // 出すか（lib/lessons/activity-diagram/・docs/lessons/design.md の「アクティビティ図」）
        activityDiagram: false,
        // メッシュの練習相手（データだけ）: {name, buttons: [{label, set, broadcast}], replies: [{onBroadcast, set,
        // broadcast}]}（set = {variable, value} か、その配列）。チャレンジ中に練習相手のパネルを出し
        // （lib/lessons/practice-partner.js）、図では相手のスイムレーンになる。無ければ null
        partner: null,
        // ふりかえりのクイズ（任意）: {question, choices: [3 つ], answer, explanation}。文言は message descriptor、
        // answer は choices の何番目が正解か（0 から）。「できた！」の中に出す（「できた」の判定には入れない）。
        // ふつうは challengeQuiz(id, answer) で書く。形は validateQuiz
        quiz: null,
        // チャレンジの形。null = ふつう、'readDiagram' = 読んで作る（説明とアクティビティ図だけで指示する。
        // 図は必ず出し、ヒントは「図と説明 → 試す → 答えを見る」の 3 ページに置き換える。`steps` は使わない。
        // 「正解のプログラムを確認する」（置き換え）は置かない。lib/lessons/read-diagram.js）
        mode: null,
        // 読んで作るチャレンジのヒントの 1 ページ目の説明（message descriptor）。無ければ task を出す
        explanation: null,
        ...def,
        // ヒント。title = 文言、target = 指す場所、blocks = 吹き出しに描くブロック、
        // spotlight = はじめて開いたチャレンジだけ周りを暗くして指す場所を照らす
        steps: (def.steps || []).map((step) => ({
            title: null,
            target: null,
            blocks: null,
            spotlight: false,
            ...step,
        })),
    });

/**
 * レッスンを定義する。何個めか（`number`。レッスンの中の番号）は並びから付ける（並びを
 * 変えたときに番号がずれないように、定義には書かない）。レッスンの「全部できた」（✓）は、ふつうは
 * チャレンジが全部できたとき（lesson-progress.js）。テーマを選んでやるレッスン（「チャットをつくろう」の
 * レッスン 5）だけ `checkCount` で数を決める。先生が必須にするチャレンジは段 2 でクラス管理の課題の
 * 側に持つ（#1529）。
 * @param {object} def - レッスンの定義。
 * @param {string} def.id - レッスン id。
 * @param {Array<object>} def.challenges - チャレンジの定義（並び順）。
 * @param {boolean} [def.allowDnclMode] - レッスンのあいだ Ruby タブを日本語モードに切りかえてよいか。
 *   書いていなければ不可（日本語モードのパレットの絞り込みがチャレンジの絞り込みに重なり、チャレンジの
 *   ブロックが出なくなるため・#1741）。setup で日本語モードにするレッスン（DNCL のコースなど）は true にする。
 * @param {number} [def.checkCount] - レッスンの ✓ に要るできた数。書いていなければチャレンジの数（全部）。
 *   テーマを 1 つ以上選んでやるレッスンは 1（#1616 の Q17）。
 * @returns {object} レッスン。
 */
export const defineLesson = ({ id, challenges, allowDnclMode = false, checkCount = null }) => ({
    id,
    name: message(`gui.lessons.lesson.${id}.name`),
    allowDnclMode: Boolean(allowDnclMode),
    checkCount: checkCount === null ? challenges.length : Math.min(checkCount, challenges.length),
    challenges: challenges.map((def, index) => defineChallenge({ ...def, number: index + 1 })),
});

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
    // そのコースで学べること（1〜2 文）。クラス管理の課題のページに入れるレッスンの説明文で使う
    description: message(`gui.lessons.course.${id}.description`),
    lessons,
});

// チャレンジの文言（task / stepN / debugN）を id から引く
const challengeMessage = (challengeId, field) => message(`gui.lessons.challenge.${challengeId}.${field}`);
/** ふりかえりのクイズの選択肢の数（3 択）。 */
export const QUIZ_CHOICE_COUNT = 3;

/**
 * ふりかえりのクイズ（#1639）を、文言の id の決まりどおりに作る。文言は
 * `gui.lessons.challenge.<id>.quiz.question` / `.quiz.choice1`〜`3` / `.quiz.explanation`（en / ja / ja-Hira）。
 * @param {string} challengeId - チャレンジ id。
 * @param {number} answer - 正解の選択肢の何番目か（0 から。choice1 が 0）。
 * @returns {{question: object, choices: Array<object>, answer: number, explanation: object}} クイズ。
 */
export const challengeQuiz = (challengeId, answer) => ({
    question: challengeMessage(challengeId, 'quiz.question'),
    choices: Array.from({ length: QUIZ_CHOICE_COUNT }, (_, i) =>
        challengeMessage(challengeId, `quiz.choice${i + 1}`),
    ),
    answer,
    explanation: challengeMessage(challengeId, 'quiz.explanation'),
});

const isMessage = (value) => Boolean(value) && typeof value === 'object' && typeof value.id === 'string';

/**
 * ふりかえりのクイズの形を確かめる（定義の誤りをテストで見つけるため。アプリでは投げない）。
 * @param {*} quiz - チャレンジの `quiz`。
 * @returns {Array<string>} 誤り（無ければ空）。
 */
export const validateQuiz = (quiz) => {
    if (!quiz || typeof quiz !== 'object') return ['quiz must be an object'];
    const errors = [];
    if (!isMessage(quiz.question)) errors.push('question must be a message');
    if (!Array.isArray(quiz.choices) || quiz.choices.length !== QUIZ_CHOICE_COUNT || !quiz.choices.every(isMessage)) {
        errors.push(`choices must be ${QUIZ_CHOICE_COUNT} messages`);
    }
    if (!Number.isInteger(quiz.answer) || quiz.answer < 0 || quiz.answer >= QUIZ_CHOICE_COUNT) {
        errors.push('answer must be 0, 1 or 2 (the index of choices)');
    }
    if (!isMessage(quiz.explanation)) errors.push('explanation must be a message');
    return errors;
};
// ヒントの文言は並びの番号（step1, step2, ...）で引く
const withTitles = (challengeId, steps) =>
    steps.map((step, i) => ({ ...step, title: challengeMessage(challengeId, `step${i + 1}`) }));

/** ヒントの 1 ページ目「課題の説明と、アクティビティ図を理解しよう」の `kind`。 */
export const UNDERSTAND_STEP_KIND = 'understand';

/**
 * アクティビティ図を出すチャレンジのヒント。1 ページ目に「課題の説明と、アクティビティ図を理解しよう」の
 * ページ（図はこのページだけに出る・lesson-hint.jsx）を足し、渡した手順を 2 ページ目からにする。
 * 手順のページに図を重ねると情報が多すぎるため、図を読むことを 1 つの手順に分ける。吹き出しは図が
 * 読めるようステージの左に出す（読んで作るチャレンジの 1 ページ目と同じ）。文言は step1 が 1 ページ目。
 * @param {string} challengeId - チャレンジ id。
 * @param {Array<object>} steps - 2 ページ目からの手順。
 * @returns {Array<object>} ヒントのページ。
 */
const withDiagramFirst = (challengeId, steps) =>
    withTitles(challengeId, [{ kind: UNDERSTAND_STEP_KIND, target: HINT_TARGETS.STAGE }, ...steps]);
// 「言う」の初期値「こんにちは！」（仕様の表記。ツールボックスの初期値は半角の「こんにちは!」なので書く）
const SAY_HELLO = { MESSAGE: { ja: 'こんにちは！', 'ja-Hira': 'こんにちは！', en: 'Hello!' } };
const debugTips = (challengeId, count) =>
    Array.from({ length: count }, (_, i) => challengeMessage(challengeId, `debug${i + 1}`));

// チャレンジ id は記録（localStorage・クラスへの引き継ぎ）のキーなので、並びを
// 変えても変わらない名前にする（番号を入れない）。中身（仕様）は EPIC #1466 の sub-issue。
// レッスンの id（blocks-l1 / blocks-l2 / blocks-l3）とチャレンジ id は別のもの。チャレンジ id に
// 入っている「l1」は、11 のチャレンジが 1 つのレッスンだったころの名残で、記録のキーなので変えない（#1529）。
const blocksLesson1 = defineLesson({
    id: 'blocks-l1',
    challenges: [
        // 1 キーで音を鳴らそう（音）: スペースキーで「ニャー」のあと「Owl」が鳴る
        {
            id: 'blocks-l1-key-sound',
            card: { category: CATEGORIES.SOUND, main: CATEGORIES.SOUND },
            task: challengeMessage('blocks-l1-key-sound', 'task'),
            allowedBlocks: {
                event: [{ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: 'space' } }],
                // 音の ▼ は、足した「Owl」ではなくネコの音（作品を作った locale の名前）
                sound: [
                    {
                        opcode: 'sound_playuntildone',
                        inputs: { SOUND_MENU: { ja: 'ニャー', 'ja-Hira': 'Meow', en: 'Meow' } },
                    },
                    { opcode: 'sound_play', inputs: { SOUND_MENU: { ja: 'ニャー', 'ja-Hira': 'Meow', en: 'Meow' } } },
                ],
            },
            steps: withTitles('blocks-l1-key-sound', [
                { target: HINT_TARGETS.SOUNDS_TAB },
                { target: HINT_TARGETS.PALETTE, blocks: 'when_key_pressed("space") do\nend\n', spotlight: true },
                // つなげる相手（その上のブロック）とつないだ並びで描く（docs/lessons/design.md の「ヒント」・#1582）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_key_pressed("space") do\n  play_until_done("ニャー")\nend\n',
                        'ja-Hira': 'when_key_pressed("space") do\n  play_until_done("Meow")\nend\n',
                        en: 'when_key_pressed("space") do\n  play_until_done("Meow")\nend\n',
                    },
                    spotlight: true,
                },
                {
                    target: HINT_TARGETS.CODE_AREA,
                    blocks: {
                        ja: 'play_until_done("ニャー")\nplay("Owl")\n',
                        'ja-Hira': 'play_until_done("Meow")\nplay("Owl")\n',
                        en: 'play_until_done("Meow")\nplay("Owl")\n',
                    },
                },
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
            card: { category: CATEGORIES.MOTION, main: CATEGORIES.MOTION },
            task: challengeMessage('blocks-l1-arrow-move', 'task'),
            // 課題の全文に画像を出す例（どのキーでどちらへ動くか）
            image: { src: arrowKeysImage, alt: challengeMessage('blocks-l1-arrow-move', 'image') },
            allowedBlocks: {
                event: [{ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: 'up arrow' } }],
                motion: ['motion_changeyby'],
            },
            steps: withTitles('blocks-l1-arrow-move', [
                // 帽子のブロックを置いてから、その下にくっつける（docs/lessons/design.md の「ヒント」）
                { target: HINT_TARGETS.PALETTE, blocks: 'when_key_pressed("up arrow") do\nend\n' },
                { target: HINT_TARGETS.PALETTE, blocks: 'when_key_pressed("up arrow") do\n  self.y += 10\nend\n' },
                // 複製して変えたあとの、下向き矢印のかたまり
                {
                    target: HINT_TARGETS.CODE_AREA,
                    blocks: 'when_key_pressed("down arrow") do\n  self.y += -10\nend\n',
                },
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
        // 3 押したら話そう（見た目）: コスチュームを足して、押したらセリフと次のコスチューム
        {
            id: 'blocks-l1-click-say',
            card: { category: CATEGORIES.LOOKS, main: CATEGORIES.LOOKS },
            task: challengeMessage('blocks-l1-click-say', 'task'),
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: SAY_HELLO }, 'looks_nextcostume'],
            },
            steps: withTitles('blocks-l1-click-say', [
                { target: HINT_TARGETS.COSTUMES_TAB },
                { target: HINT_TARGETS.PALETTE, blocks: 'when_clicked do\nend\n', spotlight: true },
                // つなげる相手（その上のブロック）とつないだ並びで描く（#1582）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_clicked do\n  say("こんにちは！", 2)\nend\n',
                        'ja-Hira': 'when_clicked do\n  say("こんにちは！", 2)\nend\n',
                        en: 'when_clicked do\n  say("Hello!", 2)\nend\n',
                    },
                    spotlight: true,
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'say("こんにちは！", 2)\nnext_costume\n',
                        'ja-Hira': 'say("こんにちは！", 2)\nnext_costume\n',
                        en: 'say("Hello!", 2)\nnext_costume\n',
                    },
                },
                // ブロックの消し方は、押して試すヒントより前（できたら吹き出しが閉じて見られない・#1576）
                { target: HINT_TARGETS.CODE_AREA, spotlight: true },
                { target: HINT_TARGETS.STAGE, spotlight: true },
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
            card: { category: CATEGORIES.CONTROL, main: CATEGORIES.CONTROL },
            task: challengeMessage('blocks-l1-repeat', 'task'),
            allowedBlocks: {
                event: [{ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: '1' } }],
                control: [{ opcode: 'control_repeat', inputs: { TIMES: 3 } }, 'control_wait'],
                // 背景の名前はライブラリの名前（locale で変わらない）。足す前は ▼ に無いので、ツールボックスの初期値になる
                looks: [{ opcode: 'looks_switchbackdropto', inputs: { BACKDROP: 'Canyon' } }],
            },
            steps: withTitles('blocks-l1-repeat', [
                { target: HINT_TARGETS.BACKDROP },
                { target: HINT_TARGETS.SPRITE_LIST },
                { target: HINT_TARGETS.PALETTE, blocks: 'when_key_pressed("1") do\nend\n' },
                // 帽子のブロックの下につないだ、中身の無い「繰り返す」（`3.times`。do...end は中身が無いと変換できない）
                { target: HINT_TARGETS.PALETTE, blocks: 'when_key_pressed("1") do\n  3.times\nend\n' },
                // 「繰り返す」の中に入れる 4 つを、「繰り返す」に入れた並びのまま描く（「2 組」と「中に」が見てわかるように）
                {
                    target: HINT_TARGETS.CODE_AREA,
                    blocks: '3.times do\n  switch_backdrop("Canyon")\n  sleep(1)\n  switch_backdrop("Arctic")\n  sleep(1)\nend\n',
                },
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
    ],
});

const blocksLesson2 = defineLesson({
    id: 'blocks-l2',
    challenges: [
        // 5 もし〜なら（制御）: マウスがさわっているか・いないかでセリフを変える
        {
            id: 'blocks-l1-if',
            card: { category: CATEGORIES.CONTROL, main: CATEGORIES.CONTROL },
            task: challengeMessage('blocks-l1-if', 'task'),
            // パレットは仕様の「もし <> なら」と、ヒント 2 の「もし〜なら でなければ」の両方を出す
            allowedBlocks: {
                event: ['event_whenflagclicked'],
                control: ['control_forever', 'control_if', 'control_if_else'],
                sensing: ['sensing_touchingobject'],
                looks: [
                    {
                        opcode: 'looks_say',
                        inputs: {
                            MESSAGE: { ja: 'くすぐったい！', 'ja-Hira': 'くすぐったい！', en: 'That tickles!' },
                        },
                    },
                ],
            },
            steps: withTitles('blocks-l1-if', [
                { target: HINT_TARGETS.PALETTE, blocks: 'when_flag_clicked do\nend\n' },
                // 「旗のブロックの下に」つなげるので、旗のブロックとつないだ「ずっと」を描く（#1578）
                { target: HINT_TARGETS.PALETTE, blocks: 'when_flag_clicked do\n  loop do\n  end\nend\n' },
                // 「ずっと」の中に入れた並びで描く（#1582）。`false` は空の穴として描く（Ruby → ブロック変換が
                // 条件の穴の `false` を空の穴にする）。中身の無い `else` も「でなければ」のまま描く（変換は空の `else` を残す）
                { target: HINT_TARGETS.PALETTE, blocks: 'loop do\n  if false\n  else\n  end\nend\n' },
                // 「もし」の穴に入れた並びで描く（#1582）
                { target: HINT_TARGETS.PALETTE, blocks: 'if touching?("_mouse_")\nelse\nend\n' },
                // 「言う」2 つを、入れる場所（「もし」の中と「でなければ」の中）のまま描く
                {
                    target: HINT_TARGETS.CODE_AREA,
                    blocks: {
                        ja: 'if touching?("_mouse_")\n  say("くすぐったい！")\nelse\n  say("さわってみて")\nend\n',
                        'ja-Hira':
                            'if touching?("_mouse_")\n  say("くすぐったい！")\nelse\n  say("さわってみて")\nend\n',
                        en: 'if touching?("_mouse_")\n  say("That tickles!")\nelse\n  say("Touch me")\nend\n',
                    },
                },
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
            code: {
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
        // 6 聞いて答えよう（調べる）: 名前を聞いて、答えと、かかった秒数を言う
        {
            id: 'blocks-l1-ask-answer',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.SENSING },
            task: challengeMessage('blocks-l1-ask-answer', 'task'),
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
                { target: HINT_TARGETS.PALETTE, blocks: 'when_clicked do\nend\n' },
                // つなげる相手（その上のブロック）とつないだ並びで描く（#1582）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_clicked do\n  ask("なまえは？")\nend\n',
                        'ja-Hira': 'when_clicked do\n  ask("なまえは？")\nend\n',
                        en: 'when_clicked do\n  ask("What\'s your name?")\nend\n',
                    },
                },
                // 「聞いて待つ」の下につないだ「言う」の白いところに「答え」を入れたところ
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'ask("なまえは？")\nsay(answer, 2)\n',
                        'ja-Hira': 'ask("なまえは？")\nsay(answer, 2)\n',
                        en: 'ask("What\'s your name?")\nsay(answer, 2)\n',
                    },
                },
                // 「聞いて待つ」の上に入れるので、その下に「聞いて待つ」をつないだ絵にする（#1580）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'timer.reset\nask("なまえは？")\n',
                        'ja-Hira': 'timer.reset\nask("なまえは？")\n',
                        en: 'timer.reset\nask("What\'s your name?")\n',
                    },
                },
                // 「(タイマー) と (秒でした)」の「と」1 つを入れた「言う」（code と同じ書き方）を、1 つめの
                // 「言う」の下につないだ並びで描く（#1582）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'say(answer, 2)\nsay(timer.value + "秒でした", 2)\n',
                        'ja-Hira': 'say(answer, 2)\nsay(timer.value + "びょうでした", 2)\n',
                        en: 'say(answer, 2)\nsay(timer.value + " seconds", 2)\n',
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
            code: {
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
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.SENSING },
            task: challengeMessage('blocks-l1-quiz', 'task'),
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
                { target: HINT_TARGETS.PALETTE, blocks: 'when_clicked do\nend\n' },
                // つなげる相手（その上のブロック）とつないだ並びで描く（#1582）
                { target: HINT_TARGETS.PALETTE, blocks: 'when_clicked do\n  ask("4+3=?")\nend\n' },
                // 「聞いて待つ」の下につないだ「もし〜なら でなければ」と、その中の「言う」2 つ（条件の穴はまだ空）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'ask("4+3=?")\nif false\n  say("正解です", 2)\nelse\n  say("ちがいます", 2)\nend\n',
                        'ja-Hira':
                            'ask("4+3=?")\nif false\n  say("せいかいです", 2)\nelse\n  say("ちがいます", 2)\nend\n',
                        en: 'ask("4+3=?")\nif false\n  say("Correct", 2)\nelse\n  say("Wrong", 2)\nend\n',
                    },
                },
                // 「=」を「もし」の穴に入れた並び（中の「言う」2 つは前のヒントで入れたまま）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'if "" == 7\n  say("正解です", 2)\nelse\n  say("ちがいます", 2)\nend\n',
                        'ja-Hira': 'if "" == 7\n  say("せいかいです", 2)\nelse\n  say("ちがいます", 2)\nend\n',
                        en: 'if "" == 7\n  say("Correct", 2)\nelse\n  say("Wrong", 2)\nend\n',
                    },
                },
                { target: HINT_TARGETS.CODE_AREA, blocks: 'answer == 7\n' },
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
    ],
});

const blocksLesson3 = defineLesson({
    id: 'blocks-l3',
    challenges: [
        // 8 数えよう（変数）: 押した回数を変数「回数」（en は count）で数えて言う
        {
            id: 'blocks-l1-count',
            card: { category: CATEGORIES.VARIABLES, main: CATEGORIES.VARIABLES },
            task: challengeMessage('blocks-l1-count', 'task'),
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
                // 「〜のプログラムを作ろう」のヒントは、帽子のブロックからのかたまりで描く
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_flag_clicked do\n  $回数 = 0\nend\n',
                        'ja-Hira': 'when_flag_clicked do\n  $かいすう = 0\nend\n',
                        en: 'when_flag_clicked do\n  $count = 0\nend\n',
                    },
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_clicked do\n  $回数 += 1\n  say($回数)\nend\n',
                        'ja-Hira': 'when_clicked do\n  $かいすう += 1\n  say($かいすう)\nend\n',
                        en: 'when_clicked do\n  $count += 1\n  say($count)\nend\n',
                    },
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
                'ja-Hira':
                    'when_flag_clicked do\n  $かいすう = 0\nend\n\nwhen_clicked do\n  $かいすう += 1\n  say($かいすう)\nend\n',
                en: 'when_flag_clicked do\n  $count = 0\nend\n\nwhen_clicked do\n  $count += 1\n  say($count)\nend\n',
            },
        },
        // 9 なかまに合図しよう（イベント）: ネコを押したら合図を送り、受け取ったペンギンが言う
        {
            id: 'blocks-l1-broadcast',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.EVENTS },
            task: challengeMessage('blocks-l1-broadcast', 'task'),
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
                        ja: 'when_clicked do\n  broadcast("あいさつ")\nend\n',
                        'ja-Hira': 'when_clicked do\n  broadcast("あいさつ")\nend\n',
                        en: 'when_clicked do\n  broadcast("hello")\nend\n',
                    },
                },
                { target: HINT_TARGETS.SPRITE_LIST },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n',
                        'ja-Hira': 'when_receive("あいさつ") do\n  say("やあ！", 2)\nend\n',
                        en: 'when_receive("hello") do\n  say("Hi!", 2)\nend\n',
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
            card: { category: CATEGORIES.EXTENSIONS, main: CATEGORIES.EXTENSIONS },
            task: challengeMessage('blocks-l1-speak', 'task'),
            // 拡張機能のカテゴリはパレットを絞っても全部出る（make-toolbox-xml）。ここは使うブロックの記録。
            // 拡張機能は子どもがヒント 1 で足す（setup.extensions では入れない）
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                text2speech: [
                    {
                        opcode: 'text2speech_speakAndWait',
                        inputs: {
                            WORDS: {
                                ja: 'ボタンが押されました',
                                'ja-Hira': 'ボタンがおされました',
                                en: 'The button was clicked',
                            },
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
                        ja: 'when_clicked do\n  text2speech.speak("ボタンが押されました")\nend\n',
                        'ja-Hira': 'when_clicked do\n  text2speech.speak("ボタンがおされました")\nend\n',
                        en: 'when_clicked do\n  text2speech.speak("The button was clicked")\nend\n',
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
        // 11 メッセージをためよう（リスト）: 聞いた答えをリスト「トーク」（en は talk）にためる
        {
            id: 'blocks-l1-message-list',
            card: { category: CATEGORIES.LISTS, main: CATEGORIES.LISTS },
            task: challengeMessage('blocks-l1-message-list', 'task'),
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
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_flag_clicked do\n  $トーク.clear\nend\n',
                        'ja-Hira': 'when_flag_clicked do\n  $トーク.clear\nend\n',
                        en: 'when_flag_clicked do\n  $talk.clear\nend\n',
                    },
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: {
                        ja: 'when_clicked do\n  ask("メッセージは？")\n  $トーク.push(answer)\nend\n',
                        'ja-Hira': 'when_clicked do\n  ask("メッセージは？")\n  $トーク.push(answer)\nend\n',
                        en: 'when_clicked do\n  ask("Message?")\n  $talk.push(answer)\nend\n',
                    },
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

// ===== コース「チャットをつくろう」（中学 2 年・EPIC #1616）=====
// 中身はレッスンごとに人間と詰めたもの（#1641〜#1645 のコメント）。どのチャレンジも、新しい作品のネコを
// シマラビ（Shimaraby）に置きかえて始める（setup.sprites・#1936）。変数は「すべてのスプライト用」（Ruby の `$`）。
// 子どもが作る名前（変数）は ja / ja-Hira が「シマラビのメッセージ」（カタカナなので ja-Hira も同じ。画面の
// キャラクターの名前もカタカナのシマラビ）、en が `shimaraby_message`（英語の生徒に日本語を入力させない）。
// 判定はどの locale の名前でも通す（locale をまたいだ作品のため）
const CHAT_START = { sprites: ['Shimaraby'] };
const CHAT_MESSAGE_VARIABLE = ['シマラビのメッセージ', 'shimaraby_message'];
// 「聞いて待つ」の質問（ja-Hira は漢字を使わない）
const CHAT_ASK = { ja: 'メッセージを入力', 'ja-Hira': 'メッセージを にゅうりょく', en: 'Enter a message' };
// locale ごとの Ruby を、名前（変数・質問・セリフ）の差しかえで作る
const CHAT_WORDS = {
    ja: { v: '$シマラビのメッセージ', ask: CHAT_ASK.ja, empty: '何か書いてね', end: 'おわり', bye: 'またね' },
    'ja-Hira': {
        v: '$シマラビのメッセージ',
        ask: CHAT_ASK['ja-Hira'],
        empty: 'なにか かいてね',
        end: 'おわり',
        bye: 'またね',
    },
    en: { v: '$shimaraby_message', ask: CHAT_ASK.en, empty: 'Write something', end: 'end', bye: 'Bye!' },
};
const chatCode = (make) =>
    Object.fromEntries(Object.entries(CHAT_WORDS).map(([locale, words]) => [locale, make(words)]));

const chatLesson1 = defineLesson({
    id: 'chat-l1',
    challenges: [
        // 1 入力して表示しよう（順次処理）: 聞く → 変数に入れる → 言う
        {
            id: 'chat-l1-sequence',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.SENSING },
            task: challengeMessage('chat-l1-sequence', 'task'),
            setup: CHAT_START,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                data: ['data_setvariableto', 'data_variable'],
                looks: ['looks_sayforsecs'],
            },
            steps: withDiagramFirst('chat-l1-sequence', [
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatCode((w) => `when_flag_clicked do\n  ask("${w.ask}")\nend\n`),
                },
                { target: HINT_TARGETS.PALETTE, blocks: chatCode((w) => `ask("${w.ask}")\n${w.v} = answer\n`) },
                { target: HINT_TARGETS.PALETTE, blocks: chatCode((w) => `${w.v} = answer\nsay(${w.v}, 2)\n`) },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l1-sequence', 1),
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: ['sensing_askandwait', 'data_setvariableto', 'looks_sayforsecs'],
                    order: ['sensing_askandwait', 'data_setvariableto', 'looks_sayforsecs'],
                },
                // 決めた名前の変数（答えを入れたもの）を言った
                { type: 'said', equalsAnswer: true, equalsVariable: CHAT_MESSAGE_VARIABLE },
            ],
            quiz: challengeQuiz('chat-l1-sequence', 1),
            code: chatCode(
                (w) => `when_flag_clicked do\n  ask("${w.ask}")\n  ${w.v} = answer\n  say(${w.v}, 2)\nend\n`,
            ),
        },
        // 2 入力を待ち続けよう（反復処理）: 「聞いて待つ」の質問に変数を入れて、ずっと入力を待つ。
        // レッスン 4 で「送る」を足すと教科書のチャットの送る側になる
        {
            id: 'chat-l1-repeat',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.CONTROL },
            task: challengeMessage('chat-l1-repeat', 'task'),
            setup: CHAT_START,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                control: ['control_forever'],
                data: ['data_setvariableto', 'data_variable'],
            },
            steps: withDiagramFirst('chat-l1-repeat', [
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatCode((w) => `when_flag_clicked do\n  ask("${w.ask}")\nend\n`),
                },
                { target: HINT_TARGETS.PALETTE, blocks: chatCode((w) => `ask("${w.ask}")\nloop do\nend\n`) },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatCode((w) => `loop do\n  ${w.v} = answer\n  ask(${w.v})\nend\n`),
                },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l1-repeat', 1),
            // 「聞いて待つ」が 3 回動いた = 最初の 1 回 + くり返しの中で 2 回（2 回以上入力した）。
            // 「(変数) と聞いて待つ」の質問は吹き出し（SAY）に出るので、答えを入れた変数を質問にしたことを said で見る
            // （作っただけの変数は 0 なので、変数の値だけを見ると変数に入れないプログラムでも通ってしまう）
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: ['control_forever', 'data_setvariableto', { opcode: 'sensing_askandwait', count: 3 }],
                },
                { type: 'said', equalsAnswer: true, equalsVariable: CHAT_MESSAGE_VARIABLE },
            ],
            quiz: challengeQuiz('chat-l1-repeat', 2),
            code: chatCode(
                (w) =>
                    `when_flag_clicked do\n  ask("${w.ask}")\n  loop do\n    ${w.v} = answer\n` +
                    `    ask(${w.v})\n  end\nend\n`,
            ),
        },
        // 3 空のメッセージは表示しない（分岐処理）: 何も入力しなければ「何か書いてね」
        {
            id: 'chat-l1-branch',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.CONTROL },
            task: challengeMessage('chat-l1-branch', 'task'),
            setup: CHAT_START,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                control: ['control_if_else'],
                // 右は空（何も入力しなかった = 空の文字と等しい）
                operators: [{ opcode: 'operator_equals', inputs: { OPERAND2: '' } }],
                data: ['data_setvariableto', 'data_variable'],
                looks: [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: {
                            MESSAGE: { ja: '何か書いてね', 'ja-Hira': 'なにか かいてね', en: 'Write something' },
                        },
                    },
                ],
            },
            steps: withDiagramFirst('chat-l1-branch', [
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatCode((w) => `when_flag_clicked do\n  ask("${w.ask}")\nend\n`),
                },
                // `false` は空の穴、中身の無い `else` も「でなければ」のまま描く（blocks-l1-if と同じ）
                { target: HINT_TARGETS.PALETTE, blocks: chatCode((w) => `ask("${w.ask}")\nif false\nelse\nend\n`) },
                { target: HINT_TARGETS.PALETTE, blocks: 'if answer == ""\nelse\nend\n' },
                {
                    target: HINT_TARGETS.CODE_AREA,
                    blocks: chatCode(
                        (w) =>
                            `if answer == ""\n  say("${w.empty}", 2)\nelse\n  ${w.v} = answer\n` +
                            `  say(${w.v}, 2)\nend\n`,
                    ),
                },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l1-branch', 1),
            // 何も入れずに試すのと、何か入れて試すのの両方（2 回試す）。分岐で言い分けたことを見るため、
            // 「何か書いてね」は答えが空のとき、答えは変数に入れて言ったとき、旗のスクリプトで「もし〜なら でなければ」が動いた
            goal: [
                { type: 'uses', trigger: { hat: 'event_whenflagclicked' }, blocks: ['control_if_else'] },
                { type: 'said', text: /^(何か書いてね|なにか かいてね|write something)/i, answer: '' },
                { type: 'said', equalsAnswer: true, equalsVariable: CHAT_MESSAGE_VARIABLE },
            ],
            quiz: challengeQuiz('chat-l1-branch', 0),
            code: chatCode(
                (w) =>
                    `when_flag_clicked do\n  ask("${w.ask}")\n  if answer == ""\n    say("${w.empty}", 2)\n` +
                    `  else\n    ${w.v} = answer\n    say(${w.v}, 2)\n  end\nend\n`,
            ),
        },
        // 4 図を読んで作ろう（読んで作る）: 「おわり」と入力するまで聞いて言うをくり返し、最後に「またね」。
        // くり返しの前に 1 回聞く（教科書のチャットの送る側と同じ「聞く → くり返し〔… → 聞く〕」の形）。旗を押すたびに
        // 最初に聞くので、前の実行の「答え」（「おわり」）が残っていても、すぐ「またね」にならない
        {
            id: 'chat-l1-read-diagram',
            mode: 'readDiagram',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.CONTROL },
            task: challengeMessage('chat-l1-read-diagram', 'task'),
            explanation: challengeMessage('chat-l1-read-diagram', 'explanation'),
            setup: CHAT_START,
            allowedBlocks: {
                event: ['event_whenflagclicked'],
                control: ['control_repeat_until'],
                operators: [
                    {
                        opcode: 'operator_equals',
                        inputs: { OPERAND2: { ja: 'おわり', 'ja-Hira': 'おわり', en: 'end' } },
                    },
                ],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                looks: [
                    { opcode: 'looks_sayforsecs', inputs: { SECS: 1 } },
                    { opcode: 'looks_say', inputs: { MESSAGE: { ja: 'またね', 'ja-Hira': 'またね', en: 'Bye!' } } },
                ],
            },
            // 「聞いて待つ」が 2 回動いた（くり返しの前の 1 回 + くり返しの中で 1 回 = 「おわり」の前に 1 回以上
            // 入力して、くり返しを通った）あと「またね」と言った
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    // 「またね」は「言う」ブロックで言った（入力した「またね」を「答えと 1 秒言う」で言っても通さない）
                    blocks: [
                        'control_repeat_until',
                        { opcode: 'sensing_askandwait', count: 2 },
                        { opcode: 'looks_say', args: { MESSAGE: /^(またね|bye)/i } },
                    ],
                },
                { type: 'said', text: /^(またね|bye)/i },
            ],
            quiz: challengeQuiz('chat-l1-read-diagram', 1),
            code: chatCode(
                (w) =>
                    `when_flag_clicked do\n  ask("${w.ask}")\n  until answer == "${w.end}"\n` +
                    `    say(answer, 1)\n    ask("${w.ask}")\n  end\n  say("${w.bye}")\nend\n`,
            ),
        },
    ],
});

// レッスン 2「データとイベント」（#1642）: 変数・乱数・タイマーと「〜したとき」で、働きかけ（入力）に応答（出力）する。
// 変数の名前は locale ごと（ja-Hira は漢字を使わない・en は英語）。判定はどの locale の名前でも通す
const CHAT_L2_WORDS = {
    ja: {
        kuji: '$くじ',
        great: '大吉',
        small: '小吉',
        timeUp: '10秒たったよ',
        janken: '0:グー 1:チョキ 2:パー',
        te: '$手',
        tie: 'あいこ',
        noTie: '勝負あり',
    },
    'ja-Hira': {
        kuji: '$くじ',
        great: 'だいきち',
        small: 'しょうきち',
        timeUp: '10びょう たったよ',
        janken: '0:グー 1:チョキ 2:パー',
        te: '$て',
        tie: 'あいこ',
        noTie: 'しょうぶあり',
    },
    en: {
        kuji: '$fortune',
        great: 'Great luck',
        small: 'Small luck',
        timeUp: '10 seconds passed',
        janken: '0:rock 1:scissors 2:paper',
        te: '$hand',
        tie: 'Tie',
        noTie: 'No tie',
    },
};
const chatL2Code = (make) =>
    Object.fromEntries(Object.entries(CHAT_L2_WORDS).map(([locale, words]) => [locale, make(words)]));
// locale ごとの文字（パレットの初期値）
const chatL2Text = (key) =>
    Object.fromEntries(Object.entries(CHAT_L2_WORDS).map(([locale, words]) => [locale, words[key]]));
const CHAT_KUJI_VARIABLE = ['くじ', 'fortune'];
const CHAT_TE_VARIABLE = ['手', 'て', 'hand'];
// タイマーで知らせる秒数。本当に使いすぎを知らせるなら 600 秒（10 分）だが、授業で試せるように 10 秒にする
const CHAT_TIMER_SECS = 10;

const chatLesson2 = defineLesson({
    id: 'chat-l2',
    challenges: [
        // 1 おみくじを作ろう（乱数）: 押したら 1〜3 の乱数を「くじ」に入れて、1 なら大吉、それ以外は小吉
        {
            id: 'chat-l2-omikuji',
            card: { category: CATEGORIES.OPERATORS, main: CATEGORIES.OPERATORS },
            task: challengeMessage('chat-l2-omikuji', 'task'),
            setup: CHAT_START,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                data: ['data_setvariableto', 'data_variable'],
                operators: [
                    { opcode: 'operator_random', inputs: { FROM: 1, TO: 3 } },
                    { opcode: 'operator_equals', inputs: { OPERAND2: 1 } },
                ],
                control: ['control_if_else'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: { MESSAGE: chatL2Text('great') } }],
            },
            steps: withDiagramFirst('chat-l2-omikuji', [
                { target: HINT_TARGETS.PALETTE, blocks: 'when_clicked do\nend\n' },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL2Code((w) => `when_clicked do\n  ${w.kuji} = rand(1..3)\nend\n`),
                },
                // 「もし〜なら でなければ」と、その中の「言う」2 つ（条件の穴はまだ空）
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL2Code(
                        (w) =>
                            `${w.kuji} = rand(1..3)\nif false\n  say("${w.great}", 2)\nelse\n` +
                            `  say("${w.small}", 2)\nend\n`,
                    ),
                },
                { target: HINT_TARGETS.CODE_AREA, blocks: chatL2Code((w) => `${w.kuji} == 1\n`) },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('chat-l2-omikuji', 1),
            // 乱数を「くじ」に入れて、分岐で言い分けた: 大吉は「くじ」が 1 のとき、小吉は 1 でないときに言った
            // （分岐を使わずに両方を言うプログラムは通らない。くじを見ずに別の乱数で分けるプログラムは、乱数の出方しだいで
            // 何回か押すうちに通ることがある。判定は動いた結果を見るので、そこまでは見分けない）
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: [
                        { opcode: 'operator_random', args: { FROM: 1, TO: 3 } },
                        'data_setvariableto',
                        'control_if_else',
                    ],
                },
                {
                    type: 'said',
                    text: /^(大吉|だいきち|great)/i,
                    variable: { name: CHAT_KUJI_VARIABLE, value: 1 },
                },
                {
                    type: 'said',
                    text: /^(小吉|しょうきち|small)/i,
                    variable: { name: CHAT_KUJI_VARIABLE, value: { ne: 1 } },
                },
            ],
            quiz: challengeQuiz('chat-l2-omikuji', 0),
            code: chatL2Code(
                (w) =>
                    `when_clicked do\n  ${w.kuji} = rand(1..3)\n  if ${w.kuji} == 1\n    say("${w.great}", 2)\n` +
                    `  else\n    say("${w.small}", 2)\n  end\nend\n`,
            ),
        },
        // 2 タイマーで知らせよう: 旗でタイマーをリセットし、10 秒より大きくなるまで待ってから知らせる
        // （使いすぎを知らせる機能のもと。課題の全文に、本当なら 600 秒と書く）
        {
            id: 'chat-l2-timer',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.SENSING },
            task: challengeMessage('chat-l2-timer', 'task'),
            setup: CHAT_START,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked'],
                sensing: ['sensing_resettimer', 'sensing_timer'],
                control: ['control_wait_until'],
                operators: [{ opcode: 'operator_gt', inputs: { OPERAND2: CHAT_TIMER_SECS } }],
                looks: [{ opcode: 'looks_say', inputs: { MESSAGE: chatL2Text('timeUp') } }],
            },
            steps: withDiagramFirst('chat-l2-timer', [
                { target: HINT_TARGETS.PALETTE, blocks: 'when_flag_clicked do\n  timer.reset\nend\n' },
                { target: HINT_TARGETS.PALETTE, blocks: 'timer.reset\nwait until false\n' },
                { target: HINT_TARGETS.CODE_AREA, blocks: `wait until timer.value > ${CHAT_TIMER_SECS}\n` },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL2Code((w) => `wait until timer.value > ${CHAT_TIMER_SECS}\nsay("${w.timeUp}")\n`),
                },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l2-timer', 1),
            // リセット → 待つ → 言う の順に動き、待つの条件が「(タイマー) > 10」（本当の 600 でもよい）だった。
            // 同じスレッドの「言う」は待つが終わってから動くので、order で「待ったあとに言った」ことになる
            // （order は、それぞれのブロックが最初に動いた順だけを見る）。「> 0」「> 1」のように早く終わる条件、
            // 待つ前に言うプログラムは通らない。右は数に限る（「10秒」のような文字だと Scratch は文字として比べ、
            // 2 秒ほどで成り立ってしまう）。左の値（タイマー）は毎回ちがい、記録する引数の種類に上限があるので
            // （goal.js の MAX_ARGS_SEEN）条件にしない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: [
                        'sensing_resettimer',
                        'control_wait_until',
                        'sensing_timer',
                        {
                            opcode: 'operator_gt',
                            args: { OPERAND2: { gte: CHAT_TIMER_SECS, matches: /^\s*\d+(\.\d+)?\s*$/ } },
                        },
                    ],
                    order: ['sensing_resettimer', 'control_wait_until', 'looks_say'],
                },
                { type: 'said', text: /^(10秒たったよ|10びょう たったよ|10 seconds)/i },
            ],
            quiz: challengeQuiz('chat-l2-timer', 0),
            code: chatL2Code(
                (w) =>
                    `when_flag_clicked do\n  timer.reset\n  wait until timer.value > ${CHAT_TIMER_SECS}\n` +
                    `  say("${w.timeUp}")\nend\n`,
            ),
        },
        // 3 じゃんけんであいこを見つけよう: 手を聞き、コンピューターの手を 0〜2 の乱数で「手」に入れて、
        // 答えと同じなら「あいこ」、ちがえば「勝負あり」
        {
            id: 'chat-l2-janken',
            card: { category: CATEGORIES.VARIABLES, main: CATEGORIES.VARIABLES },
            task: challengeMessage('chat-l2-janken', 'task'),
            setup: CHAT_START,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenthisspriteclicked'],
                sensing: [
                    { opcode: 'sensing_askandwait', inputs: { QUESTION: chatL2Text('janken') } },
                    'sensing_answer',
                ],
                data: ['data_setvariableto', 'data_variable'],
                operators: [{ opcode: 'operator_random', inputs: { FROM: 0, TO: 2 } }, 'operator_equals'],
                control: ['control_if_else'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: { MESSAGE: chatL2Text('tie') } }],
            },
            steps: withDiagramFirst('chat-l2-janken', [
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL2Code((w) => `when_clicked do\n  ask("${w.janken}")\nend\n`),
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL2Code((w) => `ask("${w.janken}")\n${w.te} = rand(0..2)\n`),
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL2Code(
                        (w) =>
                            `${w.te} = rand(0..2)\nif false\n  say("${w.tie}", 2)\nelse\n` +
                            `  say("${w.noTie}", 2)\nend\n`,
                    ),
                },
                { target: HINT_TARGETS.CODE_AREA, blocks: chatL2Code((w) => `answer == ${w.te}\n`) },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('chat-l2-janken', 1),
            // 乱数を「手」に入れて、答えと比べて言い分けた: あいこは「手」と答えが同じとき、勝負ありはちがうときに
            // 言った（分岐を使わずに両方を言うプログラムは通らない。答えを決まった数と比べるプログラムは、乱数の出方しだいで
            // 何回か試すうちに通ることがある。判定は動いた結果を見るので、そこまでは見分けない）
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: [
                        { opcode: 'operator_random', args: { FROM: 0, TO: 2 } },
                        'sensing_askandwait',
                        'data_setvariableto',
                        'control_if_else',
                    ],
                },
                {
                    type: 'said',
                    text: /^(あいこ|tie)/i,
                    variable: { name: CHAT_TE_VARIABLE, equalsAnswer: true },
                },
                {
                    type: 'said',
                    text: /^(勝負あり|しょうぶあり|no tie)/i,
                    variable: { name: CHAT_TE_VARIABLE, equalsAnswer: false },
                },
            ],
            quiz: challengeQuiz('chat-l2-janken', 1),
            code: chatL2Code(
                (w) =>
                    `when_clicked do\n  ask("${w.janken}")\n  ${w.te} = rand(0..2)\n  if answer == ${w.te}\n` +
                    `    say("${w.tie}", 2)\n  else\n    say("${w.noTie}", 2)\n  end\nend\n`,
            ),
        },
    ],
});

// レッスン 3「メッシュでつながろう」（#1643）: メッセージ（知らせ）と変数（中身）を分けて送るしくみを、同じ
// コンピューターの中 → メッシュのメッセージ → メッシュの共有する変数、の順に学ぶ。ペアが基本で、ひとりのときは
// 練習相手の「シマネコ」とやる（partner。ペアでシマネコの役の人はシマラビとシマネコを入れかえて作るので、判定は
// 両方の名前を通す）。変数とメッセージは同じ名前にする（教科書の形）。拡張機能「メッシュ」は 3-2 で生徒が足し、
// 3-3 は setup で読み込んでおく。メッシュで相手に届く名前（メッセージ・共有する変数）は ja と ja-Hira で同じにする
// （漢字を使わない形。ja と ja-Hira の生徒がペアになっても届くように）。en は別の名前（en と ja のペアは考えない）
const CHAT_PAIR_START = { sprites: ['Shimaraby', 'Shimacat'] };
const CHAT_L3_WORDS = {
    ja: {
        v: '$シマラビのメッセージ',
        message: 'シマラビのメッセージ',
        ask: CHAT_ASK.ja,
        wave: 'てをふる',
        hi: 'やあ！',
        myMood: '$シマラビのきぶん',
        myMoodName: 'シマラビのきぶん',
        partnerMood: 'シマネコのきぶん',
        happy: 'うれしい',
        sleepy: 'ねむい',
        partner: 'シマネコ',
    },
    'ja-Hira': {
        v: '$シマラビのメッセージ',
        message: 'シマラビのメッセージ',
        ask: CHAT_ASK['ja-Hira'],
        wave: 'てをふる',
        hi: 'やあ！',
        myMood: '$シマラビのきぶん',
        myMoodName: 'シマラビのきぶん',
        partnerMood: 'シマネコのきぶん',
        happy: 'うれしい',
        sleepy: 'ねむい',
        partner: 'シマネコ',
    },
    en: {
        v: '$shimaraby_message',
        message: 'shimaraby_message',
        ask: CHAT_ASK.en,
        wave: 'wave',
        hi: 'Hi!',
        myMood: '$shimaraby_mood',
        myMoodName: 'shimaraby_mood',
        partnerMood: 'shimacat_mood',
        happy: 'happy',
        sleepy: 'sleepy',
        partner: 'Shimacat',
    },
};
const chatL3Code = (make) =>
    Object.fromEntries(Object.entries(CHAT_L3_WORDS).map(([locale, words]) => [locale, make(words)]));
const chatL3Text = (key) =>
    Object.fromEntries(Object.entries(CHAT_L3_WORDS).map(([locale, words]) => [locale, words[key]]));
const CHAT_WAVE_MESSAGE = ['てをふる', 'wave'];
// メッセージの名前のどれかに合う（Scratch と同じく大文字小文字を区別しない）
const messageMatcher = (names) => new RegExp(`^(${names.join('|')})$`, 'i');
// 気分の変数（シマラビの役・シマネコの役のどちらの名前も、どの locale の名前も）
const CHAT_MOOD_VARIABLE = ['シマラビのきぶん', 'シマネコのきぶん', 'shimaraby_mood', 'shimacat_mood'];
// 3-1 の変数（受け取った側が読む）の名前
const CHAT_MESSAGE_NAME = new RegExp(`^(${CHAT_MESSAGE_VARIABLE.join('|')})$`);
// 合図を送るブロック（「送る」「送って待つ」「値つきで送る」のどれで送ってもよい）
const CHAT_SEND_OPCODES = ['event_broadcast', 'event_broadcastandwait', 'meshV2_broadcastWithValue'];
const CHAT_MOOD_NAME = new RegExp(`^(${CHAT_MOOD_VARIABLE.join('|')})$`);
const CHAT_HAPPY = /^(うれしい|happy)$/i;
const CHAT_SLEEPY = /^(ねむい|sleepy)$/i;
const CHAT_MOOD = /^(うれしい|ねむい|happy|sleepy)$/i;

const chatLesson3 = defineLesson({
    id: 'chat-l3',
    challenges: [
        // 1 メッセージと変数を分けて送ろう（同じコンピューターの中）: シマラビが聞いた答えを変数に入れてメッセージを送り、
        // 受け取ったシマネコがその変数を言う。メッセージは「送ったよ」の知らせだけで、中身は変数に入れておく
        {
            id: 'chat-l3-local-message',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.EVENTS },
            task: challengeMessage('chat-l3-local-message', 'task'),
            // シマネコは生徒がライブラリから足す
            setup: CHAT_START,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                data: ['data_setvariableto', 'data_variable'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: { SECS: 3 } }],
            },
            steps: withDiagramFirst('chat-l3-local-message', [
                { target: HINT_TARGETS.SPRITE_LIST, spotlight: true },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL3Code((w) => `when_flag_clicked do\n  ask("${w.ask}")\n  ${w.v} = answer\nend\n`),
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL3Code((w) => `${w.v} = answer\nbroadcast("${w.message}")\n`),
                },
                {
                    target: HINT_TARGETS.SPRITE_LIST,
                    blocks: chatL3Code((w) => `when_receive("${w.message}") do\n  say(${w.v}, 3)\nend\n`),
                },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l3-local-message', 2),
            // シマラビの旗のスクリプトで 聞く → 変数に入れる → 送る の順に動き、ほかのスプライト（シマネコ）が受け取った
            // スクリプトで、答えを入れた変数を言った（said の trigger で「受け取ったスクリプトで言った」ことを見る。
            // シマラビが自分で言うだけ・受け取った側が別のことを言うプログラムは通らない）
            goal: [
                { type: 'sprites', min: 2 },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: ['sensing_askandwait', 'data_setvariableto', 'event_broadcast'],
                    order: ['sensing_askandwait', 'data_setvariableto', 'event_broadcast'],
                },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' },
                    // 受け取ったスクリプトで変数を読んで言った（(答え) を言うだけでは通さない）
                    blocks: ['looks_sayforsecs', { opcode: 'data_variable', args: { VARIABLE: CHAT_MESSAGE_NAME } }],
                },
                {
                    type: 'said',
                    trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' },
                    equalsAnswer: true,
                    equalsVariable: CHAT_MESSAGE_VARIABLE,
                },
            ],
            quiz: challengeQuiz('chat-l3-local-message', 0),
            code: chatL3Code(
                (w) =>
                    `when_flag_clicked do\n  ask("${w.ask}")\n  ${w.v} = answer\n  broadcast("${w.message}")\nend\n`,
            ),
            spriteCodes: [
                {
                    sprite: 'Shimacat',
                    code: chatL3Code((w) => `when_receive("${w.message}") do\n  say(${w.v}, 3)\nend\n`),
                },
            ],
        },
        // 2 メッシュでメッセージを送り合おう: 拡張機能「メッシュ」を足し、ペアならホストがグループを作って相手が参加する
        // （ひとりなら練習相手）。スペースキーでシマラビが「手をふる」を送り、受け取ったらシマネコが「やあ！」と言う
        {
            id: 'chat-l3-mesh-signal',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.EXTENSIONS },
            task: challengeMessage('chat-l3-mesh-signal', 'task'),
            // 拡張機能は子どもがヒント 1 で足す（setup.extensions では入れない）
            setup: CHAT_PAIR_START,
            activityDiagram: true,
            allowedBlocks: {
                event: [
                    { opcode: 'event_whenkeypressed', fields: { KEY_OPTION: 'space' } },
                    'event_broadcast',
                    'event_whenbroadcastreceived',
                ],
                looks: [{ opcode: 'looks_sayforsecs', inputs: { MESSAGE: chatL3Text('hi'), SECS: 2 } }],
            },
            partner: {
                name: chatL3Text('partner'),
                buttons: [{ label: chatL3Text('wave'), broadcast: chatL3Text('wave') }],
                replies: [],
            },
            steps: withDiagramFirst('chat-l3-mesh-signal', [
                { target: HINT_TARGETS.EXTENSION_BUTTON, spotlight: true },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL3Code((w) => `when_key_pressed("space") do\n  broadcast("${w.wave}")\nend\n`),
                },
                {
                    target: HINT_TARGETS.SPRITE_LIST,
                    blocks: chatL3Code((w) => `when_receive("${w.wave}") do\n  say("${w.hi}", 2)\nend\n`),
                },
                { target: HINT_TARGETS.KEYBOARD },
            ]),
            debug: debugTips('chat-l3-mesh-signal', 2),
            // メッシュを読み込み、スペースキーのスクリプトで「手をふる」を送り、「手をふる」を受け取ったスクリプトで言った。
            // 自分の送ったメッセージも自分に届くので、ひとりでも「できた」になる。メッシュで届いた合図は送り手を記録しない
            // ので sentBy は使わない（docs/lessons/README.md の「メッシュの練習相手」）
            goal: [
                { type: 'extension', id: 'meshV2' },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: 'space' },
                    blocks: [
                        { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: messageMatcher(CHAT_WAVE_MESSAGE) } },
                    ],
                },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenbroadcastreceived', message: CHAT_WAVE_MESSAGE },
                    blocks: ['looks_sayforsecs'],
                },
            ],
            quiz: challengeQuiz('chat-l3-mesh-signal', 2),
            code: chatL3Code((w) => `when_key_pressed("space") do\n  broadcast("${w.wave}")\nend\n`),
            spriteCodes: [
                {
                    sprite: 'Shimacat',
                    code: chatL3Code((w) => `when_receive("${w.wave}") do\n  say("${w.hi}", 2)\nend\n`),
                },
            ],
        },
        // 3 変数を共有しよう: 1・2 のキーで変数「シマラビの気分」を変え（メッシュの共有する変数）、シマネコを押したら
        // 相手の気分（「シマネコの気分」のセンサーの値）を言う。自分の気分は練習相手のパネルの「届いた」に出る（watch）
        {
            id: 'chat-l3-mesh-variable',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.EXTENSIONS },
            task: challengeMessage('chat-l3-mesh-variable', 'task'),
            setup: { ...CHAT_PAIR_START, extensions: ['meshV2'] },
            activityDiagram: true,
            allowedBlocks: {
                event: [
                    { opcode: 'event_whenkeypressed', fields: { KEY_OPTION: '1' } },
                    'event_whenthisspriteclicked',
                ],
                data: [{ opcode: 'data_setvariableto', inputs: { VALUE: chatL3Text('happy') } }, 'data_variable'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: { SECS: 2 } }],
                // 拡張機能のカテゴリはパレットを絞っても全部出る（make-toolbox-xml）。ここは使うブロックの記録
                meshV2: ['meshV2_getSensorValue'],
            },
            partner: {
                name: chatL3Text('partner'),
                buttons: [
                    {
                        label: chatL3Text('happy'),
                        set: { variable: chatL3Text('partnerMood'), value: chatL3Text('happy') },
                    },
                    {
                        label: chatL3Text('sleepy'),
                        set: { variable: chatL3Text('partnerMood'), value: chatL3Text('sleepy') },
                    },
                ],
                replies: [],
                // 相手は読まないが、1・2 のキーで変えた自分の気分を、ひとりのときもパネルの「届いた」に出す
                watch: [chatL3Text('myMoodName')],
            },
            steps: withDiagramFirst('chat-l3-mesh-variable', [
                { target: HINT_TARGETS.PALETTE },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL3Code((w) => `when_key_pressed("1") do\n  ${w.myMood} = "${w.happy}"\nend\n`),
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL3Code((w) => `when_key_pressed("2") do\n  ${w.myMood} = "${w.sleepy}"\nend\n`),
                },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                {
                    target: HINT_TARGETS.SPRITE_LIST,
                    blocks: chatL3Code(
                        (w) => `when_clicked do\n  say(mesh.sensor_value("${w.partnerMood}"), 2)\nend\n`,
                    ),
                },
                { target: HINT_TARGETS.STAGE },
            ]),
            debug: debugTips('chat-l3-mesh-variable', 3),
            // 1 のキーで気分の変数を「うれしい」、2 のキーで「ねむい」にし（ステージの変数 = メッシュで共有される変数）、
            // 押したスクリプトで気分のセンサーの値を読んで、届いた気分を言った（センサーに値が届いていないと何も言わない
            // ので、相手が気分を変えてから押したことになる）。作っただけの変数（0）では通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: '1' },
                    blocks: [{ opcode: 'data_setvariableto', args: { VARIABLE: CHAT_MOOD_NAME, VALUE: CHAT_HAPPY } }],
                },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: '2' },
                    blocks: [
                        { opcode: 'data_setvariableto', args: { VARIABLE: CHAT_MOOD_NAME, VALUE: CHAT_SLEEPY } },
                    ],
                },
                { type: 'variable', name: CHAT_MOOD_VARIABLE, target: 'stage', value: CHAT_MOOD },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: [{ opcode: 'meshV2_getSensorValue', args: { NAME: CHAT_MOOD_NAME } }, 'looks_sayforsecs'],
                },
                // 言ったのは、ほかのノード（練習相手・ペアの相手）から届いた値（自分の気分のセンサーの値では通さない）
                { type: 'said', trigger: { hat: 'event_whenthisspriteclicked' }, text: CHAT_MOOD, remoteValue: true },
            ],
            quiz: challengeQuiz('chat-l3-mesh-variable', 1),
            code: chatL3Code(
                (w) =>
                    `when_key_pressed("1") do\n  ${w.myMood} = "${w.happy}"\nend\n\n` +
                    `when_key_pressed("2") do\n  ${w.myMood} = "${w.sleepy}"\nend\n`,
            ),
            spriteCodes: [
                {
                    sprite: 'Shimacat',
                    code: chatL3Code(
                        (w) => `when_clicked do\n  say(mesh.sensor_value("${w.partnerMood}"), 2)\nend\n`,
                    ),
                },
            ],
        },
    ],
});

// レッスン 4「チャットを作ろう」（#1644）: 1 回送る → くり返し送る → おたがいに → グループ → ダイレクトメッセージ、と
// 育てて、教科書の形のチャットを作る。どの段も前の段の答えを setup（code / spriteCodes）で入れて始め、足すのは 3〜6
// ブロック。4-1〜4-3 はシマラビの役（練習相手 = シマネコの役。ペアでシマネコの役の人は名前と受け持ちを入れかえる）、
// 4-4 からは「みんなで 1 つ」の変数・メッセージ「メッセージ」に切りかえる（シマネコはみんなの発言を言う役）。
// メッシュで相手に届く名前（メッセージ・共有する変数）は ja と ja-Hira で同じ（漢字を使わない形）。「なまえ」
// 「あてさき」も、すべてのスプライト用の変数なのでメッシュで共有されるから、同じ決まりにする。en は別の名前
const CHAT_L4_WORDS = {
    ja: {
        v: '$シマラビのメッセージ',
        message: 'シマラビのメッセージ',
        partnerMessage: 'シマネコのメッセージ',
        ask: CHAT_ASK.ja,
        hello: 'こんにちは',
        howAreYou: '元気？',
        gotIt: 'とどいたよ',
        group: 'メッセージ',
        gv: '$メッセージ',
        nv: '$なまえ',
        askName: '名前は？',
        colon: '：',
        tv: '$あてさき',
        to: 'あてさき',
        askTo: 'だれに送る？',
        asShimacat: 'シマネコとして送る',
        asMimi: 'ミミとして送る',
        shimacatHello: 'シマネコ：こんにちは',
        mimiHello: 'ミミ：よろしくね',
        dmYou: 'あなたに DM',
        dmMimi: 'ミミに DM',
        mimi: 'ミミ',
        secret: 'シマネコ：ないしょだよ',
        mimiOnly: 'シマネコ：ミミにだけ',
        nameVar: 'なまえ',
        partner: 'シマネコ',
    },
    'ja-Hira': {
        v: '$シマラビのメッセージ',
        message: 'シマラビのメッセージ',
        partnerMessage: 'シマネコのメッセージ',
        ask: CHAT_ASK['ja-Hira'],
        hello: 'こんにちは',
        howAreYou: 'げんき？',
        gotIt: 'とどいたよ',
        group: 'メッセージ',
        gv: '$メッセージ',
        nv: '$なまえ',
        askName: 'なまえは？',
        colon: '：',
        tv: '$あてさき',
        to: 'あてさき',
        askTo: 'だれに おくる？',
        asShimacat: 'シマネコとして おくる',
        asMimi: 'ミミとして おくる',
        shimacatHello: 'シマネコ：こんにちは',
        mimiHello: 'ミミ：よろしくね',
        dmYou: 'あなたに DM',
        dmMimi: 'ミミに DM',
        mimi: 'ミミ',
        secret: 'シマネコ：ないしょだよ',
        mimiOnly: 'シマネコ：ミミにだけ',
        nameVar: 'なまえ',
        partner: 'シマネコ',
    },
    en: {
        v: '$shimaraby_message',
        message: 'shimaraby_message',
        partnerMessage: 'shimacat_message',
        ask: CHAT_ASK.en,
        hello: 'Hello',
        howAreYou: 'How are you?',
        gotIt: 'Got it',
        group: 'message',
        gv: '$message',
        nv: '$name',
        askName: 'What is your name?',
        colon: ': ',
        tv: '$to',
        to: 'to',
        askTo: 'Send to whom?',
        asShimacat: 'Send as Shimacat',
        asMimi: 'Send as Mimi',
        shimacatHello: 'Shimacat: Hello',
        mimiHello: 'Mimi: Nice to meet you',
        dmYou: 'DM to you',
        dmMimi: 'DM to Mimi',
        mimi: 'Mimi',
        secret: 'Shimacat: It is a secret',
        mimiOnly: 'Shimacat: Only for Mimi',
        nameVar: 'name',
        partner: 'Shimacat',
    },
};
const chatL4Code = (make) =>
    Object.fromEntries(Object.entries(CHAT_L4_WORDS).map(([locale, words]) => [locale, make(words)]));
const chatL4Text = (key) =>
    Object.fromEntries(Object.entries(CHAT_L4_WORDS).map(([locale, words]) => [locale, words[key]]));

// 各段の答え（Ruby）。次の段の setup にもそのまま使う
const chatL4SendOnce = chatL4Code(
    (w) => `when_flag_clicked do\n  ask("${w.ask}")\n  ${w.v} = answer\n  broadcast("${w.message}")\nend\n`,
);
const chatL4SendRepeat = chatL4Code(
    (w) =>
        `when_flag_clicked do\n  ask("${w.ask}")\n  loop do\n    ${w.v} = answer\n    broadcast("${w.message}")\n` +
        `    ask(${w.v})\n  end\nend\n`,
);
const chatL4ReceiveSay = chatL4Code(
    (w) => `when_receive("${w.partnerMessage}") do\n  say(mesh.sensor_value("${w.partnerMessage}"))\nend\n`,
);
// 4-4 の始め: 4-3 を「みんなで 1 つ」の変数・メッセージに置きかえた形
const chatL4GroupStart = chatL4Code(
    (w) =>
        `when_flag_clicked do\n  ask("${w.ask}")\n  loop do\n    ${w.gv} = answer\n    broadcast("${w.group}")\n` +
        `    ask(${w.gv})\n  end\nend\n`,
);
const chatL4GroupReceive = chatL4Code(
    (w) => `when_receive("${w.group}") do\n  say(mesh.sensor_value("${w.group}"))\nend\n`,
);
const chatL4Group = chatL4Code(
    (w) =>
        `when_flag_clicked do\n  ask("${w.askName}")\n  ${w.nv} = answer\n  ask("${w.ask}")\n  loop do\n` +
        `    ${w.gv} = ${w.nv} + "${w.colon}" + answer\n    broadcast("${w.group}")\n    ask(${w.gv})\n  end\nend\n`,
);
const chatL4Dm = chatL4Code(
    (w) =>
        `when_flag_clicked do\n  ask("${w.askName}")\n  ${w.nv} = answer\n  ask("${w.ask}")\n  loop do\n` +
        `    ${w.gv} = ${w.nv} + "${w.colon}" + answer\n    ask("${w.askTo}")\n    ${w.tv} = answer\n` +
        `    broadcast("${w.group}")\n    ask(${w.gv})\n  end\nend\n`,
);
const chatL4DmReceive = chatL4Code(
    (w) =>
        `when_receive("${w.group}") do\n  if mesh.sensor_value("${w.to}") == ${w.nv}\n` +
        `    say(mesh.sensor_value("${w.group}"))\n  end\nend\n`,
);

const CHAT_L4_START = { sprites: ['Shimaraby', 'Shimacat'], extensions: ['meshV2'] };
// 自分のメッセージの変数・メッセージ（シマラビの役・シマネコの役のどちらの名前も、どの locale の名前も）
const CHAT_PAIR_MESSAGE = ['シマラビのメッセージ', 'シマネコのメッセージ', 'shimaraby_message', 'shimacat_message'];
const CHAT_PAIR_MESSAGE_NAME = messageMatcher(CHAT_PAIR_MESSAGE);
// 「みんなで 1 つ」の変数・メッセージ、名前・あて先の変数（ja は漢字で書いた名前も通す）
const CHAT_GROUP_MESSAGE = ['メッセージ', 'message'];
const CHAT_GROUP_MESSAGE_NAME = messageMatcher(CHAT_GROUP_MESSAGE);
const CHAT_NAME_VARIABLE = ['なまえ', '名前', 'name'];
const CHAT_NAME_VARIABLE_NAME = new RegExp(`^(${CHAT_NAME_VARIABLE.join('|')})$`);
const CHAT_TO_VARIABLE = ['あてさき', 'あて先', 'to'];
const CHAT_TO_VARIABLE_NAME = new RegExp(`^(${CHAT_TO_VARIABLE.join('|')})$`);
const CHAT_SAY_OPCODES = ['looks_say', 'looks_sayforsecs'];
// 「メッセージを入力」「〜にする」「送る」（自分のメッセージの名前で）
const chatL4SendBlocks = (count) => [
    { opcode: 'sensing_askandwait', count },
    { opcode: 'data_setvariableto', args: { VARIABLE: CHAT_PAIR_MESSAGE_NAME }, count },
    { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: CHAT_PAIR_MESSAGE_NAME }, count },
];
// 自分のメッセージの変数が、すべてのスプライト用（メッシュで共有される）で、入力した答えが入っている
const CHAT_L4_SENT_ANSWER = { type: 'variable', name: CHAT_PAIR_MESSAGE, target: 'stage', fromAnswer: true };
// 4-1〜4-3 の練習相手: ボタンでシマネコのメッセージを変えて送り、シマラビのメッセージを受け取ったら「とどいたよ」を返す
const chatL4PairPartner = () => ({
    name: chatL4Text('partner'),
    buttons: ['hello', 'howAreYou'].map((key) => ({
        label: chatL4Text(key),
        set: { variable: chatL4Text('partnerMessage'), value: chatL4Text(key) },
        broadcast: chatL4Text('partnerMessage'),
    })),
    replies: [
        {
            onBroadcast: chatL4Text('message'),
            set: { variable: chatL4Text('partnerMessage'), value: chatL4Text('gotIt') },
            broadcast: chatL4Text('partnerMessage'),
        },
    ],
});
const chatL4AskBlock = (key) => ({ opcode: 'sensing_askandwait', inputs: { QUESTION: chatL4Text(key) } });

const chatLesson4 = defineLesson({
    id: 'chat-l4',
    challenges: [
        // 1 1 回送ろう: 旗でシマラビが聞いた答えを変数「シマラビのメッセージ」に入れ、メッセージ「シマラビのメッセージ」を
        // メッシュで送る（3-1 と同じ形で、相手が別のコンピューターになった）
        {
            id: 'chat-l4-send-once',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.EVENTS },
            task: challengeMessage('chat-l4-send-once', 'task'),
            setup: CHAT_L4_START,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_broadcast'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                data: ['data_setvariableto', 'data_variable'],
            },
            partner: chatL4PairPartner(),
            steps: withDiagramFirst('chat-l4-send-once', [
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL4Code((w) => `when_flag_clicked do\n  ask("${w.ask}")\n  ${w.v} = answer\nend\n`),
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL4Code((w) => `${w.v} = answer\nbroadcast("${w.message}")\n`),
                },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l4-send-once', 2),
            // 旗のスクリプトで 聞く → 変数に入れる → 送る の順に動き（変数とメッセージは自分のメッセージの名前）、
            // その変数がすべてのスプライト用（メッシュで共有される）で、入力した答えが入っている。作っただけの変数（0）・
            // 決まった文字を入れた変数・このスプライトのみの変数では通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: chatL4SendBlocks(1),
                    order: ['sensing_askandwait', 'data_setvariableto', 'event_broadcast'],
                },
                CHAT_L4_SENT_ANSWER,
            ],
            quiz: challengeQuiz('chat-l4-send-once', 1),
            code: chatL4SendOnce,
        },
        // 2 くり返し送ろう: 「〜にする」と「送る」をずっとの中に入れ、その下に「(シマラビのメッセージ) と聞いて待つ」を
        // 足す（レッスン 1-2 の形。教科書の送る側と同じ）
        {
            id: 'chat-l4-send-repeat',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.CONTROL },
            task: challengeMessage('chat-l4-send-repeat', 'task'),
            setup: { ...CHAT_L4_START, code: chatL4SendOnce },
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_broadcast'],
                control: ['control_forever'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                data: ['data_setvariableto', 'data_variable'],
            },
            partner: chatL4PairPartner(),
            steps: withDiagramFirst('chat-l4-send-repeat', [
                {
                    target: HINT_TARGETS.CODE_AREA,
                    blocks: chatL4Code((w) => `loop do\n  ${w.v} = answer\n  broadcast("${w.message}")\nend\n`),
                },
                { target: HINT_TARGETS.PALETTE, blocks: chatL4SendRepeat },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l4-send-repeat', 2),
            // 旗のスクリプトで「ずっと」が動き、聞いて待つ・自分のメッセージの変数に入れる・送る が 2 回以上ずつ動いた
            // （2 回以上入力して送った）＋ 変数に入力した答えが入っている。くり返さずに 2 つ並べるプログラム、ずっとの中で
            // 聞かずに送り続けるプログラムは通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: ['control_forever', ...chatL4SendBlocks(2)],
                },
                CHAT_L4_SENT_ANSWER,
            ],
            quiz: challengeQuiz('chat-l4-send-repeat', 1),
            code: chatL4SendRepeat,
        },
        // 3 おたがいに送ろう: シマネコが、メッセージ「シマネコのメッセージ」を受け取ったら「シマネコのメッセージ」の
        // センサーの値を言う（3-1 の「(変数) を言う」が「(センサーの値) を言う」になる）
        {
            id: 'chat-l4-both-ways',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.EVENTS },
            task: challengeMessage('chat-l4-both-ways', 'task'),
            setup: { ...CHAT_L4_START, code: chatL4SendRepeat },
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
                control: ['control_forever'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                data: ['data_setvariableto', 'data_variable'],
                looks: ['looks_say'],
                // 拡張機能のカテゴリはパレットを絞っても全部出る（make-toolbox-xml）。ここは使うブロックの記録
                meshV2: ['meshV2_getSensorValue'],
            },
            partner: chatL4PairPartner(),
            steps: withDiagramFirst('chat-l4-both-ways', [
                { target: HINT_TARGETS.SPRITE_LIST },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL4Code((w) => `when_receive("${w.partnerMessage}") do\nend\n`),
                },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                { target: HINT_TARGETS.PALETTE, blocks: chatL4ReceiveSay },
                // 送る側（シマラビ）のプログラムは 4-2 の答えのまま。旗を押すとこれで自分から送れる
                { target: HINT_TARGETS.GREEN_FLAG, blocks: chatL4SendRepeat },
            ]),
            debug: debugTips('chat-l4-both-ways', 2),
            // 旗のスクリプトで自分のメッセージを送った（4-2 の答えのまま）＋ 相手のメッセージを受け取ったスクリプトで、
            // 相手のメッセージの名前の `meshV2_getSensorValue` と「言う」が動いた ＋ そのスクリプトで言った文字が、
            // ほかのノード（練習相手・ペアの相手）から届いた値だった（remoteValue）。自分のメッセージのセンサーの値・
            // 自分の変数を言うプログラムは、相手と同じ文字でない限り通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: [{ opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: CHAT_PAIR_MESSAGE_NAME } }],
                },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenbroadcastreceived', message: CHAT_PAIR_MESSAGE },
                    blocks: [
                        { opcode: 'meshV2_getSensorValue', args: { NAME: CHAT_PAIR_MESSAGE_NAME } },
                        { opcode: CHAT_SAY_OPCODES },
                    ],
                },
                {
                    type: 'said',
                    trigger: { hat: 'event_whenbroadcastreceived', message: CHAT_PAIR_MESSAGE },
                    text: /\S/,
                    remoteValue: true,
                },
            ],
            quiz: challengeQuiz('chat-l4-both-ways', 1),
            code: chatL4SendRepeat,
            spriteCodes: [{ sprite: 'Shimacat', code: chatL4ReceiveSay }],
        },
        // 4 グループチャットにしよう: みんなで 1 つの変数・メッセージ「メッセージ」を使う形（最初から入っている）に、
        // はじめに名前を聞いて変数「なまえ」に入れ、「なまえ：メッセージ」の形で送るようにする
        {
            id: 'chat-l4-group',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.OPERATORS },
            task: challengeMessage('chat-l4-group', 'task'),
            setup: {
                ...CHAT_L4_START,
                code: chatL4GroupStart,
                spriteCodes: [{ sprite: 'Shimacat', code: chatL4GroupReceive }],
            },
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
                control: ['control_forever'],
                sensing: [chatL4AskBlock('askName'), 'sensing_answer'],
                data: ['data_setvariableto', 'data_variable'],
                operators: [{ opcode: 'operator_join', inputs: { STRING2: chatL4Text('colon') } }],
                looks: ['looks_say'],
                meshV2: ['meshV2_getSensorValue'],
            },
            partner: {
                name: chatL4Text('partner'),
                buttons: [
                    ['asShimacat', 'shimacatHello'],
                    ['asMimi', 'mimiHello'],
                ].map(([label, value]) => ({
                    label: chatL4Text(label),
                    set: { variable: chatL4Text('group'), value: chatL4Text(value) },
                    broadcast: chatL4Text('group'),
                })),
                replies: [],
            },
            steps: withDiagramFirst('chat-l4-group', [
                // 最初から入っているシマネコのプログラム（みんなの発言を言う）
                { target: HINT_TARGETS.CODE_AREA, blocks: chatL4GroupReceive },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL4Code(
                        (w) =>
                            `when_flag_clicked do\n  ask("${w.askName}")\n  ${w.nv} = answer\n  ask("${w.ask}")\nend\n`,
                    ),
                },
                // つなぐ 2 つの入れ方は、できあがりの形で見せる（「なまえ」が文字の変数だと分かる形でないと「+」が
                // つなぐにならないので、つなぐだけは描けない）
                { target: HINT_TARGETS.CODE_AREA, blocks: chatL4Group },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l4-group', 2),
            // 旗のスクリプトで、変数「なまえ」に入れ、つなぐが 2 回動き、メッセージ「メッセージ」を送った ＋ 「なまえ」に
            // 入力した答えが入っている ＋ 変数「メッセージ」（すべてのスプライト用）が「：」を含み、「なまえ」の値を含む。
            // 名前を聞かずに決まった名前をつなぐ・「：」を入れないプログラムは通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: [
                        { opcode: 'data_setvariableto', args: { VARIABLE: CHAT_NAME_VARIABLE_NAME } },
                        { opcode: 'operator_join', count: 2 },
                        { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: CHAT_GROUP_MESSAGE_NAME } },
                    ],
                },
                { type: 'variable', name: CHAT_NAME_VARIABLE, fromAnswer: true },
                {
                    type: 'variable',
                    name: CHAT_GROUP_MESSAGE,
                    target: 'stage',
                    value: /[：:]/,
                    includesVariable: CHAT_NAME_VARIABLE,
                },
            ],
            quiz: challengeQuiz('chat-l4-group', 1),
            code: chatL4Group,
            spriteCodes: [{ sprite: 'Shimacat', code: chatL4GroupReceive }],
        },
        // 5 ダイレクトメッセージを送ろう: メッセージを入れたあと「だれに送る？」と聞いて変数「あてさき」に入れてから送る。
        // シマネコは、あてさき（センサーの値）が自分の名前と同じときだけ言う
        {
            id: 'chat-l4-dm',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.CONTROL },
            task: challengeMessage('chat-l4-dm', 'task'),
            setup: {
                ...CHAT_L4_START,
                code: chatL4Group,
                spriteCodes: [{ sprite: 'Shimacat', code: chatL4GroupReceive }],
            },
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_broadcast', 'event_whenbroadcastreceived'],
                control: ['control_forever', 'control_if'],
                sensing: [chatL4AskBlock('askTo'), 'sensing_answer'],
                data: ['data_setvariableto', 'data_variable'],
                operators: ['operator_join', 'operator_equals'],
                looks: ['looks_say'],
                meshV2: ['meshV2_getSensorValue'],
            },
            partner: {
                name: chatL4Text('partner'),
                buttons: [
                    {
                        label: chatL4Text('dmYou'),
                        set: [
                            { variable: chatL4Text('to'), value: { fromVariable: chatL4Text('nameVar') } },
                            { variable: chatL4Text('group'), value: chatL4Text('secret') },
                        ],
                        broadcast: chatL4Text('group'),
                    },
                    {
                        label: chatL4Text('dmMimi'),
                        set: [
                            { variable: chatL4Text('to'), value: chatL4Text('mimi') },
                            { variable: chatL4Text('group'), value: chatL4Text('mimiOnly') },
                        ],
                        broadcast: chatL4Text('group'),
                    },
                ],
                replies: [],
            },
            steps: withDiagramFirst('chat-l4-dm', [
                { target: HINT_TARGETS.CODE_AREA, blocks: chatL4Dm },
                { target: HINT_TARGETS.SPRITE_LIST, blocks: chatL4DmReceive },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l4-dm', 2),
            // 旗のスクリプトで変数「あてさき」に入れて「メッセージ」を送った ＋ 「あてさき」がすべてのスプライト用で、
            // 入力した答えが入っている ＋ 「メッセージ」を受け取ったスクリプトで、もし・=・「あてさき」のセンサーの値・
            // 変数「なまえ」・言う が動いた ＋ そのスクリプトで、ほかのノードから届いたメッセージを言った（自分あての DM が
            // 届いて表示した）。あてさきを見ずに全部言うプログラム（もし が無い）、自分の「あてさき」の変数と比べる
            // プログラム、ほかの人あての DM だけでは通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: [
                        { opcode: 'data_setvariableto', args: { VARIABLE: CHAT_TO_VARIABLE_NAME } },
                        { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: CHAT_GROUP_MESSAGE_NAME } },
                    ],
                },
                { type: 'variable', name: CHAT_TO_VARIABLE, target: 'stage', fromAnswer: true },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenbroadcastreceived', message: CHAT_GROUP_MESSAGE },
                    blocks: [
                        'control_if',
                        'operator_equals',
                        { opcode: 'meshV2_getSensorValue', args: { NAME: CHAT_TO_VARIABLE_NAME } },
                        { opcode: 'data_variable', args: { VARIABLE: CHAT_NAME_VARIABLE_NAME } },
                        { opcode: CHAT_SAY_OPCODES },
                    ],
                },
                {
                    type: 'said',
                    trigger: { hat: 'event_whenbroadcastreceived', message: CHAT_GROUP_MESSAGE },
                    text: /[：:]/,
                    remoteValue: true,
                },
            ],
            quiz: challengeQuiz('chat-l4-dm', 0),
            code: chatL4Dm,
            spriteCodes: [{ sprite: 'Shimacat', code: chatL4DmReceive }],
        },
    ],
});

// レッスン 5「チャットを改良しよう」（#1645）: 改良のテーマを 1 つずつチャレンジにする（通知と既読・NG ワード・時間で
// 自動返信・合言葉・スタンプ）。どのテーマも 4-3 の答え（シマラビの役の 2 人のチャット）を setup で入れて始め、
// 最低限の機能を足すところまでを「できた」にする（その先の工夫は判定せず、提出した作品で先生が見る）。レッスンの ✓ は
// テーマを 1 つ「できた」にすればつく（checkCount: 1・#1616 の Q17）。メッシュで相手に届く名前は、レッスン 4 と
// 同じく ja と ja-Hira で同じ（漢字を使わない形）。en は別の名前
const CHAT_L5_WORDS = {
    ja: {
        ...CHAT_L4_WORDS.ja,
        talk: '発言する',
        question: '明日の持ち物は？',
        myRead: 'シマラビがよんだ',
        partnerRead: 'シマネコがよんだ',
        markRead: '既読にする',
        read: '既読',
        meow: 'Meow',
        ng: '$NGワード',
        ngWords: ['ばか', 'きらい'],
        cannotSend: 'その言葉は送れません',
        autoReply: 'もう寝ています。朝に返事します',
        askPassword: '合言葉は？',
        password: 'もみじ',
        wrongPassword: '合言葉がちがいます',
        myStamp: 'シマラビのスタンプ',
        partnerStamp: 'シマネコのスタンプ',
        sendStamp: 'スタンプを送る',
    },
    'ja-Hira': {
        ...CHAT_L4_WORDS['ja-Hira'],
        talk: 'はつげんする',
        question: 'あしたの もちものは？',
        myRead: 'シマラビがよんだ',
        partnerRead: 'シマネコがよんだ',
        markRead: 'きどくにする',
        read: 'きどく',
        meow: 'Meow',
        ng: '$NGワード',
        ngWords: ['ばか', 'きらい'],
        cannotSend: 'その ことばは おくれません',
        autoReply: 'もう ねています。あさに へんじします',
        askPassword: 'あいことばは？',
        password: 'もみじ',
        wrongPassword: 'あいことばが ちがいます',
        myStamp: 'シマラビのスタンプ',
        partnerStamp: 'シマネコのスタンプ',
        sendStamp: 'スタンプを おくる',
    },
    en: {
        ...CHAT_L4_WORDS.en,
        talk: 'Say something',
        question: 'What should I bring tomorrow?',
        myRead: 'shimaraby_read',
        partnerRead: 'shimacat_read',
        markRead: 'Mark as read',
        read: 'Read',
        meow: 'Meow',
        ng: '$ng_words',
        ngWords: ['stupid', 'idiot'],
        cannotSend: "You can't send that word",
        autoReply: 'I am sleeping now. I will reply in the morning',
        askPassword: 'Password?',
        password: 'maple',
        wrongPassword: 'Wrong password',
        myStamp: 'shimaraby_stamp',
        partnerStamp: 'shimacat_stamp',
        sendStamp: 'Send a stamp',
    },
};
const chatL5Code = (make) =>
    Object.fromEntries(Object.entries(CHAT_L5_WORDS).map(([locale, words]) => [locale, make(words)]));
const chatL5Text = (key) =>
    Object.fromEntries(Object.entries(CHAT_L5_WORDS).map(([locale, words]) => [locale, words[key]]));
const chatL5AskBlock = (key) => ({ opcode: 'sensing_askandwait', inputs: { QUESTION: chatL5Text(key) } });
// どの locale の値でも（判定の名前・文字は、locale をまたいだ作品のためにどれでも通す）
const chatL5Values = (key) => [...new Set(Object.values(CHAT_L5_WORDS).flatMap((words) => [].concat(words[key])))];
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anyOf = (values) => values.map(escapeRegExp).join('|');

// 土台（4-3 の答え）: シマラビが聞いて送り、シマネコが相手のメッセージを言う
const CHAT_L5_BASE = {
    ...CHAT_L4_START,
    code: chatL4SendRepeat,
    spriteCodes: [{ sprite: 'Shimacat', code: chatL4ReceiveSay }],
};
// 練習相手は 4-1〜4-3 と同じ（テーマで書きかえるものだけ変える）
const chatL5Partner = (change = {}) => ({ ...chatL4PairPartner(), ...change });
// 相手（シマネコの役）のメッセージを受け取ったスクリプト。この作品のスクリプトが送った合図では動いたことにしない
// （`sentBy: 'remote'`。受け取る ▼ を自分のメッセージにしたプログラム・自分で相手の名前を送るプログラムを通さない）
const fromPartner = (names) => ({ hat: 'event_whenbroadcastreceived', message: names, sentBy: 'remote' });
const CHAT_READ_MESSAGE = chatL5Values('myRead').concat(chatL5Values('partnerRead'));
const CHAT_STAMP_MESSAGE = chatL5Values('myStamp').concat(chatL5Values('partnerStamp'));
// 5-2・5-4 で、送ったメッセージが NG ワード・合言葉ではない（入力したふつうの言葉が届いた）
const notOneOf = (values) => new RegExp(`^(?!(${anyOf(values)})$)`, 'i');
const oneOf = (values) => new RegExp(`^(${anyOf(values)})$`, 'i');

// いちばん新しい旗のスクリプトの実行で、自分のメッセージの変数をこの値にしていない（`uses` の `not`。
// 直して旗を押し直せば通る）
const neverSets = (value) => ({
    type: 'uses',
    not: true,
    trigger: { hat: 'event_whenflagclicked' },
    blocks: [{ opcode: 'data_setvariableto', args: { VARIABLE: CHAT_PAIR_MESSAGE_NAME, VALUE: value } }],
});

// 5-1 の答え（足す分）
const chatL5ReadReceive = chatL5Code(
    (w) =>
        `when_receive("${w.partnerMessage}") do\n  say(mesh.sensor_value("${w.partnerMessage}"))\n` +
        `  play("${w.meow}")\nend\n\nwhen_clicked do\n  broadcast("${w.myRead}")\nend\n`,
);
const chatL5ReadSay = chatL5Code((w) => `when_receive("${w.partnerRead}") do\n  say("${w.read}", 2)\nend\n`);
// 5-2 の答え（シマラビの「ずっと」の中を、もし〜なら でなければ にする）
const chatL5NgLoop = chatL5Code(
    (w) =>
        `loop do\n  if ${w.ng}.include?(answer)\n    say("${w.cannotSend}", 2)\n  else\n    ${w.v} = answer\n` +
        `    broadcast("${w.message}")\n  end\n  ask(${w.v})\nend\n`,
);
const chatL5Ng = chatL5Code(
    (w) =>
        `when_flag_clicked do\n  ask("${w.ask}")\n  loop do\n    if ${w.ng}.include?(answer)\n` +
        `      say("${w.cannotSend}", 2)\n    else\n      ${w.v} = answer\n      broadcast("${w.message}")\n` +
        `    end\n    ask(${w.v})\n  end\nend\n`,
);
// 5-2 の準備: ステージの旗で、リスト「NGワード」を空にして 2 つの言葉を入れる
const chatL5NgStage = chatL5Code(
    (w) =>
        `when_flag_clicked do\n  ${w.ng}.clear\n${w.ngWords.map((word) => `  ${w.ng}.push("${word}")\n`).join('')}end\n`,
);
// 5-3 の答え（シマラビに足す）
const chatL5AutoReply = chatL5Code(
    (w) =>
        `when_receive("${w.partnerMessage}") do\n  if Time.now.hour > 21\n    ${w.v} = "${w.autoReply}"\n` +
        `    broadcast("${w.message}")\n  end\nend\n`,
);
// 5-4 の答え（シマラビ）
const chatL5Password = chatL5Code(
    (w) =>
        `when_flag_clicked do\n  ask("${w.askPassword}")\n  if answer == "${w.password}"\n    ask("${w.ask}")\n` +
        `    loop do\n      ${w.v} = answer\n      broadcast("${w.message}")\n      ask(${w.v})\n    end\n` +
        `  else\n    say("${w.wrongPassword}", 2)\n  end\nend\n`,
);
// 5-5 の答え（足す分）
const chatL5StampSend = chatL5Code((w) => `when_clicked do\n  broadcast("${w.myStamp}")\nend\n`);
const chatL5StampReceive = chatL5Code(
    (w) =>
        `when_receive("${w.partnerStamp}") do\n  switch_costume("shimacat-b")\n  sleep(2)\n` +
        `  switch_costume("shimacat-a")\nend\n`,
);
// 土台のプログラムに足したもの（locale ごとに 2 つの Ruby をつなぐ）
const joinCode = (...codes) =>
    Object.fromEntries(Object.keys(CHAT_L5_WORDS).map((locale) => [locale, codes.map((c) => c[locale]).join('\n')]));

const chatLesson5 = defineLesson({
    id: 'chat-l5',
    // テーマは生徒が選ぶので、1 つ「できた」でレッスンの ✓（#1616 の Q17）
    checkCount: 1,
    challenges: [
        // 1 通知と既読: 相手のメッセージが届いたらシマネコが音を鳴らし、シマネコを押すと「シマラビがよんだ」を送る。
        // シマラビは「シマネコがよんだ」を受け取ったら「既読」と言う
        {
            id: 'chat-l5-read-receipt',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.SOUND },
            task: challengeMessage('chat-l5-read-receipt', 'task'),
            setup: CHAT_L5_BASE,
            activityDiagram: true,
            allowedBlocks: {
                event: [
                    'event_whenflagclicked',
                    'event_whenbroadcastreceived',
                    'event_whenthisspriteclicked',
                    'event_broadcast',
                ],
                sound: ['sound_play'],
                // 変数のカテゴリはこの絞りで出す（最初から入っている 4-3 のプログラムが使う）
                data: ['data_setvariableto', 'data_variable'],
                looks: [
                    'looks_say',
                    { opcode: 'looks_sayforsecs', inputs: { MESSAGE: chatL5Text('read'), SECS: 2 } },
                ],
                meshV2: ['meshV2_getSensorValue'],
            },
            partner: chatL5Partner({
                buttons: [
                    {
                        label: chatL5Text('talk'),
                        set: { variable: chatL5Text('partnerMessage'), value: chatL5Text('question') },
                        broadcast: chatL5Text('partnerMessage'),
                    },
                    { label: chatL5Text('markRead'), broadcast: chatL5Text('partnerRead') },
                ],
            }),
            steps: withDiagramFirst('chat-l5-read-receipt', [
                {
                    target: HINT_TARGETS.SPRITE_LIST,
                    blocks: chatL5Code(
                        (w) =>
                            `when_receive("${w.partnerMessage}") do\n  say(mesh.sensor_value("${w.partnerMessage}"))\n` +
                            `  play("${w.meow}")\nend\n`,
                    ),
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL5Code((w) => `when_clicked do\n  broadcast("${w.myRead}")\nend\n`),
                },
                { target: HINT_TARGETS.SPRITE_LIST, blocks: chatL5ReadSay },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                // 送る側（シマラビ）のプログラムは 4-3 の答えのまま
                { target: HINT_TARGETS.GREEN_FLAG, blocks: chatL4SendRepeat },
            ]),
            debug: debugTips('chat-l5-read-receipt', 2),
            // 相手のメッセージを受け取ったスクリプトで音を鳴らした ＋ 押したスクリプトで既読の合図を送った ＋ 相手から届いた
            // 既読の合図を受け取ったスクリプトで「既読」と言った。押して送る名前と受け取る名前を同じにする（自分の画面だけで
            // 既読になる）プログラムは、自分で送った合図なので通らない
            goal: [
                {
                    type: 'uses',
                    trigger: fromPartner(CHAT_PAIR_MESSAGE),
                    blocks: [{ opcode: ['sound_play', 'sound_playuntildone'] }],
                },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: [
                        { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: messageMatcher(CHAT_READ_MESSAGE) } },
                    ],
                },
                {
                    type: 'said',
                    trigger: fromPartner(CHAT_READ_MESSAGE),
                    text: new RegExp(anyOf(chatL5Values('read')), 'i'),
                },
            ],
            quiz: challengeQuiz('chat-l5-read-receipt', 0),
            code: joinCode(chatL4SendRepeat, chatL5ReadSay),
            spriteCodes: [{ sprite: 'Shimacat', code: chatL5ReadReceive }],
        },
        // 2 わるい言葉を送らせない（NG ワード）: 入力した言葉がリスト「NGワード」（ステージのプログラムで用意する）に
        // 入っていたら、送らずに注意する
        {
            id: 'chat-l5-ng-word',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.LISTS },
            task: challengeMessage('chat-l5-ng-word', 'task'),
            setup: { ...CHAT_L5_BASE, stageCode: chatL5NgStage },
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_broadcast'],
                control: ['control_forever', 'control_if_else'],
                sensing: [{ opcode: 'sensing_askandwait', inputs: { QUESTION: CHAT_ASK } }, 'sensing_answer'],
                // ステージのリストの準備（空にする・足す）も、変数のカテゴリに出す
                data: [
                    'data_setvariableto',
                    'data_variable',
                    'data_deletealloflist',
                    'data_addtolist',
                    'data_listcontainsitem',
                ],
                looks: [{ opcode: 'looks_sayforsecs', inputs: { MESSAGE: chatL5Text('cannotSend'), SECS: 2 } }],
            },
            partner: chatL5Partner(),
            steps: withDiagramFirst('chat-l5-ng-word', [
                // 最初から入っている 4-3 の答え（シマネコが相手のメッセージを言う）
                { target: HINT_TARGETS.SPRITE_LIST, blocks: chatL4ReceiveSay },
                { target: HINT_TARGETS.SPRITE_LIST, blocks: chatL5NgStage },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL5Code(
                        (w) => `if ${w.ng}.include?(answer)\n  say("${w.cannotSend}", 2)\nelse\nend\n`,
                    ),
                },
                { target: HINT_TARGETS.CODE_AREA, blocks: chatL5NgLoop },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l5-ng-word', 2),
            // 旗のスクリプトで「(NGワード) に (答え) が含まれる」「もし〜なら でなければ」「送る」が動いた ＋ NG ワードを入力
            // したときに旗のスクリプトで注意を言った ＋ 自分のメッセージの変数（ステージの変数）に、入力したふつうの言葉が
            // 入っている。「もし」の外で送る（注意してから送ってしまう）プログラムは「でなければ」が無いので通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: [
                        'data_listcontainsitem',
                        'control_if_else',
                        { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: CHAT_PAIR_MESSAGE_NAME } },
                    ],
                },
                {
                    type: 'said',
                    trigger: { hat: 'event_whenflagclicked' },
                    text: /送れません|おくれません|can't send|cannot send/i,
                    answer: oneOf(chatL5Values('ngWords')),
                },
                { ...CHAT_L4_SENT_ANSWER, value: notOneOf(chatL5Values('ngWords')) },
                // いちばん新しい旗の実行で、NG ワードを自分のメッセージの変数に入れていない（注意したあとに
                // 送ってしまうプログラムを通さない）
                neverSets(oneOf(chatL5Values('ngWords'))),
            ],
            quiz: challengeQuiz('chat-l5-ng-word', 0),
            code: chatL5Ng,
            spriteCodes: [{ sprite: 'Shimacat', code: chatL4ReceiveSay }],
        },
        // 3 時間で自動返信する: 夜（現在の時が 21 より大きい）に相手のメッセージが届いたら、決まった文を自動で送り返す。
        // 昼に試すときは 21 を小さい数にして確かめる
        {
            id: 'chat-l5-auto-reply',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.SENSING },
            task: challengeMessage('chat-l5-auto-reply', 'task'),
            setup: CHAT_L5_BASE,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
                control: ['control_if'],
                sensing: [{ opcode: 'sensing_current', fields: { CURRENTMENU: 'HOUR' } }],
                operators: [{ opcode: 'operator_gt', inputs: { OPERAND2: 21 } }],
                data: [{ opcode: 'data_setvariableto', inputs: { VALUE: chatL5Text('autoReply') } }, 'data_variable'],
            },
            // 自動の返事（「とどいたよ」）は持たない。自動返信どうしが行き来し続けないように
            partner: chatL5Partner({ replies: [] }),
            steps: withDiagramFirst('chat-l5-auto-reply', [
                // 最初から入っている 4-3 の答え（シマネコが相手のメッセージを言う）
                { target: HINT_TARGETS.SPRITE_LIST, blocks: chatL4ReceiveSay },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL5Code((w) => `when_receive("${w.partnerMessage}") do\nend\n`),
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL5Code(
                        (w) => `when_receive("${w.partnerMessage}") do\n  if Time.now.hour > 21\n  end\nend\n`,
                    ),
                },
                { target: HINT_TARGETS.CODE_AREA, blocks: chatL5AutoReply },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                { target: HINT_TARGETS.GREEN_FLAG, blocks: chatL4SendRepeat },
            ]),
            debug: debugTips('chat-l5-auto-reply', 2),
            // 相手から届いたメッセージを受け取ったスクリプトで、もし・「現在の時」・比べる が動き、もしの中で自分のメッセージの
            // 変数に入れて送った（自動返信が送られた。昼は 21 を小さい数にして確かめる）。自分の送ったメッセージを受け取る
            // プログラムは、自分で送った合図なので通らない
            goal: [
                {
                    type: 'uses',
                    trigger: fromPartner(CHAT_PAIR_MESSAGE),
                    blocks: [
                        { opcode: ['control_if', 'control_if_else'] },
                        { opcode: 'sensing_current', args: { CURRENTMENU: 'HOUR' } },
                        { opcode: ['operator_gt', 'operator_lt'] },
                        { opcode: 'data_setvariableto', args: { VARIABLE: CHAT_PAIR_MESSAGE_NAME } },
                        { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: CHAT_PAIR_MESSAGE_NAME } },
                    ],
                },
            ],
            quiz: challengeQuiz('chat-l5-auto-reply', 0),
            code: joinCode(chatL4SendRepeat, chatL5AutoReply),
            spriteCodes: [{ sprite: 'Shimacat', code: chatL4ReceiveSay }],
        },
        // 4 合言葉で入る（パスワード）: はじめに合言葉を聞き、合っていればチャットを始め、ちがえば注意する
        {
            id: 'chat-l5-password',
            card: { category: CATEGORIES.SENSING, main: CATEGORIES.OPERATORS },
            task: challengeMessage('chat-l5-password', 'task'),
            setup: CHAT_L5_BASE,
            activityDiagram: true,
            allowedBlocks: {
                event: ['event_whenflagclicked', 'event_broadcast'],
                control: ['control_forever', 'control_if_else'],
                sensing: [chatL5AskBlock('askPassword'), 'sensing_answer'],
                operators: [{ opcode: 'operator_equals', inputs: { OPERAND2: chatL5Text('password') } }],
                data: ['data_setvariableto', 'data_variable'],
                looks: [{ opcode: 'looks_sayforsecs', inputs: { MESSAGE: chatL5Text('wrongPassword'), SECS: 2 } }],
            },
            partner: chatL5Partner(),
            steps: withDiagramFirst('chat-l5-password', [
                // 最初から入っている 4-3 の答え（シマネコが相手のメッセージを言う）
                { target: HINT_TARGETS.SPRITE_LIST, blocks: chatL4ReceiveSay },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL5Code((w) => `when_flag_clicked do\n  ask("${w.askPassword}")\nend\n`),
                },
                {
                    target: HINT_TARGETS.PALETTE,
                    blocks: chatL5Code(
                        (w) => `if answer == "${w.password}"\nelse\n  say("${w.wrongPassword}", 2)\nend\n`,
                    ),
                },
                { target: HINT_TARGETS.CODE_AREA, blocks: chatL5Password },
                { target: HINT_TARGETS.GREEN_FLAG },
            ]),
            debug: debugTips('chat-l5-password', 2),
            // 旗のスクリプトで =・もし〜なら でなければ・送る が動いた ＋ 合言葉でない答えのときに旗のスクリプトで「ちがいます」
            // と言った ＋ 自分のメッセージの変数（ステージの変数）に、合言葉のあとに入力したメッセージ（合言葉ではない）が入って
            // いる。合言葉を確かめないプログラム、合言葉をそのまま送ってしまうプログラムは通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: [
                        'operator_equals',
                        'control_if_else',
                        { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: CHAT_PAIR_MESSAGE_NAME } },
                    ],
                },
                {
                    type: 'said',
                    trigger: { hat: 'event_whenflagclicked' },
                    text: /ちがいます|wrong/i,
                    answer: notOneOf(chatL5Values('password')),
                },
                { ...CHAT_L4_SENT_ANSWER, value: notOneOf(chatL5Values('password')) },
                // いちばん新しい旗の実行で、合言葉を自分のメッセージの変数に入れていない（合言葉をそのまま
                // 送ってしまうプログラムを通さない）
                neverSets(oneOf(chatL5Values('password'))),
            ],
            quiz: challengeQuiz('chat-l5-password', 0),
            code: chatL5Password,
            spriteCodes: [{ sprite: 'Shimacat', code: chatL4ReceiveSay }],
        },
        // 5 スタンプを送る（静止画）: シマラビを押すとメッセージ「シマラビのスタンプ」を送り、「シマネコのスタンプ」を
        // 受け取ったらシマネコのコスチュームを 2 秒かえる。変数は使わず、メッセージだけで送れる
        {
            id: 'chat-l5-stamp',
            card: { category: CATEGORIES.EVENTS, main: CATEGORIES.LOOKS },
            task: challengeMessage('chat-l5-stamp', 'task'),
            setup: CHAT_L5_BASE,
            activityDiagram: true,
            allowedBlocks: {
                event: [
                    'event_whenflagclicked',
                    'event_whenthisspriteclicked',
                    'event_broadcast',
                    'event_whenbroadcastreceived',
                ],
                control: [{ opcode: 'control_wait', inputs: { DURATION: 2 } }],
                looks: ['looks_switchcostumeto'],
                data: ['data_setvariableto', 'data_variable'],
            },
            partner: chatL5Partner({
                buttons: [{ label: chatL5Text('sendStamp'), broadcast: chatL5Text('partnerStamp') }],
                replies: [{ onBroadcast: chatL5Text('myStamp'), broadcast: chatL5Text('partnerStamp') }],
            }),
            steps: withDiagramFirst('chat-l5-stamp', [
                // 最初から入っている 4-3 の答え（シマネコが相手のメッセージを言う）
                { target: HINT_TARGETS.SPRITE_LIST, blocks: chatL4ReceiveSay },
                { target: HINT_TARGETS.PALETTE, blocks: chatL5StampSend },
                { target: HINT_TARGETS.SPRITE_LIST, blocks: chatL5StampReceive },
                { target: HINT_TARGETS.PRACTICE_PARTNER },
                { target: HINT_TARGETS.GREEN_FLAG, blocks: chatL4SendRepeat },
            ]),
            debug: debugTips('chat-l5-stamp', 2),
            // 押したスクリプトでスタンプのメッセージを送った ＋ 相手から届いたスタンプのメッセージを受け取ったスクリプトで、
            // ちがう 2 つのコスチュームにかえて、待った。押して送る名前と受け取る名前を同じにするプログラムは、自分で送った
            // 合図なので通らない
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: [
                        { opcode: CHAT_SEND_OPCODES, args: { BROADCAST_OPTION: messageMatcher(CHAT_STAMP_MESSAGE) } },
                    ],
                },
                {
                    type: 'uses',
                    trigger: fromPartner(CHAT_STAMP_MESSAGE),
                    blocks: [{ opcode: 'looks_switchcostumeto', count: 2, distinct: 'COSTUME' }, 'control_wait'],
                },
            ],
            quiz: challengeQuiz('chat-l5-stamp', 1),
            code: joinCode(chatL4SendRepeat, chatL5StampSend),
            spriteCodes: [{ sprite: 'Shimacat', code: joinCode(chatL4ReceiveSay, chatL5StampReceive) }],
        },
    ],
});

export const COURSES = [
    defineCourse({
        id: 'kyou-kara-programmer',
        language: LANGUAGES.BLOCKS,
        lessons: [blocksLesson1, blocksLesson2, blocksLesson3],
    }),
    defineCourse({
        id: 'chat-wo-tsukurou',
        language: LANGUAGES.BLOCKS,
        lessons: [chatLesson1, chatLesson2, chatLesson3, chatLesson4, chatLesson5],
    }),
];

/**
 * コースの大きさ（レッスンの数・チャレンジの数）。ウェルカムのコースの案内に出す（#1888。数を直書きしない）。
 * @param {object} course - コース。
 * @returns {{lessonCount: number, challengeCount: number}} 数。
 */
export const courseSize = (course) => ({
    lessonCount: course.lessons.length,
    challengeCount: course.lessons.reduce((sum, lesson) => sum + lesson.challenges.length, 0),
});

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
