import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

const mockFetchReports = jest.fn();
const mockFetchReport = jest.fn();
const mockUpdateReport = jest.fn();
jest.mock('../../src/lib/bug-report-api.js', () => ({
    fetchBugReports: (...args) => mockFetchReports(...args),
    fetchBugReport: (...args) => mockFetchReport(...args),
    updateBugReport: (...args) => mockUpdateReport(...args)
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
    // Real reports carry appContext as an OBJECT (crashed the first E2E run) —
    // the view must render it as JSON text, never as a React child.
    appContext: {rubyVersion: 2, url: 'https://smalruby.app/'},
    developerReply: '',
    projectUrl: 'https://signed.example/project.sb3',
    thumbnailUrl: 'https://signed.example/thumb.png',
    screenshotUrls: ['https://signed.example/ss0.png']
};

describe('BugReportsView (issue #1085 + 状態変更/コメント)', () => {
    beforeEach(() => {
        mockFetchReports.mockReset().mockResolvedValue({reports: [listEntry]});
        mockFetchReport.mockReset().mockResolvedValue(detail);
        mockUpdateReport.mockReset().mockResolvedValue({});
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

    test('the detail shows attachments via presigned URLs', async () => {
        render(<BugReportsView />);
        await waitFor(() => screen.getByTestId('bug-admin-item-r1'));
        fireEvent.click(screen.getByTestId('bug-admin-item-r1'));
        await waitFor(() => screen.getByTestId('bug-admin-detail'));

        expect(screen.getByTestId('bug-admin-description').textContent).toBe('ブロックが消える');
        expect(screen.getByTestId('bug-admin-project-download')).toHaveAttribute(
            'href', 'https://signed.example/project.sb3');
        expect(screen.getByTestId('bug-admin-screenshot-0')).toHaveAttribute(
            'src', 'https://signed.example/ss0.png');
        expect(screen.getByTestId('bug-admin-app-context').textContent).toContain('rubyVersion');
        expect(mockFetchReport).toHaveBeenCalledWith('r1');
    });

    test('save is disabled until something changes, then sends only the changes', async () => {
        render(<BugReportsView />);
        await waitFor(() => screen.getByTestId('bug-admin-item-r1'));
        fireEvent.click(screen.getByTestId('bug-admin-item-r1'));
        await waitFor(() => screen.getByTestId('bug-admin-detail'));

        expect(screen.getByTestId('bug-admin-save')).toBeDisabled();

        fireEvent.change(screen.getByTestId('bug-admin-reply-input'),
            {target: {value: '再現を確認しました。次のリリースで修正します。'}});
        expect(screen.getByTestId('bug-admin-save')).toBeEnabled();

        fireEvent.click(screen.getByTestId('bug-admin-save'));
        expect(mockUpdateReport).not.toHaveBeenCalled();
        expect(screen.getByTestId('bug-admin-save-confirm').textContent).toContain('報告者にも表示');

        fireEvent.click(screen.getByTestId('bug-admin-save-yes'));
        await waitFor(() => expect(mockUpdateReport).toHaveBeenCalledWith('r1',
            {developerReply: '再現を確認しました。次のリリースで修正します。'}));
        await waitFor(() => screen.getByTestId('bug-admin-saved'));
        // The list refetches after a change.
        expect(mockFetchReports.mock.calls.length).toBeGreaterThan(1);
    });

    test('a terminal status change warns about the auto-delete TTL', async () => {
        render(<BugReportsView />);
        await waitFor(() => screen.getByTestId('bug-admin-item-r1'));
        fireEvent.click(screen.getByTestId('bug-admin-item-r1'));
        await waitFor(() => screen.getByTestId('bug-admin-detail'));

        fireEvent.change(screen.getByTestId('bug-admin-status-select'),
            {target: {value: 'resolved'}});
        fireEvent.click(screen.getByTestId('bug-admin-save'));
        expect(screen.getByTestId('bug-admin-save-confirm').textContent).toContain('自動削除');

        fireEvent.click(screen.getByTestId('bug-admin-save-yes'));
        await waitFor(() => expect(mockUpdateReport).toHaveBeenCalledWith('r1', {status: 'resolved'}));
    });

    test('the confirmation can be cancelled without any API call', async () => {
        render(<BugReportsView />);
        await waitFor(() => screen.getByTestId('bug-admin-item-r1'));
        fireEvent.click(screen.getByTestId('bug-admin-item-r1'));
        await waitFor(() => screen.getByTestId('bug-admin-detail'));

        fireEvent.change(screen.getByTestId('bug-admin-status-select'),
            {target: {value: 'in_progress'}});
        fireEvent.click(screen.getByTestId('bug-admin-save'));
        fireEvent.click(screen.getByTestId('bug-admin-save-no'));
        expect(mockUpdateReport).not.toHaveBeenCalled();
        expect(screen.queryByTestId('bug-admin-save-confirm')).not.toBeInTheDocument();
    });

    test('an attachment whose upload never completed is hidden, not broken', async () => {
        render(<BugReportsView />);
        await waitFor(() => screen.getByTestId('bug-admin-item-r1'));
        const thumb = screen.getByTestId('bug-admin-item-r1').querySelector('img');
        fireEvent.error(thumb);
        expect(thumb).toHaveStyle({display: 'none'});

        fireEvent.click(screen.getByTestId('bug-admin-item-r1'));
        await waitFor(() => screen.getByTestId('bug-admin-detail'));
        const screenshot = screen.getByTestId('bug-admin-screenshot-0');
        fireEvent.error(screenshot);
        expect(screenshot).toHaveStyle({display: 'none'});
    });

    test('an API error surfaces instead of the list', async () => {
        mockFetchReports.mockRejectedValue(new Error('Administrator privileges are required'));
        render(<BugReportsView />);
        await waitFor(() => expect(screen.getByTestId('bug-admin-error')).toHaveTextContent(
            'Administrator privileges are required'));
    });
});
