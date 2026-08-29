import '@testing-library/jest-dom';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';

const mockFetchClassrooms = jest.fn();
const mockFetchClassroom = jest.fn();
const mockSetStatus = jest.fn();
const mockFetchOverview = jest.fn();
const mockFetchCandidates = jest.fn();
const mockFetchPlan = jest.fn();
const mockExecuteRestore = jest.fn();
const mockSendNotification = jest.fn();
const mockSetSharingRecommendation = jest.fn();
jest.mock('../../src/lib/admin-api.js', () => ({
    fetchClassrooms: (...args) => mockFetchClassrooms(...args),
    fetchClassroom: (...args) => mockFetchClassroom(...args),
    setClassroomStatus: (...args) => mockSetStatus(...args),
    fetchClassroomOverview: (...args) => mockFetchOverview(...args),
    fetchRestoreCandidates: (...args) => mockFetchCandidates(...args),
    fetchRestorePlan: (...args) => mockFetchPlan(...args),
    executeRestore: (...args) => mockExecuteRestore(...args),
    sendNotification: (...args) => mockSendNotification(...args),
    setSharingRecommendation: (...args) => mockSetSharingRecommendation(...args)
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

const overview = {
    summary: {total: 3, active: 2, archived: 1, recent30d: 2},
    creationTrend: [{month: '2026-07', count: 3}],
    richnessDistribution: [
        {score: 0, count: 0}, {score: 1, count: 1}, {score: 2, count: 0},
        {score: 3, count: 0}, {score: 4, count: 2}
    ],
    candidates: [{
        classroomId: 'c1',
        className: '5年1組',
        assignmentName: 'ねこ迷路ゲーム',
        teacherSub: 't1',
        score: 4,
        pageCount: 2,
        hasImages: true,
        hasStarter: true,
        createdAt: '2026-07-10T00:00:00.000Z',
        likelyShared: false
    }],
    themeKeywords: [{keyword: 'ねこ', count: 3}]
};

const restoreResponse = {
    items: [{...liveItem, teacherSub: 't1', deletedAt: plan.deletedAt}],
    total: 1,
    facets: {byMonth: [{month: '2026-07', count: 1}], byTeacher: [{teacherSub: 't1', count: 1}]}
};

describe('ClassroomsView (issue #1084 + 俯瞰 #1106)', () => {
    beforeEach(() => {
        mockFetchClassrooms.mockReset().mockResolvedValue({items: [liveItem]});
        mockFetchClassroom.mockReset().mockResolvedValue(detail);
        mockSetStatus.mockReset();
        mockFetchOverview.mockReset().mockResolvedValue(overview);
        mockFetchCandidates.mockReset().mockResolvedValue(restoreResponse);
        mockFetchPlan.mockReset().mockResolvedValue(plan);
        mockExecuteRestore.mockReset();
        mockSendNotification.mockReset();
        mockSetSharingRecommendation.mockReset();
    });

    test('the default tab is the overview dashboard', async () => {
        render(<ClassroomsView />);
        await waitFor(() => expect(screen.getByTestId('overview-view')).toBeInTheDocument());
        expect(screen.getByTestId('overview-summary').textContent).toContain('課題総数');
        expect(screen.getByTestId('overview-candidates').textContent).toContain('ねこ迷路ゲーム');
        expect(screen.getByTestId('overview-candidates').textContent).toContain('未共有らしい');
    });

    test('opening a dashboard candidate shows its live classroom detail', async () => {
        render(<ClassroomsView />);
        await waitFor(() => screen.getByTestId('overview-candidate-c1'));
        fireEvent.click(screen.getByTestId('overview-candidate-c1'));
        await waitFor(() => screen.getByTestId('classroom-admin-detail'));
        expect(mockFetchClassroom).toHaveBeenCalledWith('c1');
    });

    test('the live tab lists classrooms and archives with confirmation', async () => {
        mockSetStatus.mockResolvedValue({...detail, status: 'archived'});
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        expect(mockFetchClassrooms).toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('classroom-admin-detail'));
        fireEvent.click(screen.getByTestId('classroom-admin-flip'));
        expect(mockSetStatus).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('classroom-admin-confirm-yes'));
        await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith('c1', 'archived'));
    });

    test('the restore tab browses all up-front with facets, then filters', async () => {
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
        // Browses everything immediately (no q required) so facets populate.
        await waitFor(() => screen.getByTestId('restore-facets'));
        expect(mockFetchCandidates).toHaveBeenCalledWith({});
        expect(screen.getByTestId('restore-facet-month-2026-07')).toBeInTheDocument();

        // Clicking a month facet re-queries with that filter.
        fireEvent.click(screen.getByTestId('restore-facet-month-2026-07'));
        await waitFor(() => expect(mockFetchCandidates).toHaveBeenCalledWith(
            {q: '', month: '2026-07', teacher: ''}));
    });

    test('共有推奨は二段階確認を通ってから API を呼ぶ (#1106)', async () => {
        mockSetSharingRecommendation.mockResolvedValue({
            ...detail,
            recommendedForSharing: true,
            recommendedForSharingAt: '2026-07-25T00:00:00Z',
            recommendedForSharingBy: 'admin@example.com'
        });
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('classroom-admin-detail'));

        fireEvent.click(screen.getByTestId('classroom-admin-recommend'));
        expect(mockSetSharingRecommendation).not.toHaveBeenCalled();
        expect(screen.getByTestId('classroom-admin-recommend-confirm').textContent)
            .toContain('お知らせが届き');

        fireEvent.click(screen.getByTestId('classroom-admin-recommend-confirm-yes'));
        await waitFor(() => expect(mockSetSharingRecommendation).toHaveBeenCalledWith('c1', true));
        // 推奨後はバッジが付き、ボタンが取り消しに変わる。
        await waitFor(() => screen.getByTestId('classroom-admin-recommended-badge'));
        expect(screen.getByTestId('classroom-admin-recommend').textContent).toContain('取り消す');
    });

    test('俯瞰候補に推奨済みバッジが出る (#1106)', async () => {
        mockFetchOverview.mockResolvedValue({
            ...overview,
            candidates: [{...overview.candidates[0], recommendedForSharing: true}]
        });
        render(<ClassroomsView />);
        await waitFor(() => screen.getByTestId('overview-candidate-recommended-c1'));
    });

    test('お知らせ送信は本文必須・確認後に classroomId で送る (#1111)', async () => {
        mockSendNotification.mockResolvedValue({notificationId: 'n1'});
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('classroom-admin-notify'));

        // 本文が空の間は送信ボタンが無効。
        expect(screen.getByTestId('classroom-admin-notify-send')).toBeDisabled();
        fireEvent.change(screen.getByTestId('classroom-admin-notify-message'), {
            target: {value: 'この課題、みんなの課題に共有しませんか？'}
        });
        fireEvent.click(screen.getByTestId('classroom-admin-notify-send'));
        // 二段階確認を通るまで API は呼ばれない。
        expect(mockSendNotification).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('classroom-admin-notify-confirm-yes'));
        await waitFor(() => expect(mockSendNotification).toHaveBeenCalledWith('c1', {
            title: '運営からのお知らせ',
            message: 'この課題、みんなの課題に共有しませんか？'
        }));
        await waitFor(() => screen.getByTestId('classroom-admin-notify-done'));
    });

    // 用語統一 (#1131): この面の操作対象は Classrooms テーブル = 「課題（1授業）」で、
    // クラス（学級）= ClassroomGroups は一切変更しない。文言が「クラス」を名乗ると
    // 運用者が「先生の画面に戻った」と誤読するため、テストで固定する。
    test('課題を操作する文言は「クラス」ではなく「課題」と呼ぶ (#1131)', async () => {
        mockSetStatus.mockResolvedValue({...detail, status: 'archived'});
        render(<ClassroomsView />);

        // 俯瞰: 件数カードは Classrooms の総数 = 課題総数。
        await waitFor(() => screen.getByTestId('overview-summary'));
        expect(screen.getByTestId('overview-summary').textContent).toContain('課題総数');
        expect(screen.getByTestId('overview-summary').textContent).not.toContain('クラス総数');

        // タブ名も検索対象（課題）に合わせる。
        expect(screen.getByTestId('classroom-admin-tab-live').textContent).toBe('課題検索');

        // アーカイブ確認。
        fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('classroom-admin-detail'));
        fireEvent.click(screen.getByTestId('classroom-admin-flip'));
        expect(screen.getByTestId('classroom-admin-confirm').textContent)
            .toContain('この課題をアーカイブしますか');
    });

    test('復元まわりの文言も「課題」と呼ぶ (#1131)', async () => {
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('restore-admin-plan'));

        // 親クラス（学級）のスナップショットも一緒に復元することを明示する。
        expect(screen.getByTestId('restore-admin-summary').textContent)
            .toContain('クラス（学級）も復元します');

        fireEvent.click(screen.getByTestId('restore-admin-execute'));
        expect(screen.getByTestId('restore-admin-confirm').textContent)
            .toContain('この課題を復元しますか');
    });

    test('生存している課題の案内と空表示も「課題」と呼ぶ (#1131)', async () => {
        mockFetchPlan.mockResolvedValue({alive: true});
        mockFetchCandidates.mockResolvedValue({
            items: [], total: 0, facets: {byMonth: [], byTeacher: []}
        });
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
        await waitFor(() => screen.getByTestId('classroom-admin-empty'));
        expect(screen.getByTestId('classroom-admin-empty').textContent)
            .toBe('該当する削除済み課題はありません。');

        // alive パネル（削除されていない課題を開いたとき）。
        mockFetchCandidates.mockResolvedValue(restoreResponse);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('restore-admin-alive'));
        expect(screen.getByTestId('restore-admin-alive').textContent)
            .toContain('この課題はまだ存在しています');
    });

    // 行・詳細の主タイトルは Classrooms.className = クラス（学級）名。無ラベルだと
    // 課題名と読み違えるので、俯瞰の候補行と同じく「クラス: 」を付けて対にする。
    test('一覧・詳細の主タイトルはクラス（学級）名だとラベルで示す (#1131)', async () => {
        render(<ClassroomsView />);

        // 課題検索の行: 主タイトル = クラス、下段 = 課題。
        fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        expect(screen.getByTestId('classroom-admin-item-c1').textContent)
            .toContain('クラス: 5年1組');
        expect(screen.getByTestId('classroom-admin-item-c1').textContent)
            .toContain('課題: ねこあつめ');

        // 詳細見出しも同じ。
        fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
        await waitFor(() => screen.getByTestId('classroom-admin-detail'));
        expect(screen.getByRole('heading', {level: 3}).textContent)
            .toContain('クラス: 5年1組');
    });

    test('期限切れ復元の行にも同じラベルが付き、空のクラス名は (名称なし) (#1131)', async () => {
        mockFetchCandidates.mockResolvedValue({
            ...restoreResponse,
            items: [{...restoreResponse.items[0], className: ''}]
        });
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
        await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
        expect(screen.getByTestId('classroom-admin-item-c1').textContent)
            .toContain('クラス: (名称なし)');
    });

    // 課題が active でも親クラス（学級）が archived なら先生には見えない (#1132)。
    describe('親クラス（学級）がアーカイブ中の警告 (#1132)', () => {
        test('課題検索の一覧と詳細に「先生には表示されません」が出る', async () => {
            const hidden = {...liveItem, groupId: 'g1', groupName: '5年1組', groupStatus: 'archived'};
            mockFetchClassrooms.mockResolvedValue({items: [hidden]});
            mockFetchClassroom.mockResolvedValue({...detail, ...hidden});
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            expect(screen.getByTestId('classroom-admin-group-hidden-badge').textContent)
                .toBe('先生には表示されません');

            fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
            await waitFor(() => screen.getByTestId('classroom-admin-detail'));
            const note = screen.getByTestId('classroom-admin-group-hidden-note').textContent;
            expect(note).toContain('先生の画面に表示されていません');
            expect(note).toContain('親クラス（学級）「5年1組」がアーカイブ中です');
            // 先生に伝える操作は課題の復帰ではなくクラス（学級）のアーカイブ解除。
            expect(note).toContain('アーカイブ済みのクラス');
        });

        test('親クラスが生きている課題には警告を出さない', async () => {
            const visible = {...liveItem, groupId: 'g1', groupName: '5年1組', groupStatus: 'active'};
            mockFetchClassrooms.mockResolvedValue({items: [visible]});
            mockFetchClassroom.mockResolvedValue({...detail, ...visible});
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            expect(screen.queryByTestId('classroom-admin-group-hidden-badge')).toBeNull();

            fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
            await waitFor(() => screen.getByTestId('classroom-admin-detail'));
            expect(screen.queryByTestId('classroom-admin-group-hidden-note')).toBeNull();
        });

        // 親クラスの行が無い課題は「見えない」ではない: 先生のクラス一覧の
        // 「どのクラスにも入っていない課題」フォールバックに出る（レビュー指摘）。
        test('親クラスの行ごと消えている課題は「表示されません」と断定しない', async () => {
            const orphan = {...liveItem, groupId: 'g1', groupName: null, groupStatus: 'missing'};
            mockFetchClassrooms.mockResolvedValue({items: [orphan]});
            mockFetchClassroom.mockResolvedValue({...detail, ...orphan});
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            expect(screen.queryByTestId('classroom-admin-group-hidden-badge')).toBeNull();
            expect(screen.getByTestId('classroom-admin-group-missing-badge').textContent)
                .toBe('クラス（学級）が見つかりません');

            fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
            await waitFor(() => screen.getByTestId('classroom-admin-detail'));
            expect(screen.queryByTestId('classroom-admin-group-hidden-note')).toBeNull();
            const note = screen.getByTestId('classroom-admin-group-missing-note').textContent;
            expect(note).toContain('親クラス（学級）が見つかりません');
            expect(note).toContain('どのクラスにも入っていない課題');
            // 行が無いクラスは「アーカイブ済みのクラス」から戻せないので案内しない。
            expect(note).not.toContain('アーカイブ済みのクラス');
        });

        test('親クラスがアーカイブ中なら「利用中に戻す」確認でも警告する', async () => {
            const hidden = {
                ...liveItem, status: 'archived', groupId: 'g1', groupName: '5年1組', groupStatus: 'archived'
            };
            mockFetchClassrooms.mockResolvedValue({items: [hidden]});
            mockFetchClassroom.mockResolvedValue({...detail, ...hidden});
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
            await waitFor(() => screen.getByTestId('classroom-admin-detail'));
            fireEvent.click(screen.getByTestId('classroom-admin-flip'));
            expect(screen.getByTestId('classroom-admin-confirm').textContent)
                .toContain('戻しても先生の画面には表示されません');
        });

        // 一覧のバッチ取得が取り切れなかったケース（'unknown'）。行が消えたと
        // 断定せず、状態が不明であることだけを出す（レビュー指摘）。
        test('親クラスを引けなかった課題は状態不明として出す', async () => {
            const unknown = {...liveItem, groupId: 'g1', groupName: null, groupStatus: 'unknown'};
            mockFetchClassrooms.mockResolvedValue({items: [unknown]});
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-live'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            expect(screen.getByTestId('classroom-admin-group-unknown-badge').textContent)
                .toBe('クラス（学級）の状態は不明');
            expect(screen.queryByTestId('classroom-admin-group-hidden-badge')).toBeNull();
            expect(screen.queryByTestId('classroom-admin-group-missing-badge')).toBeNull();
        });

        test('復元パネルの alive 文言が課題生存／親クラスアーカイブ中で切り替わる', async () => {
            mockFetchPlan.mockResolvedValue({
                alive: true, status: 'active', groupId: 'g1', groupName: '5年1組', groupStatus: 'archived'
            });
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
            await waitFor(() => screen.getByTestId('restore-admin-alive'));
            const hiddenText = screen.getByTestId('restore-admin-alive-group-hidden').textContent;
            expect(hiddenText).toContain('親クラス（学級）「5年1組」がアーカイブ中です');
            expect(hiddenText).toContain('アーカイブ済みのクラス');
            // 誤誘導になる「課題一覧から戻せます」は出さない。
            expect(screen.queryByTestId('restore-admin-alive-classroom')).toBeNull();
        });

        test('親クラスが生きていてアーカイブ済みの課題は先生自身が戻せると案内する', async () => {
            mockFetchPlan.mockResolvedValue({
                alive: true, status: 'archived', groupId: 'g1', groupName: '5年1組', groupStatus: 'active'
            });
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
            await waitFor(() => screen.getByTestId('restore-admin-alive'));
            expect(screen.getByTestId('restore-admin-alive-classroom').textContent)
                .toContain('先生自身のクラス管理画面の課題一覧から戻せます');
            expect(screen.queryByTestId('restore-admin-alive-group-hidden')).toBeNull();
        });

        test('親クラスの行が無い利用中の課題はフォールバック一覧に出ると案内する', async () => {
            mockFetchPlan.mockResolvedValue({
                alive: true, status: 'active', groupId: 'g1', groupName: null, groupStatus: 'missing'
            });
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
            await waitFor(() => screen.getByTestId('restore-admin-alive'));
            const text = screen.getByTestId('restore-admin-alive-classroom').textContent;
            expect(text).toContain('どのクラスにも入っていない課題');
            expect(screen.queryByTestId('restore-admin-alive-group-hidden')).toBeNull();
        });

        test('親クラスの行が無いアーカイブ済み課題は Admin で戻すよう案内する', async () => {
            mockFetchPlan.mockResolvedValue({
                alive: true, status: 'archived', groupId: 'g1', groupName: null, groupStatus: 'missing'
            });
            render(<ClassroomsView />);
            fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
            await waitFor(() => screen.getByTestId('classroom-admin-item-c1'));
            fireEvent.click(screen.getByTestId('classroom-admin-item-c1'));
            await waitFor(() => screen.getByTestId('restore-admin-alive'));
            const text = screen.getByTestId('restore-admin-alive-classroom').textContent;
            // 先生の課題一覧には出ないので「先生自身が戻せます」とは案内しない。
            expect(text).not.toContain('先生自身のクラス管理画面の課題一覧から戻せます');
            expect(text).toContain('利用中に戻す');
        });
    });

    test('restore executes only after confirmation', async () => {
        mockExecuteRestore.mockResolvedValue({restored: 22, missingFiles: 1, classroom: {...liveItem}});
        render(<ClassroomsView />);
        fireEvent.click(screen.getByTestId('classroom-admin-tab-restore'));
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
});
