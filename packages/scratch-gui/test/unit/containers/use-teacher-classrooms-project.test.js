/* eslint-env jest */
/**
 * The stream's［⛶ 全画面で映す］opens the assignment on its［⛶ 映す］screen through
 * `detailEntry.project`, which is used once (#1961 M1): after the detail calls
 * `consumeDetailProject`, a later remount of the detail (back from posting to Google
 * Classroom) must not open the screen again.
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherClassrooms from '../../../src/containers/use-teacher-classrooms.js';

jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getClassroom: () => Promise.resolve({ classroomId: 'c1', studentCount: 3, joinCode: 'abc234' }),
        listMembers: () => Promise.resolve({ members: [] }),
        listSubmissions: () => Promise.resolve({ submissions: [] }),
        listKickRequests: () => Promise.resolve({ requests: [] }),
        getLessonProgress: () => Promise.resolve({ progress: [] }),
    },
}));

const setup = () => {
    const deps = {
        idToken: 'id-token',
        handleTeacher401: jest.fn(),
        mode: 'teacher',
        phase: 'teacher-dashboard',
        setPhase: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || '' },
        setIsLoading: jest.fn(),
    };
    return renderHook(() => useTeacherClassrooms(deps));
};

describe('useTeacherClassrooms — detailEntry.project (#1961)', () => {
    test('the stream asks for the projector screen on the members tab', async () => {
        const hook = setup();
        await act(async () => {
            await hook.result.current.handleSelectClassroom('c1', { project: true, tab: 'description' });
        });
        expect(hook.result.current.detailEntry).toEqual(expect.objectContaining({ tab: 'members', project: true }));
    });

    test('used once: consumeDetailProject forgets it and keeps the seq', async () => {
        const hook = setup();
        await act(async () => {
            await hook.result.current.handleSelectClassroom('c1', { project: true });
        });
        const seq = hook.result.current.detailEntry.seq;
        act(() => hook.result.current.consumeDetailProject());
        expect(hook.result.current.detailEntry.project).toBe(false);
        expect(hook.result.current.detailEntry.seq).toBe(seq);
    });

    test('an ordinary open does not ask for it', async () => {
        const hook = setup();
        await act(async () => {
            await hook.result.current.handleSelectClassroom('c1');
        });
        expect(hook.result.current.detailEntry.project).toBe(false);
    });
});
