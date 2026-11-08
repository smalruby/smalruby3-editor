// Prompts for "生成AI に相談" (prototype): the student copies them into the
// school's generative AI chat and pastes the answer back. Pure functions only.

// The student's kinds of trouble; `starter` seeds the text box so they can go on in their own words.
const PROBLEM_KINDS = [
    { id: 'not-working', label: '思ったとおりに動かない', starter: '〜してほしいのに、〜してしまう' },
    { id: 'error', label: 'エラーが出る', starter: '〜をすると、〜というエラーが出る' },
    { id: 'next', label: '次に何を作ればいいかわからない', starter: '〜まではできた。次に〜したい' },
    { id: 'how', label: 'ブロックの使い方がわからない', starter: '〜するには、どのブロックを使えばいい？' },
    { id: 'more-fun', label: 'もっとおもしろくしたい', starter: '〜を、もっと〜にしたい' },
    // The Ruby tab's student writes commands, not blocks (#1398).
    { id: 'how-command', label: '命令の書き方がわからない', starter: '〜するには、どう書けばいい？' },
];

// The kinds each tab offers, in order.
const CODE_TAB_KINDS = ['not-working', 'error', 'next', 'how', 'more-fun'];
const RUBY_TAB_KINDS = ['not-working', 'error', 'next', 'how-command', 'more-fun'];

const COPY_START = '▼▼ ここから下をコピーして、スモウルビーにもどろう ▼▼';
const COPY_END = '▲▲ ここまで ▲▲';

// Students cannot describe their program in chat, so a question back (「どのブロックの中かな？」)
// stalls them. The AI answers with the whole changed program right away; the
// student learns by reading the "what changed" lines and trying it.
const rules = (editingName) => {
    const target = editingName ? `「${editingName}」` : '直すスプライト';
    return [
        '生徒は自分のプログラムを言葉で説明するのが苦手です。「どこに入れればいいかな？」のような質問を返さず、すぐに直したプログラムを出してください。',
        `直すのは、できるだけ${target}のプログラムだけにしてください。スモウルビーはスプライトのブロックを丸ごと入れかえるので、変えるスプライトごとに「# 「スプライト名」」という 1 行から始めて、変えないところも含めてそのスプライトのプログラムを全部書いてください。変えないスプライトは書かないでください。`,
        'コードの前に、何を変えたかを「〜を受け取ったときのブロックの中に、〜を鳴らす命令を足しました」のように、ブロックのことばで 1〜3 行で説明してください。Ruby の書き方の細かいことは言わないでください。',
        '命令は、今のプログラムにある書き方か、下の「使える命令の例」の書き方で書いてください。例にない命令が要るときも、プログラムを出すのをやめずに、例と同じスモウルビーの書き方で書いてください。Scratch のブロック名を英語にしただけの命令（when_this_sprite_clicked など）は使えません。音やコスチュームの名前は、下の一覧にあるものから選んでください。',
        `直したプログラムは全部、「${COPY_START}」の行と「${COPY_END}」の行のあいだに、1 つの \`\`\`ruby と \`\`\` で囲んで書いてください。変えるスプライトが 2 つ以上でも 1 つにまとめ、印の外にはコードを書かないでください（生徒は印のあいだだけをコピーします）。`,
        'コードの後に、動かして確かめることを 1 つだけ書いてください。',
        '中学生にわかる言葉で、短く答えてください。生徒の名前や学校名をたずねないでください。',
    ];
};

