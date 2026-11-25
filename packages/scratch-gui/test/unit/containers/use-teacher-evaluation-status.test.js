/* eslint-env jest */
/**
 * 採点の手順の処理中の表示と、終わったときの結果 (#2419)。
 *
 * - 処理中は evalProgress に「何をしているか」（kind・課題・件数）が入る。
 * - 終わったら evalResult に短い結果が入り、うまくいったものはしばらくして消える。
 * - 失敗したら、何が失敗したかが残る（次の手順を始めるまで）。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherEvaluation from '../../../src/containers/use-teacher-evaluation.js';

const mockListSubmissions = jest.fn();
const mockEvaluateSubmissions = jest.fn();
const mockUpdateSubmission = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        // 採点の保存（#2424）: 保存は無い・保存したものをそのまま返す・メンバーは提出の席だけ
        getGrading: jest.fn(() => Promise.resolve({ grading: null })),
        putGrading: jest.fn((token, id, updates) => Promise.resolve({ grading: updates })),
        listMembers: jest.fn(() => Promise.resolve({ members: [] })),
        getAssignment: jest.fn(() => Promise.resolve({})),
        listSubmissions: (...args) => mockListSubmissions(...args),
        evaluateSubmissions: (...args) => mockEvaluateSubmissions(...args),
        updateSubmission: (...args) => mockUpdateSubmission(...args),
    },
}));

// 12 人 = AI には 10 人ずつなので 2 回に分けて送る
const submissionsOf = (count) =>
    Array.from({ length: count }, (_, i) => ({
        submissionId: `s${i + 1}`,
        memberId: `seat-${String(i + 1).padStart(2, '0')}`,
        status: 'submitted',
        projectUrl: `https://example.invalid/${i + 1}.sb3`,
    }));

const group = { groupId: 'g1', name: '技術' };
const classrooms = [{ classroomId: 'c1', groupId: 'g1', assignmentName: '迷路' }];

const setup = async () => {
    const deps = {
        idToken: 'id-token',
        classrooms,
        handleTeacher401: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || m.id || String(m) },
        setPhase: jest.fn(),
    };
    const hook = renderHook((props) => useTeacherEvaluation({ ...deps, ...props }), { initialProps: {} });
    await act(async () => {
        hook.result.current.handleShowEvaluation(group);
    });
    await act(async () => {
        hook.result.current.handleOpenAssignment(hook.result.current.evalLessons[0].classroomId);
    });
    return { hook, deps };
};

const load = async (hook) => {
    await act(async () => {
        await hook.result.current.handleLoadSubmissions();
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    mockListSubmissions.mockResolvedValue({ submissions: submissionsOf(12) });
    mockUpdateSubmission.mockResolvedValue({});
    mockEvaluateSubmissions.mockImplementation((token, id, payload) =>
        Promise.resolve({
            results: payload.submissions.map((s) =>
                payload.mode === 'grade'
                    ? { seatNumber: s.seatNumber, grade: 'A', reason: 'ok' }
                    : { seatNumber: s.seatNumber, comment: 'よくできました' },
            ),
        }),
    );
    // sb3 のダウンロードは失敗させる（セルは「要確認」で残る）
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
});

afterEach(() => {
    jest.useRealTimers();
});

describe('useTeacherEvaluation — 処理中の表示と結果 (#2419)', () => {
    test('読み込み中は課題と件数が入り、終わったら読み込んだ件数が出る', async () => {
        const { hook } = await setup();
        let listed;
        mockListSubmissions.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    listed = resolve;
                }),
        );
        let running;
        await act(async () => {
            running = hook.result.current.handleLoadSubmissions();
        });
        expect(hook.result.current.evalProgress).toEqual({
            kind: 'load',
            assignmentName: '迷路',
            done: 0,
            total: null,
        });
        await act(async () => {
            listed({ submissions: submissionsOf(12) });
            await running;
        });
        expect(hook.result.current.evalProgress).toBeNull();
        expect(hook.result.current.evalResult).toEqual({ kind: 'load', count: 12, lessons: 0 });
    });

    test('提出がまだ無いふつうの課題は「0 件の提出」で、進み具合を読んだことにしない', async () => {
        const { hook } = await setup();
        mockListSubmissions.mockResolvedValueOnce({ submissions: [] });
        await load(hook);
        expect(hook.result.current.evalResult).toEqual({ kind: 'load', count: 0, lessons: 0 });
    });

    test('AI は送っている席の範囲が入り、終わったら採点した件数が出る', async () => {
        const { hook } = await setup();
        await load(hook);
        const answers = [];
        mockEvaluateSubmissions.mockImplementation(
            (token, id, payload) =>
                new Promise((resolve) => {
                    answers.push(() =>
                        resolve({
                            results: payload.submissions.map((s) => ({ seatNumber: s.seatNumber, grade: 'A' })),
                        }),
                    );
                }),
        );
        let running;
        await act(async () => {
            running = hook.result.current.handleRunAi('grade');
        });
        expect(hook.result.current.evalProgress).toEqual({
            kind: 'grade',
            assignmentName: '迷路',
            from: 1,
            to: 10,
            total: 12,
        });
        await act(async () => {
            answers[0]();
        });
        expect(hook.result.current.evalProgress).toEqual({
            kind: 'grade',
            assignmentName: '迷路',
            from: 11,
            to: 12,
            total: 12,
        });
        await act(async () => {
            answers[1]();
            await running;
        });
        expect(hook.result.current.evalResult).toEqual({ kind: 'grade', count: 12 });
    });

    test('返却が途中で失敗したら、何件まで返したかが残る', async () => {
        const { hook } = await setup();
        await load(hook);
        await act(async () => {
            await hook.result.current.handleRunAi('comment');
        });
        expect(hook.result.current.evalResult).toEqual({ kind: 'comment', count: 12 });
        mockUpdateSubmission
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
        await act(async () => {
            await hook.result.current.handleReturnComments();
        });
        expect(hook.result.current.evalProgress).toBeNull();
        expect(hook.result.current.evalResult).toEqual({ kind: 'return', failed: true, done: 2, total: 12 });
    });

    test('うまくいった結果はしばらくして消え、失敗は残る', async () => {
        jest.useFakeTimers();
        const { hook } = await setup();
        await load(hook);
        expect(hook.result.current.evalResult).not.toBeNull();
        await act(async () => {
            jest.advanceTimersByTime(6000);
        });
        expect(hook.result.current.evalResult).toBeNull();

        mockListSubmissions.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
        await load(hook);
        expect(hook.result.current.evalResult).toEqual({ kind: 'load', failed: true });
        await act(async () => {
            jest.advanceTimersByTime(60000);
        });
        expect(hook.result.current.evalResult).toEqual({ kind: 'load', failed: true });
    });

    test('離れたら結果も消える', async () => {
        const { hook } = await setup();
        await load(hook);
        await act(async () => {
            hook.result.current.handleBackFromEvaluation();
        });
        expect(hook.result.current.evalResult).toBeNull();
    });
});
