/* eslint-env jest */
/**
 * 課題の採点の［基準］のタブ (EPIC #2421 / #2425)。useTeacherEvaluation の中で使う。
 *
 * - 提出を読み込むと、スターターを読み、作品をまとまりに分けて代表を出す。
 * - 全員の採点に、スターターを渡し、点にまとまりを付けて保存する。
 * - 代表に正解を付けて基準を保存すると、正解の例も PUT /grading の rubric に入る。
 * - 説明が空なら AI の案を出し、［合っている（課題に保存）］で PUT /assignment に保存する。
 * - 全員の採点のあとに 1 件を直すと、同じまとまりも直すかを聞く。
 * - ほかの課題の基準を読み、コピーする。
 */
import { act, renderHook } from '@testing-library/react';
import JSZip from 'jszip';
import useTeacherEvaluation from '../../../src/containers/use-teacher-evaluation.js';

const mockGetGrading = jest.fn();
const mockPutGrading = jest.fn();
const mockGetAssignment = jest.fn();
const mockSetAssignment = jest.fn();
const mockEvaluateSubmissions = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getGrading: (...args) => mockGetGrading(...args),
        putGrading: (...args) => mockPutGrading(...args),
        listMembers: () => Promise.resolve({ members: [] }),
        getAssignment: (...args) => mockGetAssignment(...args),
        setAssignment: (...args) => mockSetAssignment(...args),
        listSubmissions: () =>
            Promise.resolve({
                submissions: [1, 2, 3, 4].map((n) => ({
                    submissionId: `s${n}`,
                    memberId: `seat-0${n}`,
                    status: 'submitted',
                    projectUrl: `https://example.invalid/${n}.sb3`,
                })),
            }),
        evaluateSubmissions: (...args) => mockEvaluateSubmissions(...args),
        updateSubmission: jest.fn(() => Promise.resolve({})),
    },
}));
// project.json carries its pseudocode directly: the analyzer is tested elsewhere.
jest.mock('../../../src/lib/classroom-evaluation/sb3-analyzer.js', () => ({
    ...jest.requireActual('../../../src/lib/classroom-evaluation/sb3-analyzer.js'),
    analyzeProject: (json) => ({ signals: {}, pseudocode: json.pseudocode }),
}));

const STARTER = [
    '=== スプライト: ロボット ===',
    '◆ スクリプト:',
    '    緑の旗が押されたとき',
    '    左の LED を点ける',
    '',
].join('\n');
const script = (...lines) => ['◆ スクリプト:', ...lines.map((l) => `    ${l}`), ''].join('\n');
const SERVO = script('スペース キーが押されたとき', 'サーボを 90 度に曲げる（1 秒）');
const MOTOR = script('スペース キーが押されたとき', 'モーターで進む（0.5 秒で止まる）');
const PSEUDO = {
    'https://example.invalid/1.sb3': `${STARTER}${SERVO}`,
    'https://example.invalid/2.sb3': `${STARTER}${SERVO}`,
    'https://example.invalid/3.sb3': `${STARTER}${SERVO}`,
    'https://example.invalid/4.sb3': `${STARTER}${MOTOR}`,
    'https://example.invalid/starter.sb3': STARTER,
};

const sb3 = async (pseudocode) => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify({ pseudocode }));
    return zip.generateAsync({ type: 'arraybuffer' });
};

const group = { groupId: 'g1', name: '技術' };
const classrooms = [
    { classroomId: 'a1', groupId: 'g1', assignmentName: '04_モーター', createdAt: '2026-11-01T00:00:00Z' },
    { classroomId: 'b1', groupId: 'g2', assignmentName: '04_モーター', className: '技術2' },
];

const setup = async () => {
    const deps = {
        idToken: 'id-token',
        classrooms,
        groups: [{ groupId: 'g2', name: '技術', year: 2026, section: '2組' }],
        handleTeacher401: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || m.id || String(m) },
        setPhase: jest.fn(),
    };
    const hook = renderHook(() => useTeacherEvaluation(deps));
    await act(async () => {
        hook.result.current.handleShowEvaluation(group);
    });
    await act(async () => {
        hook.result.current.handleOpenAssignment('a1');
    });
    await act(async () => {
        await hook.result.current.handleLoadSubmissions();
    });
    await act(async () => {
        await hook.result.current.rubricTools.loadStarter();
    });
    return { hook, deps };
};

const tools = (hook) => hook.result.current.rubricTools;

beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockGetGrading.mockResolvedValue({ grading: null });
    mockPutGrading.mockImplementation((token, id, updates) => Promise.resolve({ grading: { ...updates } }));
    mockGetAssignment.mockResolvedValue({
        assignment: {
            pages: [{ text: '', imageKey: 'a1/assignment/i.png', imageUrl: 'https://x' }],
            starterKey: 'a1/assignment/s.sb3',
            starterUrl: 'https://example.invalid/starter.sb3',
        },
        lesson: null,
    });
    mockSetAssignment.mockResolvedValue({});
    mockEvaluateSubmissions.mockImplementation((token, id, payload) => {
        if (payload.mode === 'describe') return Promise.resolve({ description: 'サーボを動かす' });
        if (payload.mode === 'rubric') return Promise.resolve({ levels: [{ grade: 'B', text: 'サーボを動かす' }] });
        return Promise.resolve({
            results: payload.submissions.map((s) => ({ seatNumber: s.seatNumber, grade: 'B', reason: 'ok' })),
        });
    });
    global.fetch = jest.fn(async (url) => ({ ok: true, arrayBuffer: () => sb3(PSEUDO[url]) }));
});