// Commands checked against the converter (genai-prompt.test.js), so the AI does not
// invent names. Without the events and sensing here, a careful AI declined to write a
// program at all when the student's trouble needed one of them (#1283).
const COMMAND_EXAMPLES = [
    'when_flag_clicked do … end … 旗が押されたとき',
    'when_clicked do … end … このスプライトが押されたとき',
    'when_key_pressed("space") do … end … スペースキーが押されたとき（"right arrow" などの矢印キーも）',
    'when_receive("合図") do … end … 合図を受け取ったとき',
    'broadcast("合図") … 合図を送る（送るスプライトと受け取るスプライトの両方を書く）',
    'loop do … end … ずっと',
    '10.times do … end … 10 回繰り返す',
    'if touching?("スプライト名") … end … もし〜に触れたなら（端は "_edge_"）',
    'if keyboard.pressed?("space") … end … もしスペースキーが押されたなら',
    'move(10) … 10 歩動かす',
    'turn_right(15) … 右に 15 度回す',
    'self.direction = 90 … 90 度に向ける',
    'go_to([0, 0]) … x座標を 0、y座標を 0 にする',
    'self.x += 10 … x座標を 10 ずつ変える（self.y も同じ）',
    'go_to([rand(-200..200), 180]) … x座標を -200 から 200 までの乱数、y座標を 180 にする',
    'bounce_if_on_edge … もし端に着いたら、跳ね返る',
    'sleep(1) … 1 秒待つ',
    'say("こんにちは") … こんにちはと言う（say("やあ", 2) で 2 秒。言えるのはスプライトだけで、ステージは言えない）',
    'switch_costume("コスチューム名") … コスチュームを〜にする',
    'next_costume … 次のコスチュームにする',
    'switch_backdrop("背景の名前") … 背景を〜にする',
    'show / hide … 表示する／隠す',
    'create_clone("_myself_") … 自分のクローンを作る',
    'when_start_as_a_clone do … end … クローンされたとき',
    'delete_this_clone … このクローンを削除する',
    'ask("名前は？") … 質問して答えを待つ（答えは answer）',
    'if answer == "東京" … end … もし答えが東京なら',
    'timer.reset … タイマーを 0 にする',
    'if timer.value > 30 … end … もしタイマーが 30 より大きいなら',
    'stop("all") … すべてを止める（吹き出しも消えるので、言わせたいときは say("おしまい", 2) のあとに止める）',
    'play("音の名前") … 〜の音を鳴らす',
    'play_until_done("音の名前") … 終わるまで〜の音を鳴らす',
    '$score = 0 … 全部のスプライトで使う変数を 0 にする（$score += 1 で 1 ずつ変える）',
];

const fence = (code) => `\`\`\`ruby\n${(code || '').replace(/\s+$/, '')}\n\`\`\``;

const quoteList = (names) => (names && names.length > 0 ? names.map((n) => `"${n}"`).join('、') : 'なし');

/**
 * The first prompt: rules, the trouble, and the whole project as Ruby.
 * @param {object} params - parameters.
 * @param {string} params.kindLabel - the chosen kind of trouble.
 * @param {string} params.text - the trouble in the student's own words.
 * @param {Array<{name: string, code: string, sounds: ?Array<string>, costumes: ?Array<string>}>} params.programs -
 *     Ruby per sprite (and stage), with the names of its sounds and costumes.
 * @param {?string} params.editingName - the sprite the student is working on.
 * @param {?string} params.assignmentName - the classroom assignment, if any.
 * @returns {string} the prompt.
 */
const buildGenaiPrompt = ({ kindLabel, text, programs, editingName, assignmentName }) => {
    const lines = [
        'あなたは中学生のプログラミング学習を手伝う先生です。',
        'スモウルビー（Scratch のブロックと Ruby のコードを行き来できるプログラミング環境）で作品を作っている生徒から相談が来ました。',
        '生徒は Ruby ではなく、命令ブロックを組み合わせてプログラムを作っています。下の「今のプログラム」は、生徒のブロックをスモウルビーが Ruby に直したものです。',
        '',
        '【守ってほしいこと】',
        ...rules(editingName).map((rule) => `・${rule}`),
        '',
        '【困っていること】',
        `${kindLabel}：`,
        text.trim(),
    ];
    if (assignmentName) lines.push('', '【課題】', assignmentName);
    lines.push('', '【使える命令の例】', ...COMMAND_EXAMPLES);
    lines.push('', '【今のプログラム（作品全体のブロックを Ruby に直したもの）】');
    if (editingName) lines.push(`生徒がいま作っているのは「${editingName}」です。`);
    if (programs.length === 0) lines.push('（まだブロックはありません）');
    for (const program of programs) {
        lines.push(
            `「${program.name}」（音: ${quoteList(program.sounds)}／コスチューム: ${quoteList(program.costumes)}）:`,
        );
        lines.push(fence(program.code));
    }
    const target = editingName ? `「${editingName}」の` : '';
    lines.push('', `${target}直したプログラムをください。`);
    return lines.join('\n');
};

