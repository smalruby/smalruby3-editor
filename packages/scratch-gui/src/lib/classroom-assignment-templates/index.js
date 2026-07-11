/**
 * Official assignment templates (課題テンプレート).
 *
 * A template pre-fills the assignment editor: pages (text) plus recommended
 * rubric axes for the evaluation screen. Starter projects are attached by
 * the teacher ("use the open project") because template sb3 assets are not
 * bundled with the editor.
 *
 * The two initial entries are the framework-check skeletons of the Tamayu
 * lesson materials (計測・制御 / プログラミングを楽しもう). Their final
 * wording is still being tuned with the school — replace the text here when
 * the materials are finalized (delivery framework first, per EPIC #974).
 */

const ASSIGNMENT_TEMPLATES = [
    {
        id: 'programming-tanoshimou',
        title: 'プログラミングを楽しもう',
        description: 'はじめてのプログラミング。キャラクターを動かして、音や背景にも挑戦する。',
        pages: [
            {
                text:
                    'きょうのめあて: キャラクターを自分の思いどおりに動かそう。\n' +
                    '1. 旗を押したらキャラクターが動くようにする\n' +
                    '2. 「ずっと」や「〜回繰り返す」を使ってみる\n' +
                    '3. できた人は、キーを押したら動く操作も作ってみよう',
            },
            {
                text:
                    'チャレンジ（できた人向け）:\n' +
                    '・音ブロックをイベントにつなげて、動きに合わせて音を鳴らそう\n' +
                    '・背景や効果を変えてみよう\n' +
                    '・キャラクターを別のスプライトに変えたり、追加したりしてみよう\n' +
                    'できたら「提出」ボタンで提出しよう。',
            },
        ],
        rubricAxes: [
            { name: '動くこと', description: 'スクリプトがイベントに接続されて（◆）実行される' },
            { name: '繰り返し・操作', description: '繰り返しブロックやキー操作を使って動きを作れている' },
            { name: 'チャレンジ', description: '音・背景・効果・キャラクター変更など要件を超えた工夫がある' },
        ],
    },
    {
        id: 'keisoku-seigyo',
        title: '計測・制御（センサーとライト）',
        description: 'センサーの値で動作を変える「計測・制御」の基本。もし〜ならで分岐する。',
        pages: [
            {
                text:
                    'きょうのめあて: センサー（入力）の値によって、動作（出力）が変わるプログラムを作ろう。\n' +
                    '1. 「もし〜なら」ブロックを使う\n' +
                    '2. センサーの値（明るさ・音・タイマーなど）を条件にする\n' +
                    '3. 条件によってライトの点灯やキャラクターの動きを変える',
            },
            {
                text:
                    'ヒント:\n' +
                    '・「ずっと」の中に「もし〜なら」を入れると、センサーをずっと見張れる\n' +
                    '・しきい値（いくつ以上なら）をいろいろ変えて試そう\n' +
                    'できたら「提出」ボタンで提出しよう。',
            },
        ],
        rubricAxes: [
            { name: '動くこと', description: 'スクリプトがイベントに接続されて（◆）実行される' },
            { name: 'センサー制御', description: 'センサー値を条件（もし〜なら）に使って動作を変えている' },
            { name: '試行錯誤', description: 'しきい値や条件を変えて試した工夫が見える' },
        ],
    },
];

/**
 * Find a template by id.
 * @param {string} id - Template id
 * @returns {?object} Template or null
 */
const getAssignmentTemplate = (id) => ASSIGNMENT_TEMPLATES.find((t) => t.id === id) || null;

export { ASSIGNMENT_TEMPLATES, getAssignmentTemplate };
