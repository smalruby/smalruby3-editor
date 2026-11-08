import {
    MAX_TAKEOVER_TRIES,
    TAKEOVER_MESSAGE_LIMIT,
    TakeoverError,
    buildRubyTabTakeoverMessage,
    buildTakeoverMessage,
    buildTakeoverRetryMessage,
    pollDelay,
    requestTakeover,
    runTakeover,
    takeoverExplanation,
} from '../../../src/lib/genai-takeover.js';

const programs = [
    {
        name: 'ネコ',
        code: 'when_flag_clicked do\n  move(10)\nend\n',
        sounds: ['ニャー'],
        costumes: ['コスチューム1'],
    },
    { name: 'ステージ', code: '', sounds: [], costumes: ['背景1'] },
];

const base = {
    kindLabel: '思ったとおりに動かない',
    text: '旗を押したら鳴いてほしいのに、鳴かない',
    programs,
    editingName: 'ネコ',
    exchanges: [
        {
            question: '最初の質問文',
            answer: '1 回目の答え play(name: "ワン")',
            problems: ['1 行目: 音「ワン」はありません'],
        },
        { question: '書き直しのお願い', answer: '2 回目の答え', problems: ['2 行目: 文法のまちがい'] },
    ],
};

describe('buildTakeoverMessage', () => {
    test('has the trouble, the whole program, and every question, answer and reason', () => {
        const message = buildTakeoverMessage(base);
        expect(message).toContain('思ったとおりに動かない');
        expect(message).toContain('旗を押したら鳴いてほしいのに、鳴かない');
        expect(message).toContain('# 「ネコ」');
        expect(message).toContain('move(10)');
        expect(message).toContain('音: "ニャー"');
        expect(message).toContain('最初の質問文');
        expect(message).toContain('1 回目の答え');
        expect(message).toContain('書き直しのお願い');
        expect(message).toContain('2 回目の答え');
        expect(message).toContain('2 行目: 文法のまちがい');
        expect(message).toContain('「ネコ」');
    });

    test('lists the sprites with no blocks too, so their names can be used', () => {
        expect(buildTakeoverMessage(base)).toContain('# 「ステージ」');
        expect(buildTakeoverMessage(base)).toContain('（まだブロックはありません）');
    });

    test('keeps within the relay limit by cutting the oldest exchanges first', () => {
        const long = 'あ'.repeat(4000);
        const message = buildTakeoverMessage({
            ...base,
            exchanges: [
                { question: `古い質問${long}`, answer: `古い答え${long}`, problems: ['古い理由'] },
                { question: '新しい質問', answer: `新しい答え${long}`, problems: ['新しい理由'] },
            ],
        });
        expect(message.length).toBeLessThanOrEqual(TAKEOVER_MESSAGE_LIMIT);
        expect(message).toContain('新しい理由');
        expect(message).toContain('新しい答え');
        expect(message).toContain('（長いので省略）');
    });

    test('keeps within the relay limit when the latest exchange is cut and an older one is left out', () => {
        const long = 'あ'.repeat(5000);
        const message = buildTakeoverMessage({
            ...base,
            exchanges: [
                { question: `古い質問${long}`, answer: `古い答え${long}`, problems: ['古い理由'] },
                { question: `新しい質問${long}`, answer: `新しい答え${long}`, problems: ['新しい理由'] },
            ],
        });
        expect(message.length).toBeLessThanOrEqual(TAKEOVER_MESSAGE_LIMIT);
        expect(message).toContain('新しい理由');
        expect(message).toContain('（これより前の相談は、長いので省略）');
        expect(message).not.toContain('古い理由');
    });

    test('leaves the consultation out when only the program fits', () => {
        // About 30 characters short of the limit: no room even for the consultation's title.
        const code = `${'move(10)\n'.repeat(1000)}# ${'x'.repeat(658)}`;
        const message = buildTakeoverMessage({
            ...base,
            programs: [{ name: 'ネコ', code, sounds: [], costumes: [] }],
        });
        expect(message.length).toBeLessThanOrEqual(TAKEOVER_MESSAGE_LIMIT);
        expect(message).toContain('move(10)');
        expect(message).not.toContain('【生成AI への相談');
    });

    test('is null when the program alone does not fit', () => {
        const huge = [{ name: 'ネコ', code: 'move(10)\n'.repeat(1500), sounds: [], costumes: [] }];
        expect(buildTakeoverMessage({ ...base, programs: huge })).toBeNull();
    });
});

