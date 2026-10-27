/* eslint-env jest */
/**
 * 課題設定「前回の提出物から始めさせる」(#1202) の読み込みと保存。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherAssignment from '../../../src/containers/use-teacher-assignment.js';

const mockGetAssignment = jest.fn();
const mockSetAssignment = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getAssignment: (...args) => mockGetAssignment(...args),
        setAssignment: (...args) => mockSetAssignment(...args),
        uploadToPresignedUrl: jest.fn(),
    },
}));

const setup = () => {
    const deps = {
        idToken: 'id-token',
        selectedClassroom: { classroomId: 'c1' },
        handleTeacher401: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage },
        setIsLoading: jest.fn(),
        phase: 'teacher-class-detail',
        setPhase: jest.fn(),
        vm: {},
    };
    return renderHook(() => useTeacherAssignment(deps));
};

describe('useTeacherAssignment — startFromPrevious (#1202)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockSetAssignment.mockReset();
        mockSetAssignment.mockResolvedValue({ imageUploadUrls: [], starterUploadUrl: null });
    });

    test('既定は OFF、保存済みの値を読み込む (課題の中身が無くても)', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: null, startFromPrevious: true });
        const hook = setup();
        await act(async () => {});
        expect(hook.result.current.startFromPrevious).toBe(true);

        mockGetAssignment.mockResolvedValue({ assignment: null });
        const off = setup();
        await act(async () => {});
        expect(off.result.current.startFromPrevious).toBe(false);
    });

    test('切り替えた値を保存の PUT に載せる', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'p' }] }, startFromPrevious: false });
        const hook = setup();
        await act(async () => {});
        act(() => hook.result.current.handleChangeStartFromPrevious(true));
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockSetAssignment).toHaveBeenCalledWith(
            'id-token',
            'c1',
            expect.objectContaining({ startFromPrevious: true }),
        );
    });
});

describe('useTeacherAssignment — peerView (#1208)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockSetAssignment.mockReset();
        mockSetAssignment.mockResolvedValue({ imageUploadUrls: [], starterUploadUrl: null });
    });

    test('既定は「しない」、保存済みの値を読み込む', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: null, peerView: 'always' });
        const hook = setup();
        await act(async () => {});
        expect(hook.result.current.peerView).toBe('always');

        mockGetAssignment.mockResolvedValue({ assignment: null });
        const off = setup();
        await act(async () => {});
        expect(off.result.current.peerView).toBe('none');
    });

    test('変更した値を保存の PUT に載せる', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'p' }] }, peerView: 'none' });
        const hook = setup();
        await act(async () => {});
        act(() => hook.result.current.handleChangePeerView('afterSubmit'));
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockSetAssignment).toHaveBeenCalledWith(
            'id-token',
            'c1',
            expect.objectContaining({ peerView: 'afterSubmit' }),
        );
    });
});
