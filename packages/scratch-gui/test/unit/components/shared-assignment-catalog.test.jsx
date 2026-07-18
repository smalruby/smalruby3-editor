/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import SharedAssignmentCatalog from '../../../src/components/classroom-modal/shared-assignment-catalog.jsx';

const item = (over = {}) => ({
    sharedId: 's1',
    title: 'ねこあつめ入門',
    summary: 'はじめてのゲームづくり',
    schoolLevel: 'junior-high',
    grades: [1, 2],
    subject: '技術・家庭（技術分野）',
    tags: ['甲子園'],
    authorName: 'るびお',
    reuseCount: 4,
    status: 'published',
    ...over,
});

const detail = (over = {}) => ({
    ...item(),
    pages: [{ text: 'ページ1', imageUrl: null }],
    starterUrl: 'https://signed.example/starter',
    hasStarter: true,
    supplementUrl: 'https://docs.google.com/document/d/abc/view',
    isMine: false,
    ...over,
});

const sharedState = (over = {}) => ({
    showCatalog: true,
    catalogTab: 'all',
    catalogItems: [item()],
    catalogCursor: null,
    catalogLoading: false,
    sharedDetail: null,
    lastImported: null,
    reportSent: false,
    handleOpenCatalog: jest.fn(),
    handleCloseCatalog: jest.fn(),
    handleCatalogTabChange: jest.fn(),
    handleApplyCatalogFilters: jest.fn(),
    handleLoadMoreCatalog: jest.fn(),
    handleOpenSharedDetail: jest.fn(),
    handleCloseSharedDetail: jest.fn(),
    handleImportShared: jest.fn(),
    handleSetSharedStatus: jest.fn(),
    handleReportShared: jest.fn(),
    ...over,
});

const group = { groupId: 'g1', name: '技術', year: 2026 };

const renderCatalog = (shared) =>
    render(
        <IntlProvider locale="en">
            <SharedAssignmentCatalog group={group} isLoading={false} shared={shared} />
        </IntlProvider>,
    );

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

describe('SharedAssignmentCatalog (issue #1070)', () => {
    test('renders catalog cards with author and reuse count', () => {
        renderCatalog(sharedState());
        const card = byTestId('shared-catalog-item-s1');
        expect(card).toBeInTheDocument();
        expect(card.textContent).toContain('ねこあつめ入門');
        expect(card.textContent).toContain('るびお');
        expect(card.textContent).toContain('4');
    });

    test('applies attribute filters through the hook', () => {
        const shared = sharedState();
        renderCatalog(shared);
        fireEvent.change(byTestId('shared-catalog-filter-level'), { target: { value: 'junior-high' } });
        fireEvent.change(byTestId('shared-catalog-filter-subject'), {
            target: { value: '技術・家庭（技術分野）' },
        });
        fireEvent.change(byTestId('shared-catalog-filter-tag'), { target: { value: '甲子園' } });
        fireEvent.click(byTestId('shared-catalog-filter-apply'));

        expect(shared.handleApplyCatalogFilters).toHaveBeenCalledWith({
            schoolLevel: 'junior-high',
            subject: '技術・家庭（技術分野）',
            tag: '甲子園',
        });
    });

    test('opening a card requests its detail; import passes the current group', () => {
        const shared = sharedState();
        renderCatalog(shared);
        fireEvent.click(byTestId('shared-catalog-open-s1'));
        expect(shared.handleOpenSharedDetail).toHaveBeenCalledWith('s1');

        const withDetail = sharedState({ sharedDetail: detail() });
        renderCatalog(withDetail);
        fireEvent.click(byTestId('shared-detail-import'));
        expect(withDetail.handleImportShared).toHaveBeenCalledWith('s1', 'g1');
    });

    test('the supplement URL opens only after an explicit confirmation naming the domain (D4)', () => {
        renderCatalog(sharedState({ sharedDetail: detail() }));
        expect(byTestId('shared-detail-url-open')).not.toBeInTheDocument();

        fireEvent.click(byTestId('shared-detail-url'));
        expect(byTestId('shared-detail-url-confirm').textContent).toContain('docs.google.com');
        const anchor = byTestId('shared-detail-url-open');
        expect(anchor).toHaveAttribute('href', 'https://docs.google.com/document/d/abc/view');
        expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
        expect(anchor).toHaveAttribute('target', '_blank');
    });

    test('shows the CC BY credit line on the detail', () => {
        renderCatalog(sharedState({
            sharedDetail: detail({ authorAffiliation: '島根県 公立中学校' }),
        }));
        expect(byTestId('shared-detail-credit').textContent).toBe(
            '© るびお（島根県 公立中学校） / CC BY 4.0',
        );
    });

    test('strangers get a report flow; the reason is required', () => {
        const shared = sharedState({ sharedDetail: detail() });
        renderCatalog(shared);
        fireEvent.click(byTestId('shared-detail-report'));
        expect(byTestId('shared-report-submit')).toBeDisabled();
        fireEvent.change(byTestId('shared-report-reason'), { target: { value: '不適切な内容' } });
        fireEvent.click(byTestId('shared-report-submit'));
        expect(shared.handleReportShared).toHaveBeenCalledWith('s1', '不適切な内容');
    });

    test('own published posts offer unlist; own unlisted posts offer republish (no import)', () => {
        const mine = sharedState({ sharedDetail: detail({ isMine: true }) });
        const { unmount } = renderCatalog(mine);
        fireEvent.click(byTestId('shared-detail-unlist'));
        expect(mine.handleSetSharedStatus).toHaveBeenCalledWith('s1', 'unlisted');
        unmount();

        const unlisted = sharedState({
            sharedDetail: detail({ isMine: true, status: 'unlisted' }),
        });
        renderCatalog(unlisted);
        expect(byTestId('shared-detail-import')).not.toBeInTheDocument();
        fireEvent.click(byTestId('shared-detail-republish'));
        expect(unlisted.handleSetSharedStatus).toHaveBeenCalledWith('s1', 'published');
    });

    test('shows load-more only when a cursor is present', () => {
        renderCatalog(sharedState());
        expect(byTestId('shared-catalog-load-more')).not.toBeInTheDocument();

        const shared = sharedState({ catalogCursor: 'abc' });
        renderCatalog(shared);
        fireEvent.click(byTestId('shared-catalog-load-more'));
        expect(shared.handleLoadMoreCatalog).toHaveBeenCalled();
    });

    test('the mine tab hides the filters and marks unlisted items', () => {
        renderCatalog(sharedState({
            catalogTab: 'mine',
            catalogItems: [item({ status: 'unlisted' })],
        }));
        expect(byTestId('shared-catalog-filter-apply')).not.toBeInTheDocument();
        expect(byTestId('shared-catalog-item-s1').textContent).toContain('Unlisted');
    });
});
