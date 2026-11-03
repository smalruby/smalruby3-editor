// 「ルビティーにまかせる」 of "生成AI に相談" (#1282): when the student's generative AI
// failed twice, Rubytee (Claude Sonnet, through the relay) rewrites the program. The
// browser checks each answer with Smalruby's converter and, without the student's
// help, asks again with the reasons a few times. Rubytee only writes Ruby: the blocks
// are always made by Smalruby. Everything but the network is a pure function, and
// the relay call takes its fetch / sleep / clock as arguments for the tests.

const RUBYTEE_RELAY_ENDPOINT = process.env.RUBYTEE_RELAY_ENDPOINT || '';

// The relay's limit of userMessage for purpose "genai-takeover".
const TAKEOVER_MESSAGE_LIMIT = 10000;
// Rubytee's answers checked before giving up: the first one and two rewrites with the
// reasons. Each try is a Sonnet call of up to a minute or two, and counts against the
// seat's 40 / 35 minutes, so a few is the most the student should wait for.
const MAX_TAKEOVER_TRIES = 3;
// The relay gives up a job after 240 seconds (JOB_TIMEOUT); the browser a bit later.
const POLL_LIMIT_MS = 300 * 1000;
// Polls that may fail in a row (a passing network failure) before giving up.
const MAX_POLL_FAILURES = 3;
const PURPOSE = 'genai-takeover';

const OMITTED = '…（長いので省略）';
const EARLIER_OMITTED = '（これより前の相談は、長いので省略）';
const COPY_MARK = '▼▼';

/**
 * An error of the takeover, with the relay's error code (or CANCELLED / NETWORK /
 * NO_RELAY / JOB_TIMEOUT from the browser).
 */
class TakeoverError extends Error {
    constructor(code, resetAfterSeconds = null) {
        super(code);
        this.name = 'TakeoverError';
        this.code = code;
        this.resetAfterSeconds = resetAfterSeconds;
    }
}

const fence = (code) => `\`\`\`ruby\n${(code || '').replace(/\s+$/, '')}\n\`\`\``;

const quoteList = (names) => (names && names.length > 0 ? names.map((n) => `"${n}"`).join('、') : 'なし');

const cut = (text, length) => {
    const s = text || '';
    if (s.length <= length) return s;
    return length <= OMITTED.length ? OMITTED : s.slice(0, length - OMITTED.length) + OMITTED;
};

const bullets = (problems) => (problems.length > 0 ? problems.map((p) => `・${p}`) : ['・（理由はわかりません）']);

const renderExchange = (exchange, index, question, answer) =>
    [
        `―― ${index + 1} 回目 ――`,
        '［生成AI への質問］',
        question || '（コピーしていません）',
        '［生徒が貼りもどした答え］',
        answer,
        '［ブロックにできなかった理由］',
        ...bullets(exchange.problems || []),
    ].join('\n');

// One exchange in at most `room` characters, or null when even its reasons do not fit.
const fitExchange = (exchange, index, room) => {
    const whole = renderExchange(exchange, index, exchange.question, exchange.answer);
    if (whole.length <= room) return whole;
    const available = room - renderExchange(exchange, index, '', '').length - 2;
    if (available < 200) return null;
    const answerLength = Math.min((exchange.answer || '').length, Math.ceil(available / 2));
    return renderExchange(
        exchange,
        index,
        cut(exchange.question, available - answerLength),
        cut(exchange.answer, answerLength),
    );
};

/**
 * The first message to Rubytee: the student's trouble, the whole program, and the
 * consultation with the generative AI (every question, pasted answer and reason it
 * could not be turned into blocks). The relay takes at most 10000 characters, so the
 * oldest exchanges are shortened or left out first; the trouble and the program
 * always go in whole.
 * @param {object} params - parameters.
 * @param {string} params.kindLabel - the chosen kind of trouble.
 * @param {string} params.text - the trouble in the student's own words.
 * @param {Array<{name: string, code: string, sounds: ?Array<string>, costumes: ?Array<string>}>} params.programs -
 *     Ruby per sprite (and 'ステージ'), with the names of its sounds and costumes.
 * @param {?string} params.editingName - the sprite the student is working on.
 * @param {Array<{question: ?string, answer: string, problems: Array<string>}>} params.exchanges -
 *     the consultation with the generative AI, oldest first; problems in Japanese.
 * @returns {?string} the message, or null when the program alone is too long to send.
 */
