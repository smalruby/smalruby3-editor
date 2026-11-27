import { DEFAULT_RUBRIC_AXES } from '../../../../src/lib/classroom-evaluation/evaluation-utils';
import {
    applyFairnessAnswers,
    buildDescribeRequest,
    buildFairnessRequest,
    buildGradeRequest,
    buildRubricRequest,
    copiedDescriptionDraft,
    descriptionSaveRequest,
    editableLevels,
    examplesFromAnswers,
    fullGradeExtras,
    gradeOfOption,
    gradingCriteriaFor,
    gradesWithoutExamples,
    groupChangePlan,
    normalizeLevels,
    representativesOf,
    rubricStepStates,
    rubricToSave,
    worksOf,
} from '../../../../src/lib/classroom-evaluation/grading-ai';

const STARTER = [
    '=== スプライト: ロボット ===',
    '◆ スクリプト:',
    '    緑の旗が押されたとき',
    '    左の LED を点ける',
    '',
].join('\n');
const script = (...lines) => ['◆ スクリプト:', ...lines.map((l) => `    ${l}`), ''].join('\n');
const work = (...scripts) => [STARTER, ...scripts].join('\n');
const SERVO_90 = script('スペース キーが押されたとき', 'サーボを 90 度に曲げる（1 秒）');
const SERVO_120 = script('スペース キーが押されたとき', 'サーボを 120 度に曲げる（1 秒）');
const MOTOR = script('スペース キーが押されたとき', 'モーターで進む（0.5 秒で止まる）');

const cells = {
    1: { submitted: true, pseudocode: work(SERVO_90), signals: { a: 1 } },
    2: { submitted: true, pseudocode: work(SERVO_120), signals: {} },
    3: { submitted: true, pseudocode: work(SERVO_90), signals: {} },
    4: { submitted: true, pseudocode: work(MOTOR), signals: {} },
    5: { submitted: true, pseudocode: STARTER, signals: {} },
    6: { submitted: false },
};
const seats = [1, 2, 3, 4, 5, 6, 7];
const getCell = (seat) => cells[seat] || null;

describe('worksOf', () => {
    test('takes the submitted works and what they added to the starter', () => {
        const works = worksOf({ seats, getCell, starterPseudocode: STARTER });
        expect(works.map((w) => w.seatNumber)).toEqual([1, 2, 3, 4, 5]);
        expect(works[0].added).toEqual(['スペース キーが押されたとき\nサーボを 90 度に曲げる（1 秒）']);
        expect(works[4]).toMatchObject({ added: [], code: '（スターターのまま）' });
    });
});