describe('buildRubyTabTakeoverMessage', () => {
    const rubyTab = {
        mode: 'ruby',
        kindLabel: '思ったとおりに動かない',
        text: '旗を押したら鳴いてほしい',
        editingName: 'ネコ',
        code: 'when_flag_clicked do\n  move(1)\nend\n',
        sounds: ['ニャー'],
        costumes: ['コスチューム1'],
        others: [
            { name: 'イヌ', code: 'when_receive("合図") do\n  say("ワン")\nend\n', sounds: [], costumes: [] },
            { name: 'ステージ', code: '', sounds: [], costumes: ['背景1'] },
        ],
        exchanges: base.exchanges,
    };

    test('asks to fix only the sprite in the editor, from the code in the editor', () => {
        const message = buildRubyTabTakeoverMessage(rubyTab);
        expect(message).toContain('直すのは「ネコ」だけです');
        expect(message).toContain('# 「ネコ」');
        expect(message).toContain('move(1)');
        expect(message).toContain('音: "ニャー"');
        expect(message).toContain('ほかのスプライトのプログラムは書かないでください');
        expect(message).toContain('旗を押したら鳴いてほしい');
    });

    test('has the other sprites with code as reference, and leaves out those without', () => {
        const message = buildRubyTabTakeoverMessage(rubyTab);
        expect(message).toContain('【参考：ほかのスプライトのプログラム（直さないでください）】');
        expect(message).toContain('# 「イヌ」');
        expect(message).toContain('say("ワン")');
        expect(message).not.toContain('# 「ステージ」');
    });

    test('has every question, answer and reason of the consultation', () => {
        const message = buildRubyTabTakeoverMessage(rubyTab);
        expect(message).toContain('最初の質問文');
        expect(message).toContain('2 回目の答え');
        expect(message).toContain('2 行目: 文法のまちがい');
    });

    test('asks for easy words in furigana mode, and for Ruby words in Ruby mode', () => {
        expect(buildRubyTabTakeoverMessage({ ...rubyTab, mode: 'furigana' })).toContain('やさしいことば');
        expect(buildRubyTabTakeoverMessage(rubyTab)).not.toContain('やさしいことば');
        expect(buildRubyTabTakeoverMessage(rubyTab)).toContain('Ruby の書き方で');
    });

    test('says so when the sprite has no program yet', () => {
        expect(buildRubyTabTakeoverMessage({ ...rubyTab, code: '' })).toContain('（まだプログラムはありません）');
    });

    test('keeps within the relay limit by cutting the oldest exchanges first', () => {
        const long = 'あ'.repeat(5000);
        const message = buildRubyTabTakeoverMessage({
            ...rubyTab,
            exchanges: [
                { question: `古い質問${long}`, answer: `古い答え${long}`, problems: ['古い理由'] },
                { question: `新しい質問${long}`, answer: `新しい答え${long}`, problems: ['新しい理由'] },
            ],
        });
        expect(message.length).toBeLessThanOrEqual(TAKEOVER_MESSAGE_LIMIT);
        expect(message).toContain('新しい理由');
        expect(message).toContain('（これより前の相談は、長いので省略）');
        expect(message).not.toContain('古い理由');
        expect(message).toContain('say("ワン")');
    });

    test('leaves the references out when they do not fit with the sprite', () => {
        const others = [{ name: 'イヌ', code: 'say("ワン")\n'.repeat(1000), sounds: [], costumes: [] }];
        const message = buildRubyTabTakeoverMessage({ ...rubyTab, others });
        expect(message.length).toBeLessThanOrEqual(TAKEOVER_MESSAGE_LIMIT);
        expect(message).toContain('move(1)');
        expect(message).not.toContain('say("ワン")');
    });

    test('is null when the sprite alone does not fit', () => {
        expect(buildRubyTabTakeoverMessage({ ...rubyTab, code: 'move(10)\n'.repeat(1500) })).toBeNull();
    });
});