// How the answer is explained in each mode of the Ruby tab (#1396 決定 2): in furigana
// mode the student is just starting to read Ruby, so the words are easy and each command
// gets its meaning, but the code stays Ruby (it goes into the same editor).
const EXPLAIN_RULES = {
    ruby: 'コードの前に、何を変えたかを「when_receive("合図") の中に play("Pop") を足しました」のように、Ruby の書き方で 1〜3 行で説明してください。',
    furigana:
        'コードの前に、何を変えたかを、小学生にもわかるやさしいことばで 1〜3 行で説明してください。命令には「loop（ずっと）」「move(10)（10 歩動かす）」のように日本語の意味を添えてください。答えのコードは Ruby のままで書いてください（日本語に直さないでください）。',
};

const rubyTabRules = (editingName, mode) => {
    const target = `「${editingName}」`;
    return [
        '生徒は自分のプログラムを言葉で説明するのが苦手です。「どこに入れればいいかな？」のような質問を返さず、すぐに直したプログラムを出してください。',
        `直すのは${target}のプログラムだけです。ほかのスプライトのプログラムは、合図や変数の名前を合わせるための参考です。直さないでください。`,
        `答えは${target}のプログラムを、変えないところも含めて全部書いてください。スモウルビーはエディタのプログラムを丸ごと入れかえます。「# 「スプライト名」」の見出しは書かないでください。`,
        EXPLAIN_RULES[mode] || EXPLAIN_RULES.ruby,
        '命令は、今のプログラムにある書き方か、下の「使える命令の例」の書き方で書いてください。例にない命令が要るときも、プログラムを出すのをやめずに、例と同じスモウルビーの書き方で書いてください。Scratch のブロック名を英語にしただけの命令（when_this_sprite_clicked など）は使えません。音やコスチュームの名前は、下の一覧にあるものから選んでください。',
        `直したプログラムは、「${COPY_START}」の行と「${COPY_END}」の行のあいだに、1 つの \`\`\`ruby と \`\`\` で囲んで書いてください。印の外にはコードを書かないでください（生徒は印のあいだだけをコピーします）。`,
        'コードの後に、動かして確かめることを 1 つだけ書いてください。',
        '中学生にわかる言葉で、短く答えてください。生徒の名前や学校名をたずねないでください。',
    ];
};

/**
 * The first prompt of the Ruby tab (#1398): only the sprite in the editor is fixed, with
 * the Ruby in the editor now (also edits not yet in the blocks); the other sprites come
 * as reference. The code tab's question (buildGenaiPrompt) stays as it is.
 * @param {object} params - parameters.
 * @param {string} params.mode - 'ruby' or 'furigana'.
 * @param {string} params.kindLabel - the chosen kind of trouble.
 * @param {string} params.text - the trouble in the student's own words.
 * @param {string} params.editingName - the sprite in the editor (「ステージ」 for the stage).
 * @param {string} params.code - the Ruby in the editor.
 * @param {Array<string>} params.sounds - the sounds of the sprite in the editor.
 * @param {Array<string>} params.costumes - the costumes of the sprite in the editor.
 * @param {Array<{name: string, code: string, sounds: ?Array<string>, costumes: ?Array<string>}>} params.others -
 *     the other sprites (and the stage) as Ruby; those without code are left out.
 * @param {Array<string>} params.errors - the errors shown in the editor, one per line.
 * @param {?string} params.assignmentName - the classroom assignment, if any.
 * @returns {string} the prompt.
 */
const buildRubyTabPrompt = ({
    mode,
    kindLabel,
    text,
    editingName,
    code,
    sounds,
    costumes,
    others,
    errors,
    assignmentName,
}) => {
    const lines = [
        'あなたは中学生のプログラミング学習を手伝う先生です。',
        'スモウルビー（Scratch のブロックと Ruby のコードを行き来できるプログラミング環境）で、Ruby のコードを書いて作品を作っている生徒から相談が来ました。',
        '',
        '【守ってほしいこと】',
        ...rubyTabRules(editingName, mode).map((rule) => `・${rule}`),
        '',
        '【困っていること】',
        `${kindLabel}：`,
        text.trim(),
    ];
    if (errors && errors.length > 0) lines.push('', '【エディタに出ているエラー】', ...errors);
    if (assignmentName) lines.push('', '【課題】', assignmentName);
    lines.push('', '【使える命令の例】', ...COMMAND_EXAMPLES);
    lines.push('', `【直すプログラム（生徒がいま書いている「${editingName}」）】`);
    lines.push(`「${editingName}」（音: ${quoteList(sounds)}／コスチューム: ${quoteList(costumes)}）:`);
    lines.push(code && code.trim() ? fence(code) : '（まだプログラムはありません）');
    const reference = (others || []).filter((p) => p.code && p.code.trim());
    if (reference.length > 0) {
        lines.push('', '【参考：ほかのスプライトのプログラム（直さないでください）】');
        for (const program of reference) {
            lines.push(
                `「${program.name}」（音: ${quoteList(program.sounds)}／コスチューム: ${quoteList(program.costumes)}）:`,
            );
            lines.push(fence(program.code));
        }
    }
    lines.push('', `「${editingName}」の分だけ、直したプログラムをください。`);
    return lines.join('\n');
};