describe('representativesOf', () => {
    test('one per group, the largest group first and the unchanged last', () => {
        const works = worksOf({ seats, getCell, starterPseudocode: STARTER });
        const { groups, representatives } = representativesOf(works);
        expect(groups).toHaveLength(3);
        expect(representatives.map((r) => r.seatNumber)).toEqual([1, 4, 5]);
        expect(representatives[0]).toMatchObject({ name: 'サーボだけ', size: 3 });
        expect(representatives[0].code).toContain('サーボを 90 度');
    });

    test('at most 8', () => {
        const many = Array.from({ length: 12 }, (_, i) => ({
            seatNumber: i + 1,
            added: [`緑の旗が押されたとき\n謎の命令${'abcdefghijkl'[i]}`],
            code: '',
        }));
        const { groups, representatives } = representativesOf(many);
        expect(groups).toHaveLength(12);
        expect(representatives).toHaveLength(8);
    });

    test('with shape tags, one per shape named by its tags; the group stays the operations', () => {
        const LED = { tags: ['明るさで LED を切りかえ', 'しきい値 300'], key: '明るさで LED を切りかえ' };
        const LED_400 = { tags: ['明るさで LED を切りかえ', 'しきい値 400'], key: '明るさで LED を切りかえ' };
        const LED_MOTOR = {
            tags: ['明るさで LED を切りかえ', 'モーター'],
            key: '明るさで LED を切りかえ / モーター',
        };
        const shaped = {
            1: { ...cells[1], shape: LED },
            2: { ...cells[2], shape: LED_400 },
            3: { ...cells[3], shape: LED },
            4: { ...cells[4], shape: LED_MOTOR },
            5: { ...cells[5], shape: { tags: ['スターターのまま'], key: 'スターターのまま' } },
        };
        const works = worksOf({ seats, getCell: (seat) => shaped[seat] || null, starterPseudocode: STARTER });
        const { groups, representatives } = representativesOf(works);
        // The groups saved with the grades are still the groups of operations.
        expect(groups.map((g) => g.name).sort()).toEqual(['サーボだけ', 'スターターのまま', 'モーターだけ'].sort());
        expect(representatives.map((r) => [r.seatNumber, r.name, r.size])).toEqual([
            [1, '明るさで LED を切りかえ', 3],
            [4, '明るさで LED を切りかえ / モーター', 1],
            [5, 'スターターのまま', 1],
        ]);
        expect(representatives[1].group).toBe('モーターだけ');
        // The example keeps the group of operations, as the grades do.
        const examples = examplesFromAnswers(representatives, { 4: { grade: 'S', reason: '' } });
        expect(examples[0].group).toBe('モーターだけ');
    });

    test('a work without shape tags: the groups of operations are used', () => {
        const partly = { ...cells, 1: { ...cells[1], shape: { tags: ['LED'], key: 'LED' } } };
        const works = worksOf({ seats, getCell: (seat) => partly[seat] || null, starterPseudocode: STARTER });
        const { representatives } = representativesOf(works);
        expect(representatives.map((r) => r.name)).toEqual(['サーボだけ', 'モーターだけ', 'スターターのまま']);
    });
});

describe('request builders', () => {
    const works = worksOf({ seats, getCell, starterPseudocode: STARTER });

    test('describe sends at most 5 works and the starter', () => {
        const body = buildDescribeRequest({ assignmentName: '02_LED', starterPseudocode: STARTER, works });
        expect(body.mode).toBe('describe');
        expect(body.starterPseudocode).toBe(STARTER);
        expect(body.submissions).toHaveLength(5);
        expect(body.submissions[0]).toEqual({ seatNumber: 1, signals: { a: 1 }, pseudocode: works[0].pseudocode });
        expect(buildDescribeRequest({ assignmentName: 'x', works: [] })).toBeNull();
    });

    test('grade adds the levels and examples of the rubric, and leaves out an empty starter', () => {
        const rubric = { levels: [{ grade: 'B', text: 'b' }], examples: [{ seatNumber: 1, grade: 'B' }] };
        const body = buildGradeRequest({ assignmentName: 'x', rubric, works });
        expect(body).toMatchObject({ mode: 'grade', rubricLevels: rubric.levels, examples: rubric.examples });
        expect(body).not.toHaveProperty('starterPseudocode');
        expect(body.submissions).toHaveLength(5);
    });

    test('the full-class grading gets the starter and the group of each seat', () => {
        const { groups } = representativesOf(works);
        const extras = fullGradeExtras({ starterPseudocode: STARTER, groups });
        expect(extras.payload).toEqual({ starterPseudocode: STARTER });
        expect(extras.groupBySeat).toMatchObject({ 1: 'サーボだけ', 2: 'サーボだけ', 5: 'スターターのまま' });
        expect(fullGradeExtras({ groups: [] }).payload).toEqual({});
    });

    test('fairness sends the other works of each group, not the examples', () => {
        const { groups, representatives } = representativesOf(works);
        const examples = examplesFromAnswers(representatives, { 1: { grade: 'B', reason: 'r' } });
        expect(examples).toEqual([
            { seatNumber: 1, grade: 'B', reason: 'r', group: 'サーボだけ', code: representatives[0].code },
        ]);
        const body = buildFairnessRequest({ assignmentName: 'x', examples, groups, works });
        expect(body.mode).toBe('fairness');
        const servo = body.groups.find((g) => g.name === 'サーボだけ');
        expect(servo.seatNumbers).toEqual([1, 2, 3]);
        expect(servo.submissions.map((s) => s.seatNumber)).toEqual([2, 3]);
        expect(buildFairnessRequest({ assignmentName: 'x', examples: [], groups, works })).toBeNull();
    });

    test('fairness keeps to 20 works, spread over the groups', () => {
        const big = Array.from({ length: 30 }, (_, i) => ({
            seatNumber: i + 1,
            code: '',
            pseudocode: '',
            signals: {},
        }));
        const groups = [
            { name: 'a', seatNumbers: big.slice(0, 25).map((w) => w.seatNumber) },
            { name: 'b', seatNumbers: [26, 27, 28] },
        ];
        const body = buildFairnessRequest({
            assignmentName: 'x',
            examples: [{ seatNumber: 1, grade: 'B' }],
            groups,
            works: big,
        });
        const counts = body.groups.map((g) => g.submissions.length);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(20);
        expect(counts[1]).toBe(3);
    });

    test('rubric puts the fairness answers into the description', () => {
        const body = buildRubricRequest({
            assignmentName: 'x',
            assignmentText: 'LED を点ける',
            examples: [{ seatNumber: 1, grade: 'B' }],
            levels: [{ grade: 'C', text: '' }],
            notes: ['20 番は？ → A'],
        });
        expect(body.assignmentText).toBe('LED を点ける\n\n先生の判断:\n- 20 番は？ → A');
        expect(body).not.toHaveProperty('rubricLevels');
        expect(buildRubricRequest({ assignmentName: 'x', examples: [] })).toBeNull();
    });
});

