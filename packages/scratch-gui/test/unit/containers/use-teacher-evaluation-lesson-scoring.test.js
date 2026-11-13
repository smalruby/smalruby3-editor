/* eslint-env jest */
/**
 * 採点の画面からレッスンの点を保存する (#1778 のレビュー M1 / FYI1 / FYI2 / FYI4・#1787)。
 *
 * - #1787: 点だけの API（PATCH .../assignment/lesson-scoring）に `{scoring}` だけを送る。
 *   ページ・はじめのプロジェクトは送らない（GET と PUT のあいだに差し替えた画像を消さない）
 * - M1: 画面は返ってきた lesson（ほかで変えた設定も入っている）に合わせる
 * - FYI1: 点が変わっていなければ保存しない
 * - FYI2: 保存に失敗したら、サーバーの値を読み直して合わせる
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherEvaluation from '../../../src/containers/use-teacher-evaluation.js';

const mockGetAssignment = jest.fn();
const mockSetAssignment = jest.fn();
const mockSetLessonScoring = jest.fn();
const mockGetLessonProgress = jest.fn();
const mockListSubmissions = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getAssignment: (...args) => mockGetAssignment(...args),
        setAssignment: (...args) => mockSetAssignment(...args),
        setLessonScoring: (...args) => mockSetLessonScoring(...args),
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

describe('useTeacherEvaluation — レッスンの点の保存 (#1778 / #1787)', () => {
    beforeEach(() => {
        mockGetAssignment.mockReset();
        mockSetAssignment.mockReset();
        mockSetLessonScoring.mockReset();
        mockGetLessonProgress.mockReset();
        mockListSubmissions.mockReset();
        mockGetAssignment.mockResolvedValue({ assignment: content, lesson: opened });
        mockGetLessonProgress.mockResolvedValue({ lesson: opened, progress });
        mockSetLessonScoring.mockImplementation((token, id, scoring) => Promise.resolve({ lesson: { ...opened, scoring } }));
    });

    test('読み込み: 作品を出さないレッスンの課題は提出を取りに行かない・★ 2 つで 70 点', async () => {
        const { hook } = await setup();
        expect(mockListSubmissions).not.toHaveBeenCalled();
        expect(settingOf(hook)).toEqual(opened);
        expect(scoreOf(hook)).toBe(70);
    });

    test('#1787: 点だけの API に scoring だけを送る（読み直さない・ページやはじめのプロジェクトを送らない）', async () => {
        const { hook } = await setup();
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(mockSetLessonScoring).toHaveBeenCalledTimes(1);
        expect(mockSetLessonScoring).toHaveBeenCalledWith('id-token', 'c1', NEW_SCORING);
        expect(mockGetAssignment).not.toHaveBeenCalled();
        expect(mockSetAssignment).not.toHaveBeenCalled();
        expect(settingOf(hook)).toEqual({ ...opened, scoring: NEW_SCORING });
        expect(scoreOf(hook)).toBe(50);
        expect(hook.result.current.scoringSavingId).toBeNull();
    });

    test('#1787: 既定に戻すときは scoring: null を送る', async () => {
        const { hook } = await setup();
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', null);
        });
        expect(mockSetLessonScoring).toHaveBeenLastCalledWith('id-token', 'c1', null);
        expect(settingOf(hook).scoring).toBeNull();
        expect(scoreOf(hook)).toBe(70);
    });

    test('M1: 画面は返ってきた lesson に合わせる（開いたあとでほかが変えた設定を戻さない）', async () => {
        const { hook } = await setup();
        // 画面を開いたあとで、別のタブがチャレンジ・条件・コースに無い ID を足した
        const changedElsewhere = {
            ...opened,
            challengeIds: [...CH, 'blocks-l1-quiz', 'gone-id'],
            completion: { type: 'count', count: 4 },
            scoring: NEW_SCORING,
        };
        mockSetLessonScoring.mockResolvedValue({ lesson: changedElsewhere });
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        // 条件 4・必須 50 → ★ 2 つで 50 点
        expect(settingOf(hook)).toEqual(changedElsewhere);
        expect(scoreOf(hook)).toBe(50);
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
        expect(mockSetLessonScoring).not.toHaveBeenCalled();
        expect(mockGetAssignment).not.toHaveBeenCalled();
    });

    test('400: レッスンが外されていたら、短く知らせて表から外す', async () => {
        const { hook, deps } = await setup();
        mockSetLessonScoring.mockRejectedValue(Object.assign(new Error('This assignment has no lesson'), { status: 400 }));
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(deps.showError).toHaveBeenCalledWith(
            'This assignment no longer has a lesson, so the points were not saved.',
        );
        expect(settingOf(hook)).toBeNull();
        expect(hook.result.current.scoringSavingId).toBeNull();
    });

    test('401: 前の点に戻して、ログインし直しへ', async () => {
        const { hook, deps } = await setup();
        mockSetLessonScoring.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }));
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(deps.handleTeacher401).toHaveBeenCalled();
        expect(settingOf(hook)).toEqual(opened);
        expect(scoreOf(hook)).toBe(70);
    });

    test('FYI2: 保存が失敗しても、サーバーに保存されていればその値を出す', async () => {
        const { hook, deps } = await setup();
        mockSetLessonScoring.mockRejectedValue(new Error('network'));
        mockGetAssignment.mockResolvedValueOnce({
            assignment: content,
            lesson: { ...opened, scoring: NEW_SCORING },
        });
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(deps.showError).toHaveBeenCalled();
        expect(settingOf(hook).scoring).toEqual(NEW_SCORING);
        expect(scoreOf(hook)).toBe(50);
    });

    test('FYI2: 保存も読み直しも失敗したら、前の点に戻す', async () => {
        const { hook, deps } = await setup();
        mockSetLessonScoring.mockRejectedValue(new Error('network'));
        mockGetAssignment.mockRejectedValueOnce(new Error('network'));
        await act(async () => {
            await hook.result.current.handleChangeLessonScoring('c1', NEW_SCORING);
        });
        expect(deps.showError).toHaveBeenCalled();
        expect(settingOf(hook)).toEqual(opened);
        expect(scoreOf(hook)).toBe(70);
    });
});
