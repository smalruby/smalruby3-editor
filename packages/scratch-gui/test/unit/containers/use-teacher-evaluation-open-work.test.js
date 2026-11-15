/* eslint-env jest */
/**
 * 採点の右の列の［作品を開く］(#1980)。
 *
 * - 読み込んだときの提出の `projectUrl` をセルに残し、課題の詳細の［スモウルビーで開く］と
 *   同じ処理（openSubmission）で開く。
 * - `projectUrl` は期限つき（既定 1 時間）の URL なので、読み込んでから時間がたっていたら、
 *   表を読み込み直さずに（採点を消さずに）その課題の提出の URL だけを取り直す。
 * - 取り直せないときは、読み込み直すよう知らせる。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherEvaluation from '../../../src/containers/use-teacher-evaluation.js';

const mockListSubmissions = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        getAssignment: jest.fn(() => Promise.resolve({})),
        listSubmissions: (...args) => mockListSubmissions(...args),
    },
}));

const submissionsWith = (tag) =>
    [1, 2].map((n) => ({
        submissionId: `s${n}`,
        memberId: `seat-0${n}`,
        status: 'submitted',
        projectUrl: `https://example.invalid/${tag}/${n}.sb3`,
    }));

const setup = async (openSubmission = jest.fn(() => Promise.resolve())) => {
    const deps = {
        idToken: 'id-token',
        classrooms: [{ classroomId: 'c1', groupId: 'g1', assignmentName: '迷路' }],
        handleTeacher401: jest.fn(),
        clearError: jest.fn(),
        showError: jest.fn(),
        intl: { formatMessage: (m) => m.defaultMessage || m.id || String(m) },
        setPhase: jest.fn(),
        openSubmission,
    };
    const hook = renderHook(() => useTeacherEvaluation(deps));
    await act(async () => {
        hook.result.current.handleShowEvaluation({ groupId: 'g1', name: '技術' });
    });
    await act(async () => {
        await hook.result.current.handleLoadSubmissions();
    });
    return { hook, deps };
};

const openWork = async (hook, seat) => {
    await act(async () => {
        await hook.result.current.handleOpenWork(seat, 'c1');
    });
};

let now;
beforeEach(() => {
    jest.clearAllMocks();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockListSubmissions.mockResolvedValue({ submissions: submissionsWith('first') });
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
});

afterEach(() => {
    Date.now.mockRestore();
});

describe('useTeacherEvaluation — 作品を開く (#1980)', () => {
    test('開く処理が渡されなければ handleOpenWork は null（ボタンを出さない）', async () => {
        const deps = {
            idToken: 'id-token',
            classrooms: [],
            handleTeacher401: jest.fn(),
            clearError: jest.fn(),
            showError: jest.fn(),
            intl: { formatMessage: (m) => m.defaultMessage },
            setPhase: jest.fn(),
        };
        const hook = renderHook(() => useTeacherEvaluation(deps));
        expect(hook.result.current.handleOpenWork).toBeNull();
    });

    test('読み込んだ URL をセルに残し、すぐなら取り直さずにその URL で開く', async () => {
        const { hook, deps } = await setup();
        expect(hook.result.current.getCell(2, 'c1').projectUrl).toBe('https://example.invalid/first/2.sb3');
        mockListSubmissions.mockClear();
        now += 10 * 60 * 1000;
        await openWork(hook, 2);
        expect(mockListSubmissions).not.toHaveBeenCalled();
        expect(deps.openSubmission).toHaveBeenCalledWith('https://example.invalid/first/2.sb3');
    });

    test('時間がたっていたら、その課題の URL だけを取り直して開く（採点は消さない）', async () => {
        const { hook, deps } = await setup();
        act(() => {
            hook.result.current.handleSetCellGrade(1, 'c1', 'S');
        });
        mockListSubmissions.mockClear();
        mockListSubmissions.mockResolvedValue({ submissions: submissionsWith('fresh') });
        now += 55 * 60 * 1000;
        await openWork(hook, 2);
        expect(mockListSubmissions).toHaveBeenCalledWith('id-token', 'c1');
        expect(deps.openSubmission).toHaveBeenCalledWith('https://example.invalid/fresh/2.sb3');
        // ほかの席の URL も新しくなり、採点はそのまま
        expect(hook.result.current.getCell(1, 'c1').projectUrl).toBe('https://example.invalid/fresh/1.sb3');
        expect(hook.result.current.getCell(1, 'c1').grade).toBe('S');
        // 取り直したばかりなので、続けて開くときは取り直さない
        mockListSubmissions.mockClear();
        await openWork(hook, 1);
        expect(mockListSubmissions).not.toHaveBeenCalled();
        expect(deps.openSubmission).toHaveBeenLastCalledWith('https://example.invalid/fresh/1.sb3');
    });

    test('取り直せない（提出が無くなった・失敗した）ときは開かずに、読み込み直すよう知らせる', async () => {
        const { hook, deps } = await setup();
        now += 55 * 60 * 1000;
        mockListSubmissions.mockResolvedValue({ submissions: [] });
        await openWork(hook, 2);
        mockListSubmissions.mockRejectedValue(new Error('network'));
        await openWork(hook, 1);
        expect(deps.openSubmission).not.toHaveBeenCalled();
        expect(deps.showError).toHaveBeenCalledTimes(2);
        expect(deps.showError).toHaveBeenCalledWith(
            'The work could not be opened. Load the submissions again and try once more.',
        );
    });

    test('取り直しで 401 ならログインし直しへ', async () => {
        const { hook, deps } = await setup();
        now += 55 * 60 * 1000;
        mockListSubmissions.mockRejectedValue(Object.assign(new Error('expired'), { status: 401 }));
        await openWork(hook, 2);
        expect(deps.handleTeacher401).toHaveBeenCalledTimes(1);
        expect(deps.openSubmission).not.toHaveBeenCalled();
        expect(deps.showError).not.toHaveBeenCalled();
    });

    test('URL をセルに足しても、書き出していない採点の判定は変わらない', async () => {
        const { hook } = await setup();
        expect(hook.result.current.hasUnsavedWork).toBe(false);
    });
});