describe('buildTakeoverRetryMessage', () => {
    test('says why the last answer could not be turned into blocks', () => {
        const message = buildTakeoverRetryMessage(['3 行目: 命令のまちがい']);
        expect(message).toContain('3 行目: 命令のまちがい');
        expect(message).toContain('▼▼');
        expect(message.length).toBeGreaterThanOrEqual(10);
    });
});

describe('takeoverExplanation', () => {
    test('is the text before the code', () => {
        const text =
            '音を鳴らす命令を足しました。\n▼▼ ここから下をコピーして ▼▼\n```ruby\nmove(10)\n```\n▲▲ ここまで ▲▲';
        expect(takeoverExplanation(text)).toBe('音を鳴らす命令を足しました。');
    });

    test('is empty without the copy marker', () => {
        expect(takeoverExplanation('```ruby\nmove(10)\n```')).toBe('');
    });
});

describe('pollDelay', () => {
    test('starts at 3 seconds and grows to 10', () => {
        expect(pollDelay(0)).toBe(3000);
        expect(pollDelay(1)).toBe(4000);
        expect(pollDelay(20)).toBe(10000);
    });
});

describe('runTakeover', () => {
    const okResult = { ok: true, problems: [] };
    const ngResult = { ok: false, problems: [{ type: 'raw', count: 1 }] };
    const toJa = () => '1 か所が、ブロックになりませんでした';

    test('returns the first answer that turns into blocks', async () => {
        const send = jest.fn().mockResolvedValue('答え');
        const check = jest.fn().mockResolvedValue(okResult);
        const out = await runTakeover({ first: '最初', send, check, toJapanese: toJa });
        expect(out).toEqual({ ok: true, text: '答え', result: okResult, tries: 1 });
        expect(send).toHaveBeenCalledWith('最初', []);
    });

    test('asks again with the reasons and the last answer as history', async () => {
        const send = jest.fn().mockResolvedValueOnce('答え1').mockResolvedValueOnce('答え2');
        const check = jest.fn().mockResolvedValueOnce(ngResult).mockResolvedValueOnce(okResult);
        const out = await runTakeover({ first: '最初', send, check, toJapanese: toJa });
        expect(out.ok).toBe(true);
        expect(out.tries).toBe(2);
        const [message, history] = send.mock.calls[1];
        expect(message).toContain('1 か所が、ブロックになりませんでした');
        expect(history).toEqual([
            { role: 'user', parts: [{ text: '最初' }] },
            { role: 'model', parts: [{ text: '答え1' }] },
        ]);
    });

    test('keeps only the first question and the latest answer in the history', async () => {
        const send = jest.fn().mockResolvedValue('答え');
        const check = jest.fn().mockResolvedValue(ngResult);
        const out = await runTakeover({ first: '最初', send, check, toJapanese: toJa });
        expect(out.ok).toBe(false);
        expect(out.tries).toBe(MAX_TAKEOVER_TRIES);
        expect(send).toHaveBeenCalledTimes(MAX_TAKEOVER_TRIES);
        expect(send.mock.calls[MAX_TAKEOVER_TRIES - 1][1]).toHaveLength(2);
        expect(out.result).toBe(ngResult);
    });

    test('tells each try as it starts', async () => {
        const send = jest.fn().mockResolvedValue('答え');
        const check = jest.fn().mockResolvedValue(ngResult);
        const onTry = jest.fn();
        await runTakeover({ first: '最初', send, check, toJapanese: toJa, onTry, maxTries: 2 });
        expect(onTry.mock.calls).toEqual([[1], [2]]);
    });

    test('stops when cancelled', async () => {
        const signal = { aborted: false };
        const send = jest.fn().mockImplementation(async () => {
            signal.aborted = true;
            return '答え';
        });
        const check = jest.fn().mockResolvedValue(ngResult);
        await expect(runTakeover({ first: '最初', send, check, toJapanese: toJa, signal })).rejects.toMatchObject({
            code: 'CANCELLED',
        });
        expect(send).toHaveBeenCalledTimes(1);
    });
});

