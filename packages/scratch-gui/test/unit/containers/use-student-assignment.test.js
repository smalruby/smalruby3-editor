/* eslint-env jest */
/**
 * 参加直後に「どこから始めるか」を選べるようにする (#1201)。
 *
 * - 参加しただけでは何も読み込まない。生徒が選んだときだけ読み込む
 *   (自動で開いたうえで同じ選択肢を出すと、迷ううえに押すと 2 重に読み込む)。
 * - 選択肢はスターター / 前回 / この課題 / いまの作品のまま。
 * - 未保存の変更があれば上書き前に確認する。
 */
import { act, renderHook } from '@testing-library/react';
import useStudentAssignment from '../../../src/containers/use-student-assignment.js';

const mockGetAssignment = jest.fn();
const mockGetContinuable = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getAssignment: (...args) => mockGetAssignment(...args),
        getContinuableSubmissions: (...args) => mockGetContinuable(...args),
    },
}));

const mockLoadProject = jest.fn();
jest.mock('../../../src/lib/project-loader-utils.js', () => ({
    loadProjectWithChecks: (...args) => mockLoadProject(...args),
}));

let mockProjectChanged = false;
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    useSelector: (fn) => fn({ scratchGui: { projectChanged: mockProjectChanged } }),
    useDispatch: () => mockDispatch,
}));

const ASSIGNMENT = { pages: [{ text: 'p1' }], starterUrl: 'https://signed.example/starter.sb3' };
const PREVIOUS = {
    classroomId: 'c-prev',
    assignmentName: '第1回',
    projectName: '先週',
    submittedAt: '2026-10-01T10:00:00.000Z',
    projectUrl: 'https://signed.example/prev.sb3',
};

const setup = () => {
    const deps = {
        classroomState: { sessionToken: 'st', classroomId: 'c-now' },
        vm: {},
        intl: { formatMessage: (m) => m.defaultMessage },
        clearError: jest.fn(),
        showError: jest.fn(),
        setIsLoading: jest.fn(),
        setPhase: jest.fn(),
        onStarted: jest.fn(),
    };
    const hook = renderHook(() => useStudentAssignment(deps));
    return { deps, hook };
};

