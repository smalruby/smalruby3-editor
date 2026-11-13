/* eslint-env jest */
/**
 * 課題設定「前回の提出物から始めさせる」(#1202) の読み込みと保存。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherAssignment from '../../../src/containers/use-teacher-assignment.js';

const mockGetAssignment = jest.fn();
const mockSetAssignment = jest.fn();
const mockUpdateClassroom = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getAssignment: (...args) => mockGetAssignment(...args),
        setAssignment: (...args) => mockSetAssignment(...args),
        updateClassroom: (...args) => mockUpdateClassroom(...args),
        uploadToPresignedUrl: jest.fn(),
    },
}));

const setup = (overrides = {}) => {
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
        ...overrides,
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

describe('useTeacherAssignment — savedSettings (#1303)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockSetAssignment.mockReset();
        mockSetAssignment.mockResolvedValue({ imageUploadUrls: [], starterUploadUrl: null });
    });

    test('保存済みの値を持ち、保存するまで変更中の値には追従しない', async () => {
        mockGetAssignment.mockResolvedValue({
            assignment: { pages: [{ text: 'p' }] },
            startFromPrevious: false,
            peerView: 'none',
        });
        const hook = setup({ selectedClassroom: { classroomId: 'c1', meshGroupLimit: 6 } });
        await act(async () => {});
        expect(hook.result.current.savedSettings).toEqual({
            startFromPrevious: false,
            peerView: 'none',
            meshGroupLimit: 6,
        });

        act(() => hook.result.current.handleChangePeerView('always'));
        expect(hook.result.current.peerView).toBe('always');
        expect(hook.result.current.savedSettings.peerView).toBe('none');

        // After the save the editor reloads the stored values.
        mockGetAssignment.mockResolvedValue({
            assignment: { pages: [{ text: 'p' }] },
            startFromPrevious: false,
            peerView: 'always',
        });
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(hook.result.current.savedSettings.peerView).toBe('always');
    });
});

describe('useTeacherAssignment — meshGroupLimit (#1257)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockSetAssignment.mockReset();
        mockUpdateClassroom.mockReset();
        mockSetAssignment.mockResolvedValue({ imageUploadUrls: [], starterUploadUrl: null });
        mockUpdateClassroom.mockResolvedValue({});
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'p' }] } });
    });

    test('課題の保存値を読み込む。値が無い（この機能より前の課題）は 0 = 制限なし', async () => {
        const six = setup({ selectedClassroom: { classroomId: 'c1', meshGroupLimit: 6 } });
        await act(async () => {});
        expect(six.result.current.meshGroupLimit).toBe(6);

        const old = setup({ selectedClassroom: { classroomId: 'c1' } });
        await act(async () => {});
        expect(old.result.current.meshGroupLimit).toBe(0);
    });

    test('変えた値を保存で PATCH し、選択中の課題と一覧に反映する', async () => {
        const setSelectedClassroom = jest.fn();
        const setClassrooms = jest.fn();
        const hook = setup({
            selectedClassroom: { classroomId: 'c1', meshGroupLimit: 0 },
            setSelectedClassroom,
            setClassrooms,
        });
        await act(async () => {});
        act(() => hook.result.current.handleChangeMeshGroupLimit('6'));
        expect(hook.result.current.meshGroupLimit).toBe(6);
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockUpdateClassroom).toHaveBeenCalledWith('id-token', 'c1', { meshGroupLimit: 6 });
        expect(setSelectedClassroom).toHaveBeenCalled();
        const nextSelected = setSelectedClassroom.mock.calls[0][0]({ classroomId: 'c1', meshGroupLimit: 0 });
        expect(nextSelected.meshGroupLimit).toBe(6);
        const nextList = setClassrooms.mock.calls[0][0]([
            { classroomId: 'c1', meshGroupLimit: 0 },
            { classroomId: 'c2', meshGroupLimit: 0 },
        ]);
        expect(nextList.map((c) => c.meshGroupLimit)).toEqual([6, 0]);
    });

    test('値を変えていなければ PATCH しない', async () => {
        const hook = setup({ selectedClassroom: { classroomId: 'c1', meshGroupLimit: 6 } });
        await act(async () => {});
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockSetAssignment).toHaveBeenCalled();
        expect(mockUpdateClassroom).not.toHaveBeenCalled();
    });
    test('保存せずに課題を開き直すと、保存値に戻る（前回の選択が残らない）', async () => {
        const deps = {
            idToken: 'id-token',
            selectedClassroom: { classroomId: 'c1', meshGroupLimit: 6 },
            handleTeacher401: jest.fn(),
            clearError: jest.fn(),
            showError: jest.fn(),
            intl: { formatMessage: (m) => m.defaultMessage },
            setIsLoading: jest.fn(),
            phase: 'teacher-class-detail',
            setPhase: jest.fn(),
            vm: {},
        };
        const hook = renderHook((props) => useTeacherAssignment(props), { initialProps: deps });
        await act(async () => {});
        act(() => hook.result.current.handleChangeMeshGroupLimit('0'));
        expect(hook.result.current.meshGroupLimit).toBe(0);

        // 課題一覧へ戻って同じ課題を開き直す
        hook.rerender({ ...deps, phase: 'teacher-dashboard' });
        hook.rerender({ ...deps, phase: 'teacher-class-detail' });
        await act(async () => {});
        expect(hook.result.current.meshGroupLimit).toBe(6);
    });
});

describe('useTeacherAssignment — lesson (#1598)', () => {
    const saved = {
        courseId: 'kyou-kara-programmer',
        challengeIds: ['blocks-l1-key-sound'],
        requiredChallengeIds: [],
        completion: { type: 'all' },
        submitWork: false,
        scoring: null,
    };

    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockSetAssignment.mockReset();
        mockSetAssignment.mockResolvedValue({ imageUploadUrls: [], starterUploadUrl: null });
    });

    test('保存済みのレッスンを読み込み、変えていなければ PUT に lesson を載せない', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'p' }] }, lesson: saved });
        const hook = setup();
        await act(async () => {});
        expect(hook.result.current.savedLesson).toEqual(saved);
        expect(hook.result.current.lessonDraft.challengeIds).toEqual(['blocks-l1-key-sound']);
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockSetAssignment.mock.calls[0][2]).not.toHaveProperty('lesson');
    });

    test('変えたレッスンを PUT に載せる・「使わない」は null', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'p' }] }, lesson: saved });
        const hook = setup();
        await act(async () => {});
        act(() => hook.result.current.handleChangeLesson({ ...hook.result.current.lessonDraft, submitWork: true }));
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockSetAssignment.mock.calls[0][2].lesson).toMatchObject({ submitWork: true });

        act(() => hook.result.current.handleChangeLesson(null));
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockSetAssignment.mock.calls[1][2].lesson).toBeNull();
    });

    test('チャレンジを選んでいないレッスンは保存しない', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: null });
        const showError = jest.fn();
        const hook = setup({ showError });
        await act(async () => {});
        act(() =>
            hook.result.current.handleChangeLesson({
                ...saved,
                challengeIds: [],
                completion: { type: 'all', count: null },
            }),
        );
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockSetAssignment).not.toHaveBeenCalled();
        expect(showError).toHaveBeenCalled();
    });

    test('このスモウルビーに無いコースでも、変えなければそのまま保存できる', async () => {
        const gone = { ...saved, courseId: 'gone-course', challengeIds: ['x'] };
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'p' }] }, lesson: gone });
        const hook = setup();
        await act(async () => {});
        await act(async () => {
            await hook.result.current.handleSaveAssignment();
        });
        expect(mockSetAssignment).toHaveBeenCalled();
        expect(mockSetAssignment.mock.calls[0][2]).not.toHaveProperty('lesson');
    });
});
