/**
 * Unit tests for the lesson goal evaluation (src/lib/lessons/goal.js).
 * VM events are replaced by recording facts directly.
 */
import {
    compareValues,
    createFacts,
    evaluateGoal,
    matchValue,
    recordAnswer,
    recordExecution,
    recordSay,
    startRun,
    validateGoal,
} from '../../../../src/lib/lessons/goal';

const key = (k, extra = {}) => ({ hat: 'event_whenkeypressed', fields: { KEY_OPTION: k }, ...extra });
const clicked = { hat: 'event_whenthisspriteclicked', fields: {} };
const flag = { hat: 'event_whenflagclicked', fields: {} };
const received = (message) => ({ hat: 'event_whenbroadcastreceived', fields: { BROADCAST_OPTION: message } });

/**
 * Record one script run.
 * @param {object} facts - facts.
 * @param {object} trigger - hat description.
 * @param {Array} ops - [opcode, args?][] in execution order.
 * @param {object} [target] - {targetId, isStage}.
 * @returns {object} the run.
 */
const run = (facts, trigger, ops, target = { targetId: 'cat', isStage: false }) => {
    const r = startRun(facts, { trigger, ...target });
    ops.forEach(([opcode, args]) => recordExecution(facts, r, opcode, args));
    return r;
};

const snapshot = (overrides = {}) => ({
    spriteCount: 1,
    costumes: { cat: { isStage: false, count: 2 }, stage: { isStage: true, count: 1 } },
    baselineCostumes: { cat: { isStage: false, count: 2 }, stage: { isStage: true, count: 1 } },
    variables: [],
    isExtensionLoaded: () => false,
    ...overrides,
});

const satisfied = (goal, facts, snap = snapshot()) => evaluateGoal(goal, facts, snap).satisfied;

describe('matchValue / compareValues', () => {
    test('compares numbers numerically even when given as strings', () => {
        expect(compareValues('10', 9)).toBeGreaterThan(0);
        expect(compareValues('7', 7)).toBe(0);
        expect(compareValues('abc', 'ABC')).toBe(0);
    });

    test('plain value means equality, object means operators', () => {
        expect(matchValue(7, '7')).toBe(true);
        expect(matchValue('７', 7)).toBe(false);
        expect(matchValue({ gte: 3 }, 3)).toBe(true);
        expect(matchValue({ gte: 3 }, 2)).toBe(false);
        expect(matchValue({ gt: 0 }, '10')).toBe(true);
        expect(matchValue({ lt: 0 }, '-10')).toBe(true);
        expect(matchValue({ ne: 7 }, 8)).toBe(true);
        expect(matchValue({ includes: '秒' }, '3.2秒でした')).toBe(true);
        expect(matchValue({ matches: '^\\d' }, '3秒')).toBe(true);
        expect(matchValue(/秒/, '3秒')).toBe(true);
        expect(matchValue(undefined, 'anything')).toBe(true);
        expect(matchValue({ unknown: 1 }, 1)).toBe(false);
    });
});

