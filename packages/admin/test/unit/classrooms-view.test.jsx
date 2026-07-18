import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

const mockFetchClassrooms = jest.fn();
const mockFetchClassroom = jest.fn();
const mockSetStatus = jest.fn();
const mockFetchCandidates = jest.fn();
const mockFetchPlan = jest.fn();
const mockExecuteRestore = jest.fn();
jest.mock('../../src/lib/admin-api.js', () => ({
    fetchClassrooms: (...args) => mockFetchClassrooms(...args),
    fetchClassroom: (...args) => mockFetchClassroom(...args),
    setClassroomStatus: (...args) => mockSetStatus(...args),
    fetchRestoreCandidates: (...args) => mockFetchCandidates(...args),
    fetchRestorePlan: (...args) => mockFetchPlan(...args),
    executeRestore: (...args) => mockExecuteRestore(...args)
}));

import ClassroomsView from '../../src/components/classrooms-view.jsx';

const liveItem = {
    classroomId: 'c1',
    className: '5年1組',
    assignmentName: 'ねこあつめ',
    joinCode: 'ABC123',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    expiresAt: '2026-10-01T00:00:00.000Z'
};

const detail = {...liveItem, memberCount: 12, submissionCount: 8};

const plan = {
    alive: false,
    classroom: liveItem,
    deletedAt: '2026-07-10T00:00:00.000Z',
    memberCount: 12,
    submissionCount: 8,
    restoresGroup: true,
    missingFiles: 1
};

describe('ClassroomsView (issue #1084)', () => {
    beforeEach(() => {
        mockFetchClassrooms.mockReset().mockResolvedValue({items: [liveItem]});
        mockFetchClassroom.mockReset().mockResolvedValue(detail);
        mockSetStatus.mockReset();
        mockFetchCandidates.mockReset().mockResolvedValue({items: [{...liveItem, deletedAt: plan.deletedAt}]});
        mockFetchPlan.mockReset().mockResolvedValue(plan);
        mockExecuteRestore.mockReset();
    });

    test('the live tab lists classrooms up-front', async () => {
        render(<ClassroomsView />);
        await waitFor(() => expect(screen.getByTestId('classroom-admin-list')).toBeInTheDocument());
        const item = screen.getByTestId('classroom-admin-item-c1');
        expect(item.textContent).toContain('5年1組');
        expect(item.textContent).toContain('ABC123');
        expect(mockFetchClassrooms).toHaveBeenCalled();
    });

    test('archiving flows through an explicit confirmation', async () => {
        mockSetStatus.mockResolvedValue({...detail, status: 'archived'});
        render(<ClassroomsView />);
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('classroom-admin-detail'));

        expect(screen.getByTestId('classroom-admin-counts').textContent).toContain('参加 12 人');
        fireEvent.click(screen.getByTestId('classroom-admin-flip'));
        expect(mockSetStatus).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('classroom-admin-confirm-yes'));
        await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith('c1', 'archived'));
    });

    test('the restore tab requires an explicit search, then shows the plan', async () => {
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
        expect(screen.getByTestId('classroom-admin-hint')).toBeInTheDocument();
        expect(mockFetchCandidates).not.toHaveBeenCalled();

        fireEvent.change(screen.getByTestId('classroom-admin-query'), {target: {value: '5年'}});
        fireEvent.click(screen.getByTestId('classroom-admin-search'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        expect(mockFetchCandidates).toHaveBeenCalledWith('5年');

        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('restore-admin-plan'));
        expect(screen.getByTestId('restore-admin-summary').textContent).toContain('参加 12 人');
        expect(screen.getByTestId('restore-admin-summary').textContent).toContain('組も復元します');
        expect(screen.getByTestId('restore-admin-missing').textContent).toContain('1 件');
    });

    test('restore executes only after confirmation and reports the result', async () => {
        mockExecuteRestore.mockResolvedValue({restored: 22, missingFiles: 1, classroom: {...liveItem}});
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
        fireEvent.change(screen.getByTestId('classroom-admin-query'), {target: {value: 'abc123'}});
        fireEvent.click(screen.getByTestId('classroom-admin-search'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('restore-admin-plan'));

        fireEvent.click(screen.getByTestId('restore-admin-execute'));
        expect(mockExecuteRestore).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('restore-admin-confirm-yes'));
        await waitFor(() => expect(mockExecuteRestore).toHaveBeenCalledWith('c1'));
        await waitFor(() => screen.getByTestId('restore-admin-done'));
        expect(screen.getByTestId('restore-admin-done').textContent).toContain('22 件');
    });

    test('a still-alive classroom points the operator to the teacher UI', async () => {
        mockFetchPlan.mockResolvedValue({alive: true, status: 'archived'});
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
        fireEvent.change(screen.getByTestId('classroom-admin-query'), {target: {value: 'abc123'}});
        fireEvent.click(screen.getByTestId('classroom-admin-search'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('restore-admin-alive'));
        expect(screen.queryByTestId('restore-admin-execute')).not.toBeInTheDocument();
    });
});
