/**
 * クラス（学級）検索・アーカイブ解除 view のテスト (EPIC #1129 C #1133).
 *
 * 守りたいのは「運用者が同名クラスを取り違えないこと」と「二段階確認を挟むこと」。
 * どちらも壊れると、無関係なクラスを先生の画面に復活させる事故になる。
 */
import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

const mockFetchGroups = jest.fn();
const mockFetchGroup = jest.fn();
const mockSetGroupStatus = jest.fn();
jest.mock('../../src/lib/admin-api.js', () => ({
    fetchClassroomGroups: (...args) => mockFetchGroups(...args),
    fetchClassroomGroup: (...args) => mockFetchGroup(...args),
    setClassroomGroupStatus: (...args) => mockSetGroupStatus(...args)
}));

import ClassroomGroupsView from '../../src/components/classroom-groups-view.jsx';

// 同名クラスが 2 つ（Google Classroom 連携での二重作成）。区別は年度・人数・
// 中の課題名・作成日時でしかできない。
const groups = [
    {
        groupId: 'g-new',
        name: '5年1組',
        year: 2026,
        section: null,
        status: 'active',
        studentCount: 28,
        createdAt: '2026-04-01T00:00:00.000Z',
        expiresAt: '2027-05-06T00:00:00.000Z',
        assignmentCount: 1,
        activeAssignmentCount: 1,
        assignmentNames: ['しりとり']
    },
    {
        groupId: 'g-old',
        name: '5年1組',
        year: 2025,
        section: null,
        status: 'archived',
        studentCount: 30,
        createdAt: '2025-04-01T00:00:00.000Z',
        expiresAt: '2026-05-06T00:00:00.000Z',
        assignmentCount: 3,
        activeAssignmentCount: 2,
        assignmentNames: ['たいこ', 'ねこ迷路']
    }
];

const groupDetail = {
    ...groups[1],
    assignments: [
        {
            classroomId: 'c2',
            assignmentName: 'たいこ',
            className: '5年1組',
            joinCode: 'bcd345',
            status: 'active',
            createdAt: '2025-06-01T00:00:00.000Z'
        },
        {
            classroomId: 'c1',
            assignmentName: 'ねこ迷路',
            className: '5年1組',
            joinCode: 'abc234',
            status: 'archived',
            createdAt: '2025-05-01T00:00:00.000Z'
        }
    ]
};