describe('uses', () => {
    test('is satisfied when every block ran in a script started by the trigger', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenkeypressed', key: 'space' },
                blocks: ['sound_playuntildone', 'sound_play'],
            },
        ];
        const facts = createFacts();
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, key('space'), [['sound_playuntildone', { SOUND_MENU: 'Meow' }]]);
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, key('space'), [['sound_play', { SOUND_MENU: 'Owl' }]]);
        // Entries may be satisfied by different runs of the same trigger (two scripts are fine).
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('ignores scripts started from another trigger or by clicking the script', () => {
        const goal = [
            { type: 'uses', trigger: { hat: 'event_whenkeypressed', key: 'space' }, blocks: ['sound_play'] },
        ];
        const facts = createFacts();
        run(facts, key('a'), [['sound_play']]);
        run(facts, flag, [['sound_play']]);
        run(facts, key('space', { stackClick: true }), [['sound_play']]);
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, key('SPACE'), [['sound_play']]);
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('accepts "any key" scripts for a key trigger', () => {
        const goal = [
            { type: 'uses', trigger: { hat: 'event_whenkeypressed', key: 'space' }, blocks: ['sound_play'] },
        ];
        const facts = createFacts();
        run(facts, key('any'), [['sound_play']]);
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('no trigger means any hat-started script', () => {
        const goal = [{ type: 'uses', blocks: ['sound_play'] }];
        const facts = createFacts();
        run(facts, key('a', { stackClick: true }), [['sound_play']]);
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, flag, [['sound_play']]);
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('count is per run of the script', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenkeypressed', key: '1', target: 'stage' },
                blocks: ['control_repeat', { opcode: 'looks_switchbackdropto', count: 6 }],
            },
        ];
        const facts = createFacts();
        const stage = { targetId: 'stage', isStage: true };
        const three = [['control_repeat'], ...Array(3).fill(['looks_switchbackdropto', { BACKDROP: 'Canyon' }])];
        run(facts, key('1'), three, stage);
        run(facts, key('1'), three, stage);
        expect(satisfied(goal, facts)).toBe(false);
        const six = [['control_repeat'], ...Array(6).fill(['looks_switchbackdropto', { BACKDROP: 'Arctic' }])];
        run(facts, key('1'), six, { targetId: 'cat', isStage: false });
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, key('1'), six, stage);
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('args matchers look at the values the block ran with', () => {
        const goal = [
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
        ];
        const facts = createFacts();
        run(facts, key('up arrow'), [['motion_changeyby', { DY: '10' }]]);
        run(facts, key('down arrow'), [['motion_changeyby', { DY: '10' }]]);
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, key('down arrow'), [['motion_changeyby', { DY: -10 }]]);
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('distinct counts different argument values in one run', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenflagclicked' },
                blocks: ['sensing_touchingobject', { opcode: 'looks_say', distinct: 'MESSAGE', count: 2 }],
            },
        ];
        const facts = createFacts();
        const r = run(facts, flag, [
            ['control_forever'],
            ['sensing_touchingobject', { TOUCHINGOBJECTMENU: '_mouse_' }],
            ['looks_say', { MESSAGE: 'さわってみて' }],
            ['sensing_touchingobject', { TOUCHINGOBJECTMENU: '_mouse_' }],
            ['looks_say', { MESSAGE: 'さわってみて' }],
        ]);
        expect(satisfied(goal, facts)).toBe(false);
        recordExecution(facts, r, 'looks_say', { MESSAGE: 'くすぐったい！' });
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('order requires the first executions to happen in that order within one run', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenthisspriteclicked' },
                blocks: ['sensing_resettimer', 'sensing_askandwait'],
                order: ['sensing_resettimer', 'sensing_askandwait'],
            },
        ];
        const facts = createFacts();
        run(facts, clicked, [['sensing_askandwait', { QUESTION: 'name?' }], ['sensing_resettimer']]);
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, clicked, [['sensing_resettimer'], ['sensing_askandwait', { QUESTION: 'name?' }]]);
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('sentBy other requires the message to come from another target', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' },
                blocks: ['looks_sayforsecs'],
            },
        ];
        const facts = createFacts();
        run(facts, clicked, [['event_broadcast', { BROADCAST_OPTION: 'あいさつ' }]], {
            targetId: 'cat',
            isStage: false,
        });
        run(facts, received('あいさつ'), [['looks_sayforsecs', { MESSAGE: 'やあ！', SECS: 2 }]], {
            targetId: 'cat',
            isStage: false,
        });
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, received('あいさつ'), [['looks_sayforsecs', { MESSAGE: 'やあ！', SECS: 2 }]], {
            targetId: 'penguin',
            isStage: false,
        });
        expect(satisfied(goal, facts)).toBe(true);
    });

    // メッシュでほかのノード（練習相手）から届いた合図は「送る」のブロックを通らないので、送り手が記録されない（#1645）
    test('sentBy remote requires a message that no script of this project sent', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenbroadcastreceived', message: 'シマネコがよんだ', sentBy: 'remote' },
                blocks: ['looks_sayforsecs'],
            },
        ];
        const facts = createFacts();
        run(facts, clicked, [['event_broadcast', { BROADCAST_OPTION: 'シマネコがよんだ' }]], {
            targetId: 'shimacat',
            isStage: false,
        });
        run(facts, received('シマネコがよんだ'), [['looks_sayforsecs', { MESSAGE: '既読', SECS: 2 }]], {
            targetId: 'shimaraby',
            isStage: false,
        });
        expect(satisfied(goal, facts)).toBe(false);
        const fromPartner = createFacts();
        run(fromPartner, received('シマネコがよんだ'), [['looks_sayforsecs', { MESSAGE: '既読', SECS: 2 }]], {
            targetId: 'shimaraby',
            isStage: false,
        });
        expect(satisfied(goal, fromPartner)).toBe(true);
    });

    test('uses with not looks at the newest run of the trigger only (#1645)', () => {
        const goal = [
            {
                type: 'uses',
                not: true,
                trigger: { hat: 'event_whenflagclicked' },
                blocks: [{ opcode: 'data_setvariableto', args: { VALUE: /^ばか$/ } }],
            },
        ];
        const facts = createFacts();
        expect(satisfied(goal, facts)).toBe(true);
        run(facts, flag, [['data_setvariableto', { VARIABLE: 'シマラビのメッセージ', VALUE: 'こんにちは' }]]);
        expect(satisfied(goal, facts)).toBe(true);
        run(facts, flag, [['data_setvariableto', { VARIABLE: 'シマラビのメッセージ', VALUE: 'ばか' }]]);
        expect(satisfied(goal, facts)).toBe(false);
        // ほかのきっかけの実行は見ない
        run(facts, clicked, [['data_setvariableto', { VARIABLE: 'シマラビのメッセージ', VALUE: 'やあ' }]]);
        expect(satisfied(goal, facts)).toBe(false);
        // 直して旗を押し直した（新しい実行）
        run(facts, flag, [['data_setvariableto', { VARIABLE: 'シマラビのメッセージ', VALUE: 'またね' }]]);
        expect(satisfied(goal, facts)).toBe(true);
        expect(validateGoal([{ ...goal[0], not: 'yes' }])).toEqual(['goal[0]: uses.not must be true or false']);
        expect(validateGoal([{ type: 'said', text: 'a', not: true }])).toEqual(['goal[0]: not is only for uses']);
    });

    test('sentBy other also counts the mesh broadcast-with-value block as the sender', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' },
                blocks: ['looks_sayforsecs'],
            },
        ];
        const facts = createFacts();
        run(facts, clicked, [['meshV2_broadcastWithValue', { BROADCAST_OPTION: 'あいさつ', VALUE: 'hi' }]], {
            targetId: 'cat',
            isStage: false,
        });
        run(facts, received('あいさつ'), [['looks_sayforsecs', { MESSAGE: 'やあ！', SECS: 2 }]], {
            targetId: 'penguin',
            isStage: false,
        });
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('message trigger matches the received message name case-insensitively', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenbroadcastreceived', message: 'hello' },
                blocks: ['looks_say'],
            },
        ];
        const facts = createFacts();
        run(facts, received('bye'), [['looks_say', { MESSAGE: 'x' }]]);
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, received('Hello'), [['looks_say', { MESSAGE: 'x' }]]);
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('message trigger can be a list of names (either role of a pair, any locale)', () => {
        const goal = [
            {
                type: 'uses',
                trigger: {
                    hat: 'event_whenbroadcastreceived',
                    message: ['シマネコのメッセージ', 'シマラビのメッセージ', 'shimacat_message'],
                },
                blocks: ['looks_say'],
            },
        ];
        const facts = createFacts();
        run(facts, received('ほかのメッセージ'), [['looks_say', { MESSAGE: 'x' }]]);
        expect(satisfied(goal, facts)).toBe(false);
        // シマネコの役の人は、名前を入れかえて「シマラビのメッセージ」を受け取る
        run(facts, received('シマラビのメッセージ'), [['looks_say', { MESSAGE: 'x' }]]);
        expect(satisfied(goal, facts)).toBe(true);

        const en = createFacts();
        run(en, received('Shimacat_Message'), [['looks_say', { MESSAGE: 'x' }]]);
        expect(satisfied(goal, en)).toBe(true);
    });

    test('validateGoal accepts a message name or a list of names and rejects anything else', () => {
        const uses = (message) => [
            { type: 'uses', trigger: { hat: 'event_whenbroadcastreceived', message }, blocks: ['looks_say'] },
        ];
        expect(validateGoal(uses('hello'))).toEqual([]);
        expect(validateGoal(uses(['hello', 'こんにちは']))).toEqual([]);
        expect(validateGoal(uses([]))).toEqual([
            'goal[0]: trigger.message must be a message name or an array of names',
        ]);
        expect(validateGoal(uses([1]))).toEqual([
            'goal[0]: trigger.message must be a message name or an array of names',
        ]);
    });

    test('keeps only the newest runs so a long session stays bounded', () => {
        const facts = createFacts();
        for (let i = 0; i < 250; i += 1) run(facts, flag, [['looks_say', { MESSAGE: String(i) }]]);
        expect(facts.runs.length).toBe(200);
        expect(facts.runs[0].ops.looks_say.argsSeen.values().next().value.args.MESSAGE).toBe('50');
    });
});

