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

describe('TeacherMemberDetail — レッスンの詳細 (#1603)', () => {
    const NOW = new Date(2026, 10, 15, 10, 30).getTime();
    const name = (id) => ({ id: `c.${id}`, defaultMessage: id.toUpperCase() });
    const lessonDetail = {
        progress: { cleared: false, shown: 2, target: 3, requiredLeft: 1 },
        rows: [
            {
                id: 'a',
                challenge: { name: name('a') },
                kind: 'done',
                completedAt: new Date(2026, 10, 15, 10, 23).toISOString(),
                required: false,
                lessonStart: true,
            },
            {
                id: 'b',
                challenge: { name: name('b') },
                kind: 'before',
                completedAt: new Date(2026, 10, 10, 9, 0).toISOString(),
                required: true,
                lessonStart: false,
            },
            {
                id: 'c',
                challenge: { name: name('c') },
                kind: 'current',
                elapsedMs: 12 * 60 * 1000,
                required: false,
                lessonStart: false,
            },
            { id: 'd', challenge: { name: name('d') }, kind: 'todo', required: true, lessonStart: true },
        ],
    };

    test('チャレンジごとに、できた時刻・前からできた日・いまやっている（分）・まだ', () => {
        renderDetail(member(), { lessonDetail, lessonNow: NOW });
        expect(byTestId('classroom-member-lesson-detail-count')).toHaveTextContent('2 / 3');
        expect(byTestId('classroom-member-lesson-detail-a')).toHaveTextContent(/10:23/);
        expect(byTestId('classroom-member-lesson-detail-b')).toHaveTextContent('Before 11/10');
        expect(byTestId('classroom-member-lesson-detail-c')).toHaveTextContent('▶ On it now (12 min)');
        expect(byTestId('classroom-member-lesson-detail-d')).toHaveTextContent('・');
    });

    test('作品も提出する課題では、その下に作品の詳細が続く', () => {
        renderDetail(member(), { lessonDetail, lessonNow: NOW });
        expect(byTestId('classroom-member-detail-thumbnail')).toBeInTheDocument();
    });

    test('作品を出さない課題では、提出の印と作品の詳細を出さない', () => {
        renderDetail(member({ hasSubmission: false }), { lessonDetail, lessonNow: NOW, showSubmission: false });
        expect(byTestId('classroom-member-detail-not-submitted')).toBeNull();
        expect(byTestId('classroom-member-lesson-detail')).toBeInTheDocument();
    });

    test('退出した席（メンバーがいない）でも記録を出す', () => {
        render(
            <IntlProvider locale="en">
                <TeacherMemberDetail
                    isLoading={false}
                    lessonDetail={lessonDetail}
                    lessonNow={NOW}
                    memberMap={{}}
                    members={[]}
                    selectedMember="seat-05"
                    onDeleteMember={jest.fn()}
                    onOpenSubmission={jest.fn()}
                    onReturnSubmission={jest.fn()}
                />
            </IntlProvider>,
        );
        expect(byTestId('classroom-member-lesson-detail')).toBeInTheDocument();
    });
});