describe('useStudentAssignment — 続きから始める (#1201)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockGetContinuable.mockReset();
        mockLoadProject.mockReset();
        mockProjectChanged = false;
        global.fetch = jest.fn(async (url) => ({ ok: true, arrayBuffer: async () => `data:${url}` }));
        window.confirm = jest.fn(() => true);
    });

    test('続きに使える提出物が無くても、スターターは自動で開かず選択肢に出す', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT });
        mockGetContinuable.mockResolvedValue({ current: null, previous: null });
        const { hook } = setup();
        let next;
        await act(async () => {
            next = await hook.result.current.handleJoined('st', 'c-now', true);
        });
        expect(next).toBe('student-assignment');
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(hook.result.current.continueOptions).toBeNull();
        expect(hook.result.current.loadedChoice).toBeNull();
        expect(hook.result.current.startChoice).toEqual({ showStarter: true, recommend: null, notice: null });
    });

    test('スターターも提出物も無ければ、選択肢は無い (「はじめる」だけ)', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: { pages: [{ text: 'p1' }], starterUrl: null } });
        mockGetContinuable.mockResolvedValue({ current: null, previous: null });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
        expect(hook.result.current.startChoice.showStarter).toBe(false);
        expect(hook.result.current.continueOptions).toBeNull();
    });

    test('前回の提出物があれば、勝手に開かず選択肢を出す', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT });
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS });
        const { hook } = setup();
        let next;
        await act(async () => {
            next = await hook.result.current.handleJoined('st', 'c-now', true);
        });
        expect(next).toBe('student-assignment');
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(hook.result.current.continueOptions).toEqual({ current: null, previous: PREVIOUS });
        expect(hook.result.current.loadedChoice).toBeNull();
    });

    test('課題の中身が無くても、前回の提出物の選択肢は出す', async () => {
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS });
        const { hook } = setup();
        let next;
        await act(async () => {
            next = await hook.result.current.handleJoined('st', 'c-now', false);
        });
        expect(next).toBeNull();
        expect(mockGetAssignment).not.toHaveBeenCalled();
        expect(hook.result.current.hasAssignment).toBe(false);
        expect(hook.result.current.continueOptions.previous).toEqual(PREVIOUS);
    });

    test('提出物の取得に失敗しても参加は止めず、スターターを選択肢に出す', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT });
        mockGetContinuable.mockRejectedValue(new Error('network'));
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(hook.result.current.continueOptions).toBeNull();
        expect(hook.result.current.startChoice.showStarter).toBe(true);
    });

    test('「前回の提出物から続ける」は URL を取り直してから読み込む', async () => {
        mockGetContinuable.mockResolvedValue({
            current: null,
            previous: { ...PREVIOUS, projectUrl: 'https://signed.example/fresh.sb3' },
        });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleLoadSubmission('previous');
        });
        expect(mockGetContinuable).toHaveBeenCalledWith('st', 'c-now');
        expect(global.fetch).toHaveBeenCalledWith('https://signed.example/fresh.sb3');
        expect(mockLoadProject).toHaveBeenCalledWith({}, expect.anything(), 'data:https://signed.example/fresh.sb3');
        expect(hook.result.current.loadedChoice).toBe('previous');
    });

    test('選んだ提出物を読み込めたら、そのまま始める (モーダルを閉じる)', async () => {
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS });
        const { hook, deps } = setup();
        await act(async () => {
            await hook.result.current.handleLoadSubmission('previous');
        });
        expect(deps.onStarted).toHaveBeenCalledTimes(1);
    });

    test('確認の文言は開くもの (前回 / この課題) に合わせる', async () => {
        mockProjectChanged = true;
        mockGetContinuable.mockResolvedValue({ current: PREVIOUS, previous: PREVIOUS });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleLoadSubmission('previous');
        });
        await act(async () => {
            await hook.result.current.handleLoadSubmission('current');
        });
        expect(window.confirm.mock.calls[0][0]).toMatch(/last time's submitted project/);
        expect(window.confirm.mock.calls[1][0]).toMatch(/you submitted for this assignment/);
        expect(window.confirm.mock.calls[0][0]).not.toMatch(/starter/);
    });

    test('未保存の変更があり確認で断ったら読み込まない', async () => {
        mockProjectChanged = true;
        window.confirm = jest.fn(() => false);
        mockGetContinuable.mockResolvedValue({ current: PREVIOUS, previous: null });
        const { hook, deps } = setup();
        await act(async () => {
            await hook.result.current.handleLoadSubmission('current');
        });
        expect(window.confirm).toHaveBeenCalled();
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(hook.result.current.loadedChoice).toBeNull();
        expect(deps.onStarted).not.toHaveBeenCalled();
    });

    test('取り直したら無くなっていた (期限切れ) ときはエラーを出す', async () => {
        mockGetContinuable.mockResolvedValue({ current: null, previous: null });
        const { hook, deps } = setup();
        await act(async () => {
            await hook.result.current.handleLoadSubmission('previous');
        });
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(deps.showError).toHaveBeenCalled();
        expect(hook.result.current.continueOptions).toBeNull();
    });

    test('「スターターから始める」も URL を取り直してから読み込む', async () => {
        mockGetAssignment.mockResolvedValueOnce({ assignment: ASSIGNMENT });
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
        mockGetAssignment.mockResolvedValueOnce({
            assignment: { ...ASSIGNMENT, starterUrl: 'https://signed.example/fresh-starter.sb3' },
        });
        await act(async () => {
            await hook.result.current.handleReloadStarter();
        });
        expect(mockGetAssignment).toHaveBeenLastCalledWith('st', 'c-now');
        expect(global.fetch).toHaveBeenCalledWith('https://signed.example/fresh-starter.sb3');
        expect(global.fetch).not.toHaveBeenCalledWith(ASSIGNMENT.starterUrl);
        expect(hook.result.current.loadedChoice).toBe('starter');
    });

    test('選択肢の「スターターから始める」は読み込んだら始め、パネルの「開く」ボタンは開いたまま', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT });
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS });
        const { hook, deps } = setup();
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
        await act(async () => {
            await hook.result.current.handleReloadStarter();
        });
        expect(deps.onStarted).not.toHaveBeenCalled();
        await act(async () => {
            await hook.result.current.handleChooseStarter();
        });
        expect(deps.onStarted).toHaveBeenCalledTimes(1);
    });

    test('取り直したらスターターが無くなっていたときはエラーを出す', async () => {
        mockGetAssignment.mockResolvedValueOnce({ assignment: ASSIGNMENT });
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS });
        const { hook, deps } = setup();
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
        mockGetAssignment.mockResolvedValueOnce({ assignment: null });
        await act(async () => {
            await hook.result.current.handleReloadStarter();
        });
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(deps.showError).toHaveBeenCalled();
    });

    test('ステータス画面用に選択肢を取り直せる', async () => {
        mockGetContinuable.mockResolvedValue({ current: PREVIOUS, previous: null });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.refreshContinueOptions();
        });
        expect(hook.result.current.continueOptions).toEqual({ current: PREVIOUS, previous: null });
    });
});