describe('said', () => {
    test('text can be an exact string or a RegExp', () => {
        const facts = createFacts();
        recordSay(facts, { targetId: 'cat', text: 'こんにちは！' });
        expect(satisfied([{ type: 'said', text: 'こんにちは！' }], facts)).toBe(true);
        expect(satisfied([{ type: 'said', text: 'こんにちは' }], facts)).toBe(false);
        expect(satisfied([{ type: 'said', text: /こんにちは/ }], facts)).toBe(true);
    });

    test('empty text (clearing the bubble) is not recorded', () => {
        const facts = createFacts();
        recordSay(facts, { targetId: 'cat', text: '' });
        expect(facts.says).toEqual([]);
    });

    test('equalsAnswer compares the text with the latest answer', () => {
        const facts = createFacts();
        recordSay(facts, { targetId: 'cat', text: 'たろう' });
        expect(satisfied([{ type: 'said', equalsAnswer: true }], facts)).toBe(false);
        recordAnswer(facts, 'たろう');
        recordSay(facts, { targetId: 'cat', text: 'たろう' });
        expect(satisfied([{ type: 'said', equalsAnswer: true }], facts)).toBe(true);
    });

    test('answer matcher looks at the answer given before the say', () => {
        const goal = [
            { type: 'said', text: '正解です', answer: { eq: 7 } },
            { type: 'said', text: 'ちがいます', answer: { ne: 7 } },
        ];
        const facts = createFacts();
        recordSay(facts, { targetId: 'cat', text: 'ちがいます' }); // no answer yet
        recordAnswer(facts, '7');
        recordSay(facts, { targetId: 'cat', text: '正解です' });
        expect(satisfied(goal, facts)).toBe(false);
        recordAnswer(facts, '8');
        recordSay(facts, { targetId: 'cat', text: 'ちがいます' });
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('equalsVariable compares the text with the variable value at that time', () => {
        const facts = createFacts();
        recordSay(facts, { targetId: 'cat', text: 2, variables: { 回数: 3 } });
        expect(satisfied([{ type: 'said', equalsVariable: '回数' }], facts)).toBe(false);
        recordSay(facts, { targetId: 'cat', text: 3, variables: { 回数: 3 } });
        expect(satisfied([{ type: 'said', equalsVariable: '回数' }], facts)).toBe(true);
    });

    // 言った時点の変数の値（「くじが 1 のとき大吉」）と、変数と答えが同じか（「同じならあいこ」）を見る（#1642）
    test('variable checks the variable value at the time it was said', () => {
        const facts = createFacts();
        const big = [{ type: 'said', text: '大吉', variable: { name: ['くじ', 'fortune'], value: 1 } }];
        recordSay(facts, { targetId: 'cat', text: '大吉', variables: { くじ: 2 } });
        expect(satisfied(big, facts)).toBe(false);
        recordSay(facts, { targetId: 'cat', text: '小吉', variables: { くじ: 1 } });
        expect(satisfied(big, facts)).toBe(false);
        recordSay(facts, { targetId: 'cat', text: '大吉', variables: { fortune: 1 } });
        expect(satisfied(big, facts)).toBe(true);
        // 変数が無ければ合わない
        expect(satisfied([{ type: 'said', text: '大吉', variable: { name: 'ない', value: 1 } }], facts)).toBe(false);
    });

    test('variable.equalsAnswer compares the variable with the last answer (true: same, false: different)', () => {
        const same = [{ type: 'said', text: 'あいこ', variable: { name: '手', equalsAnswer: true } }];
        const differ = [{ type: 'said', text: '勝負あり', variable: { name: '手', equalsAnswer: false } }];
        const facts = createFacts();
        // まだ答えていなければどちらも合わない
        recordSay(facts, { targetId: 'cat', text: 'あいこ', variables: { 手: 0 } });
        recordSay(facts, { targetId: 'cat', text: '勝負あり', variables: { 手: 0 } });
        expect(satisfied(same, facts)).toBe(false);
        expect(satisfied(differ, facts)).toBe(false);
        recordAnswer(facts, '1');
        recordSay(facts, { targetId: 'cat', text: 'あいこ', variables: { 手: 0 } });
        recordSay(facts, { targetId: 'cat', text: '勝負あり', variables: { 手: 1 } });
        expect(satisfied(same, facts)).toBe(false);
        expect(satisfied(differ, facts)).toBe(false);
        recordSay(facts, { targetId: 'cat', text: 'あいこ', variables: { 手: 1 } });
        recordSay(facts, { targetId: 'cat', text: '勝負あり', variables: { 手: 2 } });
        expect(satisfied(same, facts)).toBe(true);
        expect(satisfied(differ, facts)).toBe(true);
    });

    test('validateGoal checks said.variable', () => {
        expect(validateGoal([{ type: 'said', variable: { name: ['くじ', 'fortune'], value: { ne: 1 } } }])).toEqual(
            [],
        );
        expect(validateGoal([{ type: 'said', variable: { name: '手', equalsAnswer: false } }])).toEqual([]);
        expect(validateGoal([{ type: 'said', variable: { name: '手' } }])).toEqual([
            'goal[0]: said.variable needs value or equalsAnswer',
        ]);
        expect(validateGoal([{ type: 'said', variable: { value: 1 } }])).toEqual([
            'goal[0]: said.variable needs a variable name or an array of names',
        ]);
        expect(validateGoal([{ type: 'said', variable: { name: '手', value: [1], equalsAnswer: 'yes' } }])).toEqual([
            'goal[0]: said.variable.value must be a matcher',
            'goal[0]: said.variable.equalsAnswer must be true or false',
        ]);
    });

    test('target restricts who said it', () => {
        const facts = createFacts();
        recordSay(facts, { targetId: 'stage', isStage: true, text: 'hi' });
        expect(satisfied([{ type: 'said', text: 'hi', target: 'sprite' }], facts)).toBe(false);
        expect(satisfied([{ type: 'said', text: 'hi', target: 'stage' }], facts)).toBe(true);
    });
});

describe('result conditions on the snapshot', () => {
    test('variable prefers the stage variable and uses a matcher', () => {
        const goal = [{ type: 'variable', name: '回数', value: { gte: 3 } }];
        const facts = createFacts();
        expect(satisfied(goal, facts, snapshot({ variables: [] }))).toBe(false);
        expect(
            satisfied(goal, facts, snapshot({ variables: [{ name: '回数', type: '', value: 2, isStage: true }] })),
        ).toBe(false);
        expect(
            satisfied(
                goal,
                facts,
                snapshot({
                    variables: [
                        { name: '回数', type: '', value: 1, isStage: false },
                        { name: '回数', type: '', value: 3, isStage: true },
                    ],
                }),
            ),
        ).toBe(true);
    });

    test('list checks length and that items came from answers', () => {
        const goal = [{ type: 'list', name: 'トーク', length: { gte: 3 }, itemsFromAnswers: true }];
        const facts = createFacts();
        ['a', 'b', 'c'].forEach((answer) => recordAnswer(facts, answer));
        const list = (value) => snapshot({ variables: [{ name: 'トーク', type: 'list', value, isStage: true }] });
        expect(satisfied(goal, facts, list(['a', 'b']))).toBe(false);
        expect(satisfied(goal, facts, list(['a', 'b', 'typed']))).toBe(false);
        expect(satisfied(goal, facts, list(['a', 'b', 'c']))).toBe(true);
    });

    test('sprites counts original sprites', () => {
        const goal = [{ type: 'sprites', min: 2 }];
        expect(satisfied(goal, createFacts(), snapshot({ spriteCount: 1 }))).toBe(false);
        expect(satisfied(goal, createFacts(), snapshot({ spriteCount: 2 }))).toBe(true);
    });

    test('costumes compares with the counts when the monitor started', () => {
        const base = { cat: { isStage: false, count: 2 }, stage: { isStage: true, count: 1 } };
        const snap = (costumes) => snapshot({ baselineCostumes: base, costumes });
        expect(satisfied([{ type: 'costumes' }], createFacts(), snap(base))).toBe(false);
        expect(
            satisfied([{ type: 'costumes' }], createFacts(), snap({ ...base, cat: { isStage: false, count: 3 } })),
        ).toBe(true);
        // a sprite added later does not count as "added a costume"
        expect(
            satisfied(
                [{ type: 'costumes' }],
                createFacts(),
                snap({ ...base, penguin: { isStage: false, count: 5 } }),
            ),
        ).toBe(false);
        // backdrops are the stage's costumes
        const twoBackdrops = { ...base, stage: { isStage: true, count: 3 } };
        expect(satisfied([{ type: 'costumes', target: 'stage', added: 2 }], createFacts(), snap(twoBackdrops))).toBe(
            true,
        );
        expect(satisfied([{ type: 'costumes', added: 2 }], createFacts(), snap(twoBackdrops))).toBe(false);
    });

    test('extension asks the snapshot', () => {
        const goal = [{ type: 'extension', id: 'text2speech' }];
        expect(satisfied(goal, createFacts(), snapshot())).toBe(false);
        expect(satisfied(goal, createFacts(), snapshot({ isExtensionLoaded: (id) => id === 'text2speech' }))).toBe(
            true,
        );
    });

    test('an empty goal or unknown condition is never satisfied', () => {
        expect(satisfied([], createFacts())).toBe(false);
        expect(satisfied([{ type: 'nope' }], createFacts())).toBe(false);
    });
});

describe('variable names given as a list (ja-Hira writes 「かいすう」)', () => {
    test('variable matches any of the names', () => {
        const goal = [{ type: 'variable', name: ['回数', 'かいすう'], value: { gte: 3 } }];
        const facts = createFacts();
        expect(
            satisfied(
                goal,
                facts,
                snapshot({ variables: [{ name: 'かいすう', type: '', value: 3, isStage: true }] }),
            ),
        ).toBe(true);
        expect(
            satisfied(goal, facts, snapshot({ variables: [{ name: 'かず', type: '', value: 3, isStage: true }] })),
        ).toBe(false);
    });

    // ja で作った作品を en で開いて「プログラムを入れる」と、「回数」と「count」の両方がある（#1514）
    test('variable passes when any of the names that exist matches, not only the first one', () => {
        const goal = [{ type: 'variable', name: ['回数', 'かいすう', 'count'], value: { gte: 3 } }];
        const both = (a, b) =>
            snapshot({
                variables: [
                    { name: '回数', type: '', value: a, isStage: true },
                    { name: 'count', type: '', value: b, isStage: true },
                ],
            });
        expect(satisfied(goal, createFacts(), both(0, 3))).toBe(true);
        expect(satisfied(goal, createFacts(), both(3, 0))).toBe(true);
        expect(satisfied(goal, createFacts(), both(1, 2))).toBe(false);
    });

    test('list passes when any of the names that exist matches', () => {
        const goal = [{ type: 'list', name: ['トーク', 'talk'], length: { gte: 3 }, itemsFromAnswers: true }];
        const facts = createFacts();
        ['a', 'b', 'c'].forEach((answer) => recordAnswer(facts, answer));
        const lists = snapshot({
            variables: [
                { name: 'トーク', type: 'list', value: [], isStage: true },
                { name: 'talk', type: 'list', value: ['a', 'b', 'c'], isStage: true },
            ],
        });
        expect(satisfied(goal, facts, lists)).toBe(true);
    });

    test('equalsVariable matches any of the names', () => {
        const goal = [{ type: 'said', equalsVariable: ['回数', 'かいすう'] }];
        const facts = createFacts();
        recordSay(facts, { targetId: 'cat', text: 2, variables: { かいすう: 3 } });
        expect(satisfied(goal, facts)).toBe(false);
        recordSay(facts, { targetId: 'cat', text: 3, variables: { かいすう: 3 } });
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('validateGoal accepts a list of names and rejects an empty one', () => {
        expect(validateGoal([{ type: 'variable', name: ['回数', 'かいすう'], value: 1 }])).toEqual([]);
        expect(validateGoal([{ type: 'said', equalsVariable: ['回数', 'かいすう'] }])).toEqual([]);
        expect(validateGoal([{ type: 'variable', name: [], value: 1 }])).toEqual([
            'goal[0]: variable.name is required',
        ]);
        expect(validateGoal([{ type: 'said', equalsVariable: [1] }])).toEqual([
            'goal[0]: said.equalsVariable must be a variable name or an array of names',
        ]);
    });
});

describe('said.trigger and variable.target (#1643)', () => {
    test('said.trigger needs the line to be said by a script started by that trigger', () => {
        const facts = createFacts();
        const send = run(facts, flag, [['event_broadcast', { BROADCAST_OPTION: 'm' }]], { targetId: 'rabbit' });
        const got = run(facts, received('m'), [['looks_sayforsecs']], { targetId: 'cat' });
        const goal = [
            { type: 'said', text: 'hello', trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' } },
        ];
        // 送った側が自分で言っても通らない
        recordSay(facts, { targetId: 'rabbit', text: 'hello', run: send });
        expect(satisfied(goal, facts)).toBe(false);
        // 言ったスクリプトが分からない（run が無い）ときも通らない
        recordSay(facts, { targetId: 'cat', text: 'hello' });
        expect(satisfied(goal, facts)).toBe(false);
        recordSay(facts, { targetId: 'cat', text: 'hello', run: got });
        expect(satisfied(goal, facts)).toBe(true);
    });

    test('variable.target "stage" looks only at the variables for all sprites', () => {
        const goal = [{ type: 'variable', name: ['気分', 'mood'], target: 'stage', value: /^うれしい$/ }];
        const local = { name: '気分', type: '', value: 'うれしい', isStage: false };
        const global = { name: 'mood', type: '', value: 'うれしい', isStage: true };
        expect(satisfied(goal, createFacts(), snapshot({ variables: [local] }))).toBe(false);
        expect(satisfied(goal, createFacts(), snapshot({ variables: [local, global] }))).toBe(true);
        const spriteGoal = [{ ...goal[0], target: 'sprite' }];
        expect(satisfied(spriteGoal, createFacts(), snapshot({ variables: [local] }))).toBe(true);
    });

    test('validateGoal checks said.trigger and variable.target', () => {
        expect(validateGoal([{ type: 'said', text: 'a', trigger: { sentBy: 'me' } }])).toEqual([
            "goal[0]: trigger.sentBy must be 'other' or 'remote'",
        ]);
        expect(validateGoal([{ type: 'variable', name: 'a', target: 'all' }])).toEqual([
            "goal[0]: variable.target must be 'stage' or 'sprite'",
        ]);
        expect(
            validateGoal([
                { type: 'said', text: 'a', trigger: { hat: 'event_whenbroadcastreceived', message: ['x'] } },
                { type: 'variable', name: 'a', target: 'stage' },
            ]),
        ).toEqual([]);
    });
});

describe('an opcode list and said.remoteValue (#1643)', () => {
    test('a block entry may be any of a list of opcodes', () => {
        const facts = createFacts();
        const goal = [
            {
                type: 'uses',
                trigger: { hat: 'event_whenkeypressed', key: 'space' },
                blocks: [
                    { opcode: ['event_broadcast', 'meshV2_broadcastWithValue'], args: { BROADCAST_OPTION: 'a' } },
                ],
            },
        ];
        run(facts, key('space'), [['event_broadcast', { BROADCAST_OPTION: 'b' }]]);
        expect(satisfied(goal, facts)).toBe(false);
        run(facts, key('space'), [['meshV2_broadcastWithValue', { BROADCAST_OPTION: 'a', VALUE: 'x' }]]);
        expect(satisfied(goal, facts)).toBe(true);
        expect(validateGoal(goal)).toEqual([]);
        expect(validateGoal([{ type: 'uses', blocks: [{ opcode: [] }] }])).toEqual([
            'goal[0].blocks[0]: opcode is required',
        ]);
    });

    test('said.remoteValue needs the line to be a value that came from another node', () => {
        const facts = createFacts();
        const goal = [{ type: 'said', text: /^(うれしい|ねむい)$/, remoteValue: true }];
        recordSay(facts, { targetId: 'cat', text: 'ねむい', remoteValues: ['うれしい'] });
        expect(satisfied(goal, facts)).toBe(false);
        recordSay(facts, { targetId: 'cat', text: 'うれしい' });
        expect(satisfied(goal, facts)).toBe(false);
        recordSay(facts, { targetId: 'cat', text: 'うれしい', remoteValues: ['ねむい', 'うれしい'] });
        expect(satisfied(goal, facts)).toBe(true);
        expect(validateGoal([{ type: 'said', text: 'a', remoteValue: 'yes' }])).toEqual([
            'goal[0]: said.remoteValue must be true or false',
        ]);
    });
});

describe('validateGoal', () => {
    test('accepts well-formed goals', () => {
        expect(
            validateGoal([
                { type: 'uses', trigger: { hat: 'event_whenflagclicked' }, blocks: ['looks_say'] },
                { type: 'said', text: 'hi' },
            ]),
        ).toEqual([]);
    });

    test('reports problems with their position', () => {
        expect(validateGoal(null)).toEqual(['goal must be a non-empty array of conditions']);
        const errors = validateGoal([
            { type: 'nope' },
            { type: 'uses', blocks: [] },
            { type: 'uses', blocks: [{ count: 0 }], trigger: { target: 'clone' } },
            { type: 'said' },
            { type: 'variable' },
            { type: 'sprites', min: 0 },
            { type: 'costumes', added: 0, target: 'clone' },
            { type: 'extension' },
        ]);
        expect(errors).toEqual([
            'goal[0]: type must be one of uses, said, variable, list, sprites, costumes, extension, moved, currentCostume, tab, partQuiz',
            'goal[1]: uses.blocks must be a non-empty array',
            'goal[2].blocks[0]: opcode is required',
            "goal[2]: trigger.target must be 'stage' or 'sprite'",
            'goal[3]: said needs text, equalsAnswer, equalsVariable, answer or variable',
            'goal[4]: variable.name is required',
            'goal[5]: sprites.min must be a positive integer',
            'goal[6]: costumes.added must be a positive integer',
            "goal[6]: costumes.target must be 'stage' or 'sprite'",
            'goal[7]: extension.id is required',
        ]);
    });
});

// The 11 challenges of lesson 1 ("ブロックのなかま"). The goals themselves go into
// courses.js with the challenge contents; here we make sure every condition can be
// written in this shape and is met by the intended program.
describe('lesson 1 goals can be written in this shape', () => {
    const cat = { targetId: 'cat', isStage: false };
    const stage = { targetId: 'stage', isStage: true };

    const cases = [
        {
            id: 'blocks-l1-key-sound',
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: 'space' },
                    blocks: [{ opcode: ['sound_playuntildone', 'sound_play'] }],
                },
            ],
            play: (facts) => run(facts, key('space'), [['sound_playuntildone', { SOUND_MENU: 'ニャー' }]]),
        },
        {
            id: 'blocks-l1-arrow-move',
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
            play: (facts) => {
                run(facts, key('up arrow'), [['motion_changeyby', { DY: 10 }]]);
                run(facts, key('down arrow'), [['motion_changeyby', { DY: -10 }]]);
            },
        },
        {
            id: 'blocks-l1-click-say',
            goal: [
                { type: 'costumes', added: 1 },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: ['looks_sayforsecs', 'looks_nextcostume'],
                },
            ],
            snapshot: snapshot({
                costumes: { cat: { isStage: false, count: 3 }, stage: { isStage: true, count: 1 } },
            }),
            play: (facts) =>
                run(facts, clicked, [
                    ['looks_sayforsecs', { MESSAGE: 'こんにちは！', SECS: 2 }],
                    ['looks_nextcostume'],
                ]),
        },
        {
            id: 'blocks-l1-repeat',
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenkeypressed', key: '1', target: 'stage' },
                    blocks: ['control_repeat', { opcode: 'looks_switchbackdropto', count: 6 }],
                },
            ],
            play: (facts) => {
                const ops = [['control_repeat', { TIMES: 3 }]];
                for (let i = 0; i < 3; i += 1) {
                    ops.push(['looks_switchbackdropto', { BACKDROP: 'Canyon' }], ['control_wait', { DURATION: 1 }]);
                    ops.push(['looks_switchbackdropto', { BACKDROP: 'Arctic' }], ['control_wait', { DURATION: 1 }]);
                }
                run(facts, key('1'), ops, stage);
            },
        },
        {
            id: 'blocks-l1-if',
            goal: [
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenflagclicked' },
                    blocks: ['sensing_touchingobject', { opcode: 'looks_say', distinct: 'MESSAGE', count: 2 }],
                },
            ],
            play: (facts) =>
                run(facts, flag, [
                    ['control_forever'],
                    ['sensing_touchingobject', { TOUCHINGOBJECTMENU: '_mouse_' }],
                    ['control_if_else'],
                    ['looks_say', { MESSAGE: 'さわってみて' }],
                    ['sensing_touchingobject', { TOUCHINGOBJECTMENU: '_mouse_' }],
                    ['control_if_else'],
                    ['looks_say', { MESSAGE: 'くすぐったい！' }],
                ]),
        },
        {
            id: 'blocks-l1-ask-answer',
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
            play: (facts) => {
                const r = run(facts, clicked, [
                    ['sensing_resettimer'],
                    ['sensing_askandwait', { QUESTION: 'なまえは？' }],
                ]);
                recordAnswer(facts, 'たろう');
                recordExecution(facts, r, 'sensing_answer');
                recordExecution(facts, r, 'looks_sayforsecs', { MESSAGE: 'たろう', SECS: 2 });
                recordSay(facts, { ...cat, text: 'たろう' });
                recordExecution(facts, r, 'sensing_timer');
                recordExecution(facts, r, 'operator_join', { STRING1: '3.21', STRING2: '秒でした' });
                recordExecution(facts, r, 'looks_sayforsecs', { MESSAGE: '3.21秒でした', SECS: 2 });
                recordSay(facts, { ...cat, text: '3.21秒でした' });
            },
        },
        {
            id: 'blocks-l1-quiz',
            goal: [
                { type: 'said', text: '正解です', answer: { eq: 7 } },
                { type: 'said', text: 'ちがいます', answer: { ne: 7 } },
            ],
            play: (facts) => {
                recordAnswer(facts, '7');
                recordSay(facts, { ...cat, text: '正解です' });
                recordAnswer(facts, '8');
                recordSay(facts, { ...cat, text: 'ちがいます' });
            },
        },
        {
            id: 'blocks-l1-count',
            goal: [
                { type: 'variable', name: '回数', value: { gte: 3 } },
                { type: 'said', equalsVariable: '回数' },
            ],
            snapshot: snapshot({ variables: [{ name: '回数', type: '', value: 3, isStage: true }] }),
            play: (facts) => {
                for (let i = 1; i <= 3; i += 1) {
                    run(facts, clicked, [['data_changevariableby', { VARIABLE: '回数', VALUE: 1 }], ['looks_say']]);
                    recordSay(facts, { ...cat, text: i, variables: { 回数: i } });
                }
            },
        },
        {
            id: 'blocks-l1-broadcast',
            goal: [
                { type: 'sprites', min: 2 },
                { type: 'uses', trigger: { hat: 'event_whenthisspriteclicked' }, blocks: ['event_broadcast'] },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenbroadcastreceived', sentBy: 'other' },
                    blocks: ['looks_sayforsecs'],
                },
            ],
            snapshot: snapshot({ spriteCount: 2 }),
            play: (facts) => {
                run(facts, clicked, [['event_broadcast', { BROADCAST_OPTION: 'あいさつ' }]], cat);
                run(facts, received('あいさつ'), [['looks_sayforsecs', { MESSAGE: 'やあ！', SECS: 2 }]], {
                    targetId: 'penguin',
                    isStage: false,
                });
            },
        },
        {
            id: 'blocks-l1-speak',
            goal: [
                { type: 'extension', id: 'text2speech' },
                {
                    type: 'uses',
                    trigger: { hat: 'event_whenthisspriteclicked' },
                    blocks: ['text2speech_speakAndWait'],
                },
            ],
            snapshot: snapshot({ isExtensionLoaded: (id) => id === 'text2speech' }),
            play: (facts) => run(facts, clicked, [['text2speech_speakAndWait', { WORDS: 'ボタンが押されました' }]]),
        },
        {
            id: 'blocks-l1-message-list',
            goal: [{ type: 'list', name: 'トーク', length: { gte: 3 }, itemsFromAnswers: true }],
            snapshot: snapshot({
                variables: [
                    { name: 'トーク', type: 'list', value: ['おはよう', 'こんにちは', 'ばいばい'], isStage: true },
                ],
            }),
            play: (facts) => {
                ['おはよう', 'こんにちは', 'ばいばい'].forEach((answer) => {
                    run(facts, clicked, [['sensing_askandwait', { QUESTION: 'メッセージは？' }]]);
                    recordAnswer(facts, answer);
                });
            },
        },
    ];

    test('covers all 11 challenges', () => {
        expect(cases.map((c) => c.id)).toHaveLength(11);
    });

    test.each(cases)(
        '$id: valid shape, unmet before, met after the intended program',
        ({ goal, play, snapshot: snap }) => {
            expect(validateGoal(goal)).toEqual([]);
            const facts = createFacts();
            expect(evaluateGoal(goal, facts, snapshot()).satisfied).toBe(false);
            play(facts);
            expect(evaluateGoal(goal, facts, snap || snapshot()).satisfied).toBe(true);
        },
    );
});

