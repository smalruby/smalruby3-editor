/* eslint-env jest */
/**
 * 提出時にスプライト名 (screenshotLabels) を送る (#1208)。
 * ブロック画像と同じ順・同じ数で並ぶことを確かめる。
 */
import { act, renderHook } from '@testing-library/react';
import useStudentSubmit from '../../../src/containers/use-student-submit.js';

const mockCreateSubmission = jest.fn();
const mockUpload = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        createSubmission: (...args) => mockCreateSubmission(...args),
        uploadToPresignedUrl: (...args) => mockUpload(...args),
    },
}));

const mockRender = jest.fn();
jest.mock('../../../src/lib/blocks-screenshot.js', () => ({
    renderBlocksToCanvas: (...args) => mockRender(...args),
}));
jest.mock('../../../src/lib/analytics', () => ({ __esModule: true, default: { event: jest.fn() } }));

const target = (id, name) => ({
    id,
    isOriginal: true,
    blocks: { _blocks: { b: {} } },
    currentCostume: 0,
    sprite: { name, costumes: [{ asset: { encodeDataURI: () => 'data:' } }] },
});

let hookDeps;

const canvas = { toBlob: (cb) => cb({ size: 1 }) };

const setup = (targets, extra = {}) => {
    const vm = {
        editingTarget: { id: targets[0].id },
        runtime: { targets },
        setEditingTarget: jest.fn(),
        saveProjectSb3: jest.fn().mockResolvedValue({ byteLength: 10 }),
    };
    const deps = {
        classroomState: { sessionToken: 's', classroomId: 'c1', submissionThumbnail: null },
        vm,
        scratchBlocks: { getMainWorkspace: () => ({}) },
        projectTitle: 'ねこ',
        dispatch: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        showSessionExpiredError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage },
        setIsLoading: jest.fn(),
        setPhase: jest.fn(),
        ...extra,
    };
    hookDeps = deps;
    return renderHook(() => useStudentSubmit(deps));
};

describe('useStudentSubmit — screenshotLabels (#1208)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        global.requestAnimationFrame = (cb) => cb();
        mockCreateSubmission.mockReset();
        mockUpload.mockReset();
        mockRender.mockReset();
        mockCreateSubmission.mockResolvedValue({ uploadUrl: 'u', screenshotUploadUrls: ['s0', 's1'] });
        mockUpload.mockResolvedValue();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    const submit = async (hook) => {
        await act(async () => {
            const done = hook.result.current.handleConfirmSubmit();
            for (let i = 0; i < 10; i++) {
                jest.runAllTimers();
                await Promise.resolve();
            }
            await done;
        });
    };

    test('撮れたブロック画像と同じ順でスプライト名を送る (撮れなかったものは除く)', async () => {
        mockRender
            .mockResolvedValueOnce(canvas) // Stage
            .mockResolvedValueOnce(null) // ねこ: 撮れない
            .mockResolvedValueOnce(canvas); // いぬ
        const hook = setup([target('t0', 'Stage'), target('t1', 'ねこ'), target('t2', 'いぬ')]);
        await submit(hook);
        expect(mockCreateSubmission).toHaveBeenCalledWith('s', 'c1', 'ねこ', 2, ['Stage', 'いぬ']);
    });

    test('長すぎる名前はサーバーの上限 (100 文字) に切り詰める', async () => {
        mockRender.mockResolvedValue(canvas);
        const hook = setup([target('t0', 'あ'.repeat(120))]);
        await submit(hook);
        expect(mockCreateSubmission.mock.calls[0][4]).toEqual(['あ'.repeat(100)]);
    });
});

