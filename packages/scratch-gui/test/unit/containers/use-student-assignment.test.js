/* eslint-env jest */
/**
 * 参加直後に「どこから始めるか」を選べるようにする (#1201)。
 *
 * - 続きに使える提出物が無ければ、従来どおりスターターを自動で開く。
 * - あれば勝手に開かず、生徒に選ばせる (スターター / 前回 / この課題)。
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
jest.mock('react-redux', () => ({
    useSelector: (fn) => fn({ scratchGui: { projectChanged: mockProjectChanged } }),
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

    test('続きに使える提出物が無ければ、スターターを自動で開く (従来どおり)', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT });
        mockGetContinuable.mockResolvedValue({ current: null, previous: null });
        const { hook } = setup();
        let next;
        await act(async () => {
            next = await hook.result.current.handleJoined('st', 'c-now', true);
        });
        expect(next).toBe('student-assignment');
        expect(global.fetch).toHaveBeenCalledWith(ASSIGNMENT.starterUrl);
        expect(mockLoadProject).toHaveBeenCalledTimes(1);
        expect(hook.result.current.continueOptions).toBeNull();
        expect(hook.result.current.loadedChoice).toBe('starter');
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

    test('提出物の取得に失敗しても参加は止めず、従来どおりスターターを開く', async () => {
        mockGetAssignment.mockResolvedValue({ assignment: ASSIGNMENT });
        mockGetContinuable.mockRejectedValue(new Error('network'));
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleJoined('st', 'c-now', true);
        });
        expect(mockLoadProject).toHaveBeenCalledTimes(1);
        expect(hook.result.current.continueOptions).toBeNull();
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

    test('未保存の変更があり確認で断ったら読み込まない', async () => {
        mockProjectChanged = true;
        window.confirm = jest.fn(() => false);
        mockGetContinuable.mockResolvedValue({ current: PREVIOUS, previous: null });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.handleLoadSubmission('current');
        });
        expect(window.confirm).toHaveBeenCalled();
        expect(mockLoadProject).not.toHaveBeenCalled();
        expect(hook.result.current.loadedChoice).toBeNull();
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

    test('ステータス画面用に選択肢を取り直せる', async () => {
        mockGetContinuable.mockResolvedValue({ current: PREVIOUS, previous: null });
        const { hook } = setup();
        await act(async () => {
            await hook.result.current.refreshContinueOptions();
        });
        expect(hook.result.current.continueOptions).toEqual({ current: PREVIOUS, previous: null });
    });
});