describe('useGradingRubric (#2425)', () => {
    test('読み込むとスターターを読み、まとまりと代表を出す', async () => {
        const { hook } = await setup();
        expect(tools(hook).starter.status).toBe('ready');
        expect(tools(hook).starterPseudocode).toBe(STARTER);
        expect(tools(hook).groups.map((g) => g.seatNumbers)).toEqual([[1, 2, 3], [4]]);
        expect(tools(hook).representatives.map((r) => r.seatNumber)).toEqual([1, 4]);
    });

    test('全員の採点にスターターを渡し、点にまとまりを付けて保存する', async () => {
        const { hook } = await setup();
        jest.useFakeTimers();
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(mockEvaluateSubmissions.mock.calls[0][2].starterPseudocode).toBe(STARTER);
        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        const grades = mockPutGrading.mock.calls[0][2].grades;
        expect(grades['1']).toMatchObject({ grade: 'B', group: 'サーボだけ' });
        expect(grades['4']).toMatchObject({ grade: 'B', group: 'モーターだけ' });
    });

    test('1 件を直すと同じまとまりも直すかを聞き、［変える］でそろえる', async () => {
        const { hook } = await setup();
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        act(() => hook.result.current.handleSetCellGrade(1, 'a1', 'A'));
        expect(tools(hook).groupPrompt).toMatchObject({ group: 'サーボだけ', seats: [2, 3], grade: 'A' });
        act(() => tools(hook).handleApplyGroupChange());
        expect(tools(hook).groupPrompt).toBeNull();
        expect(hook.result.current.getCell(2, 'a1')).toMatchObject({ grade: 'A', gradeEdited: true });
        expect(hook.result.current.getCell(4, 'a1')).toMatchObject({ grade: 'B' });
    });

    test('代表に正解を付けて基準を保存すると、正解の例も保存する', async () => {
        const { hook } = await setup();
        act(() => tools(hook).handleSetAnswer(1, { grade: 'B', reason: 'サーボだけ' }));
        await act(async () => {
            await tools(hook).handleDraftRubric();
        });
        expect(mockEvaluateSubmissions.mock.calls[0][2]).toMatchObject({
            mode: 'rubric',
            starterPseudocode: STARTER,
        });
        expect(tools(hook).levels.find((l) => l.grade === 'B').text).toBe('サーボを動かす');
        await act(async () => {
            await tools(hook).handleSaveRubric();
        });
        const rubric = mockPutGrading.mock.calls[0][2].rubric;
        expect(rubric.levels).toEqual([{ grade: 'B', text: 'サーボを動かす' }]);
        expect(rubric.examples).toEqual([
            expect.objectContaining({ seatNumber: 1, grade: 'B', reason: 'サーボだけ', group: 'サーボだけ' }),
        ]);
        expect(hook.result.current.currentGrading.rubric).toEqual(rubric);
    });

    test('説明が空なら AI の案を出し、［合っている］で課題に保存する（画像とスターターは残す）', async () => {
        const { hook } = await setup();
        await act(async () => {
            await tools(hook).handleDescribe();
        });
        expect(mockEvaluateSubmissions.mock.calls[0][2]).toMatchObject({
            mode: 'describe',
            assignmentName: '04_モーター',
        });
        expect(tools(hook).description).toEqual({ status: 'proposed', text: 'サーボを動かす' });
        await act(async () => {
            await tools(hook).handleUseDescription('サーボを動かす', true);
        });
        expect(mockSetAssignment).toHaveBeenCalledWith('id-token', 'a1', {
            pages: [{ text: 'サーボを動かす', imageKey: 'a1/assignment/i.png' }],
            keepStarter: true,
        });
        expect(tools(hook).description.status).toBe('saved');
        expect(hook.result.current.currentLesson.assignmentText).toBe('サーボを動かす');
    });

    test('［保存せず、この採点だけで使う］は課題に保存しない', async () => {
        const { hook } = await setup();
        await act(async () => {
            await tools(hook).handleUseDescription('LED', false);
        });
        expect(mockSetAssignment).not.toHaveBeenCalled();
        expect(hook.result.current.currentLesson.assignmentText).toBe('LED');
    });

    test('ほかの課題の基準を読んでコピーする', async () => {
        const { hook } = await setup();
        expect(tools(hook).copyClasses).toEqual([
            {
                key: 'g2',
                label: '技術 2026年度 / 2組',
                assignments: [{ classroomId: 'b1', assignmentName: '04_モーター' }],
            },
        ]);
        const source = { levels: [{ grade: 'S', text: '両方' }], examples: [] };
        mockGetGrading.mockResolvedValueOnce({ grading: { rubric: source } });
        let read = null;
        await act(async () => {
            read = await tools(hook).handleReadCopySource('b1');
        });
        expect(read).toEqual(source);
        await act(async () => {
            await tools(hook).handleCopyRubric(read);
        });
        expect(mockPutGrading).toHaveBeenLastCalledWith('id-token', 'a1', { rubric: source });
    });
});
