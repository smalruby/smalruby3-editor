/* eslint-env jest */
/**
 * 課題名の保存は成否を返し、課題詳細の欄の横に「保存しました」/失敗を出せるようにする (#1388)。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherClassrooms from '../../../src/containers/use-teacher-classrooms.js';

const mockUpdateClassroom = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        updateClassroom: (...args) => mockUpdateClassroom(...args),
    },
}));

const setup = (overrides = {}) => {
    const deps = {
        idToken: 'id-token',
        handleTeacher401: jest.fn(),
        mode: 'teacher',
        phase: 'teacher-assignment-editor',
        setPhase: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || '' },
        setIsLoading: jest.fn(),
        ...overrides,
    };
    const hook = renderHook(() => useTeacherClassrooms(deps));
    act(() => hook.result.current.setSelectedClassroom({ classroomId: 'c1', assignmentName: '課題1' }));
    return { hook, deps };
};

describe('useTeacherClassrooms — handleUpdateAssignmentName (#1388)', () => {
    beforeEach(() => {
        mockUpdateClassroom.mockReset();
    });

    test('保存できたら true を返し、選択中の課題名を更新する', async () => {
        mockUpdateClassroom.mockResolvedValue({});
        const { hook } = setup();
        let ok;
        await act(async () => {
            ok = await hook.result.current.handleUpdateAssignmentName('課題2');
        });
        expect(ok).toBe(true);
        expect(mockUpdateClassroom).toHaveBeenCalledWith('id-token', 'c1', { assignmentName: '課題2' });
        expect(hook.result.current.selectedClassroom.assignmentName).toBe('課題2');
    });

    test('保存に失敗したら false を返し、課題名は変えない', async () => {
        mockUpdateClassroom.mockRejectedValue(Object.assign(new Error('x'), { status: 500 }));
        const { hook, deps } = setup();
        let ok;
        await act(async () => {
            ok = await hook.result.current.handleUpdateAssignmentName('課題2');
        });
        expect(ok).toBe(false);
        expect(deps.showError).toHaveBeenCalled();
        expect(hook.result.current.selectedClassroom.assignmentName).toBe('課題1');
    });

    test('ログインが切れていたら false を返す', async () => {
        mockUpdateClassroom.mockRejectedValue(Object.assign(new Error('x'), { status: 401 }));
        const { hook, deps } = setup();
        let ok;
        await act(async () => {
            ok = await hook.result.current.handleUpdateAssignmentName('課題2');
        });
        expect(ok).toBe(false);
        expect(deps.handleTeacher401).toHaveBeenCalled();
    });
});
