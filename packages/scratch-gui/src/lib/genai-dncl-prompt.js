// The question of "生成AI に相談" in the Ruby tab's Japanese (DNCL) mode (#1402), for
// the high school students practicing the DNCL of 共通テスト. The code in the editor goes
// in as DNCL, and the answer comes back as DNCL (Smalruby reads DNCLv2 too). Pure functions.
import { DNCL_BUILTIN_NAMES } from './dncl/dncl-builtins';
import { COPY_END, COPY_START, betweenCopyMarks } from './genai-prompt.js';

// The kinds of trouble of DNCL mode, in order (labels in PROBLEM_KINDS of genai-prompt.js).
const DNCL_TAB_KINDS = ['wrong-answer', 'error', 'how-write', 'how-think'];

// How DNCL is written in Smalruby: the AI follows these. Each one is a whole program, so
// the unit test checks it turns into ordinary blocks (genai-dncl-prompt.test.js).
const SYNTAX_EXAMPLES = [
    { note: '代入（← でも = でもよい）', code: 'kosuu ← 3\ngoukei = 0' },
    { note: '配列（添字は 0 から。Data[0] が 3、最後は Data[2]）', code: 'Data = [3, 1, 2]\nData[0] = 5' },
    { note: '入力（数にするときは 整数(...)）', code: 'kotae = 【外部からの入力】\nn = 整数(kotae)' },
    { note: '整数の割り算と余り（// はコメントではない）', code: 'a = 7 // 2\nb = 7 % 2' },
    {
        note: 'もし〜ならば（「を実行する」で閉じる）',
        code: 'x = 1\nもし x > 0 かつ x < 10 ならば\n  表示する("1けた")\nそうでなくもし x == 0 ならば\n  表示する("0")\nそうでなければ\n  表示する("ほか")\nを実行する',
    },
    { note: '〜の間（「を繰り返す」で閉じる）', code: 'x = 10\nx > 0 の間\n  x = x - 3\nを繰り返す' },
    {
        note: '増やしながら（終わりの値も含む。「を繰り返す」で閉じる）',
        code: 'Data = [3, 1, 2]\ni を 0 から 要素数(Data) - 1 まで 1 ずつ増やしながら\n  表示する(Data[i])\nを繰り返す',
    },
    { note: '減らしながら', code: 'i を 10 から 1 まで 1 ずつ減らしながら\n  表示する(i)\nを繰り返す' },
    {
        note: '関数（「と定義する」で閉じる。値は 返す で返す）',
        code: '関数 nibai(x)\n  返す x * 2\nと定義する\n表示する(nibai(4))',
    },
];

// One example per built-in function of dncl-builtins.js (the test checks none is missing).
const BUILTIN_EXAMPLES = {
    表示する: { note: '表示する（いくつか並べるとつなげて表示）', code: 'ten = 80\n表示する(ten, "点")' },
    含む: {
        note: '文字列に含まれるか',
        code: 'namae = "さくら"\nもし 含む(namae, "く") ならば\n  表示する("ある")\nを実行する',
    },
    要素数: { note: '配列の要素の数', code: 'Data = [3, 1, 2]\n表示する(要素数(Data))' },
    整数: { note: '整数にする（小数点以下を切り捨て）', code: '表示する(整数(3.7))' },
    文字列: { note: '文字列にする', code: '表示する(文字列(12) + "円")' },
    乱数: { note: '乱数（1 から 6 まで）', code: 'me = 乱数(1..6)' },
    四捨五入: { note: '四捨五入', code: '表示する(四捨五入(2.5))' },
    切り捨て: { note: '切り捨て', code: '表示する(切り捨て(2.5))' },
    切り上げ: { note: '切り上げ', code: '表示する(切り上げ(2.1))' },
    絶対値: { note: '絶対値', code: '表示する(絶対値(-5))' },
    平方根: { note: '平方根', code: '表示する(平方根(9))' },
};

const DNCL_COMMAND_EXAMPLES = [...SYNTAX_EXAMPLES, ...DNCL_BUILTIN_NAMES.map((name) => BUILTIN_EXAMPLES[name])];

const fence = (code) => `\`\`\`\n${(code || '').replace(/\s+$/, '')}\n\`\`\``;

// The examples as one program with a comment above each (the AI reads them as DNCL).
const examplesBlock = () =>
    fence(DNCL_COMMAND_EXAMPLES.map((example) => `# ${example.note}\n${example.code}`).join('\n\n'));