/**
 * Split a prompt into `count` parts at line breaks, for an AI that refused a long paste.
 * Every part but the last asks the AI to wait for the rest.
 * @param {string} prompt - the whole prompt.
 * @param {number} count - number of parts (1 returns the prompt as is).
 * @returns {Array<string>} the parts, each ready to paste.
 */
const splitPrompt = (prompt, count) => {
    if (count <= 1) return [prompt];
    const lines = prompt.split('\n');
    const target = Math.ceil(prompt.length / count);
    const chunks = [];
    let current = [];
    let size = 0;
    for (const line of lines) {
        if (size + line.length > target && current.length > 0 && chunks.length < count - 1) {
            chunks.push(current.join('\n'));
            current = [];
            size = 0;
        }
        current.push(line);
        size += line.length + 1;
    }
    chunks.push(current.join('\n'));
    const total = chunks.length;
    return chunks.map((chunk, index) => {
        const head = `【${total} つに分けた ${index + 1} つ目】`;
        const tail =
            index < total - 1
                ? `\n\n（続きがあります。${total} つ全部届くまで、返事は「受け取りました」とだけ書いてください）`
                : `\n\n（これで全部です。${total} つをまとめて 1 つの相談として読んでください）`;
        return `${head}\n${chunk}${tail}`;
    });
};

/**
 * Take the Ruby code out of a pasted answer: the fenced code between the copy
 * markers, else the last ```ruby (or ```) block, else the text itself when it
 * looks like code.
 * @param {string} answer - the pasted answer.
 * @returns {?string} the Ruby code, or null when none is found.
 */
const extractRuby = (answer) => {
    if (!answer) return null;
    let text = answer;
    const start = text.indexOf('▼▼');
    if (start >= 0) {
        const afterStart = text.indexOf('\n', start);
        const end = text.indexOf('▲▲', afterStart);
        text = end >= 0 ? text.slice(afterStart, end) : text.slice(afterStart);
    }
    const blocks = [...text.matchAll(/```[ \t]*([a-zA-Z]*)[^\n]*\n([\s\S]*?)```/g)];
    const ruby = blocks.filter((m) => !m[1] || /^(ruby|rb)$/i.test(m[1]));
    if (ruby.length > 0) return `${ruby[ruby.length - 1][2].replace(/\s+$/, '')}\n`;
    const plain = text.trim();
    if (/\bend\b/.test(plain) && /\bdo\b|\bdef\b|\bif\b/.test(plain)) return `${plain}\n`;
    return null;
};

/**
 * The follow-up prompt when the answer could not be turned into blocks.
 * @param {object} params - parameters.
 * @param {string} params.code - the Ruby that failed.
 * @param {Array<string>} params.problems - what the converter reported.
 * @returns {string} the prompt.
 */
const buildRewritePrompt = ({ code, problems }) =>
    [
        'さっきのコードは、スモウルビーのブロックに直せない書き方がありました。',
        '',
        '【ブロックに直せなかったところ】',
        ...problems.map((problem) => `・${problem}`),
        '',
        '【さっきのコード】',
        fence(code),
        '',
        '今のプログラムと同じ書き方と、スモウルビーの命令だけを使って、スプライトのプログラムを全部書き直してください。',
        `コードの前に「${COPY_START}」、後に「${COPY_END}」の行を書き、コードは \`\`\`ruby と \`\`\` で囲んでください。`,
    ].join('\n');

export {
    CODE_TAB_KINDS,
    COMMAND_EXAMPLES,
    COPY_END,
    COPY_START,
    PROBLEM_KINDS,
    RUBY_TAB_KINDS,
    buildGenaiPrompt,
    buildRubyTabPrompt,
    buildRewritePrompt,
    extractRuby,
    splitPrompt,
};