describe('variable.fromAnswer and variable.includesVariable (#1644)', () => {
    const v = (name, value, isStage = true) => ({ name, type: '', value, isStage });

    test('fromAnswer needs the value to be one of the answers (not a made variable or a fixed text)', () => {
        const goal = [{ type: 'variable', name: ['メッセージ', 'message'], target: 'stage', fromAnswer: true }];
        const facts = createFacts();
        // 作っただけの変数（0）
        expect(satisfied(goal, facts, snapshot({ variables: [v('メッセージ', 0)] }))).toBe(false);
        // 入力していない文字
        recordAnswer(facts, 'hello');
        expect(satisfied(goal, facts, snapshot({ variables: [v('メッセージ', 'こんにちは')] }))).toBe(false);
        expect(satisfied(goal, facts, snapshot({ variables: [v('message', 'hello')] }))).toBe(true);
        // 空の答えは入れたことにしない
        recordAnswer(facts, '');
        expect(satisfied(goal, facts, snapshot({ variables: [v('メッセージ', '')] }))).toBe(false);
    });

    test('includesVariable needs the value to contain the (non-empty) value of the other variable', () => {
        const goal = [{ type: 'variable', name: 'メッセージ', value: /：/, includesVariable: ['なまえ', 'name'] }];
        const facts = createFacts();
        const message = v('メッセージ', 'たろう：やあ');
        expect(satisfied(goal, facts, snapshot({ variables: [message] }))).toBe(false);
        expect(satisfied(goal, facts, snapshot({ variables: [message, v('なまえ', 'じろう')] }))).toBe(false);
        expect(satisfied(goal, facts, snapshot({ variables: [message, v('なまえ', '')] }))).toBe(false);
        expect(satisfied(goal, facts, snapshot({ variables: [message, v('name', 'たろう', false)] }))).toBe(true);
    });

    test('validateGoal checks fromAnswer and includesVariable', () => {
        expect(
            validateGoal([
                { type: 'variable', name: 'a', fromAnswer: 'yes' },
                { type: 'variable', name: 'a', includesVariable: 3 },
            ]),
        ).toEqual([
            'goal[0]: variable.fromAnswer must be true or false',
            'goal[1]: variable.includesVariable must be a variable name or an array of names',
        ]);
        expect(validateGoal([{ type: 'variable', name: 'a', fromAnswer: true, includesVariable: ['b'] }])).toEqual(
            [],
        );
    });
});