describe('fairness answers', () => {
    test.each([
        ['20 番は A', 'A'],
        ['1 番と同じ B', 'B'],
        ['C のまま', 'C'],
        ['A か B', null],
        ['そのまま', null],
    ])('%s → %s', (option, grade) => {
        expect(gradeOfOption(option)).toBe(grade);
    });

    test('an answer about one seat becomes an example; all answers become notes', () => {
        const works = [{ seatNumber: 20, code: 'code20' }];
        const result = applyFairnessAnswers({
            checks: [
                { question: '20 番は戻している', options: ['20 番は A', '1 番と同じ B'], seatNumbers: [1, 20] },
                { question: 'どちら？', options: ['x', 'y'], seatNumbers: [1] },
            ],
            answers: { 0: '20 番は A', 1: 'x' },
            examples: [{ seatNumber: 1, grade: 'B' }],
            groupBySeat: { 20: 'サーボだけ' },
            works,
        });
        expect(result.examples).toHaveLength(2);
        expect(result.examples[1]).toMatchObject({ seatNumber: 20, grade: 'A', group: 'サーボだけ', code: 'code20' });
        expect(result.notes).toEqual(['20 番は戻している → 20 番は A', 'どちら？ → x']);
    });
});

describe('levels and the saved rubric', () => {
    test('normalizes to S → C, one per grade, without empty texts', () => {
        expect(
            normalizeLevels([
                { grade: 'C', text: ' c ' },
                { grade: 'S', text: 's' },
                { grade: 'S', text: 'dup' },
                { grade: 'A', text: '' },
                { grade: 'X', text: 'x' },
            ]),
        ).toEqual([
            { grade: 'S', text: 's' },
            { grade: 'C', text: 'c' },
        ]);
        expect(editableLevels([{ grade: 'B', text: 'b' }]).map((l) => l.text)).toEqual(['', '', 'b', '']);
    });

    test('cuts the examples to the sizes the server accepts', () => {
        const rubric = rubricToSave(
            [{ grade: 'B', text: 'b' }],
            [{ seatNumber: 1, grade: 'B', reason: 'r'.repeat(400), group: 'g'.repeat(100), code: 'c'.repeat(5000) }],
        );
        expect(rubric.examples[0].reason).toHaveLength(300);
        expect(rubric.examples[0].group).toHaveLength(80);
        expect(rubric.examples[0].code).toHaveLength(4000);
    });
});