describe('requestTakeover', () => {
    const json = (status, body) => ({ status, ok: status < 300, json: () => Promise.resolve(body) });
    const sleep = jest.fn().mockResolvedValue();
    const JOB = '3b241101-e2bb-4255-8caf-4136c566a962';

    test('posts the takeover with the sessionToken and fetches the answer', async () => {
        const fetchFn = jest
            .fn()
            .mockResolvedValueOnce(json(202, { jobId: JOB, status: 'pending' }))
            .mockResolvedValueOnce(json(200, { jobId: JOB, status: 'pending' }))
            .mockResolvedValueOnce(json(200, { jobId: JOB, status: 'done', text: '答え' }));
        const text = await requestTakeover(
            { userMessage: 'まかせる', history: [], stateContext: {}, sessionToken: 'tok' },
            { fetch: fetchFn, endpoint: 'https://relay', sleep },
        );
        expect(text).toBe('答え');
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe('https://relay/generate');
        const body = JSON.parse(init.body);
        expect(body).toEqual({
            userMessage: 'まかせる',
            history: [],
            stateContext: {},
            purpose: 'genai-takeover',
            sessionToken: 'tok',
        });
        expect(fetchFn.mock.calls[1][0]).toBe(`https://relay/jobs/${JOB}`);
    });

    test('sends no sessionToken outside a class (and never an email, classroom or seat)', async () => {
        const fetchFn = jest
            .fn()
            .mockResolvedValueOnce(json(202, { jobId: JOB }))
            .mockResolvedValueOnce(json(200, { status: 'done', text: '答え' }));
        await requestTakeover(
            { userMessage: 'まかせる', history: [], stateContext: {}, sessionToken: null },
            { fetch: fetchFn, endpoint: 'https://relay', sleep },
        );
        const body = JSON.parse(fetchFn.mock.calls[0][1].body);
        expect(Object.keys(body).sort()).toEqual(['history', 'purpose', 'stateContext', 'userMessage']);
    });

    test('turns a 429 into RATE_LIMIT_EXCEEDED with the wait', async () => {
        const fetchFn = jest
            .fn()
            .mockResolvedValue(json(429, { error: 'RATE_LIMIT_EXCEEDED', resetAfterSeconds: 120 }));
        await expect(
            requestTakeover({ userMessage: 'まかせる' }, { fetch: fetchFn, endpoint: 'https://relay', sleep }),
        ).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', resetAfterSeconds: 120 });
    });

    test('turns an error of the job into its code', async () => {
        const fetchFn = jest
            .fn()
            .mockResolvedValueOnce(json(202, { jobId: JOB }))
            .mockResolvedValueOnce(json(200, { status: 'error', error: 'AI_OVERLOADED' }));
        const error = await requestTakeover(
            { userMessage: 'まかせる' },
            { fetch: fetchFn, endpoint: 'https://relay', sleep },
        ).catch((e) => e);
        expect(error).toBeInstanceOf(TakeoverError);
        expect(error.code).toBe('AI_OVERLOADED');
    });

    test('turns a 400 of the post into its code', async () => {
        const fetchFn = jest.fn().mockResolvedValue(json(400, { error: 'INVALID_INPUT' }));
        await expect(
            requestTakeover({ userMessage: 'まかせる' }, { fetch: fetchFn, endpoint: 'https://relay', sleep }),
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    test('gives up when the job stays pending too long', async () => {
        const fetchFn = jest
            .fn()
            .mockResolvedValueOnce(json(202, { jobId: JOB }))
            .mockResolvedValue(json(200, { status: 'pending' }));
        let now = 0;
        const clock = () => now;
        const slow = jest.fn().mockImplementation(async (ms) => {
            now += ms;
        });
        await expect(
            requestTakeover(
                { userMessage: 'まかせる' },
                { fetch: fetchFn, endpoint: 'https://relay', sleep: slow, now: clock },
            ),
        ).rejects.toMatchObject({ code: 'JOB_TIMEOUT' });
    });

    test('keeps asking through a passing network failure of a poll', async () => {
        const fetchFn = jest
            .fn()
            .mockResolvedValueOnce(json(202, { jobId: JOB }))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(json(200, { status: 'done', text: '答え' }));
        await expect(
            requestTakeover({ userMessage: 'まかせる' }, { fetch: fetchFn, endpoint: 'https://relay', sleep }),
        ).resolves.toBe('答え');
    });

    test('is a NO_RELAY error without an endpoint', async () => {
        await expect(
            requestTakeover({ userMessage: 'まかせる' }, { fetch: jest.fn(), endpoint: '' }),
        ).rejects.toMatchObject({ code: 'NO_RELAY' });
    });
});
