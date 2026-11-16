/* eslint-env jest */
/**
 * 先生が作品を開く（課題の詳細の［スモウルビーで開く］・採点の［作品を開く］、#1980）。
 *
 * 先生の画面は先生用のモーダルにあるので、読み込んだらそれも閉じる（閉じないと作品が後ろに開く）。
 *
 * エディタに保存していない変更があるときは、開く前にクラス管理の中で聞く（#1983）。
 * 変更が無ければ今までどおりすぐ開く。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherSubmissions from '../../../src/containers/use-teacher-submissions.js';
import { closeClassroomModal, closeTeacherModal, setTeacherOpenedWork } from '../../../src/reducers/classroom.js';
import { setProjectUnchanged } from '../../../src/reducers/project-changed.js';

jest.mock('../../../src/lib/classroom-api.js', () => ({ __esModule: true, default: {} }));

const setup = (selectedClassroom = null, projectChanged = false, runtime = undefined) => {
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
        vm: { loadProject: jest.fn(() => Promise.resolve()), runtime },
        dispatch: jest.fn(),
    };
    const hook = renderHook(({ changed }) => useTeacherSubmissions({ ...deps, projectChanged: changed }), {
        initialProps: { changed: projectChanged },
    });
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
        // 「変更なし」にするのはタイマーのあと（#1983・下のテスト）なので、ここでは数えない。
        const actions = deps.dispatch.mock.calls
            .map(([action]) => action)
            .filter((action) => action.type !== setProjectUnchanged().type);
        expect(actions).toEqual([
            closeTeacherModal(),
            closeClassroomModal(),
            setTeacherOpenedWork({ from: 'assignment', seatNumber: 3, assignmentName: '迷路' }),
        ]);
    });

    test('読み込んだあと、エディタの作品は「変更なし」にする（ファイルから開いたときと同じ・#1983）', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve('sb3') }));
        const { hook, deps } = setup();
        await act(async () => {
            await hook.result.current.handleOpenSubmission('https://example.invalid/1.sb3');
        });
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(deps.dispatch).toHaveBeenCalledWith(setProjectUnchanged());
    });
});

describe('useTeacherSubmissions — 保存していない変更があるとき (#1983)', () => {
    beforeEach(() => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve('sb3') }));
    });

    const open = async (hook, url = 'https://example.invalid/1.sb3', work = undefined) => {
        await act(async () => {
            await hook.result.current.handleOpenSubmission(url, work);
        });
    };

    test('変更が無ければ聞かずにすぐ開く', async () => {
        const { hook, deps } = setup(null, false);
        await open(hook);
        expect(hook.result.current.openWorkConfirm).toBeNull();
        expect(deps.vm.loadProject).toHaveBeenCalledWith('sb3');
    });

    test('変更があれば開く前に聞く（先生自身の作品として）。まだ読み込まない', async () => {
        const { hook, deps } = setup(null, true);
        await open(hook);
        expect(hook.result.current.openWorkConfirm).toBe('own');
        expect(global.fetch).not.toHaveBeenCalled();
        expect(deps.vm.loadProject).not.toHaveBeenCalled();
        expect(deps.dispatch).not.toHaveBeenCalled();
    });

    test('［やめる］では開かない', async () => {
        const { hook, deps } = setup(null, true);
        await open(hook);
        act(() => {
            hook.result.current.handleCancelOpenWork();
        });
        expect(hook.result.current.openWorkConfirm).toBeNull();
        expect(deps.vm.loadProject).not.toHaveBeenCalled();
        expect(deps.dispatch).not.toHaveBeenCalled();
    });

    test('［開く］で、聞いた作品を開いた場所といっしょに開く', async () => {
        const { hook, deps } = setup({ classroomId: 'c1', assignmentName: '迷路' }, true);
        await open(hook, 'https://example.invalid/3.sb3', { from: 'assignment', seatNumber: 3 });
        await act(async () => {
            await hook.result.current.handleConfirmOpenWork();
        });
        expect(hook.result.current.openWorkConfirm).toBeNull();
        expect(global.fetch).toHaveBeenCalledWith('https://example.invalid/3.sb3');
        expect(deps.vm.loadProject).toHaveBeenCalledWith('sb3');
        expect(deps.dispatch).toHaveBeenCalledWith(closeTeacherModal());
        expect(deps.dispatch).toHaveBeenCalledWith(
            setTeacherOpenedWork({ from: 'assignment', seatNumber: 3, assignmentName: '迷路' }),
        );
    });

    test('前に開いた生徒の作品を先生が変えていたら、生徒の作品の上の変更として聞く', async () => {
        const { hook, deps } = setup(null, false);
        await open(hook, 'https://example.invalid/1.sb3');
        // 開いたあとに先生が作品を変えた
        hook.rerender({ changed: true });
        await open(hook, 'https://example.invalid/2.sb3');
        expect(hook.result.current.openWorkConfirm).toBe('opened');
        expect(deps.vm.loadProject).toHaveBeenCalledTimes(1);
    });

    test('前に開いた生徒の作品を変えていなければ、開き直すときも聞かない', async () => {
        const { hook, deps } = setup(null, false);
        await open(hook, 'https://example.invalid/1.sb3');
        await open(hook, 'https://example.invalid/2.sb3');
        expect(hook.result.current.openWorkConfirm).toBeNull();
        expect(deps.vm.loadProject).toHaveBeenCalledTimes(2);
    });

    test('ほかの作品が読み込まれたあと（ファイルなど）は、先生自身の作品として聞く', async () => {
        const listeners = {};
        const runtime = {
            on: (name, fn) => {
                listeners[name] = fn;
            },
            removeListener: jest.fn(),
        };
        const { hook } = setup(null, false, runtime);
        await open(hook, 'https://example.invalid/1.sb3');
        act(() => {
            listeners.PROJECT_LOADED();
        });
        hook.rerender({ changed: true });
        await open(hook, 'https://example.invalid/2.sb3');
        expect(hook.result.current.openWorkConfirm).toBe('own');
    });
});
