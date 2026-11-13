/* eslint-env jest */
/**
 * 採点の画面からレッスンの点を保存する (#1778 のレビュー M1 / FYI1 / FYI2 / FYI4)。
 *
 * - M1: 送る lesson は、保存の直前に GET したものに scoring だけを重ねる（開いたときの値で上書きしない）
 * - FYI1: 点が変わっていなければ保存しない
 * - FYI2: 保存に失敗したら、サーバーの値を読み直して合わせる
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherEvaluation from '../../../src/containers/use-teacher-evaluation.js';

const mockGetAssignment = jest.fn();
const mockSetAssignment = jest.fn();
const mockGetLessonProgress = jest.fn();
const mockListSubmissions = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getAssignment: (...args) => mockGetAssignment(...args),
        setAssignment: (...args) => mockSetAssignment(...args),
        getLessonProgress: (...args) => mockGetLessonProgress(...args),
        listSubmissions: (...args) => mockListSubmissions(...args),
    },
}));

const CH = [
    'blocks-l1-key-sound',
    'blocks-l1-arrow-move',
    'blocks-l1-click-say',
    'blocks-l1-repeat',
    'blocks-l1-if',
    'blocks-l1-ask-answer',
];
// ★ 2・「全部」: 必須 35 点ずつ・それ以外 7.5 点ずつ
const opened = {
    courseId: 'kyou-kara-programmer',
    challengeIds: CH,
    requiredChallengeIds: [CH[0], CH[3]],
    completion: { type: 'all' },
    submitWork: false,
    scoring: null,
};
const progress = [
    {
        memberId: 'seat-01',
        seatNumber: 1,
        challenges: {
            [CH[0]]: { completedAt: '2026-11-13T00:00:00.000Z', before: false },
            [CH[3]]: { completedAt: '2026-11-13T00:01:00.000Z', before: false },
        },
        current: null,
        updatedAt: '2026-11-13T00:02:00.000Z',
    },
];
const content = {
    pages: [{ text: 'p1', imageKey: 'c1/assignment/image-1.png', imageUrl: 'https://x' }],
    starterKey: 'c1/assignment/starter-1.sb3',
};
const NEW_SCORING = { total: 100, requiredPoints: 50, optionalPoints: 50 };

const setup = async () => {
    const deps = {
        idToken: 'id-token',
        classrooms: [{ classroomId: 'c1', groupId: 'g1', assignmentName: 'L', hasLesson: true }],
        handleTeacher401: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || m.id || String(m) },
        setPhase: jest.fn(),
    };
    const hook = renderHook(() => useTeacherEvaluation(deps));
    await act(async () => {
        hook.result.current.handleShowEvaluation({ groupId: 'g1', name: '技術' });
    });
    await act(async () => {
        await hook.result.current.handleLoadSubmissions();
    });
    mockGetAssignment.mockReset();
    return { hook, deps };
};

const settingOf = (hook) => hook.result.current.evalLessons[0].lessonSetting;
const scoreOf = (hook) => hook.result.current.lessonScores.c1.scores[1];

describe('useTeacherEvaluation — レッスンの点の保存 (#1778)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockSetAssignment.mockReset();
        mockGetLessonProgress.mockReset();
        mockListSubmissions.mockReset();
        mockGetAssignment.mockResolvedValue({ assignment: content, lesson: opened });
        mockGetLessonProgress.mockResolvedValue({ lesson: opened, progress });
        mockSetAssignment.mockResolvedValue({});
    });

    test('読み込み: 作品を出さないレッスンの課題は提出を取りに行かない・★ 2 つで 70 点', async () => {
        const { hook } = await setup();
        expect(mockListSubmissions).not.toHaveBeenCalled();
        expect(settingOf(hook)).toEqual(opened);
        expect(scoreOf(hook)).toBe(70);
    });

    test('M1: 保存の直前に読んだ lesson に scoring だけを重ねて送る（開いたあとでほかが変えた設定を戻さない）', async () => {
        const { hook } = await setup();
        // 画面を開いたあとで、別のタブがチャレンジ・条件・コースに無い ID を足した
        const changedElsewhere = {
            ...opened,
            challengeIds: [...CH, 'blocks-l1-quiz', 'gone-id'],
            completion: { type: 'count', count: 4 },
            scoring: { total: 100, requiredPoints: 60, optionalPoints: 40 },
        };
        mockGetAssignment.mockResolvedValue({ assignment: content, lesson: changedElsewhere });
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(mockSetAssignment).toHaveBeenCalledTimes(1);
        const [, id, body] = mockSetAssignment.mock.calls[0];
        expect(id).toBe('c1');
        expect(body.lesson).toEqual({ ...changedElsewhere, scoring: NEW_SCORING });
        expect(body.pages).toEqual([{ text: 'p1', imageKey: 'c1/assignment/image-1.png' }]);
        expect(body.keepStarter).toBe(true);
        // 画面もサーバーの設定に合わせる（条件 4・必須 50 → ★ 2 つで 50 点）
        expect(settingOf(hook)).toEqual({ ...changedElsewhere, scoring: NEW_SCORING });
        expect(scoreOf(hook)).toBe(50);
        expect(hook.result.current.scoringSavingId).toBeNull();
    });

    test('FYI1: 点が変わっていなければ保存しない（欄を出ただけ）', async () => {
        const { hook } = await setup();
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', null);
            await hook.result.current.handleChangeLessonScoring('c1', {
                total: 100,
                requiredPoints: 70,
                optionalPoints: 30,
            });
        });
        expect(mockGetAssignment).not.toHaveBeenCalled();
        expect(mockSetAssignment).not.toHaveBeenCalled();
    });

    test('M1: レッスンが外されていたら保存せず、短く知らせる', async () => {
        const { hook, deps } = await setup();
        mockGetAssignment.mockResolvedValue({ assignment: content, lesson: null });
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(mockSetAssignment).not.toHaveBeenCalled();
        expect(deps.showError).toHaveBeenCalledWith(
            'This assignment no longer has a lesson, so the points were not saved.',
        );
        expect(settingOf(hook)).toBeNull();
    });

    test('FYI2: PUT が失敗しても、サーバーに保存されていればその値を出す', async () => {
        const { hook, deps } = await setup();
        mockSetAssignment.mockRejectedValue(new Error('network'));
        mockGetAssignment
            .mockResolvedValueOnce({ assignment: content, lesson: opened })
            .mockResolvedValueOnce({ assignment: content, lesson: { ...opened, scoring: NEW_SCORING } });
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(deps.showError).toHaveBeenCalled();
        expect(settingOf(hook).scoring).toEqual(NEW_SCORING);
        expect(scoreOf(hook)).toBe(50);
    });

    test('FYI2: PUT も読み直しも失敗したら、前の点に戻す', async () => {
        const { hook, deps } = await setup();
        mockSetAssignment.mockRejectedValue(new Error('network'));
        mockGetAssignment
            .mockResolvedValueOnce({ assignment: content, lesson: opened })
            .mockRejectedValueOnce(new Error('network'));
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(deps.showError).toHaveBeenCalled();
        expect(settingOf(hook)).toEqual(opened);
        expect(scoreOf(hook)).toBe(70);
    });
});
