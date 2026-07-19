import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

const mockFetchReports = jest.fn();
const mockFetchList = jest.fn();
const mockFetchDetail = jest.fn();
const mockSetStatus = jest.fn();
jest.mock('../../src/lib/admin-api.js', () => ({
    fetchSharedReports: (...args) => mockFetchReports(...args),
    fetchSharedAssignments: (...args) => mockFetchList(...args),
    fetchSharedAssignment: (...args) => mockFetchDetail(...args),
    setSharedStatus: (...args) => mockSetStatus(...args)
}));

import SharedAssignmentsView from '../../src/components/shared-assignments-view.jsx';

const queueEntry = {
    sharedId: 's1',
    count: 2,
    reports: [{reason: '不適切な内容', createdAt: '2026-07-18T00:00:00Z'}],
    item: {sharedId: 's1', title: 'ねこあつめ入門', status: 'published'}
};

const detail = {
    sharedId: 's1',
    title: 'ねこあつめ入門',
    status: 'published',
    authorName: 'るびお',
    authorAffiliation: '島根県',
    schoolLevel: 'junior-high',
    subject: '技術・家庭（技術分野）',
    tags: ['甲子園'],
    supplementUrl: 'https://docs.google.com/x',
    reuseCount: 4,
    pages: [{text: 'ページ1', imageUrl: null}],
    starterUrl: 'https://signed.example/starter.sb3'
};

describe('SharedAssignmentsView (issue #1083)', () => {
    beforeEach(() => {
        mockFetchReports.mockReset().mockResolvedValue({queue: [queueEntry]});
        mockFetchList.mockReset().mockResolvedValue({items: [queueEntry.item]});
        mockFetchDetail.mockReset().mockResolvedValue(detail);
        mockSetStatus.mockReset();
    });

    test('shows the report queue with counts and reasons', async () => {
        render(<SharedAssignmentsView />);
        await waitFor(() => expect(screen.getByTestId('shared-admin-queue')).toBeInTheDocument());
        const item = screen.getByTestId('shared-admin-queue-item-s1');
        expect(item.textContent).toContain('ねこあつめ入門');
        expect(item.textContent).toContain('通報 2 件');
        expect(item.textContent).toContain('不適切な内容');
    });

    test('the all-posts tab lists every item', async () => {
        render(<SharedAssignmentsView />);
        fireEvent.click(screen.getByTestId('shared-admin-tab-all'));
        await waitFor(() => expect(screen.getByTestId('shared-admin-list')).toBeInTheDocument());
        expect(mockFetchList).toHaveBeenCalled();
    });

    test('unpublish flows through an explicit confirmation and refreshes', async () => {
        mockSetStatus.mockResolvedValue({...detail, status: 'unlisted'});
        render(<SharedAssignmentsView />);
        await waitFor(() => screen.getByTestId('shared-admin-queue-item-s1'));
        fireEvent.click(screen.getByTestId('shared-admin-queue-item-s1'));
        await waitFor(() => screen.getByTestId('shared-admin-detail'));

        expect(screen.getByTestId('shared-admin-credit').textContent).toContain('CC BY 4.0');
        fireEvent.click(screen.getByTestId('shared-admin-flip'));
        expect(mockSetStatus).not.toHaveBeenCalled();
        expect(screen.getByTestId('shared-admin-confirm').textContent).toContain('非公開');

        fireEvent.click(screen.getByTestId('shared-admin-confirm-yes'));
        await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith('s1', 'unlisted'));
        // The queue reloads after a change.
        await waitFor(() => expect(mockFetchReports.mock.calls.length).toBeGreaterThan(1));
    });

    test('the detail offers the starter download, or says there is none', async () => {
        const first = render(<SharedAssignmentsView />);
        await waitFor(() => screen.getByTestId('shared-admin-queue-item-s1'));
        fireEvent.click(screen.getByTestId('shared-admin-queue-item-s1'));
        await waitFor(() => screen.getByTestId('shared-admin-detail'));
        expect(screen.getByTestId('shared-admin-starter-download')).toHaveAttribute(
            'href', 'https://signed.example/starter.sb3');
        first.unmount();

        // Without a starter: an explicit "none" note, no dead link.
        mockFetchDetail.mockResolvedValue({...detail, starterUrl: null});
        render(<SharedAssignmentsView />);
        await waitFor(() => screen.getByTestId('shared-admin-queue-item-s1'));
        fireEvent.click(screen.getByTestId('shared-admin-queue-item-s1'));
        await waitFor(() => expect(screen.getByTestId('shared-admin-starter').textContent)
            .toContain('スタータープロジェクトなし'));
        expect(screen.queryByTestId('shared-admin-starter-download')).not.toBeInTheDocument();
    });

    test('the confirmation can be cancelled without any API call', async () => {
        render(<SharedAssignmentsView />);
        await waitFor(() => screen.getByTestId('shared-admin-queue-item-s1'));
        fireEvent.click(screen.getByTestId('shared-admin-queue-item-s1'));
        await waitFor(() => screen.getByTestId('shared-admin-detail'));

        fireEvent.click(screen.getByTestId('shared-admin-flip'));
        fireEvent.click(screen.getByTestId('shared-admin-confirm-no'));
        expect(mockSetStatus).not.toHaveBeenCalled();
        expect(screen.queryByTestId('shared-admin-confirm')).not.toBeInTheDocument();
    });
});