describe('useStudentAssignment — 前回の提出物から始めさせる (#1202)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockGetContinuable.mockReset();
        mockLoadProject.mockReset();
        mockProjectChanged = false;
        global.fetch = jest.fn(async (url) => ({ ok: true, arrayBuffer: async () => `data:${url}` }));
        window.confirm = jest.fn(() => true);
    });

    const join = async (hook) => {
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
    };

    test('設定 ON: 前回の提出物は自動で開かず「おすすめ」にし、スターターは出さない', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT, startFromPrevious: true });
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS, startFromPrevious: true });
        const { hook, deps } = setup();
        await join(hook);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(hook.result.current.loadedChoice).toBeNull();
        expect(hook.result.current.startChoice).toEqual({
            showStarter: false,
            recommend: 'previous',
            notice: 'recommendPrevious',
        });
        expect(hook.result.current.continueOptions.previous).toEqual(PREVIOUS);
        expect(deps.onStarted).not.toHaveBeenCalled();
    });

    test('設定 ON: おすすめの前回の提出物を押したときだけ 1 回読み込み、始める', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT, startFromPrevious: true });
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS, startFromPrevious: true });
        const { hook, deps } = setup();
        await join(hook);
        await act(async () => {
            await hook.result.current.handleLoadSubmission('previous');
        });
        expect(mockLoadProject).toHaveBeenCalledTimes(1);
        expect(window.confirm).not.toHaveBeenCalled();
        expect(hook.result.current.loadedChoice).toBe('previous');
        expect(deps.onStarted).toHaveBeenCalledTimes(1);
    });

    test('設定 ON で前回の提出物が無ければ、スターターを「おすすめ」にしてそのことを知らせる', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT, startFromPrevious: true });
        mockGetContinuable.mockResolvedValue({ current: null, previous: null, startFromPrevious: true });
        const { hook } = setup();
        await join(hook);
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(hook.result.current.startChoice).toEqual({
            showStarter: true,
            recommend: 'starter',
            notice: 'noPrevious',
        });
    });

    test('設定 OFF なら選ばせるだけで、おすすめ・お知らせは出さない', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT, startFromPrevious: false });
        mockGetContinuable.mockResolvedValue({ current: null, previous: PREVIOUS, startFromPrevious: false });
        const { hook } = setup();
        await join(hook);
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(hook.result.current.startChoice).toEqual({ showStarter: true, recommend: null, notice: null });
    });
});

describe('useStudentAssignment — 他者参照の設定を覚える (#1210)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockGetContinuable.mockReset();
        mockDispatch.mockReset();
    });

    test('参加時の課題の応答にある他者参照の設定を Redux に入れる', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT, peerView: 'afterSubmit' });
        mockGetContinuable.mockResolvedValue({ current: null, previous: null });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ peerView: 'afterSubmit' }));
    });

    test('「課題を見る」で取り直したときも設定を入れ直す', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT, peerView: 'none' });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleOpenAssignment();
        });
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ peerView: 'none' }));
    });

    test('設定の無い古い応答では何もしない', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT });
        mockGetContinuable.mockResolvedValue({ current: null, previous: null });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
        expect(mockDispatch).not.toHaveBeenCalled();
    });
});
