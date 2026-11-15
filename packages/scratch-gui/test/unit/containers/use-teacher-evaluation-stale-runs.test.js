/* eslint-env jest */
/**
 * 採点の画面を離れたら、途中の処理を止める (#1950)。
 *
 * - AI の採点・下書きの途中で離れたら、残りは送らず、あとから届いた結果も書き込まない。
 * - 入り直した表に、前の実行の結果が混ざらない（ボタンも押せないままにならない）。
 * - 離れ方は［戻る］・ほかの画面（phase）へ移る・クラス管理を閉じる（アンマウント）・別のクラスを開く。
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

const answer = (payload, label) => ({
    results: payload.submissions.map((s) =>
        payload.mode === 'grade'
            ? { seatNumber: s.seatNumber, grade: 'A', reason: `${label} ${s.seatNumber}` }
            : { seatNumber: s.seatNumber, comment: `${label} ${s.seatNumber}` },
    ),
});

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
    const hook = renderHook((props) => useTeacherEvaluation({ ...deps, ...props }), {
        initialProps: { phase: 'teacher-evaluation' },
    });
    await act(async () => {
        hook.result.current.handleShowEvaluation(group);
    });
    await act(async () => {
        await hook.result.current.handleLoadSubmissions();
    });
    return { hook, deps };
};

/** Start the AI and leave it waiting for the first answer. */
const startAiWaiting = async (hook, mode) => {
    const first = deferred();
    mockEvaluateSubmissions.mockImplementationOnce(() => first.promise);
    let running;
    await act(async () => {
        running = hook.result.current.handleRunAi(mode);
    });
    expect(hook.result.current.evalProgress).not.toBeNull();
    return { first, running };
};

const grades = (hook) =>
    Object.values(hook.result.current.matrix)
        .map((cell) => cell.grade)
        .filter(Boolean);

beforeEach(() => {
    jest.clearAllMocks();
    mockListSubmissions.mockResolvedValue({ submissions: submissionsOf(12) });
    mockUpdateSubmission.mockResolvedValue({});
    mockEvaluateSubmissions.mockImplementation((token, id, payload) => Promise.resolve(answer(payload, 'new')));
    // sb3 のダウンロードは失敗させる（セルは「要確認」で残る）
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
});

describe('useTeacherEvaluation — 離れたら途中の処理を止める (#1950)', () => {
    test('AI の採点の途中で［戻る］と、あとから届いた点は書き込まず、残りも送らない', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'grade');

        await act(async () => {
            hook.result.current.handleBackFromEvaluation();
        });
        await act(async () => {
            first.resolve(answer({ mode: 'grade', submissions: [{ seatNumber: 1 }, { seatNumber: 2 }] }, 'old'));
            await running;
        });

        expect(grades(hook)).toEqual([]);
        expect(hook.result.current.evalProgress).toBeNull();
        // 12 人 = 2 回のはずが、離れたので 1 回目だけ
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(1);
    });

    test('ほかの画面へ移った（phase が変わった）ら止まる', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'comment');

        await act(async () => {
            hook.rerender({ phase: 'teacher-notifications' });
        });
        await act(async () => {
            first.resolve(answer({ mode: 'comment', submissions: [{ seatNumber: 1 }] }, 'old'));
            await running;
        });

        expect(hook.result.current.comments).toEqual({});
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(1);
    });

    test('クラス管理を閉じた（アンマウント）ら、残りを送らない', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'grade');

        hook.unmount();
        await act(async () => {
            first.resolve(answer({ mode: 'grade', submissions: [{ seatNumber: 1 }] }, 'old'));
            await running;
        });

        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(1);
    });

    test('入り直した表に、前の実行のコメントが混ざらない', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'comment');

        // 離れて、同じクラスに入り直して読み込む
        await act(async () => {
            hook.result.current.handleBackFromEvaluation();
        });
        await act(async () => {
            hook.result.current.handleShowEvaluation(group);
        });
        await act(async () => {
            await hook.result.current.handleLoadSubmissions();
        });
        // 前の実行の答えが、入り直したあとに届く
        await act(async () => {
            first.resolve(answer({ mode: 'comment', submissions: [{ seatNumber: 1 }, { seatNumber: 2 }] }, 'old'));
            await running;
        });

        expect(hook.result.current.comments).toEqual({});
        // ボタンが押せないままにならない
        expect(hook.result.current.evalProgress).toBeNull();

        // 入り直した表で走らせた AI の結果は入る
        await act(async () => {
            await hook.result.current.handleRunAi('comment');
        });
        const values = Object.values(hook.result.current.comments);
        expect(values).toHaveLength(12);
        expect(values.every((c) => c.startsWith('new '))).toBe(true);
    });

    test('別のクラスを開いたら、前のクラスの点は書き込まない', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'grade');

        await act(async () => {
            hook.result.current.handleShowEvaluation(group);
        });
        await act(async () => {
            await hook.result.current.handleLoadSubmissions();
        });
        await act(async () => {
            first.resolve(answer({ mode: 'grade', submissions: [{ seatNumber: 1 }, { seatNumber: 2 }] }, 'old'));
            await running;
        });

        expect(grades(hook)).toEqual([]);
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(1);
    });

    test('読み込みの途中で離れて入り直すと、前の読み込みの表で上書きしない', async () => {
        const { hook } = await setup();
        await act(async () => {
            hook.result.current.handleBackFromEvaluation();
        });
        await act(async () => {
            hook.result.current.handleShowEvaluation(group);
        });

        const slow = deferred();
        mockListSubmissions.mockImplementationOnce(() => slow.promise);
        let loading;
        await act(async () => {
            loading = hook.result.current.handleLoadSubmissions();
        });
        await act(async () => {
            hook.result.current.handleBackFromEvaluation();
        });
        await act(async () => {
            hook.result.current.handleShowEvaluation(group);
        });
        await act(async () => {
            slow.resolve({ submissions: submissionsOf(3) });
            await loading;
        });

        expect(hook.result.current.matrix).toEqual({});
        expect(hook.result.current.seats).toEqual([]);
        expect(hook.result.current.evalProgress).toBeNull();
    });

    test('離れずに最後まで走れば、2 回に分けた結果がどちらも入る', async () => {
        const { hook } = await setup();
        await act(async () => {
            await hook.result.current.handleRunAi('grade');
        });
        expect(grades(hook)).toHaveLength(12);
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(2);
    });
});