describe('descriptionSaveRequest', () => {
    test('puts the text into the first page and keeps the images and the starter', () => {
        const body = descriptionSaveRequest(
            {
                pages: [
                    { text: '', imageKey: 'c/assignment/a.png', imageUrl: 'https://x' },
                    { text: 'two', imageKey: null },
                ],
                starterKey: 'c/assignment/s.sb3',
            },
            ' LED を点ける ',
        );
        expect(body).toEqual({
            pages: [{ text: 'LED を点ける', imageKey: 'c/assignment/a.png' }],
            keepStarter: true,
        });
    });

    test('replaces a written description of several pages: the other pages keep only their images (#2456)', () => {
        const body = descriptionSaveRequest(
            {
                pages: [{ text: 'one' }, { text: 'two', imageKey: 'c/assignment/b.png' }, { text: 'three' }],
            },
            'new',
        );
        expect(body).toEqual({ pages: [{ text: 'new' }, { text: '', imageKey: 'c/assignment/b.png' }] });
    });

    test('an assignment without pages gets one', () => {
        expect(descriptionSaveRequest(null, 'x')).toEqual({ pages: [{ text: 'x' }] });
    });
});

describe('copiedDescriptionDraft', () => {
    test('the copied description, cut to one page', () => {
        expect(copiedDescriptionDraft(' サーボ ', '')).toBe('サーボ');
        expect(copiedDescriptionDraft('あ'.repeat(600), '')).toHaveLength(500);
    });

    test('none when it is the same as this assignment or empty', () => {
        expect(copiedDescriptionDraft('LED を点ける', ' LED を点ける ')).toBe('');
        expect(copiedDescriptionDraft('', 'x')).toBe('');
    });
});

describe('groupChangePlan', () => {
    const groupBySeat = { 1: 'サーボだけ', 2: 'サーボだけ', 3: 'サーボだけ', 4: 'モーターだけ' };
    const grades = { 1: 'A', 2: 'B', 3: 'B', 4: 'B' };
    const gradeOf = (s) => grades[s] || null;

    test('the other seats of the group that had the old grade', () => {
        expect(groupChangePlan({ seat: 2, from: 'B', to: 'A', groupBySeat, seats: [1, 2, 3, 4], gradeOf })).toEqual({
            group: 'サーボだけ',
            seats: [3],
            grade: 'A',
        });
    });

    test('nothing to ask', () => {
        expect(
            groupChangePlan({ seat: 4, from: 'B', to: 'A', groupBySeat, seats: [1, 2, 3, 4], gradeOf }),
        ).toBeNull();
        expect(groupChangePlan({ seat: 2, from: 'B', to: 'B', groupBySeat, seats: [1, 2, 3], gradeOf })).toBeNull();
        expect(groupChangePlan({ seat: 2, from: null, to: 'A', groupBySeat, seats: [1, 2, 3], gradeOf })).toBeNull();
        expect(groupChangePlan({ seat: 9, from: 'B', to: 'A', groupBySeat, seats: [9], gradeOf })).toBeNull();
    });
});

describe('gradingCriteriaFor (#2455 F2: no criteria on the screen)', () => {
    test('with the S/A/B/C sentences, no criteria are sent: the rubric and the examples grade', () => {
        expect(gradingCriteriaFor({ levels: [{ grade: 'S', text: 's' }] })).toEqual({
            rubricAxes: [],
            strictness: 'standard',
        });
    });

    test('without a rubric, the fixed criteria are sent (it runs, the requirements, extra ideas)', () => {
        for (const rubric of [null, {}, { levels: [], examples: [{ seatNumber: 1, grade: 'B' }] }]) {
            const criteria = gradingCriteriaFor(rubric);
            expect(criteria.rubricAxes).toBe(DEFAULT_RUBRIC_AXES);
            expect(criteria.rubricAxes.map((a) => a.name)).toEqual(['動くこと', '課題の要件', '工夫']);
            expect(criteria.strictness).toBe('standard');
        }
    });

    test('the grade request of the representatives follows the same rule', () => {
        const works = worksOf({ seats: [1], getCell, starterPseudocode: STARTER });
        expect(buildGradeRequest({ assignmentName: 'x', rubric: null, works }).rubricAxes).toBe(DEFAULT_RUBRIC_AXES);
        const withLevels = buildGradeRequest({
            assignmentName: 'x',
            rubric: { levels: [{ grade: 'B', text: 'b' }] },
            works,
        });
        expect(withLevels.rubricAxes).toEqual([]);
        expect(withLevels.strictness).toBe('standard');
    });
});