describe('lesson 0 conditions: clicks, moved, currentCostume, tab, partQuiz (#2134)', () => {
    const paletteClick = { hat: 'motion_movesteps', fields: {}, stackClick: true, palette: true };
    const areaClick = { hat: 'motion_movesteps', fields: {}, stackClick: true };
    const move = ['motion_movesteps', { STEPS: 10 }];
    const turn = ['motion_turnright', { DEGREES: 15 }];

    test('trigger.click: palette counts only the blocks clicked in the palette', () => {
        const goal = [{ type: 'uses', trigger: { click: 'palette' }, blocks: ['motion_movesteps'] }];
        const facts = createFacts();
        run(facts, areaClick, [move]);
        run(facts, flag, [move]);
        expect(evaluateGoal(goal, facts, snapshot()).satisfied).toBe(false);
        run(facts, paletteClick, [move]);
        expect(evaluateGoal(goal, facts, snapshot()).satisfied).toBe(true);
    });

    test('trigger.click: codeArea counts only the scripts clicked in the code area', () => {
        const goal = [{ type: 'uses', trigger: { click: 'codeArea' }, blocks: ['motion_movesteps'] }];
        const facts = createFacts();
        run(facts, paletteClick, [move]);
        expect(evaluateGoal(goal, facts, snapshot()).satisfied).toBe(false);
        run(facts, areaClick, [move]);
        expect(evaluateGoal(goal, facts, snapshot()).satisfied).toBe(true);
    });

    test('trigger.click: any counts clicks and hat scripts; without click, clicks do not count', () => {
        const any = [{ type: 'uses', trigger: { click: 'any' }, blocks: ['motion_movesteps'] }];
        const none = [{ type: 'uses', blocks: ['motion_movesteps'] }];
        const clicks = createFacts();
        run(clicks, paletteClick, [move]);
        expect(evaluateGoal(any, clicks, snapshot()).satisfied).toBe(true);
        expect(evaluateGoal(none, clicks, snapshot()).satisfied).toBe(false);
        const hats = createFacts();
        run(hats, flag, [move]);
        expect(evaluateGoal(any, hats, snapshot()).satisfied).toBe(true);
    });

    test('together: all the blocks ran in one run (they are snapped)', () => {
        const goal = [
            {
                type: 'uses',
                trigger: { click: 'codeArea' },
                blocks: ['motion_movesteps', 'motion_turnright'],
                together: true,
            },
        ];
        const apart = createFacts();
        run(apart, areaClick, [move]);
        run(apart, { ...areaClick, hat: 'motion_turnright' }, [turn]);
        expect(evaluateGoal(goal, apart, snapshot()).satisfied).toBe(false);
        // together が無ければ、別々の実行でもよい（いまの決まり）
        expect(evaluateGoal([{ ...goal[0], together: false }], apart, snapshot()).satisfied).toBe(true);
        const snapped = createFacts();
        run(snapped, areaClick, [move, turn]);
        expect(evaluateGoal(goal, snapped, snapshot()).satisfied).toBe(true);
    });

    test('moved: a sprite is away from where it was when the watch began', () => {
        const goal = [{ type: 'moved' }];
        const base = { baselinePositions: { cat: { x: 0, y: 0 } } };
        expect(
            evaluateGoal(goal, createFacts(), snapshot({ ...base, positions: { cat: { x: 0, y: 0 } } })).satisfied,
        ).toBe(false);
        expect(
            evaluateGoal(goal, createFacts(), snapshot({ ...base, positions: { cat: { x: 30, y: -40 } } })).satisfied,
        ).toBe(true);
        // 後から足したスプライトは見ない
        expect(
            evaluateGoal(
                goal,
                createFacts(),
                snapshot({ ...base, positions: { cat: { x: 0, y: 0 }, dog: { x: 9, y: 9 } } }),
            ).satisfied,
        ).toBe(false);
        expect(
            evaluateGoal(
                [{ type: 'moved', min: 60 }],
                createFacts(),
                snapshot({ ...base, positions: { cat: { x: 30, y: 40 } } }),
            ).satisfied,
        ).toBe(false);
    });

    test('currentCostume: number (1 from the first) and changed', () => {
        const at = (cat, stage) =>
            snapshot({
                baselineCostumes: {
                    cat: { isStage: false, count: 2, current: 0 },
                    stage: { isStage: true, count: 1, current: 0 },
                },
                costumes: {
                    cat: { isStage: false, count: 2, current: cat },
                    stage: { isStage: true, count: 2, current: stage },
                },
            });
        const second = [{ type: 'currentCostume', number: 2 }];
        expect(evaluateGoal(second, createFacts(), at(0, 0)).satisfied).toBe(false);
        expect(evaluateGoal(second, createFacts(), at(1, 0)).satisfied).toBe(true);
        const backdrop = [{ type: 'currentCostume', target: 'stage', changed: true }];
        expect(evaluateGoal(backdrop, createFacts(), at(1, 0)).satisfied).toBe(false);
        expect(evaluateGoal(backdrop, createFacts(), at(0, 1)).satisfied).toBe(true);
    });

    test('tab and partQuiz look at the editor screen (snapshot.ui)', () => {
        expect(evaluateGoal([{ type: 'tab', tab: 'code' }], createFacts(), snapshot()).satisfied).toBe(false);
        expect(
            evaluateGoal([{ type: 'tab', tab: 'code' }], createFacts(), snapshot({ ui: { activeTab: 'code' } }))
                .satisfied,
        ).toBe(true);
        const quiz = [{ type: 'partQuiz', count: 5 }];
        expect(evaluateGoal(quiz, createFacts(), snapshot({ ui: { partQuizSolved: 4 } })).satisfied).toBe(false);
        expect(evaluateGoal(quiz, createFacts(), snapshot({ ui: { partQuizSolved: 5 } })).satisfied).toBe(true);
    });

    test('validateGoal checks the new conditions', () => {
        expect(
            validateGoal([
                { type: 'uses', trigger: { click: 'menu' }, blocks: ['motion_movesteps'] },
                { type: 'uses', blocks: ['motion_movesteps'], together: 'yes' },
                { type: 'moved', min: 0 },
                { type: 'currentCostume' },
                { type: 'currentCostume', number: 0, changed: true },
                { type: 'tab', tab: 'ruby' },
                { type: 'partQuiz' },
            ]),
        ).toEqual([
            'goal[0]: trigger.click must be one of palette, codeArea, any',
            'goal[1]: uses.together must be true or false',
            'goal[2]: moved.min must be a positive number',
            'goal[3]: currentCostume needs number or changed',
            'goal[4]: currentCostume.number must be a positive integer',
            'goal[5]: tab.tab must be one of code, costumes, sounds',
            'goal[6]: partQuiz.count must be a positive integer',
        ]);
        expect(
            validateGoal([
                { type: 'moved' },
                { type: 'currentCostume', target: 'stage', changed: true },
                { type: 'tab', tab: 'code' },
                { type: 'partQuiz', count: 5 },
            ]),
        ).toEqual([]);
    });
});
