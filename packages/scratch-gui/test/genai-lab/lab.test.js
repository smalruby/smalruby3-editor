// Prompt lab for "生成AI に相談" (#1283): ask a model with the real prompt and
// grade its answer with the real checker and converter. It calls a model, so it
// runs only when asked for (not in CI):
//
//   GENAI_LAB=1 npx jest test/genai-lab/lab.test.js
//
// GENAI_LAB_MODELS (default "sonnet"): comma-separated `claude -p --model` names.
// GENAI_LAB_RUN (default a timestamp): the run folder under <repo>/tmp/genai-lab/.
//   Answers already in the folder are reused, so a run can be graded again for free.
// GENAI_LAB_ONLY: comma-separated scenario ids. GENAI_LAB_REPEAT (default 1): answers per scenario.
// GENAI_LAB_JUDGE (default "sonnet"; "none" to skip): the model that judges whether the
//   program Smalruby takes from the answer solves the student's trouble.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { checkAnswer, problemToJapanese } from '../../src/lib/genai-answer.js';
import {
    COMMAND_EXAMPLES,
    COPY_END,
    COPY_START,
    PROBLEM_KINDS,
    buildGenaiPrompt,
} from '../../src/lib/genai-prompt.js';
import RubyToBlocksConverter from '../../src/lib/ruby-to-blocks-converter';
import scenarios from './scenarios.js';

const enabled = process.env.GENAI_LAB === '1';
const models = (process.env.GENAI_LAB_MODELS || 'sonnet').split(',').filter(Boolean);
const only = (process.env.GENAI_LAB_ONLY || '').split(',').filter(Boolean);
const repeat = Number(process.env.GENAI_LAB_REPEAT || 1);
const runName = process.env.GENAI_LAB_RUN || new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.resolve(__dirname, '../../../../tmp/genai-lab', runName);
const judgeModel = process.env.GENAI_LAB_JUDGE || 'sonnet';
const CONCURRENCY = 3;

// A plain chat assistant, like the school's: no tools and none of Claude Code's instructions.
const SYSTEM_PROMPT =
    'You are a helpful AI assistant used by students and teachers at a Japanese junior high school.';

const askModel = (model, prompt) =>
    new Promise((resolve, reject) => {
        const child = spawn(
            'claude',
            [
                '-p',
                '--model',
                model,
                '--system-prompt',
                SYSTEM_PROMPT,
                '--tools',
                '',
                '--no-session-persistence',
                '--setting-sources',
                '',
            ],
            { cwd: runDir },
        );
        let out = '';
        let err = '';
        child.stdout.on('data', (data) => {
            out += data;
        });
        child.stderr.on('data', (data) => {
            err += data;
        });
        child.on('error', reject);
        child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err}`))));
        child.stdin.end(prompt);
    });

const convert = async (name, code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    converter.result = await converter.targetCodeToBlocks(null, code);
    return converter;
};

const promptFor = (scenario) =>
    buildGenaiPrompt({
        kindLabel: PROBLEM_KINDS.find((kind) => kind.id === scenario.kind).label,
        text: scenario.text,
        programs: scenario.sprites,
        editingName: scenario.editingName,
    });

/**
 * Grade one answer: what the student would see in Smalruby, and how well the
 * answer kept the rules of the prompt.
 * @param {object} scenario - the scenario.
 * @param {string} answer - the model's answer.
 * @returns {Promise<object>} the grade.
 */
const grade = async (scenario, answer) => {
    const result = await checkAnswer({
        answer,
        sprites: scenario.sprites,
        editingName: scenario.editingName,
        convert,
    });
    const start = answer.indexOf(COPY_START);
    const end = answer.indexOf(COPY_END);
    const written = result.parts.map((part) => part.name);
    const expected = scenario.expect.sprites;
    return {
        ok: result.ok,
        markers: start >= 0 && end > start,
        rubyFence: /```ruby/.test(answer),
        asksBack: result.parts.length === 0 && /[？?]/.test(answer),
        explainsFirst: start > 0 && answer.slice(0, start).trim().length > 0,
        checkAfter: end >= 0 && answer.slice(end + COPY_END.length).trim().length > 0,
        written,
        missingSprites: expected.filter((name) => !written.includes(name)),
        extraSprites: written.filter((name) => !expected.includes(name)),
        fixes: result.fixes,
        problems: result.problems.map((problem) => problemToJapanese(problem)),
        codeOutside: codeOutsideMarks(answer),
        length: answer.length,
        result,
    };
};

const programText = (sprites) =>
    sprites
        .map(
            (sprite) =>
                `「${sprite.name}」（音: ${sprite.sounds.join('、') || 'なし'}／コスチューム: ${sprite.costumes.join('、')}）:\n` +
                `\`\`\`ruby\n${sprite.code || '（なし）\n'}\`\`\``,
        )
        .join('\n\n');

/**
 * Ask a model whether the project after pasting solves the trouble. Only the
 * program Smalruby takes (between the copy marks) counts, as for the student.
 * @param {object} scenario - the scenario.
 * @param {object} result - checkAnswer's result.
 * @param {string} file - where to keep the verdict.
 * @returns {Promise<?object>} `{solves, reason}`, or null when not judged.
 */
