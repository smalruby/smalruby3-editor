// Prompts for "生成AI に相談" (prototype): the student copies them into the
// school's generative AI chat and pastes the answer back. Pure functions only.

// The student's kinds of trouble; `starter` seeds the text box so they can go on in their own words.
const PROBLEM_KINDS = [
    { id: 'not-working', label: '思ったとおりに動かない', starter: '〜してほしいのに、〜してしまう' },
    { id: 'error', label: 'エラーが出る', starter: '〜をすると、〜というエラーが出る' },
    { id: 'next', label: '次に何を作ればいいかわからない', starter: '〜まではできた。次に〜したい' },
    { id: 'how', label: 'ブロックの使い方がわからない', starter: '〜するには、どのブロックを使えばいい？' },
    { id: 'more-fun', label: 'もっとおもしろくしたい', starter: '〜を、もっと〜にしたい' },
];

const COPY_START = '▼▼ ここから下をコピーして、スモウルビーにもどろう ▼▼';
const COPY_END = '▲▲ ここまで ▲▲';

const RULES = [
    '答えのコードをいきなり全部書かないでください。まずヒントを 1 つだけ出し、生徒に考えを書いてもらってください。',
    '生徒が考えを書いたら、それを認めてから次のヒントを出してください。',
    '生徒が「答えを見せて」と書いたとき、またはヒントを 3 回出したあとは、直したコードを書いてかまいません。',
    '説明では Ruby の書き方の細かいことは言わず、「〜を止める命令」「〜と言う命令」のように、何をする命令かを言葉で説明してください。生徒はスモウルビーでブロックとして見ます。',
    'コードを書くときは、変えるスプライトのプログラムを全部、下の「今のプログラム」と同じ書き方で書いてください。今のプログラムにある命令と、スモウルビーの命令だけを使ってください。',
    `コードの前に「${COPY_START}」、コードの後に「${COPY_END}」という行を書き、コードは \`\`\`ruby と \`\`\` で囲んでください。`,
    '中学生にわかる言葉で、短く答えてください。',
    '生徒の名前や学校名をたずねないでください。',
];

const fence = (code) => `\`\`\`ruby\n${(code || '').replace(/\s+$/, '')}\n\`\`\``;

/**
 * The first prompt: rules, the trouble, and the whole project as Ruby.
 * @param {object} params - parameters.
 * @param {string} params.kindLabel - the chosen kind of trouble.
 * @param {string} params.text - the trouble in the student's own words.
 * @param {Array<{name: string, code: string}>} params.programs - Ruby per sprite (and stage).
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
        ...RULES.map((rule) => `・${rule}`),
        '',
        '【困っていること】',
        `${kindLabel}：`,
        text.trim(),
    ];
    if (assignmentName) lines.push('', '【課題】', assignmentName);
    lines.push('', '【今のプログラム（作品全体のブロックを Ruby に直したもの）】');
    if (editingName) lines.push(`生徒がいま作っているのは「${editingName}」です。`);
    if (programs.length === 0) lines.push('（まだブロックはありません）');
    for (const program of programs) {
        lines.push(`「${program.name}」:`, fence(program.code));
    }
    lines.push('', 'まず、ヒントを 1 つだけください。');
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

export { COPY_END, COPY_START, PROBLEM_KINDS, buildGenaiPrompt, buildRewritePrompt, extractRuby, splitPrompt };
