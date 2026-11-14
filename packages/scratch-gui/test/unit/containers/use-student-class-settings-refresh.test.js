/* eslint-env jest */
/**
 * ページを開いたときにクラスの AI 設定（生成AI・ルビティー）を読み直す (#1279)。
 */
import { renderHook, waitFor } from '@testing-library/react';
import useStudentClassSettingsRefresh from '../../../src/containers/use-student-class-settings-refresh.js';

const mockVerifySession = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: { verifySession: (...args) => mockVerifySession(...args) },
}));

const genaiOf = (dispatch) =>
    dispatch.mock.calls.map(([a]) => a).find((a) => a.type === 'scratch-gui/classroom/SET_STUDENT_GENAI');
const rubyteeOf = (dispatch) =>
    dispatch.mock.calls.map(([a]) => a).find((a) => a.type === 'scratch-gui/classroom/SET_RUBYTEE_ENABLED');

describe('useStudentClassSettingsRefresh', () => {
    beforeEach(() => mockVerifySession.mockReset());

    test('should apply the settings verify-session returns when a student opens the page', async () => {
        mockVerifySession.mockResolvedValue({ genai: { enabled: false }, rubytee: { enabled: true } });
        const dispatch = jest.fn();
        renderHook(() => useStudentClassSettingsRefresh({ role: 'student', sessionToken: 's1', dispatch }));
        await waitFor(() => expect(genaiOf(dispatch)).toBeTruthy());
        expect(mockVerifySession).toHaveBeenCalledWith('s1');
        expect(genaiOf(dispatch).genai).toEqual({ enabled: false });
        expect(rubyteeOf(dispatch).enabled).toBe(true);
    });

    test('should ask only once even when the session changes later', async () => {
        mockVerifySession.mockResolvedValue({ genai: null });
        const dispatch = jest.fn();
        const { rerender } = renderHook((props) => useStudentClassSettingsRefresh({ ...props, dispatch }), {
            initialProps: { role: 'student', sessionToken: 's1' },
        });
        rerender({ role: 'student', sessionToken: 's2' });
        await waitFor(() => expect(mockVerifySession).toHaveBeenCalledTimes(1));
        // The answer is for s1, which the student no longer holds.
        await new Promise((r) => setTimeout(r, 0));
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('should not ask without a student session', () => {
        const dispatch = jest.fn();
        renderHook(() => useStudentClassSettingsRefresh({ role: null, sessionToken: null, dispatch }));
        renderHook(() => useStudentClassSettingsRefresh({ role: 'teacher', sessionToken: 't', dispatch }));
        expect(mockVerifySession).not.toHaveBeenCalled();
    });

    test('should hide both when the server rejects the session', async () => {
        mockVerifySession.mockRejectedValue(Object.assign(new Error('gone'), { status: 410 }));
        const dispatch = jest.fn();
        renderHook(() => useStudentClassSettingsRefresh({ role: 'student', sessionToken: 's1', dispatch }));
        await waitFor(() => expect(genaiOf(dispatch)).toBeTruthy());
        expect(genaiOf(dispatch).genai).toBeNull();
        expect(rubyteeOf(dispatch).enabled).toBe(false);
    });

    test('should keep the saved settings on a network error', async () => {
        mockVerifySession.mockRejectedValue(new Error('offline'));
        const dispatch = jest.fn();
        renderHook(() => useStudentClassSettingsRefresh({ role: 'student', sessionToken: 's1', dispatch }));
        await waitFor(() => expect(mockVerifySession).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 0));
        expect(dispatch).not.toHaveBeenCalled();
    });

    // #1795: the same answer carries this assignment's submission, so the menu
    // bar's submit button is not left stale (returned by the teacher, submitted
    // on another PC, or none) — without another request.
    const submissionOf = (dispatch) =>
        dispatch.mock.calls.map(([a]) => a).find((a) => a.type === 'scratch-gui/classroom/SET_SUBMISSION_STATUS');

    test.each([
        ['returned', { status: 'returned', submittedAt: 't1', teacherComment: 'c' }, 'returned', 't1'],
        ['submitted elsewhere', { status: 'submitted', submittedAt: 't2' }, 'submitted', 't2'],
        ['none', null, null, null],
    ])('should apply the submission (%s)', async (_label, submission, status, submittedAt) => {
        mockVerifySession.mockResolvedValue({ genai: null, submission });
        const dispatch = jest.fn();
        renderHook(() => useStudentClassSettingsRefresh({ role: 'student', sessionToken: 's1', dispatch }));
        await waitFor(() => expect(submissionOf(dispatch)).toBeTruthy());
        expect(submissionOf(dispatch)).toMatchObject({ submissionStatus: status, lastSubmittedAt: submittedAt });
        expect(mockVerifySession).toHaveBeenCalledTimes(1);
    });

    test('should keep the submission when the answer does not carry it', async () => {
        mockVerifySession.mockResolvedValue({ genai: null });
        const dispatch = jest.fn();
        renderHook(() => useStudentClassSettingsRefresh({ role: 'student', sessionToken: 's1', dispatch }));
        await waitFor(() => expect(genaiOf(dispatch)).toBeTruthy());
        expect(submissionOf(dispatch)).toBeUndefined();
    });
});
