import {
    applyFairnessAnswers,
    buildDescribeRequest,
    buildFairnessRequest,
    buildGradeRequest,
    buildRubricRequest,
    descriptionSaveRequest,
    editableLevels,
    examplesFromAnswers,
    fullGradeExtras,
    gradeOfOption,
    groupChangePlan,
    normalizeLevels,
    representativesOf,
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
        const body = buildGradeRequest({ assignmentName: 'x', rubric, rubricAxes: [], works });
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
            pages: [{ text: 'LED を点ける', imageKey: 'c/assignment/a.png' }, { text: 'two' }],
            keepStarter: true,
        });
    });

    test('an assignment without pages gets one', () => {
        expect(descriptionSaveRequest(null, 'x')).toEqual({ pages: [{ text: 'x' }] });
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
