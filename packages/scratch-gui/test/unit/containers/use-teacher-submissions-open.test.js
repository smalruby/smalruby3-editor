/* eslint-env jest */
/**
 * 先生が作品を開く（課題の詳細の［スモウルビーで開く］・採点の［作品を開く］、#1980）。
 *
 * 先生の画面は先生用のモーダルにあるので、読み込んだらそれも閉じる（閉じないと作品が後ろに開く）。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherSubmissions from '../../../src/containers/use-teacher-submissions.js';
import { closeClassroomModal, closeTeacherModal, setTeacherOpenedWork } from '../../../src/reducers/classroom.js';

jest.mock('../../../src/lib/classroom-api.js', () => ({ __esModule: true, default: {} }));

const setup = (selectedClassroom = null) => {
    const deps = {
        idToken: 'id-token',
        selectedClassroom,
        members: [],
        handleTeacher401: jest.fn(),
        loadClassroomDetail: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || m.id || String(m) },
        setIsLoading: jest.fn(),
        vm: { loadProject: jest.fn(() => Promise.resolve()) },
        dispatch: jest.fn(),
    };
    const hook = renderHook(() => useTeacherSubmissions(deps));
    return { hook, deps };
};

describe('useTeacherSubmissions — 作品を開く', () => {
    test('読み込んだら先生のモーダルも閉じる', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve('sb3') }));
        const { hook, deps } = setup();
        await act(async () => {
            await hook.result.current.handleOpenSubmission('https://example.invalid/1.sb3');
        });
        expect(deps.vm.loadProject).toHaveBeenCalledWith('sb3');
        expect(deps.dispatch).toHaveBeenCalledWith(closeTeacherModal());
        expect(deps.dispatch).toHaveBeenCalledWith(closeClassroomModal());
    });

    test('取れなかったら閉じずに知らせる', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 403 }));
        const { hook, deps } = setup();
        await act(async () => {
            await hook.result.current.handleOpenSubmission('https://example.invalid/1.sb3');
        });
        expect(deps.vm.loadProject).not.toHaveBeenCalled();
        expect(deps.dispatch).not.toHaveBeenCalled();
        expect(deps.showError).toHaveBeenCalledTimes(1);
    });

    test('開いた場所を渡すと、閉じたあとで戻る帯のために覚える（課題名は選んだ課題から・#1990）', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve('sb3') }));
        const { hook, deps } = setup({ classroomId: 'c1', assignmentName: '迷路' });
        await act(async () => {
            await hook.result.current.handleOpenSubmission('https://example.invalid/3.sb3', {
                from: 'assignment',
                seatNumber: 3,
            });
        });
        const actions = deps.dispatch.mock.calls.map(([action]) => action);
        expect(actions).toEqual([
            closeTeacherModal(),
            closeClassroomModal(),
            setTeacherOpenedWork({ from: 'assignment', seatNumber: 3, assignmentName: '迷路' }),
        ]);
    });
});