const judge = async (scenario, result, file) => {
    if (judgeModel === 'none' || result.parts.length === 0) return null;
    if (!fs.existsSync(file)) {
        const after = scenario.sprites.map((sprite) => {
            const part = result.parts.find((p) => p.name === sprite.name);
            return part ? { ...sprite, code: part.code } : sprite;
        });
        const prompt = [
            'スモウルビー（Scratch のブロックと Ruby を行き来できる環境）で、中学生の困りごとを生成AI に相談しました。',
            '生徒は答えのプログラムを貼りつけ、スモウルビーはスプライトごとにプログラムを丸ごと入れかえました。',
            '入れかえたあとのプログラムで、困りごとが解決するかを判定してください。',
            '判定するのは、困りごとに書かれたことができるようになったかだけです。ゲームとしての作りの良し悪しや、困りごとに無いことは問いません。',
            '音やコスチュームは、各スプライトの一覧にある名前なら使えます。',
            '',
            `【困りごと】${scenario.text}`,
            '',
            '【スモウルビーの命令の例（どれも正しい書き方）】',
            ...COMMAND_EXAMPLES,
            '',
            '【前のプログラム】',
            programText(scenario.sprites),
            '',
            '【入れかえたあとのプログラム】',
            programText(after),
            '',
            '次の JSON だけを 1 行で答えてください: {"solves": true か false, "reason": "日本語で 1 文"}',
        ].join('\n');
        fs.writeFileSync(file, await askModel(judgeModel, prompt));
    }
    const text = fs.readFileSync(file, 'utf8');
    // The judge may correct itself after a first answer, so the last object wins.
    const objects = text.match(/\{[^{}]*\}/g) || [];
    try {
        return JSON.parse(objects[objects.length - 1]);
    } catch (e) {
        return { solves: null, reason: text.trim().slice(0, 200) };
    }
};

// Fenced code outside the copy marks: the student may copy it, and Smalruby ignores it.
const codeOutsideMarks = (answer) => {
    const start = answer.indexOf(COPY_START);
    const end = answer.indexOf(COPY_END);
    const outside = start >= 0 && end > start ? answer.slice(0, start) + answer.slice(end) : answer;
    return (outside.match(/```/g) || []).length / 2;
};

const runPool = async (jobs) => {
    const results = [];
    let next = 0;
    const worker = async () => {
        while (next < jobs.length) {
            const index = next++;
            results[index] = await jobs[index]();
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return results;
};

const mark = (value) => (value ? '✓' : '✗');

const summarize = (rows) => {
    const lines = [
        `# genai-lab ${runName}`,
        '',
        '| model | scenario | # | ブロック化 | 解決 | 印 | 印の外のコード | 質問返し | 説明 | 確かめ | 書いた | 足りない | 余分 | 自動修正 | 問題・判定 |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ];
    for (const row of rows) {
        const g = row.grade;
        lines.push(
            [
                '',
                row.model,
                row.scenario,
                row.n,
                mark(g.ok),
                g.verdict ? mark(g.verdict.solves) : '',
                mark(g.markers && g.rubyFence),
                g.codeOutside || '',
                g.asksBack ? '⚠️' : '',
                mark(g.explainsFirst),
                mark(g.checkAfter),
                g.written.join('・'),
                g.missingSprites.join('・'),
                g.extraSprites.join('・'),
                g.fixes.map((fix) => `${fix.from} → ${fix.to}`).join('<br>'),
                [...g.problems, g.verdict && !g.verdict.solves ? g.verdict.reason : null]
                    .filter(Boolean)
                    .join('<br>')
                    .replace(/\n/g, ' '),
                '',
            ].join(' | '),
        );
    }
    for (const model of models) {
        const mine = rows.filter((row) => row.model === model);
        const count = (key) => mine.filter((row) => row.grade[key]).length;
        lines.push(
            '',
            `**${model}**: ブロック化 ${count('ok')}/${mine.length}・` +
                `解決 ${mine.filter((row) => row.grade.ok && row.grade.verdict?.solves).length}/${mine.length}・` +
                `印 ${count('markers')}/${mine.length}・印の外にコード ${count('codeOutside')}・` +
                `質問返し ${count('asksBack')}・自動修正あり ${mine.filter((row) => row.grade.fixes.length).length}`,
        );
    }
    return `${lines.join('\n')}\n`;
};

(enabled ? describe : describe.skip)('genai-lab', () => {
    test(
        'asks the models and grades the answers',
        async () => {
            fs.mkdirSync(runDir, { recursive: true });
            const picked = scenarios.filter((scenario) => only.length === 0 || only.includes(scenario.id));
            const jobs = [];
            for (const model of models) {
                for (const scenario of picked) {
                    const prompt = promptFor(scenario);
                    fs.writeFileSync(path.join(runDir, `${scenario.id}.prompt.md`), prompt);
                    for (let n = 1; n <= repeat; n++) {
                        jobs.push(async () => {
                            const file = path.join(runDir, model, `${scenario.id}-${n}.md`);
                            fs.mkdirSync(path.dirname(file), { recursive: true });
                            if (!fs.existsSync(file)) fs.writeFileSync(file, await askModel(model, prompt));
                            const answer = fs.readFileSync(file, 'utf8');
                            const { result, ...graded } = await grade(scenario, answer);
                            const verdict = await judge(scenario, result, file.replace(/\.md$/, '.judge.txt'));
                            return { model, scenario: scenario.id, n, grade: { ...graded, verdict } };
                        });
                    }
                }
            }
            const rows = await runPool(jobs);
            fs.writeFileSync(path.join(runDir, 'grades.json'), `${JSON.stringify(rows, null, 2)}\n`);
            fs.writeFileSync(path.join(runDir, 'summary.md'), summarize(rows));
            // eslint-disable-next-line no-console
            console.log(`genai-lab: ${path.join(runDir, 'summary.md')}`);
            expect(rows.length).toBe(jobs.length);
        },
        30 * 60 * 1000,
    );
});