describe('rubricStepStates (#2455 F1: the inner steps 2-1 → 2-4)', () => {
    const base = { hasDescription: false, repsTotal: 3, repsDone: 0, fairness: null, saved: false };
    const states = (patch) => rubricStepStates({ ...base, ...patch });

    test('at the start, 2-1 is the current step and the rest are not yet', () => {
        expect(states({})).toEqual({ describe: 'now', examples: 'todo', fairness: 'todo', sentences: 'todo' });
    });

    test('a description moves the current step to 2-2', () => {
        expect(states({ hasDescription: true })).toMatchObject({ describe: 'done', examples: 'now' });
    });

    test('a description draft (copied or proposed by the AI) keeps 2-1 the current step (#2456)', () => {
        expect(states({ hasDescription: true, descriptionDraft: true })).toMatchObject({
            describe: 'now',
            examples: 'todo',
        });
    });

    test('every representative with an answer moves it to 2-3', () => {
        expect(states({ hasDescription: true, repsDone: 3 })).toMatchObject({ examples: 'done', fairness: 'now' });
        expect(states({ hasDescription: true, repsDone: 2 })).toMatchObject({ examples: 'now', fairness: 'todo' });
    });

    test('the fairness is done when every question is answered', () => {
        const done = { hasDescription: true, repsDone: 3 };
        const asked = { checks: [{ question: 'q' }, { question: 'r' }], answers: { 0: 'x' } };
        expect(states({ ...done, fairness: asked }).fairness).toBe('now');
        expect(states({ ...done, fairness: { ...asked, answers: { 0: 'x', 1: 'y' } } }).fairness).toBe('done');
    });

    test('with no question, 2-3 waits for the teacher’s［次へ］(#2521)', () => {
        const done = { hasDescription: true, repsDone: 3 };
        expect(states({ ...done, fairness: { checks: [], answers: {} } })).toMatchObject({
            fairness: 'now',
            sentences: 'todo',
        });
        expect(states({ ...done, fairness: { checks: [], answers: {}, confirmed: true } })).toMatchObject({
            fairness: 'done',
            sentences: 'now',
        });
    });

    test('saving the sentences finishes 2-4; a step done out of order stays done', () => {
        expect(
            states({
                hasDescription: true,
                repsDone: 3,
                fairness: { checks: [], answers: {}, confirmed: true },
                saved: true,
            }),
        ).toEqual({ describe: 'done', examples: 'done', fairness: 'done', sentences: 'done' });
        // Without a description yet, the answered representatives still count as done.
        expect(states({ repsDone: 3 })).toEqual({
            describe: 'now',
            examples: 'done',
            fairness: 'todo',
            sentences: 'todo',
        });
    });

    test('no representative (not loaded / nothing submitted) keeps 2-2 not done', () => {
        expect(states({ hasDescription: true, repsTotal: 0 }).examples).toBe('now');
    });
});

describe('gradesWithoutExamples', () => {
    test('the grades no example has, in S/A/B/C order', () => {
        expect(gradesWithoutExamples([{ grade: 'C' }, { grade: 'B' }, { grade: 'B' }])).toEqual(['S', 'A']);
        expect(gradesWithoutExamples([{ grade: 'S' }, { grade: 'A' }, { grade: 'B' }, { grade: 'C' }])).toEqual([]);
        expect(gradesWithoutExamples(undefined)).toEqual(['S', 'A', 'B', 'C']);
    });
});