const buildTakeoverMessage = ({ kindLabel, text, programs, editingName, exchanges }) => {
    const head = [
        '生徒が学校の生成AI にプログラムの相談をしましたが、その答えはスモウルビーのブロックにできませんでした。',
        '生徒のやりたいことができて、ブロックにできるように、作品を書き直してください。',
        '',
        '【困っていること】',
        `${kindLabel || ''}：`,
        (text || '').trim(),
        '',
        '【今の作品（作品全体のブロックを Ruby に直したもの）】',
    ];
    if (editingName) head.push(`生徒がいま作っているのは「${editingName}」です。`);
    for (const program of programs) {
        head.push(
            `# 「${program.name}」`,
            `（音: ${quoteList(program.sounds)}／コスチューム: ${quoteList(program.costumes)}）`,
            program.code && program.code.trim() ? fence(program.code) : '（まだブロックはありません）',
        );
    }
    const tail = [
        '',
        '上の作品を元に、ブロックにできるプログラムを答えてください。',
        '変えるスプライトごとに「# 「スプライト名」」の行から、そのスプライトのプログラムを全部書いてください。',
    ];
    const fixed = [...head, ...tail].join('\n');
    const title = '\n\n【生成AI への相談（古い順）】\n';
    if (fixed.length > TAKEOVER_MESSAGE_LIMIT) return null;
    // The line saying the older exchanges are left out has its room kept from the start:
    // the exchange before it may take all the rest.
    let room = TAKEOVER_MESSAGE_LIMIT - fixed.length - title.length - EARLIER_OMITTED.length - 2;
    if (room < 0) return fixed;
    const fitted = [];
    for (let i = exchanges.length - 1; i >= 0; i--) {
        const block = fitExchange(exchanges[i], i, room - 2);
        if (!block) {
            fitted.unshift(EARLIER_OMITTED);
            break;
        }
        fitted.unshift(block);
        room -= block.length + 2;
    }
    if (fitted.length === 0) return fixed;
    return [head.join('\n'), title, fitted.join('\n\n'), tail.join('\n')].join('');
};

/**
 * The message asking Rubytee to rewrite its last answer (which is in the history).
 * @param {Array<string>} problems - why it could not be turned into blocks, in Japanese.
 * @returns {string} the message.
 */
const buildTakeoverRetryMessage = (problems) =>
    cut(
        [
            'さっきの答えは、スモウルビーのブロックにできませんでした。',
            '',
            '【ブロックにできなかったところ】',
            ...bullets(problems.slice(0, 20)),
            '',
            '使える命令と書き方だけを使って、もう一度答えてください。',
            `答えの形は前と同じです（説明 → ${COPY_MARK} の行 → \`\`\`ruby のコード → ▲▲ の行 → 確かめ方）。`,
        ].join('\n'),
        TAKEOVER_MESSAGE_LIMIT,
    );

/**
 * Rubytee's short explanation of what it changed: the text before the code.
 * @param {string} text - Rubytee's answer.
 * @returns {string} the explanation (empty when the answer has no copy marker).
 */
const takeoverExplanation = (text) => {
    const index = (text || '').indexOf(COPY_MARK);
    if (index < 0) return '';
    return cut(text.slice(0, index).trim(), 400);
};

/**
 * How long to wait before the n-th poll of a job: 3 seconds, then a second more
 * each time up to 10, so a class polling at once stays under the route's throttling.
 * @param {number} attempt - polls done so far.
 * @returns {number} milliseconds.
 */
const pollDelay = (attempt) => Math.min(10000, 3000 + 1000 * attempt);

/**
 * Ask Rubytee until an answer turns into blocks, at most `maxTries` times. A retry
 * sends the first message and Rubytee's last answer as the history (older answers are
 * left out to keep the request small) and the reasons as the new message.
 * @param {object} params - parameters.
 * @param {string} params.first - the first message (buildTakeoverMessage).
 * @param {function(string, Array<object>): Promise<string>} params.send - asks Rubytee.
 * @param {function(string): Promise<object>} params.check - checkAnswer of a text.
 * @param {function(object): string} params.toJapanese - a problem as a line of the request.
 * @param {function(number)} [params.onTry] - told the number of each try as it starts.
 * @param {number} [params.maxTries] - tries before giving up.
 * @param {{aborted: boolean}} [params.signal] - stops between the tries.
 * @returns {Promise<{ok: boolean, text: string, result: object, tries: number}>} the
 *     answer that turned into blocks, or the last one.
 */
