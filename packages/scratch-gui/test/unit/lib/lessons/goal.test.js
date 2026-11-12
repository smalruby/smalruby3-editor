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
            'goal[0]: type must be one of uses, said, variable, list, sprites, costumes, extension',
            'goal[1]: uses.blocks must be a non-empty array',
            'goal[2].blocks[0]: opcode is required',
            "goal[2]: trigger.target must be 'stage' or 'sprite'",
            'goal[3]: said needs text, equalsAnswer, equalsVariable or answer',
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
                    blocks: ['sound_playuntildone', 'sound_play'],
                    order: ['sound_playuntildone', 'sound_play'],
                },
            ],
            play: (facts) =>
                run(facts, key('space'), [
                    ['sound_playuntildone', { SOUND_MENU: 'ニャー' }],
                    ['sound_play', { SOUND_MENU: 'Owl' }],
                ]),
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
