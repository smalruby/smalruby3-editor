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

describe('TeacherMemberDetail — ［退室させる］と提出時刻 (#1919 / #1923 C3)', () => {
    test('［退室させる］は ⋮ のメニューの中にあり、確認で［退室させる］を押すとメンバーの ID を渡す', () => {
        const onDeleteMember = jest.fn();
        renderDetail(member({ memberId: 'seat-04' }), { onDeleteMember });
        // 見出しの行には出さない（⋮ を開くまで無い）
        expect(byTestId('classroom-member-remove')).not.toBeInTheDocument();
        fireEvent.click(byTestId('classroom-member-more-menu'));
        fireEvent.click(byTestId('classroom-member-remove'));
        // まだ退室させない: 確認を 1 段挟む
        expect(onDeleteMember).not.toHaveBeenCalled();
        const confirm = byTestId('classroom-member-remove-confirm-message');
        expect(confirm.textContent).toBe('Remove the student at seat 4 from the assignment? (Their work is kept.)');
        fireEvent.click(byTestId('classroom-member-remove-confirm'));
        expect(onDeleteMember).toHaveBeenCalledTimes(1);
        expect(onDeleteMember).toHaveBeenCalledWith('seat-04');
    });

    test('確認で［キャンセル］を押すと退室させず、確認を閉じる', () => {
        const onDeleteMember = jest.fn();
        renderDetail(member(), { onDeleteMember });
        fireEvent.click(byTestId('classroom-member-more-menu'));
        fireEvent.click(byTestId('classroom-member-remove'));
        fireEvent.click(byTestId('classroom-member-remove-cancel'));
        expect(onDeleteMember).not.toHaveBeenCalled();
        expect(byTestId('classroom-member-remove-confirm-message')).not.toBeInTheDocument();
    });

    test('ほかのメンバーを選ぶと、開いていた確認は閉じる', () => {
        const a = member({ memberId: 'seat-01' });
        const b = member({ memberId: 'seat-02' });
        const props = {
            isLoading: false,
            memberMap: { 'seat-01': a, 'seat-02': b },
            members: [a, b],
            onDeleteMember: jest.fn(),
            onOpenSubmission: jest.fn(),
            onReturnSubmission: jest.fn(),
        };
        const { rerender } = render(
            <IntlProvider locale="en">
                <TeacherMemberDetail {...props} selectedMember="seat-01" />
            </IntlProvider>,
        );
        fireEvent.click(byTestId('classroom-member-more-menu'));
        fireEvent.click(byTestId('classroom-member-remove'));
        expect(byTestId('classroom-member-remove-confirm-message')).toBeInTheDocument();
        rerender(
            <IntlProvider locale="en">
                <TeacherMemberDetail {...props} selectedMember="seat-02" />
            </IntlProvider>,
        );
        expect(byTestId('classroom-member-remove-confirm-message')).not.toBeInTheDocument();
    });

    test('提出時刻は日付つきで出す', () => {
        const iso = '2026-10-26T01:00:00.000Z';
        renderDetail(member({ submittedAt: iso }));
        const badge = byTestId('classroom-member-detail-submitted');
        const date = new Date(iso).toLocaleDateString('en', { month: 'numeric', day: 'numeric' });
        expect(badge.textContent).toContain(date);
    });

    test.each([undefined, null, '', 'not-a-date'])(
        '提出時刻が無い・読めないとき (%p) は時刻を出さない',
        (submittedAt) => {
            renderDetail(member({ submittedAt }));
            const badge = byTestId('classroom-member-detail-submitted');
            expect(badge).toBeInTheDocument();
            expect(badge.textContent).not.toContain('Invalid Date');
            expect(badge.textContent).not.toMatch(/1970/);
            expect(badge.textContent.trim()).toBe('');
        },
    );
});

describe('TeacherMemberDetail — コメント欄のラベル (#1924 C5・R1)', () => {
    test('コメント欄の上に見えるラベルがあり、欄と結び付いている', () => {
        renderDetail(member());
        const input = byTestId('classroom-member-detail-comment');
        const label = byTestId('classroom-member-detail-comment-label');
        expect(label.textContent).toBe('Comment to the student (sent when you return it)');
        expect(label.getAttribute('for')).toBe(input.id);
        expect(input.getAttribute('placeholder')).toBeFalsy();
    });
});

describe('TeacherMemberDetail — ［スモウルビーで開く］の前の確認 (#1980)', () => {
    const URL = 'https://example.invalid/3.sb3';
    const typeComment = (text) =>
        fireEvent.change(byTestId('classroom-member-detail-comment'), { target: { value: text } });

    test('書きかけのコメントが無ければ、確かめずに開く', () => {
        const onOpenSubmission = jest.fn();
        renderDetail(member({ projectUrl: URL }), { onOpenSubmission });
        fireEvent.click(byTestId('classroom-member-detail-open'));
        expect(onOpenSubmission).toHaveBeenCalledWith(URL);
        expect(byTestId('classroom-member-open-confirm-box')).not.toBeInTheDocument();
    });

    test('返却したコメントのままなら、確かめずに開く', () => {
        const onOpenSubmission = jest.fn();
        renderDetail(member({ projectUrl: URL, teacherComment: 'いいね' }), { onOpenSubmission });
        fireEvent.click(byTestId('classroom-member-detail-open'));
        expect(onOpenSubmission).toHaveBeenCalledWith(URL);
    });

    test('返却していないコメントがあれば先に聞き、［とどまる］なら開かずにコメントを残す', () => {
        const onOpenSubmission = jest.fn();
        renderDetail(member({ projectUrl: URL }), { onOpenSubmission });
        typeComment('よくできました');
        fireEvent.click(byTestId('classroom-member-detail-open'));
        expect(onOpenSubmission).not.toHaveBeenCalled();
        expect(byTestId('classroom-member-open-confirm-message')).toHaveTextContent(
            'The comment you have not returned will be lost.',
        );
        fireEvent.click(byTestId('classroom-member-open-stay'));
        expect(byTestId('classroom-member-open-confirm-box')).not.toBeInTheDocument();
        expect(byTestId('classroom-member-detail-comment')).toHaveValue('よくできました');
        expect(onOpenSubmission).not.toHaveBeenCalled();
    });

    test('［離れる］で開く', () => {
        const onOpenSubmission = jest.fn();
        renderDetail(member({ projectUrl: URL, teacherComment: 'いいね' }), { onOpenSubmission });
        typeComment('いいね！ もう少し');
        fireEvent.click(byTestId('classroom-member-detail-open'));
        fireEvent.click(byTestId('classroom-member-open-leave'));
        expect(onOpenSubmission).toHaveBeenCalledWith(URL);
        expect(byTestId('classroom-member-open-confirm-box')).not.toBeInTheDocument();
    });
});