const runTakeover = async ({ first, send, check, toJapanese, onTry, maxTries = MAX_TAKEOVER_TRIES, signal }) => {
    let message = first;
    let history = [];
    let last = null;
    for (let tries = 1; tries <= maxTries; tries++) {
        if (signal && signal.aborted) throw new TakeoverError('CANCELLED');
        if (onTry) onTry(tries);
        const text = await send(message, history);
        if (signal && signal.aborted) throw new TakeoverError('CANCELLED');
        const result = await check(text);
        if (result.ok) return { ok: true, text, result, tries };
        last = { text, result };
        history = [
            { role: 'user', parts: [{ text: first }] },
            // A turn of the history is at most 10000 characters, as the message.
            { role: 'model', parts: [{ text: cut(text, TAKEOVER_MESSAGE_LIMIT) }] },
        ];
        message = buildTakeoverRetryMessage(result.problems.map(toJapanese));
    }
    return { ok: false, text: last.text, result: last.result, tries: maxTries };
};

const defaultSleep = (ms, signal) =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (signal)
            signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new TakeoverError('CANCELLED'));
            });
    });

const readJson = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

/**
 * One takeover call to the relay: POST /generate with purpose "genai-takeover"
 * (202 with a jobId), then GET /jobs/{jobId} until it is done. The seat is proved
 * by the student's sessionToken (sent only in a class); no email, name, classroom
 * or seat is sent.
 * @param {object} request - the request.
 * @param {string} request.userMessage - the message.
 * @param {Array<object>} [request.history] - the earlier turns.
 * @param {object} [request.stateContext] - names of the sprite, its costumes and sounds.
 * @param {?string} [request.sessionToken] - the student's session in the class.
 * @param {object} [deps] - what the call uses (replaced in the tests).
 * @param {Function} [deps.fetch] - fetch.
 * @param {string} [deps.endpoint] - the relay's URL.
 * @param {Function} [deps.sleep] - waits `ms` (rejects when the signal aborts).
 * @param {Function} [deps.now] - the clock in ms.
 * @param {?AbortSignal} [deps.signal] - cancels the call.
 * @returns {Promise<string>} Rubytee's answer.
 */
const requestTakeover = async (
    { userMessage, history = [], stateContext = {}, sessionToken = null },
    {
        fetch: fetchFn = (...args) => window.fetch(...args),
        endpoint = RUBYTEE_RELAY_ENDPOINT,
        sleep = defaultSleep,
        now = Date.now,
        signal = null,
    } = {},
) => {
    if (!endpoint) throw new TakeoverError('NO_RELAY');
    const call = async (url, init) => {
        try {
            return await fetchFn(url, { ...init, signal });
        } catch (e) {
            throw new TakeoverError(e && e.name === 'AbortError' ? 'CANCELLED' : 'NETWORK');
        }
    };
    const body = { userMessage, history, stateContext, purpose: PURPOSE };
    if (sessionToken) body.sessionToken = sessionToken;
    const posted = await call(`${endpoint}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const job = await readJson(posted);
    if (posted.status === 429) throw new TakeoverError('RATE_LIMIT_EXCEEDED', job.resetAfterSeconds || null);
    if (!posted.ok || !job.jobId) throw new TakeoverError(job.error || `HTTP_${posted.status}`);

    const start = now();
    let failures = 0;
    for (let attempt = 0; ; attempt++) {
        if (now() - start > POLL_LIMIT_MS) throw new TakeoverError('JOB_TIMEOUT');
        await sleep(pollDelay(attempt), signal);
        if (signal && signal.aborted) throw new TakeoverError('CANCELLED');
        let polled;
        try {
            polled = await call(`${endpoint}/jobs/${job.jobId}`, { method: 'GET' });
        } catch (e) {
            if (e.code === 'CANCELLED') throw e;
            failures += 1;
            if (failures >= MAX_POLL_FAILURES) throw e;
            continue;
        }
        failures = 0;
        const data = await readJson(polled);
        if (!polled.ok) throw new TakeoverError(data.error || `HTTP_${polled.status}`);
        if (data.status === 'done') return data.text || '';
        if (data.status === 'error') throw new TakeoverError(data.error || 'INTERNAL_ERROR');
    }
};

export {
    MAX_TAKEOVER_TRIES,
    TAKEOVER_MESSAGE_LIMIT,
    TakeoverError,
    buildTakeoverMessage,
    buildTakeoverRetryMessage,
    pollDelay,
    requestTakeover,
    runTakeover,
    takeoverExplanation,
};
