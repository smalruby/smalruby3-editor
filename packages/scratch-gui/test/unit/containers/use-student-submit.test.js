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

const canvas = { toBlob: (cb) => cb({ size: 1 }) };

const setup = (targets) => {
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
    };
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
