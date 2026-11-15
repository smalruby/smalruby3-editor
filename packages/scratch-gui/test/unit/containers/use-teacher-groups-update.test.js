/* eslint-env jest */
/**
 * クラスの設定の保存 (#1958 レビュー M1・M2):
 * - 成功・失敗を返す（成功したときだけ、呼び出した側が次の画面へ移る）。
 * - 保存して読み直したクラスで、開いているクラス（selectedGroup）も置きかえる。ヘッダーの
 *   クラス名・課題詳細・共有の画面が古い名前のまま残らないように。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherGroups from '../../../src/containers/use-teacher-groups.js';

const mockUpdateGroup = jest.fn();
const mockListGroups = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        updateGroup: (...args) => mockUpdateGroup(...args),
        listGroups: (...args) => mockListGroups(...args),
        migrateGroups: () => Promise.resolve({}),
    },
}));
jest.mock('../../../src/lib/log.js', () => ({ error: jest.fn() }));

const oldGroup = { groupId: 'g1', name: '技術', year: 2026, schemaVersion: 2 };
const otherGroup = { groupId: 'g2', name: '情報', year: 2026, schemaVersion: 2 };

const makeProps = () => ({
    idToken: 'tok',
    handleTeacher401: jest.fn(),
    setClassrooms: jest.fn(),
    setSelectedClassroom: jest.fn(),
    loadClassrooms: jest.fn(() => Promise.resolve()),
    clearError: jest.fn(),
    showError: jest.fn(),
    intl: { formatMessage: () => 'error' },
    setIsLoading: jest.fn(),
    setPhase: jest.fn(),
});

const renderGroups = async (props) => {
    const hook = renderHook(() => useTeacherGroups(props));
    // The first load of the classes (on login).
    await act(async () => {});
    return hook;
};

describe('useTeacherGroups handleUpdateGroup', () => {
    beforeEach(() => {
        mockUpdateGroup.mockReset().mockResolvedValue({});
        mockListGroups.mockReset().mockResolvedValue({ groups: [oldGroup, otherGroup] });
    });

    test('a new name shows in the opened class (the assignment detail reads it from there)', async () => {
        const props = makeProps();
        const { result } = await renderGroups(props);
        act(() => result.current.handleSelectGroup(oldGroup));
        mockListGroups.mockResolvedValue({ groups: [{ ...oldGroup, name: '技術・家庭' }, otherGroup] });

        let saved;
        await act(async () => {
            saved = await result.current.handleUpdateGroup('g1', { name: '技術・家庭' });
        });

        expect(saved).toBe(true);
        expect(mockUpdateGroup).toHaveBeenCalledWith('tok', 'g1', { name: '技術・家庭' });
        expect(result.current.selectedGroup.name).toBe('技術・家庭');
    });

    test('another opened class is left as it is', async () => {
        const props = makeProps();
        const { result } = await renderGroups(props);
        act(() => result.current.handleSelectGroup(otherGroup));
        await act(async () => {
            await result.current.handleUpdateGroup('g1', { name: '技術・家庭' });
        });
        expect(result.current.selectedGroup).toBe(otherGroup);
    });

    test('a failure returns false and leaves the error', async () => {
        const props = makeProps();
        const { result } = await renderGroups(props);
        act(() => result.current.handleSelectGroup(oldGroup));
        mockUpdateGroup.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

        let saved;
        await act(async () => {
            saved = await result.current.handleUpdateGroup('g1', { status: 'archived' });
        });

        expect(saved).toBe(false);
        expect(props.showError).toHaveBeenCalled();
        expect(result.current.selectedGroup).toBe(oldGroup);
    });

    test('an expired login returns false (the re-login takes over)', async () => {
        const props = makeProps();
        const { result } = await renderGroups(props);
        mockUpdateGroup.mockRejectedValue(Object.assign(new Error('expired'), { status: 401 }));

        let saved;
        await act(async () => {
            saved = await result.current.handleUpdateGroup('g1', { status: 'archived' });
        });

        expect(saved).toBe(false);
        expect(props.handleTeacher401).toHaveBeenCalled();
    });
});
