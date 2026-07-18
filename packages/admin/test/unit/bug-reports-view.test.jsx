import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

const mockFetchReports = jest.fn();
const mockFetchReport = jest.fn();
jest.mock('../../src/lib/bug-report-api.js', () => ({
    fetchBugReports: (...args) => mockFetchReports(...args),
    fetchBugReport: (...args) => mockFetchReport(...args)
}));

import BugReportsView from '../../src/components/bug-reports-view.jsx';

const listEntry = {
    reportId: 'r1',
    ownerEmail: 'teacher@example.com',
    description: 'ブロックが消える',
    projectName: 'ねこあつめ',
    status: 'open',
    thumbnailUrl: 'https://signed.example/thumb.png',
    createdAt: '2026-07-18T00:00:00.000Z'
};

const detail = {
    ...listEntry,
    userAgent: 'Mozilla/5.0',
    appContext: '{"tab":"ruby"}',
    developerReply: '',
    projectUrl: 'https://signed.example/project.sb3',
    thumbnailUrl: 'https://signed.example/thumb.png',
    screenshotUrls: ['https://signed.example/ss0.png']
};

describe('BugReportsView (issue #1085, read-only)', () => {
    beforeEach(() => {
        mockFetchReports.mockReset().mockResolvedValue({reports: [listEntry]});
        mockFetchReport.mockReset().mockResolvedValue(detail);
    });

    test('lists reports with status badge and owner', async () => {
        render(<BugReportsView />);
        await waitFor(() => expect(screen.getByTestId('bug-admin-list')).toBeInTheDocument());
        const item = screen.getByTestId('bug-admin-item-r1');
        expect(item.textContent).toContain('ねこあつめ');
        expect(item.textContent).toContain('未対応');
        expect(item.textContent).toContain('teacher@example.com');
        expect(mockFetchReports).toHaveBeenCalledWith('');
    });

    test('the status filter refetches with the chosen status', async () => {
        render(<BugReportsView />);
        await waitFor(() => screen.getByTestId('bug-admin-list'));
        fireEvent.change(screen.getByTestId('bug-admin-filter-status'), {target: {value: 'resolved'}});
        await waitFor(() => expect(mockFetchReports).toHaveBeenLastCalledWith('resolved'));
    });

    test('the detail shows attachments via presigned URLs — and offers no write actions', async () => {
        render(<BugReportsView />);
        await waitFor(() => screen.getByTestId('bug-admin-item-r1'));
        fireEvent.click(screen.getByTestId('bug-admin-item-r1'));
        await waitFor(() => screen.getByTestId('bug-admin-detail'));

        expect(screen.getByTestId('bug-admin-description').textContent).toBe('ブロックが消える');
        expect(screen.getByTestId('bug-admin-project-download')).toHaveAttribute(
            'href', 'https://signed.example/project.sb3');
        expect(screen.getByTestId('bug-admin-screenshot-0')).toHaveAttribute(
            'src', 'https://signed.example/ss0.png');
        // Read-only surface: no status select / reply textarea in the detail.
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(mockFetchReport).toHaveBeenCalledWith('r1');
    });

    test('an API error surfaces instead of the list', async () => {
        mockFetchReports.mockRejectedValue(new Error('Administrator privileges are required'));
        render(<BugReportsView />);
        await waitFor(() => expect(screen.getByTestId('bug-admin-error')).toHaveTextContent(
            'Administrator privileges are required'));
    });
});