const dnclRules = () => [
    '生徒は自分のプログラムを言葉で説明するのが苦手です。「どこを直したいかな？」のような質問を返さず、すぐに直したプログラムを出してください。',
    '答えのプログラムは、Python や Ruby ではなく、下の「書き方と使える命令の例」の DNCL で書いてください。共通テストの DNCL の形（行番号、｜ や ⎿、行の終わりの「:」）で書いてもかまいません。',
    '配列の添字は 0 から始まります（最初の要素は Data[0]）。問題文が「添字は 1 から」と言っていても、添字を 1 ずらして 0 から書いてください。',
    '代入は「←」か「=」で書いてください。',
    '関数の引数には代入できません（引数を変える行はエラーになります）。引数の値を変えたいときは、「x ← a」のようにほかの変数に写してから、その変数を変えてください。',
    'ブロックの終わりは、「もし〜ならば」は「を実行する」、「〜の間」と「〜ずつ増やしながら」「〜ずつ減らしながら」は「を繰り返す」、「関数」は「と定義する」の行で閉じてください。',
    '答えは、生徒のプログラムを、変えないところも含めて全部書いてください。スモウルビーはエディタのプログラムを丸ごと入れかえます。',
    'コードの前に、何を変えたかを「「もし x > 0 ならば」の中に「表示する(x)」を足しました」のように、DNCL のことばで 1〜3 行で説明してください。',
    'コメントは # で書いてください。// は整数の割り算なので、コメントには使えません。',
    '命令は、今のプログラムにある書き方か、下の「書き方と使える命令の例」の書き方で書いてください。イベント（旗が押されたとき など）・音・コスチューム・拡張機能の命令は使えません。',
    `直したプログラムは、「${COPY_START}」の行と「${COPY_END}」の行のあいだに、1 つの \`\`\` と \`\`\` で囲んで書いてください。印の外にはコードを書かないでください（生徒は印のあいだだけをコピーします）。`,
    'コードの後に、動かして確かめることを 1 つだけ書いてください。',
    '高校生にわかる言葉で、短く答えてください。生徒の名前や学校名をたずねないでください。',
];

/**
 * The first prompt of the Japanese (DNCL) mode (#1402): the DNCL in the editor as it is,
 * the answer in DNCL (indexes from 0), explained in the words of DNCL. Sounds, costumes and
 * the other sprites are left out: DNCL has no commands for them.
 * @param {object} params - parameters.
 * @param {string} params.kindLabel - the chosen kind of trouble.
 * @param {string} params.text - the trouble in the student's own words.
 * @param {string} params.code - the DNCL in the editor.
 * @param {Array<string>} params.errors - the errors shown in the editor (on DNCL lines).
 * @param {?string} params.assignmentName - the classroom assignment, if any.
 * @returns {string} the prompt.
 */
const buildDnclTabPrompt = ({ kindLabel, text, code, errors, assignmentName }) => {
    const lines = [
        'あなたは高校生のプログラミング学習を手伝う先生です。',
        'スモウルビーの日本語モードで、大学入学共通テストの DNCL（プログラム表記）の形の日本語のプログラムを書いて練習している生徒から相談が来ました。スモウルビーは、DNCL のプログラムを動かせます。',
        '',
        '【守ってほしいこと】',
        ...dnclRules().map((rule) => `・${rule}`),
        '',
        '【困っていること】',
        `${kindLabel}：`,
        text.trim(),
    ];
    if (errors && errors.length > 0) lines.push('', '【エディタに出ているエラー】', ...errors);
    if (assignmentName) lines.push('', '【課題】', assignmentName);
    lines.push('', '【書き方と使える命令の例】', examplesBlock());
    lines.push('', '【直すプログラム（生徒がいま書いている DNCL）】');
    lines.push(code && code.trim() ? fence(code) : '（まだプログラムはありません）');
    lines.push('', '直したプログラムを DNCL でください。');
    return lines.join('\n');
};

// A line that only DNCL (not prose) would have, for an answer pasted without a code fence.
const DNCL_LINE = /(を実行する|を繰り返す|と定義する|ならば\s*[:：]?|の間\s*[:：]?|表示する\(|←)\s*$/m;

/**
 * Take the DNCL out of a pasted answer: the fenced code between the copy markers, else
 * the last fenced code (of any language name: the AI may call it dncl, text or python),
 * else the text between the markers, else the text itself when it looks like DNCL.
 * @param {string} answer - the pasted answer.
 * @returns {?string} the DNCL, or null when none is found.
 */
const extractDncl = (answer) => {
    if (!answer) return null;
    const { text, marked } = betweenCopyMarks(answer);
    const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)];
    if (blocks.length > 0) return `${blocks[blocks.length - 1][1].replace(/\s+$/, '')}\n`;
    const plain = text.replace(/^\s*\n/, '').replace(/\s+$/, '');
    if (plain && (marked || DNCL_LINE.test(plain))) return `${plain}\n`;
    return null;
};

/**
 * The follow-up prompt when the DNCL answer could not be turned into blocks.
 * @param {object} params - parameters.
 * @param {string} params.code - the DNCL that failed.
 * @param {Array<string>} params.problems - what went wrong (lines are DNCL lines).
 * @returns {string} the prompt.
 */
const buildDnclRewritePrompt = ({ code, problems }) =>
    [
        'さっきのプログラムは、スモウルビーで動かせない書き方がありました。',
        '',
        '【動かせなかったところ】',
        ...problems.map((problem) => `・${problem}`),
        '',
        '【さっきのプログラム】',
        fence(code),
        '',
        '最初に送った「書き方と使える命令の例」の DNCL の書き方で、プログラムを全部書き直してください。配列の添字は 0 から始まります。',
        `コードの前に「${COPY_START}」、後に「${COPY_END}」の行を書き、コードは \`\`\` と \`\`\` で囲んでください。`,
    ].join('\n');

export { DNCL_COMMAND_EXAMPLES, DNCL_TAB_KINDS, buildDnclRewritePrompt, buildDnclTabPrompt, extractDncl };
