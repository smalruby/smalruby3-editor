/* eslint-env jest */
/**
 * 採点の画面を離れる前の確認 (#1923 C4・レビュー M1 / Q1 / FYI2・#2424)。
 *
 * - 採点（grade・reason）はサーバーに保存する（#2424）。消えるのは保存できなかった採点だけ。
 *   返却していない（返却したあとに変わった）コメントは画面にしか無いので確かめる。
 * - 読み込み直しはコメントの下書きを残すので、保存できなかった採点があるときだけ確かめる。
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
        hook.result.current.handleOpenAssignment(hook.result.current.evalLessons[0].classroomId);
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

    test('筋書き 1: AI → 手直し → コメント → 離れる: 返却していないコメントが消えるので確かめる', async () => {
        const hook = await setup();
        await runAi(hook, 'grade');
        act(() => hook.result.current.handleSetCellGrade(2, 'c1', 'S'));
        await runAi(hook, 'comment');
        expect(hook.result.current.unsavedWork).toEqual({ grades: false, comments: true });
        const action = jest.fn();
        act(() => hook.result.current.handleRequestLeave(action));
        expect(action).not.toHaveBeenCalled();
        expect(hook.result.current.leaveRequest).toMatchObject({ kind: 'back' });
        act(() => hook.result.current.handleConfirmLeave());
        expect(action).toHaveBeenCalledTimes(1);
        expect(hook.result.current.leaveRequest).toBeNull();
    });

    test('筋書き 2: … → 返却 → 離れる: 採点は保存してあるので確かめない', async () => {
        const hook = await setup();
        await runAi(hook, 'grade');
        await runAi(hook, 'comment');
        await act(async () => {
            await hook.result.current.handleReturnComments();
        });
        expect(hook.result.current.hasUnsavedWork).toBe(false);
        const action = jest.fn();
        act(() => hook.result.current.handleRequestLeave(action, 'leave'));
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('筋書き 3: 返却のあとにコメントを直すと、また確かめる', async () => {
        const hook = await setup();
        await runAi(hook, 'comment');
        await act(async () => {
            await hook.result.current.handleReturnComments();
        });
        act(() => hook.result.current.handleSetComment(1, 'c1', '直したコメント'));
        expect(hook.result.current.hasUnsavedWork).toBe(true);
        act(() => hook.result.current.handleSetComment(1, 'c1', 'よくできました 1'));
        expect(hook.result.current.hasUnsavedWork).toBe(false);
    });

    test('［採点を続ける］で取りやめる', async () => {
        const hook = await setup();
        await runAi(hook, 'comment');
        const action = jest.fn();
        act(() => hook.result.current.handleRequestLeave(action, 'leave'));
        act(() => hook.result.current.handleCancelLeave());
        expect(hook.result.current.leaveRequest).toBeNull();
        expect(action).not.toHaveBeenCalled();
    });

    test('読み込み直しは、保存できなかった採点があるときだけ確かめる（コメントの下書きは残る）', async () => {
        const hook = await setup();
        act(() => hook.result.current.handleSetComment(1, 'c1', '下書き'));
        const reload = jest.fn();
        act(() => hook.result.current.handleRequestLeave(reload, 'reload'));
        expect(reload).toHaveBeenCalledTimes(1);
        const classroomAPI = jest.requireMock('../../../src/lib/classroom-api.js').default;
        classroomAPI.putGrading.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
        act(() => hook.result.current.handleSetCellGrade(1, 'c1', 'B'));
        await act(async () => {
            await hook.result.current.handleConfirmGrades();
        });
        expect(hook.result.current.unsavedWork).toEqual({ grades: true, comments: true });
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

    test('離れるときは、待っている採点の保存をすぐ送る', async () => {
        const hook = await setup();
        const classroomAPI = jest.requireMock('../../../src/lib/classroom-api.js').default;
        await runAi(hook, 'grade');
        classroomAPI.putGrading.mockClear();
        act(() => hook.result.current.handleSetCellGrade(1, 'c1', 'S'));
        const action = jest.fn();
        await act(async () => {
            hook.result.current.handleRequestLeave(action, 'leave');
        });
        expect(action).toHaveBeenCalledTimes(1);
        expect(classroomAPI.putGrading).toHaveBeenCalledTimes(1);
        expect(classroomAPI.putGrading.mock.calls[0][2].grades['1']).toMatchObject({ grade: 'S', source: 'teacher' });
    });
});

describe('useTeacherEvaluation — 「AI の下書き」の印 (#1962)', () => {
    test('根拠だけを直しても点は AI のまま（gradeEdited にしない）。点を変えたときだけ gradeEdited', async () => {
        const hook = await setup();
        await runAi(hook, 'grade');
        expect(hook.result.current.getCell(1, 'c1')).toMatchObject({ grade: 'A', gradeEdited: false });
        act(() => hook.result.current.handleSetCellReason(1, 'c1', '旗で動く。音もある'));
        expect(hook.result.current.getCell(1, 'c1')).toMatchObject({ grade: 'A', manual: true, gradeEdited: false });
        act(() => hook.result.current.handleSetCellGrade(1, 'c1', 'S'));
        expect(hook.result.current.getCell(1, 'c1')).toMatchObject({ grade: 'S', gradeEdited: true });
    });
});
