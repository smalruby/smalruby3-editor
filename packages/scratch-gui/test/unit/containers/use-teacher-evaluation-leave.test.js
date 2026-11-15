/* eslint-env jest */
/**
 * 採点の画面を離れる前の確認 (#1923 C4・レビュー M1 / Q1 / FYI2)。
 *
 * - 返却しても採点（grade・reason）はサーバーに残らない。残るのは「採点結果」の CSV だけ。
 *   だから書き出していない採点と、返却していない（返却したあとに変わった）コメントがあれば確かめる。
 * - 読み込み直しはコメントの下書きを残すので、書き出していない採点があるときだけ確かめる。
 * - AI の途中で離れるときも確かめる。
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

const submissions = [1, 2].map((n) => ({
    submissionId: `s${n}`,
    memberId: `seat-0${n}`,
    status: 'submitted',
    projectUrl: `https://example.invalid/${n}.sb3`,
}));

const setup = async (classrooms = [{ classroomId: 'c1', groupId: 'g1', assignmentName: '迷路' }]) => {
    const deps = {
        idToken: 'id-token',
        classrooms,
        handleTeacher401: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || m.id || String(m) },
        setPhase: jest.fn(),
    };
    const hook = renderHook(() => useTeacherEvaluation(deps));
    await act(async () => {
        hook.result.current.handleShowEvaluation({ groupId: 'g1', name: '技術' });
    });
    await act(async () => {
        await hook.result.current.handleLoadSubmissions();
    });
    return hook;
};

const runAi = async (hook, mode) => {
    await act(async () => {
        await hook.result.current.handleRunAi(mode);
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    mockListSubmissions.mockResolvedValue({ submissions });
    mockUpdateSubmission.mockResolvedValue({});
    mockEvaluateSubmissions.mockImplementation((token, id, payload) =>
        Promise.resolve({
            results: payload.submissions.map((s) =>
                payload.mode === 'grade'
                    ? { seatNumber: s.seatNumber, grade: 'A', reason: '旗で動く' }
                    : { seatNumber: s.seatNumber, comment: `よくできました ${s.seatNumber}` },
            ),
        }),
    );
    // sb3 のダウンロードは失敗させる（セルは「要確認」で残る）
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
    global.URL.createObjectURL = jest.fn(() => 'blob:x');
    global.URL.revokeObjectURL = jest.fn();
});

describe('useTeacherEvaluation — 離れる前の確認 (#1923 C4)', () => {
    test('読み込んだだけなら何も消えないので、すぐ離れる', async () => {
        const hook = await setup();
        expect(hook.result.current.hasUnsavedWork).toBe(false);
        const action = jest.fn();
        act(() => hook.result.current.handleRequestLeave(action));
        expect(action).toHaveBeenCalledTimes(1);
        expect(hook.result.current.leaveRequest).toBeNull();
    });

    test('筋書き 1: AI → 手直し → コメント → 返却 → 離れる: 書き出していない採点が消えるので確かめる', async () => {
        const hook = await setup();
        await runAi(hook, 'grade');
        act(() => hook.result.current.handleSetCellGrade(2, 'c1', 'S'));
        await runAi(hook, 'comment');
        await act(async () => {
            await hook.result.current.handleReturnComments();
        });
        expect(hook.result.current.getCell(1, 'c1').returnedComment).toBe('よくできました 1');
        expect(hook.result.current.hasUnsavedWork).toBe(true);
        const action = jest.fn();
        act(() => hook.result.current.handleRequestLeave(action));
        expect(action).not.toHaveBeenCalled();
        expect(hook.result.current.leaveRequest).toMatchObject({ kind: 'back' });
        act(() => hook.result.current.handleConfirmLeave());
        expect(action).toHaveBeenCalledTimes(1);
        expect(hook.result.current.leaveRequest).toBeNull();
    });

    test('筋書き 2: … → 書き出し → 返却 → 離れる: 何も消えないので確かめない', async () => {
        const hook = await setup();
        await runAi(hook, 'grade');
        await runAi(hook, 'comment');
        act(() => hook.result.current.handleExportEvaluationCsv());
        await act(async () => {
            await hook.result.current.handleReturnComments();
        });
        expect(hook.result.current.hasUnsavedWork).toBe(false);
        const action = jest.fn();
        act(() => hook.result.current.handleRequestLeave(action, 'leave'));
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('筋書き 3: 書き出し・返却のあとに採点やコメントを直すと、また確かめる', async () => {
        const hook = await setup();
        await runAi(hook, 'grade');
        await runAi(hook, 'comment');
        act(() => hook.result.current.handleExportEvaluationCsv());
        await act(async () => {
            await hook.result.current.handleReturnComments();
        });
        act(() => hook.result.current.handleSetComment(1, 'c1', '直したコメント'));
        expect(hook.result.current.hasUnsavedWork).toBe(true);
        act(() => hook.result.current.handleSetComment(1, 'c1', 'よくできました 1'));
        expect(hook.result.current.hasUnsavedWork).toBe(false);
        act(() => hook.result.current.handleSetCellReason(2, 'c1', '工夫あり'));
        expect(hook.result.current.hasUnsavedWork).toBe(true);
    });

    test('［採点を続ける］で取りやめる', async () => {
        const hook = await setup();
        await runAi(hook, 'grade');
        const action = jest.fn();
        act(() => hook.result.current.handleRequestLeave(action, 'leave'));
        act(() => hook.result.current.handleCancelLeave());
        expect(hook.result.current.leaveRequest).toBeNull();
        expect(action).not.toHaveBeenCalled();
    });

    test('読み込み直しは、書き出していない採点があるときだけ確かめる（コメントの下書きは残る）', async () => {
        const hook = await setup();
        act(() => hook.result.current.handleSetComment(1, 'c1', '下書き'));
        const reload = jest.fn();
        act(() => hook.result.current.handleRequestLeave(reload, 'reload'));
        expect(reload).toHaveBeenCalledTimes(1);
        await runAi(hook, 'grade');
        act(() => hook.result.current.handleRequestLeave(reload, 'reload'));
        expect(reload).toHaveBeenCalledTimes(1);
        expect(hook.result.current.leaveRequest).toMatchObject({ kind: 'reload' });
    });

    test('AI の途中で離れるときは、採点がまだ無くても確かめる（FYI2）', async () => {
        const hook = await setup();
        let finish;
        mockEvaluateSubmissions.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        let running;
        act(() => {
            running = hook.result.current.handleRunAi('grade');
        });
        const action = jest.fn();
        act(() => hook.result.current.handleRequestLeave(action));
        expect(action).not.toHaveBeenCalled();
        expect(hook.result.current.leaveRequest).toMatchObject({ kind: 'back' });
        expect(hook.result.current.unsavedWork).toEqual({ grades: false, comments: false });
        expect(hook.result.current.evalProgress).not.toBeNull();
        await act(async () => {
            finish({ results: [] });
            await running;
        });
    });

    test('選択を外した課題の採点も数える: 離れる・読み込み直すと確かめる（レビュー M2）', async () => {
        const hook = await setup([
            { classroomId: 'c1', groupId: 'g1', assignmentName: '迷路' },
            { classroomId: 'c2', groupId: 'g1', assignmentName: 'ボール' },
        ]);
        await runAi(hook, 'grade');
        act(() => hook.result.current.handleToggleLesson('c2'));
        expect(hook.result.current.selectedLessonIds).toEqual(['c1']);
        // c1 だけ書き出しても、c2 の採点は書き出していない
        act(() => hook.result.current.handleExportEvaluationCsv());
        expect(hook.result.current.unsavedWork).toEqual({ grades: true, comments: false });
        const leave = jest.fn();
        act(() => hook.result.current.handleRequestLeave(leave, 'leave'));
        expect(leave).not.toHaveBeenCalled();
        act(() => hook.result.current.handleCancelLeave());
        const reload = jest.fn();
        act(() => hook.result.current.handleRequestLeave(reload, 'reload'));
        expect(reload).not.toHaveBeenCalled();
        expect(hook.result.current.leaveRequest).toMatchObject({ kind: 'reload' });
    });

    test('読み込み直しの確認で［読み込み直す］を押すと、その時の選択で読み込む（FYI1）', async () => {
        const hook = await setup([
            { classroomId: 'c1', groupId: 'g1', assignmentName: '迷路' },
            { classroomId: 'c2', groupId: 'g1', assignmentName: 'ボール' },
        ]);
        await runAi(hook, 'grade');
        act(() => hook.result.current.handleRequestLeave(hook.result.current.handleLoadSubmissions, 'reload'));
        act(() => hook.result.current.handleToggleLesson('c2'));
        mockListSubmissions.mockClear();
        await act(async () => {
            hook.result.current.handleConfirmLeave();
        });
        expect(mockListSubmissions.mock.calls.map((call) => call[1])).toEqual(['c1']);
    });
});
