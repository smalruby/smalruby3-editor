/* eslint-env jest */
/**
 * 先生が作品を開く（課題の詳細の［スモウルビーで開く］・採点の［作品を開く］、#1980）。
 *
 * 先生の画面は先生用のモーダルにあるので、読み込んだらそれも閉じる（閉じないと作品が後ろに開く）。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherSubmissions from '../../../src/containers/use-teacher-submissions.js';
import { closeClassroomModal, closeTeacherModal } from '../../../src/reducers/classroom.js';

jest.mock('../../../src/lib/classroom-api.js', () => ({ __esModule: true, default: {} }));

const setup = () => {
    const deps = {
        idToken: 'id-token',
        selectedClassroom: null,
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
});
