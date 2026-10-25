/* eslint-env jest */
/**
 * `groupsLoaded` tells "class list not loaded yet" apart from "no classes", so
 * the menu bar's「いまの課題を開く」request does not wait forever (#1199).
 */
import { renderHook, waitFor } from '@testing-library/react';
import useTeacherGroups from '../../../src/containers/use-teacher-groups.js';

const mockListGroups = jest.fn();
const mockMigrateGroups = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        listGroups: (...args) => mockListGroups(...args),
        migrateGroups: (...args) => mockMigrateGroups(...args),
    },
}));
jest.mock('../../../src/lib/log.js', () => ({ error: jest.fn() }));

const baseProps = {
    handleTeacher401: jest.fn(),
    setClassrooms: jest.fn(),
    setSelectedClassroom: jest.fn(),
    loadClassrooms: jest.fn(() => Promise.resolve()),
    clearError: jest.fn(),
    showError: jest.fn(),
    intl: { formatMessage: () => '' },
    setIsLoading: jest.fn(),
    setPhase: jest.fn(),
};

const renderGroups = (idToken) =>
    renderHook((props) => useTeacherGroups(props), { initialProps: { ...baseProps, idToken } });

describe('useTeacherGroups groupsLoaded (#1199)', () => {
    beforeEach(() => {
        mockListGroups.mockReset();
        mockMigrateGroups.mockReset().mockResolvedValue({});
    });

    test('is false without a login', () => {
        const { result } = renderGroups(null);
        expect(result.current.groupsLoaded).toBe(false);
    });

    test('becomes true when the list loads empty', async () => {
        mockListGroups.mockResolvedValue({ groups: [] });
        const { result } = renderGroups('tok');
        expect(result.current.groupsLoaded).toBe(false);
        await waitFor(() => expect(result.current.groupsLoaded).toBe(true));
        expect(result.current.groups).toEqual([]);
    });

    test('becomes true when the list fails to load', async () => {
        mockListGroups.mockRejectedValue(new Error('network'));
        const { result } = renderGroups('tok');
        await waitFor(() => expect(result.current.groupsLoaded).toBe(true));
    });

    test('resets for a different login', async () => {
        mockListGroups.mockResolvedValue({ groups: [{ groupId: 'g1', schemaVersion: 2 }] });
        const { result, rerender } = renderGroups('tok-a');
        await waitFor(() => expect(result.current.groupsLoaded).toBe(true));
        mockListGroups.mockReturnValue(new Promise(() => {}));
        rerender({ ...baseProps, idToken: 'tok-b' });
        expect(result.current.groupsLoaded).toBe(false);
    });
});