describe('ClassroomGroupsView (#1133)', () => {
    beforeEach(() => {
        mockFetchGroups.mockReset();
        mockFetchGroup.mockReset();
        mockSetGroupStatus.mockReset();
        mockFetchGroups.mockResolvedValue({items: groups, total: groups.length});
        mockFetchGroup.mockResolvedValue(groupDetail);
        mockSetGroupStatus.mockResolvedValue({
            ...groupDetail, status: 'active', restoredAt: '2026-08-29T00:00:00.000Z'
        });
    });

    test('同名クラスを年度・人数・中の課題名・作成日時で区別できる', async () => {
        render(<ClassroomGroupsView />);
        const row = await screen.findByTestId('classroom-group-admin-item-g-old');
        expect(row).toHaveTextContent('年度: 2025');
        expect(row).toHaveTextContent('人数: 30');
        expect(row).toHaveTextContent('作成: 2025-04-01');
        expect(row).toHaveTextContent('課題(3件): たいこ、ねこ迷路 ほか 1 件');

        const fresh = screen.getByTestId('classroom-group-admin-item-g-new');
        expect(fresh).toHaveTextContent('年度: 2026');
        expect(fresh).toHaveTextContent('人数: 28');
    });

    test('検索語と状態フィルタが API に渡る', async () => {
        render(<ClassroomGroupsView />);
        await screen.findByTestId('classroom-group-admin-list');

        fireEvent.change(screen.getByTestId('classroom-group-admin-query'), {
            target: {value: ' 5年1組 '}
        });
        fireEvent.click(screen.getByTestId('classroom-group-admin-search'));
        await waitFor(() => expect(mockFetchGroups).toHaveBeenLastCalledWith({q: '5年1組', status: ''}));

        fireEvent.click(screen.getByTestId('classroom-group-admin-status-archived'));
        await waitFor(() =>
            expect(mockFetchGroups).toHaveBeenLastCalledWith({q: '5年1組', status: 'archived'}));
    });

    test('見つからないときは空メッセージ', async () => {
        mockFetchGroups.mockResolvedValue({items: [], total: 0});
        render(<ClassroomGroupsView />);
        expect(await screen.findByTestId('classroom-group-admin-empty')).toBeInTheDocument();
    });

    test('API エラーを表示する', async () => {
        mockFetchGroups.mockRejectedValue(new Error('API error 500'));
        render(<ClassroomGroupsView />);
        expect(await screen.findByTestId('classroom-group-admin-error')).toHaveTextContent('API error 500');
    });

    describe('詳細', () => {
        const openDetail = async () => {
            render(<ClassroomGroupsView />);
            fireEvent.click(await screen.findByTestId('classroom-group-admin-item-g-old'));
            return screen.findByTestId('classroom-group-admin-detail');
        };

        test('アーカイブ中のクラスは「先生に表示されない」ことを明示する', async () => {
            await openDetail();
            expect(screen.getByTestId('classroom-group-admin-archived-note'))
                .toHaveTextContent('先生の画面には表示されません');
        });

        test('中の課題を状態つきで一覧できる', async () => {
            await openDetail();
            const list = screen.getByTestId('classroom-group-admin-assignments');
            expect(list).toHaveTextContent('課題: たいこ');
            expect(list).toHaveTextContent('コード: bcd345');
            expect(screen.getByTestId('classroom-group-admin-assignment-c1'))
                .toHaveTextContent('状態: アーカイブ');
        });

        test('アーカイブ解除は二段階確認を経て初めて API を呼ぶ', async () => {
            await openDetail();
            fireEvent.click(screen.getByTestId('classroom-group-admin-flip'));
            expect(mockSetGroupStatus).not.toHaveBeenCalled();

            const confirm = screen.getByTestId('classroom-group-admin-confirm');
            expect(confirm).toHaveTextContent('保持期間は今日から数え直します');
            expect(confirm).toHaveTextContent('中の課題の状態は変わりません');

            fireEvent.click(screen.getByTestId('classroom-group-admin-confirm-yes'));
            await waitFor(() => expect(mockSetGroupStatus).toHaveBeenCalledWith('g-old', 'active'));
            await waitFor(() =>
                expect(screen.getByTestId('classroom-group-admin-status-badge')).toHaveTextContent('利用中'));
            expect(screen.queryByTestId('classroom-group-admin-archived-note')).not.toBeInTheDocument();
        });

        test('「やめる」で確認を取り消せる', async () => {
            await openDetail();
            fireEvent.click(screen.getByTestId('classroom-group-admin-flip'));
            fireEvent.click(screen.getByTestId('classroom-group-admin-confirm-no'));
            expect(screen.queryByTestId('classroom-group-admin-confirm')).not.toBeInTheDocument();
            expect(mockSetGroupStatus).not.toHaveBeenCalled();
        });

        test('利用中のクラスをアーカイブする確認は中の課題への影響を伝える', async () => {
            mockFetchGroup.mockResolvedValue({...groupDetail, status: 'active'});
            await openDetail();
            fireEvent.click(screen.getByTestId('classroom-group-admin-flip'));
            expect(screen.getByTestId('classroom-group-admin-confirm'))
                .toHaveTextContent('中の課題ごと先生の画面から消えます');
        });

        test('切り替え失敗はエラー表示になり状態は変わらない', async () => {
            mockSetGroupStatus.mockRejectedValue(new Error('API error 403'));
            await openDetail();
            fireEvent.click(screen.getByTestId('classroom-group-admin-flip'));
            fireEvent.click(screen.getByTestId('classroom-group-admin-confirm-yes'));
            expect(await screen.findByTestId('classroom-group-admin-error'))
                .toHaveTextContent('API error 403');
        });
    });
});
