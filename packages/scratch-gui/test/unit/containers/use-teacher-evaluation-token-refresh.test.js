/* eslint-env jest */
/**
 * 採点の長い処理（読み込み・AI・返却）は、送るたびにその時点の ID トークンを使う (#1993)。
 *
 * クラス管理は閉じても隠して残る (#1990) ので、途中でログインし直すとトークンが新しくなる。
 * 続きの送信は、始めたときのトークンではなく新しいトークンで送る。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherEvaluation from '../../../src/containers/use-teacher-evaluation.js';

const mockListSubmissions = jest.fn();
const mockEvaluateSubmissions = jest.fn();
const mockUpdateSubmission = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
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

const deferred = () => {
    let resolve;
    const promise = new Promise((r) => {
        resolve = r;
    });
    return { promise, resolve };
};

const answer = (payload) => ({
    results: payload.submissions.map((s) =>
        payload.mode === 'grade'
            ? { seatNumber: s.seatNumber, grade: 'A', reason: 'ok' }
            : { seatNumber: s.seatNumber, comment: `good ${s.seatNumber}` },
    ),
});

const group = { groupId: 'g1', name: '技術' };
const classrooms = [
    { classroomId: 'c1', groupId: 'g1', assignmentName: '迷路' },
    { classroomId: 'c2', groupId: 'g1', assignmentName: '迷路 2' },
];

const setup = async () => {
    const deps = {
        idToken: 'old-token',
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
        await hook.result.current.handleLoadSubmissions();
    });
    return { hook, deps };
};

const tokensOf = (mock) => mock.mock.calls.map((call) => call[0]);

beforeEach(() => {
    jest.clearAllMocks();
    mockListSubmissions.mockResolvedValue({ submissions: submissionsOf(12) });
    mockUpdateSubmission.mockResolvedValue({});
    mockEvaluateSubmissions.mockImplementation((token, id, payload) => Promise.resolve(answer(payload)));
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
});

describe('useTeacherEvaluation — 途中でトークンが新しくなったら続きは新しいトークンで送る (#1993)', () => {
    test.each(['grade', 'comment'])('AI（%s）の続きは新しいトークンで送る', async (mode) => {
        const { hook, deps } = await setup();
        const first = deferred();
        mockEvaluateSubmissions.mockImplementationOnce(() => first.promise);
        let running;
        await act(async () => {
            running = hook.result.current.handleRunAi(mode);
        });

        // 1 回目の答えを待っている間にログインし直した（クラス管理は隠れたまま残る）
        hook.rerender({ idToken: 'new-token' });
        await act(async () => {
            first.resolve(answer({ mode, submissions: [{ seatNumber: 1 }] }));
            await running;
        });

        // 2 課題 × 2 回（10 人 + 2 人）
        expect(tokensOf(mockEvaluateSubmissions)).toEqual(['old-token', 'new-token', 'new-token', 'new-token']);
        expect(deps.handleTeacher401).not.toHaveBeenCalled();
    });

    test('返却の続きは新しいトークンで送る', async () => {
        const { hook, deps } = await setup();
        await act(async () => {
            await hook.result.current.handleRunAi('comment');
        });
        const first = deferred();
        mockUpdateSubmission.mockImplementationOnce(() => first.promise);
        let returning;
        await act(async () => {
            returning = hook.result.current.handleReturnComments();
        });

        hook.rerender({ idToken: 'new-token' });
        await act(async () => {
            first.resolve({});
            await returning;
        });

        const tokens = tokensOf(mockUpdateSubmission);
        expect(tokens).toHaveLength(24);
        expect(tokens[0]).toBe('old-token');
        expect(tokens.slice(1).every((t) => t === 'new-token')).toBe(true);
        expect(deps.handleTeacher401).not.toHaveBeenCalled();
    });

    test('読み込みの続き（次の課題）は新しいトークンで読む', async () => {
        const { hook } = await setup();
        mockListSubmissions.mockClear();
        const first = deferred();
        mockListSubmissions.mockImplementationOnce(() => first.promise);
        let loading;
        await act(async () => {
            loading = hook.result.current.handleLoadSubmissions();
        });

        hook.rerender({ idToken: 'new-token' });
        await act(async () => {
            first.resolve({ submissions: submissionsOf(2) });
            await loading;
        });

        expect(tokensOf(mockListSubmissions)).toEqual(['old-token', 'new-token']);
    });

    test('古いトークンで 401 になったときは、これまでどおりログインし直しに進む', async () => {
        const { hook, deps } = await setup();
        mockEvaluateSubmissions.mockImplementationOnce(() =>
            Promise.reject(Object.assign(new Error('x'), { status: 401 })),
        );
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });

        expect(deps.handleTeacher401).toHaveBeenCalledTimes(1);
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(1);
    });
});