// Ruby タブで書きかえたまま提出すると、ブロックに直る前の作品が出ていた (#1449)。
describe('useStudentSubmit — Ruby をブロックに直してから提出する (#1449)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        global.requestAnimationFrame = (cb) => cb();
        mockCreateSubmission.mockReset();
        mockUpload.mockReset();
        mockRender.mockReset();
        mockCreateSubmission.mockResolvedValue({ uploadUrl: 'u', screenshotUploadUrls: ['s0'] });
        mockUpload.mockResolvedValue();
        mockRender.mockResolvedValue(canvas);
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    const submit = async (hook) => {
        await act(async () => {
            const done = hook.result.current.handleConfirmSubmit();
            for (let i = 0; i < 10; i++) {
                jest.runAllTimers();
                await Promise.resolve();
            }
            await done;
        });
    };

    test('変換を適用してからブロック画像と作品を作る', async () => {
        const order = [];
        const apply = jest.fn(() => {
            order.push('apply');
            return Promise.resolve();
        });
        const targetCodeToBlocks = jest.fn().mockResolvedValue({ result: true, errors: [], apply });
        mockRender.mockImplementation(() => {
            order.push('screenshot');
            return Promise.resolve(canvas);
        });
        const hook = setup([target('t0', 'ねこ')], { targetCodeToBlocks });
        hookDeps.vm.saveProjectSb3.mockImplementation(() => {
            order.push('sb3');
            return Promise.resolve({ byteLength: 10 });
        });
        await submit(hook);
        expect(targetCodeToBlocks).toHaveBeenCalledWith(hookDeps.intl);
        expect(order).toEqual(['apply', 'screenshot', 'sb3']);
        expect(mockCreateSubmission).toHaveBeenCalled();
        expect(hookDeps.setPhase).toHaveBeenCalledWith('student-submit-done');
    });

    test('変換に失敗したら提出せずにモーダルを閉じる', async () => {
        const apply = jest.fn();
        const targetCodeToBlocks = jest.fn().mockResolvedValue({ result: false, errors: [{}], apply });
        const hook = setup([target('t0', 'ねこ')], { targetCodeToBlocks });
        await submit(hook);
        expect(apply).not.toHaveBeenCalled();
        expect(mockCreateSubmission).not.toHaveBeenCalled();
        expect(mockUpload).not.toHaveBeenCalled();
        expect(hookDeps.vm.saveProjectSb3).not.toHaveBeenCalled();
        expect(hookDeps.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'scratch-gui/classroom/CLOSE_MODAL' }),
        );
        expect(hookDeps.setIsLoading).toHaveBeenLastCalledWith(false);
    });

    // メニューバーの「提出する」から開くので、「やめる」はモーダルを閉じる (#1795)。
    test('「やめる」はモーダルを閉じる', () => {
        const hook = setup([target('t0', 'ねこ')]);
        act(() => hook.result.current.handleCancelSubmit());
        expect(hookDeps.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'scratch-gui/classroom/CLOSE_MODAL' }),
        );
        expect(hookDeps.setPhase).not.toHaveBeenCalled();
    });

    // #1795 M1/Q1: the send has its own flag (verify-session also sets isLoading),
    // and the menu bar's button is disabled through Redux while it runs.
    test('送信中だけ isSubmitting と studentSubmitting が立ち、終わったら戻る', async () => {
        let release;
        mockCreateSubmission.mockImplementation(
            () =>
                new Promise((resolve) => {
                    release = () => resolve({ uploadUrl: 'u', screenshotUploadUrls: [] });
                }),
        );
        mockRender.mockResolvedValue(canvas);
        const hook = setup([target('t0', 'ねこ')]);
        expect(hook.result.current.isSubmitting).toBe(false);
        let done;
        await act(async () => {
            done = hook.result.current.handleConfirmSubmit();
            for (let i = 0; i < 10; i++) {
                jest.runAllTimers();
                await Promise.resolve();
            }
        });
        expect(hook.result.current.isSubmitting).toBe(true);
        expect(hookDeps.dispatch).toHaveBeenCalledWith({
            type: 'scratch-gui/classroom/SET_STUDENT_SUBMITTING',
            submitting: true,
        });
        await act(async () => {
            release();
            for (let i = 0; i < 10; i++) {
                jest.runAllTimers();
                await Promise.resolve();
            }
            await done;
        });
        expect(hook.result.current.isSubmitting).toBe(false);
        expect(hookDeps.dispatch).toHaveBeenLastCalledWith({
            type: 'scratch-gui/classroom/SET_STUDENT_SUBMITTING',
            submitting: false,
        });
    });

    test('verify の読み込み (isLoading) だけでは isSubmitting にならない', () => {
        const hook = setup([target('t0', 'ねこ')]);
        act(() => hook.result.current.handleStartSubmit());
        expect(hook.result.current.isSubmitting).toBe(false);
    });
});

// 提出を押した結果の GA (#1831)。秒は確認を開いてから（タブが裏の時間を除く時計）。
describe('useStudentSubmit — GA の submit_result (#1831)', () => {
    let now;
    beforeEach(() => {
        jest.useFakeTimers();
        global.requestAnimationFrame = (cb) => cb();
        mockCreateSubmission.mockReset();
        mockUpload.mockReset();
        mockRender.mockReset();
        mockCreateSubmission.mockResolvedValue({ uploadUrl: 'u', screenshotUploadUrls: ['s0'] });
        mockUpload.mockResolvedValue();
        mockRender.mockResolvedValue(canvas);
        now = 50000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
    });
    afterEach(() => {
        Date.now.mockRestore();
        jest.useRealTimers();
    });

    const confirm = async (hook) => {
        await act(async () => {
            const done = hook.result.current.handleConfirmSubmit();
            for (let i = 0; i < 10; i++) {
                jest.runAllTimers();
                await Promise.resolve();
            }
            await done;
        });
    };

    test('提出できたら done と確認を開いてからの秒', async () => {
        const track = jest.fn();
        const hook = setup([target('t0', 'ねこ')], { track });
        act(() => hook.result.current.handleStartSubmit());
        now += 7000;
        await confirm(hook);
        expect(track).toHaveBeenCalledWith('submit_result', { result: 'done', seconds: 7 });
    });

    test('失敗したら error', async () => {
        mockCreateSubmission.mockRejectedValue({ status: 500, message: 'x' });
        const track = jest.fn();
        const hook = setup([target('t0', 'ねこ')], { track });
        act(() => hook.result.current.handleStartSubmit());
        await confirm(hook);
        expect(track).toHaveBeenCalledWith('submit_result', expect.objectContaining({ result: 'error' }));
    });

    test('「やめる」は cancel', () => {
        const track = jest.fn();
        const hook = setup([target('t0', 'ねこ')], { track });
        act(() => hook.result.current.handleStartSubmit());
        now += 3000;
        act(() => hook.result.current.handleCancelSubmit());
        expect(track).toHaveBeenCalledWith('submit_result', { result: 'cancel', seconds: 3 });
    });
});
