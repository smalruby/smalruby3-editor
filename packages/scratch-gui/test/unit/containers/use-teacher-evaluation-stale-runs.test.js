/* eslint-env jest */
/**
 * 採点の画面を離れたら、途中の処理を止める (#1950)。
 *
 * - 止めるのは、離れる確認（requestLeave）で［戻る］［離れる］を選んだとき・別のクラスの採点を
 *   開いたとき・ログアウト（クラス管理を外す＝アンマウント）・読み込み直し / AI の再実行。
 *   止めたら残りは送らず、あとから届いた結果も書き込まない。
 * - クラス管理を隠すだけ（← エディタに戻る・Esc・［作品を開く］）では止めない (#1990)。
 *   hook は生きたままなので、続きの結果がそのまま表に入る。
 * - 入り直した表に、前の実行の結果が混ざらない（ボタンも押せないままにならない）。
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
    const hook = renderHook((props) => useTeacherEvaluation({ ...deps, ...props }), { initialProps: {} });
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

/**
 * Leave through the leave question, as the screen does: ask, then［離れる］.
 * @returns {Function} the action run on leaving
 */
const leave = async (hook) => {
    const action = jest.fn(() => hook.result.current.handleBackFromEvaluation());
    await act(async () => {
        hook.result.current.handleRequestLeave(action, 'leave');
    });
    await act(async () => {
        hook.result.current.handleConfirmLeave();
    });
    return action;
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
    test('AI の途中で離れる確認を出しただけでは止めず、［採点を続ける］なら最後まで入る', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'grade');
        const action = jest.fn();

        await act(async () => {
            hook.result.current.handleRequestLeave(action, 'leave');
        });
        expect(hook.result.current.leaveRequest).toMatchObject({ kind: 'leave' });
        await act(async () => {
            hook.result.current.handleCancelLeave();
        });
        await act(async () => {
            first.resolve(
                answer(
                    { mode: 'grade', submissions: submissionsOf(10).map((_, i) => ({ seatNumber: i + 1 })) },
                    'new',
                ),
            );
            await running;
        });

        expect(action).not.toHaveBeenCalled();
        expect(grades(hook)).toHaveLength(12);
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(2);
    });

    test('AI の採点の途中で［離れる］を選ぶと、あとから届いた点は書き込まず、残りも送らない', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'grade');

        const action = await leave(hook);
        await act(async () => {
            first.resolve(answer({ mode: 'grade', submissions: [{ seatNumber: 1 }, { seatNumber: 2 }] }, 'old'));
            await running;
        });

        expect(action).toHaveBeenCalledTimes(1);
        expect(grades(hook)).toEqual([]);
        expect(hook.result.current.evalProgress).toBeNull();
        // 12 人 = 2 回のはずが、離れたので 1 回目だけ
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(1);
    });

    test('［戻る］を通らない行き先（お知らせ・課題・クラス一覧・ログアウト）でも、［離れる］で進み具合が消える', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'grade');
        // guardLeave の行き先は handleBackFromEvaluation を呼ばない
        const action = jest.fn();

        await act(async () => {
            hook.result.current.handleRequestLeave(action, 'leave');
        });
        await act(async () => {
            hook.result.current.handleConfirmLeave();
        });
        expect(action).toHaveBeenCalledTimes(1);
        expect(hook.result.current.evalProgress).toBeNull();

        await act(async () => {
            first.resolve(answer({ mode: 'grade', submissions: [{ seatNumber: 1 }] }, 'old'));
            await running;
        });
        expect(hook.result.current.evalProgress).toBeNull();
        expect(grades(hook)).toEqual([]);
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(1);
    });

    test('クラス管理を隠して戻った（hook は生きたまま）ら、続きの結果がそのまま表に入る', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'comment');

        // 隠す・開き直すは hook に何も伝えない（ClassroomTeacherModalHost が外さない）
        hook.rerender({});
        await act(async () => {
            first.resolve(
                answer(
                    { mode: 'comment', submissions: submissionsOf(10).map((_, i) => ({ seatNumber: i + 1 })) },
                    'new',
                ),
            );
            await running;
        });
        hook.rerender({});

        expect(Object.values(hook.result.current.comments)).toHaveLength(12);
        expect(hook.result.current.evalProgress).toBeNull();
        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(2);
    });

    test('ログアウトでクラス管理を外した（アンマウント）ら、残りを送らない', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'grade');

        hook.unmount();
        await act(async () => {
            first.resolve(answer({ mode: 'grade', submissions: [{ seatNumber: 1 }] }, 'old'));
            await running;
        });

        expect(mockEvaluateSubmissions).toHaveBeenCalledTimes(1);
    });

    test('［離れる］のあと入り直した表に、前の実行のコメントが混ざらない', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'comment');

        await leave(hook);
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

    test('別の課題・別のクラスの採点に切りかえたら、前の点は書き込まない', async () => {
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

    test('読み込み直したら、前の AI の点は書き込まない', async () => {
        const { hook } = await setup();
        const { first, running } = await startAiWaiting(hook, 'grade');

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
        const slow = deferred();
        mockListSubmissions.mockImplementationOnce(() => slow.promise);
        let loading;
        await act(async () => {
            loading = hook.result.current.handleLoadSubmissions();
        });
        await leave(hook);
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

    test('返却の途中で［離れる］と残りは返却せず、入り直した表にはサーバーが返却済みとした分が出る', async () => {
        const { hook } = await setup();
        await act(async () => {
            await hook.result.current.handleRunAi('comment');
        });
        // 1 人目は返却でき、2 人目の返却の答えを待っている間に離れる
        const second = deferred();
        mockUpdateSubmission.mockResolvedValueOnce({}).mockImplementationOnce(() => second.promise);
        let returning;
        await act(async () => {
            returning = hook.result.current.handleReturnComments();
        });
        await leave(hook);
        await act(async () => {
            hook.result.current.handleShowEvaluation(group);
        });
        await act(async () => {
            second.resolve({});
            await returning;
        });
        // 残りの 10 人は返却しない。入り直した（まだ読み込んでいない）表にも書き込まない
        expect(mockUpdateSubmission).toHaveBeenCalledTimes(2);
        expect(hook.result.current.matrix).toEqual({});
        expect(hook.result.current.evalProgress).toBeNull();

        // 読み込むと、サーバーの状態（返却済みの 2 人）がそのまま出る
        const all = submissionsOf(12);
        mockListSubmissions.mockResolvedValueOnce({
            submissions: all.map((s, i) =>
                i < 2 ? { ...s, status: 'returned', teacherComment: `new ${i + 1}` } : s,
            ),
        });
        await act(async () => {
            await hook.result.current.handleLoadSubmissions();
        });
        const cell = (seat) => hook.result.current.getCell(seat, 'c1');
        expect(cell(1)).toMatchObject({ returned: true, returnedComment: 'new 1' });
        expect(cell(2)).toMatchObject({ returned: true, returnedComment: 'new 2' });
        expect(cell(3)).toMatchObject({ returned: false, returnedComment: null });
        expect(hook.result.current.seats).toHaveLength(12);
    });

    test('返却をクラス管理を隠したまま最後まで終えると、返却済みが表に入る', async () => {
        const { hook } = await setup();
        await act(async () => {
            await hook.result.current.handleRunAi('comment');
        });
        hook.rerender({});
        await act(async () => {
            await hook.result.current.handleReturnComments();
        });
        hook.rerender({});

        expect(mockUpdateSubmission).toHaveBeenCalledTimes(12);
        expect(hook.result.current.getCell(12, 'c1')).toMatchObject({ returned: true, returnedComment: 'new 12' });
    });
});
