/* eslint-env jest */
/**
 * Inline assignment creation passes the create screen's「メッシュのグループの人数」
 * through to POST /classrooms (#1257).
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherGroups from '../../../src/containers/use-teacher-groups.js';

const mockCreateClassroom = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        createClassroom: (...args) => mockCreateClassroom(...args),
        listGroups: () => new Promise(() => {}),
        migrateGroups: () => Promise.resolve({}),
    },
}));
jest.mock('../../../src/lib/log.js', () => ({ error: jest.fn() }));

const baseProps = {
    handleTeacher401: jest.fn(),
    setClassrooms: jest.fn(),
    setSelectedClassroom: jest.fn(),
    loadClassrooms: jest.fn(() => Promise.resolve()),
    clearError: jest.fn(),
    showError: jest.fn(),
    intl: { formatMessage: () => '' },
    setIsLoading: jest.fn(),
    setPhase: jest.fn(),
};

const group = { groupId: 'g1', name: '1年1組' };

describe('useTeacherGroups handleCreateAssignmentInClass (#1257)', () => {
    beforeEach(() => {
        mockCreateClassroom.mockReset().mockResolvedValue({ classroomId: 'c1' });
    });

    test('sends the chosen meshGroupLimit', async () => {
        const { result } = renderHook(() => useTeacherGroups({ ...baseProps, idToken: 'tok' }));
        await act(() => result.current.handleCreateAssignmentInClass(group, '課題1', { meshGroupLimit: 0 }));
        expect(mockCreateClassroom).toHaveBeenCalledWith('tok', '1年1組', '課題1', null, null, 'g1', {
            meshGroupLimit: 0,
        });
    });

    test('leaves meshGroupLimit to the server when no option is given', async () => {
        const { result } = renderHook(() => useTeacherGroups({ ...baseProps, idToken: 'tok' }));
        await act(() => result.current.handleCreateAssignmentInClass(group, '課題1'));
        expect(mockCreateClassroom.mock.calls[0][6]).toEqual({ meshGroupLimit: undefined });
    });
});
