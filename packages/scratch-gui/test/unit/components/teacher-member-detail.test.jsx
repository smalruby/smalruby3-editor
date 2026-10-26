/* eslint-env jest */
/**
 * メンバー詳細の「他の生徒に見せない」切り替え (#1208)。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherMemberDetail from '../../../src/components/classroom-modal/teacher-member-detail.jsx';

const member = (over = {}) => ({
    memberId: 'seat-3',
    displayName: 'たろう',
    hasSubmission: true,
    submissionId: 'sub-1',
    submissionStatus: 'submitted',
    submittedAt: '2026-10-26T01:00:00.000Z',
    thumbnailUrl: 'https://example.com/t.png',
    screenshotUrls: [],
    hiddenFromPeers: false,
    ...over,
});

const renderDetail = (m, props = {}) =>
    render(
        <IntlProvider locale="en">
            <TeacherMemberDetail
                isLoading={false}
                memberMap={{ [m.memberId]: m }}
                members={[m]}
                selectedMember={m.memberId}
                onDeleteMember={jest.fn()}
                onOpenSubmission={jest.fn()}
                onReturnSubmission={jest.fn()}
                {...props}
            />
        </IntlProvider>,
    );

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

describe('TeacherMemberDetail — 他の生徒に見せない (#1208)', () => {
    test('提出があればチェックボックスを出し、切り替えを提出 ID 付きで伝える', () => {
        const onSetHiddenFromPeers = jest.fn();
        renderDetail(member(), { onSetHiddenFromPeers });
        const checkbox = byTestId('classroom-member-detail-hide-from-peers');
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        expect(onSetHiddenFromPeers).toHaveBeenCalledWith('sub-1', true);
    });

    test('非表示の提出はチェック済みで、外すと false を伝える', () => {
        const onSetHiddenFromPeers = jest.fn();
        renderDetail(member({ hiddenFromPeers: true }), { onSetHiddenFromPeers });
        const checkbox = byTestId('classroom-member-detail-hide-from-peers');
        expect(checkbox).toBeChecked();
        fireEvent.click(checkbox);
        expect(onSetHiddenFromPeers).toHaveBeenCalledWith('sub-1', false);
    });

    test('未提出のときは出さない', () => {
        renderDetail(member({ hasSubmission: false, submissionId: undefined }), {
            onSetHiddenFromPeers: jest.fn(),
        });
        expect(byTestId('classroom-member-detail-hide-from-peers')).not.toBeInTheDocument();
    });
});
