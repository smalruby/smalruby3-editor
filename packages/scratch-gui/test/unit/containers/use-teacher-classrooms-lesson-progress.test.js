/* eslint-env jest */
/**
 * レッスンの課題の進み具合（#1602）: メンバータブと「進み具合」タブを表示している間だけ取得し、
 * レッスンの無い課題では取りに行かない。
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import useTeacherClassrooms from '../../../src/containers/use-teacher-classrooms.js';

const mockApi = {
    listMembers: jest.fn(),
    listSubmissions: jest.fn(),
    listKickRequests: jest.fn(),
    getLessonProgress: jest.fn(),
};
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        listMembers: (...a) => mockApi.listMembers(...a),
        listSubmissions: (...a) => mockApi.listSubmissions(...a),
        listKickRequests: (...a) => mockApi.listKickRequests(...a),
        getLessonProgress: (...a) => mockApi.getLessonProgress(...a),
    },
}));

const setup = (classroom) => {
    const deps = {
        idToken: 'id-token',
        handleTeacher401: jest.fn(),
        mode: 'teacher',
        phase: 'teacher-class-detail',
        setPhase: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || '' },
        setIsLoading: jest.fn(),
    };
    const hook = renderHook(() => useTeacherClassrooms(deps));
    act(() => hook.result.current.setSelectedClassroom(classroom));
    return hook;
};

describe('useTeacherClassrooms — lesson progress (#1602)', () => {
    beforeEach(() => {
        Object.values(mockApi).forEach((fn) => fn.mockReset());
        mockApi.listMembers.mockResolvedValue({ members: [] });
        mockApi.listSubmissions.mockResolvedValue({ submissions: [] });
        mockApi.listKickRequests.mockResolvedValue({ requests: [] });
        mockApi.getLessonProgress.mockResolvedValue({ lesson: { courseId: 'c' }, progress: [] });
    });

    test('レッスンの課題では進み具合も取り、課題の ID を添えて持つ', async () => {
        const hook = setup({ classroomId: 'c1', hasLesson: true, studentCount: 3 });
        await waitFor(() => expect(hook.result.current.lessonProgress).not.toBeNull());
        expect(mockApi.getLessonProgress).toHaveBeenCalledWith('id-token', 'c1');
        expect(hook.result.current.lessonProgress.classroomId).toBe('c1');
    });

    test('レッスンの無い課題では進み具合を取りに行かない', async () => {
        setup({ classroomId: 'c1', hasLesson: false, studentCount: 3 });
        await waitFor(() => expect(mockApi.listMembers).toHaveBeenCalled());
        expect(mockApi.getLessonProgress).not.toHaveBeenCalled();
    });

    test('「進み具合」タブでも取得し、「説明」タブでは取得しない', async () => {
        const hook = setup({ classroomId: 'c1', hasLesson: true, studentCount: 3 });
        await waitFor(() => expect(mockApi.getLessonProgress).toHaveBeenCalledTimes(1));
        act(() => hook.result.current.setDetailTab('description'));
        act(() => hook.result.current.setDetailTab('progress'));
        await waitFor(() => expect(mockApi.getLessonProgress).toHaveBeenCalledTimes(2));
        act(() => hook.result.current.setDetailTab('description'));
        expect(mockApi.getLessonProgress).toHaveBeenCalledTimes(2);
    });
});
