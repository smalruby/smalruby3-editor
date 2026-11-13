/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherClassDetail from '../../../src/components/classroom-modal/teacher-class-detail.jsx';

const classroom = (over = {}) => ({
    classroomId: 'c1',
    className: '2年1組',
    assignmentName: '課題1',
    joinCode: 'ABCDEF',
    studentCount: 3,
    googleClassroomCourseId: null,
    googleClassroomAlternateLink: null,
    ...over,
});

const defaultProps = () => ({
    selectedClassroom: classroom(),
    members: [],
    isLoading: false,
    onBack: jest.fn(),
    onSelectMember: jest.fn(),
    onDeleteMember: jest.fn(),
    onDeleteClassroom: jest.fn(),
    onOpenSubmission: jest.fn(),
    onRefresh: jest.fn(),
    onReturnSubmission: jest.fn(),
    onDownloadAll: jest.fn(),
    onShowCodeDisplay: jest.fn(),
    onCloseCodeDisplay: jest.fn(),
    onCopyInviteLink: jest.fn(),
    onToggleCodeFullscreen: jest.fn(),
    onShowPostAssignment: jest.fn(),
    onUpdateAssignmentName: jest.fn(),
});

// E2 (#1303): the rarely changed settings sit in the folded「詳しい設定」.
const openAdvanced = () =>
    fireEvent.click(document.querySelector('[data-testid="classroom-assignment-advanced-toggle"]'));

const renderDetail = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherClassDetail {...defaultProps()} {...props} />
        </IntlProvider>,
    );

describe('TeacherClassDetail — Google Classroom post button', () => {
    test('should show the post button when only the class (group) is linked to Google Classroom', () => {
        // Post-refactor: the assignment itself has no courseId; the link lives on the group.
        renderDetail({
            selectedClassroom: classroom({ googleClassroomCourseId: null }),
            group: { groupId: 'g1', googleClassroomCourseId: 'course-123' },
        });
        expect(document.querySelector('[data-testid="classroom-post-assignment"]')).toBeInTheDocument();
    });

    test('should show the post button when the assignment itself has a courseId', () => {
        renderDetail({
            selectedClassroom: classroom({ googleClassroomCourseId: 'course-123' }),
            group: { groupId: 'g1', googleClassroomCourseId: null },
        });
        expect(document.querySelector('[data-testid="classroom-post-assignment"]')).toBeInTheDocument();
    });

    test('should hide the post button when neither the class nor the assignment is linked', () => {
        renderDetail({
            selectedClassroom: classroom({ googleClassroomCourseId: null }),
            group: { groupId: 'g1', googleClassroomCourseId: null },
        });
        expect(document.querySelector('[data-testid="classroom-post-assignment"]')).not.toBeInTheDocument();
    });

    test('should show the view-assignment link (not the post button) once this assignment was posted', () => {
        renderDetail({
            selectedClassroom: classroom({
                googleClassroomCourseId: null,
                googleClassroomAlternateLink: 'https://classroom.google.com/c/x/a/y',
            }),
            group: { groupId: 'g1', googleClassroomCourseId: 'course-123' },
        });
        expect(document.querySelector('[data-testid="classroom-view-assignment"]')).toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-post-assignment"]')).not.toBeInTheDocument();
    });
});

// Sharing posts course work with the pressing teacher's own Google account, so
// a class co-teacher who is not a teacher of the linked course cannot share —
// and one on a personal Google account never can. Blocked by default, with a
// check the genuine Google Classroom co-teacher can run themselves.
describe('TeacherClassDetail — Google Classroom share gate (issue #1184)', () => {
    const linkedProps = (googleCourseAccess, groupOver = {}) => ({
        selectedClassroom: classroom({ googleClassroomCourseId: null }),
        group: { groupId: 'g1', googleClassroomCourseId: 'course-123', ...groupOver },
        googleCourseAccess: googleCourseAccess && { groupId: 'g1', ...googleCourseAccess },
        onVerifyGoogleCourseAccess: jest.fn(),
    });
    const postButton = () => document.querySelector('[data-testid="classroom-post-assignment"]');
    const blockedNote = () => document.querySelector('[data-testid="classroom-post-assignment-blocked"]');
    const verifyButton = () => document.querySelector('[data-testid="classroom-post-assignment-verify"]');

    // The teacher in the bug report had never granted Google access, so the
    // probe could not run at all: this is the state they open the class in.
    test('disables the share button from the start for a teacher who did not link the course', () => {
        renderDetail(linkedProps(null, { googleClassroomLinkedByEmail: 'owner@example.com' }));
        expect(postButton()).toBeDisabled();
        expect(blockedNote()).toBeInTheDocument();
        expect(blockedNote().textContent).toContain('owner@example.com');
        expect(verifyButton()).toBeInTheDocument();
    });

    test('keeps it disabled when the silent check could not tell', () => {
        renderDetail(linkedProps({ status: 'unknown', linkedByEmail: 'owner@example.com' }));
        expect(postButton()).toBeDisabled();
        expect(verifyButton()).toBeInTheDocument();
    });

    test('stays generic rather than guessing when the linking teacher is unknown', () => {
        renderDetail(linkedProps({ status: 'notTeacher', linkedByEmail: null }));
        expect(postButton()).toBeDisabled();
        expect(blockedNote().textContent).toContain('another teacher');
    });

    test('keeps the share button usable for the teacher who linked the course', () => {
        renderDetail(linkedProps(null, { googleClassroomLinkedByMe: true }));
        expect(postButton()).not.toBeDisabled();
        expect(blockedNote()).not.toBeInTheDocument();
    });

    test('keeps the share button usable for a proven teacher of the course', () => {
        renderDetail(linkedProps({ status: 'teacher', linkedByEmail: 'owner@example.com' }));
        expect(postButton()).not.toBeDisabled();
        expect(blockedNote()).not.toBeInTheDocument();
    });

    test('the check asks the container to verify this class', () => {
        const props = linkedProps(null);
        renderDetail(props);
        fireEvent.click(verifyButton());
        expect(props.onVerifyGoogleCourseAccess).toHaveBeenCalledWith(props.group);
    });

    // A check that came back negative must read as a result, and must not
    // offer the same popup again — Google's answer will not change.
    test('reports a failed check in place and stops offering it', () => {
        renderDetail(linkedProps({ status: 'notTeacher', linkedByEmail: 'owner@example.com', verifyFailed: true }));
        expect(blockedNote().textContent).toContain('could not confirm');
        expect(blockedNote().textContent).toContain('owner@example.com');
        expect(verifyButton()).not.toBeInTheDocument();
    });

    // Consent dismissed / Google unreachable: still blocked, still retryable,
    // and reported here rather than in an error banner.
    test('keeps the check available when it failed without an answer', () => {
        renderDetail(linkedProps({ status: 'unknown', linkedByEmail: null, verifyFailed: true }));
        expect(blockedNote().textContent).toContain('could not confirm');
        expect(verifyButton()).toBeInTheDocument();
    });

    test('shows the check as running while it is in flight', () => {
        renderDetail({ ...linkedProps(null), isVerifyingGoogleCourseAccess: true });
        expect(verifyButton()).toBeDisabled();
        expect(verifyButton().textContent).toContain('Checking');
    });

    test('falls back to the class attribution when the probe carries no email', () => {
        renderDetail(
            linkedProps(
                { status: 'notTeacher', linkedByEmail: null },
                {
                    googleClassroomLinkedByEmail: 'linker@example.com',
                },
            ),
        );
        expect(blockedNote().textContent).toContain('linker@example.com');
    });

    // The probe is async, so switching classes leaves the previous class's
    // verdict in state until the new answer lands (and answers can arrive out
    // of order). It must not decide anything about a class it was not about —
    // including lifting the block.
    test('ignores a verdict that was about a different class', () => {
        renderDetail({
            selectedClassroom: classroom({ googleClassroomCourseId: null }),
            group: { groupId: 'gB', googleClassroomCourseId: 'course-B' },
            googleCourseAccess: { groupId: 'gA', status: 'teacher', linkedByEmail: 'a@example.com' },
        });
        expect(postButton()).toBeDisabled();
    });

    // Pre-v2 classes link Google Classroom on the assignment with nobody
    // recorded as the linker, so the default block would lock out the owner.
    test('keeps the old proof-only rule when only the assignment is linked', () => {
        renderDetail({
            selectedClassroom: classroom({ googleClassroomCourseId: 'course-123' }),
            group: { groupId: 'g1', googleClassroomCourseId: null },
        });
        expect(postButton()).not.toBeDisabled();
        expect(blockedNote()).not.toBeInTheDocument();
    });

    // Once the assignment is posted the share button becomes an "open it"
    // link, so "ask someone to share it" would be telling the teacher to
    // redo something that is already done.
    test('does not explain how to share an assignment that is already shared', () => {
        renderDetail({
            selectedClassroom: classroom({
                googleClassroomAlternateLink: 'https://classroom.google.com/c/x/a/y',
            }),
            group: { groupId: 'g1', googleClassroomCourseId: 'course-123' },
            googleCourseAccess: { groupId: 'g1', status: 'notTeacher', linkedByEmail: 'owner@example.com' },
        });
        expect(document.querySelector('[data-testid="classroom-view-assignment"]')).toBeInTheDocument();
        expect(blockedNote()).not.toBeInTheDocument();
    });
});

describe('TeacherClassDetail — retention banner (issue #1052)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const inDays = (days) => new Date(Date.now() + days * DAY).toISOString();
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('shows only the grey deadline while more than 7 days are left (R4)', () => {
        renderDetail({ selectedClassroom: classroom({ expiresAt: inDays(20) }) });
        expect(byTestId('classroom-retention-banner')).not.toBeInTheDocument();
        expect(byTestId('classroom-detail-expires-at').textContent).toContain('Kept until');
    });

    test('shows the red alert and a download button within 7 days of deletion', () => {
        const onDownloadAll = jest.fn();
        renderDetail({ selectedClassroom: classroom({ expiresAt: inDays(5) }), onDownloadAll });
        const alert = byTestId('classroom-retention-banner');
        expect(alert).toBeInTheDocument();
        expect(alert.textContent).toContain('deleted automatically');
        fireEvent.click(byTestId('classroom-retention-banner-download'));
        expect(onDownloadAll).toHaveBeenCalled();
    });

    test('共有推奨バナー (#1106): フラグ + 中身ありのときだけ出て CTA が動く', () => {
        const onOpenShareSuggestion = jest.fn();
        const { unmount } = renderDetail({
            selectedClassroom: classroom({ recommendedForSharing: true, hasAssignment: true }),
            onOpenShareSuggestion,
        });
        expect(byTestId('classroom-share-suggestion-banner')).toBeInTheDocument();
        fireEvent.click(byTestId('classroom-share-suggestion-open'));
        expect(onOpenShareSuggestion).toHaveBeenCalled();
        unmount();

        // フラグ無しでは出ない。
        const second = renderDetail({
            selectedClassroom: classroom({ hasAssignment: true }),
            onOpenShareSuggestion,
        });
        expect(byTestId('classroom-share-suggestion-banner')).not.toBeInTheDocument();
        second.unmount();

        // 中身の無い課題では出ない（共有 API が拒否する行き止まりを防ぐ。
        // 推奨後に先生が説明を空にしたケースを含む）。
        renderDetail({
            selectedClassroom: classroom({ recommendedForSharing: true, hasAssignment: false }),
            onOpenShareSuggestion,
        });
        expect(byTestId('classroom-share-suggestion-banner')).not.toBeInTheDocument();
    });
});

describe('TeacherClassDetail — member grid status icons (#1196)', () => {
    const recent = () => new Date(Date.now() - 60 * 1000).toISOString();
    const old = () => new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const cellStatuses = (seat) =>
        Array.from(document.querySelectorAll(`[data-testid="classroom-member-seat-0${seat}"] [role="img"]`)).map(
            (el) => el.dataset.status,
        );

    test('shows presence + submission icons per seat and a leave-request icon', () => {
        renderDetail({
            selectedClassroom: classroom({ studentCount: 3 }),
            members: [
                { memberId: 'seat-01', lastActiveAt: recent(), hasSubmission: true, submissionStatus: 'submitted' },
                { memberId: 'seat-02', lastActiveAt: old(), hasSubmission: true, submissionStatus: 'returned' },
            ],
            kickRequestsBySeat: { 2: [{ requestId: 'r1' }] },
        });
        fireEvent.click(document.querySelector('[data-testid="classroom-tab-members"]'));
        expect(cellStatuses(1)).toEqual(['seated', 'submitted']);
        expect(cellStatuses(2)).toEqual(['notSeated', 'returned', 'kickRequested']);
        expect(cellStatuses(3)).toEqual(['notJoined']);
        expect(document.querySelector('[data-testid="classroom-seat-kick-request-2"]')).toBeInTheDocument();
    });

    test('renders the icon legend', () => {
        renderDetail({ members: [] });
        fireEvent.click(document.querySelector('[data-testid="classroom-tab-members"]'));
        const legend = document.querySelector('[data-testid="classroom-status-legend"]');
        expect(legend).toBeInTheDocument();
        expect(legend.querySelectorAll('[role="img"]')).toHaveLength(7);
    });
});

describe('TeacherClassDetail — entry tab (teacher review on #1199)', () => {
    // CSS modules are mocked out, so the visible tab is observed through the
    // tab reported to the container (it drives the members polling).
    test('opens on the members tab by default', () => {
        const onDetailTabChange = jest.fn();
        renderDetail({ onDetailTabChange });
        expect(onDetailTabChange).toHaveBeenLastCalledWith('members');
    });

    test('opens on the description tab when asked (just-created assignment)', () => {
        const onDetailTabChange = jest.fn();
        renderDetail({ onDetailTabChange, detailEntry: { tab: 'description', seq: 1 } });
        expect(onDetailTabChange).toHaveBeenLastCalledWith('description');
    });

    test('reopening the assignment on screen resets the tab', () => {
        const onDetailTabChange = jest.fn();
        const props = { ...defaultProps(), onDetailTabChange, detailEntry: { tab: 'description', seq: 1 } };
        const { rerender } = render(
            <IntlProvider locale="en">
                <TeacherClassDetail {...props} />
            </IntlProvider>,
        );
        expect(onDetailTabChange).toHaveBeenLastCalledWith('description');
        rerender(
            <IntlProvider locale="en">
                <TeacherClassDetail {...props} detailEntry={{ tab: 'members', seq: 2 }} />
            </IntlProvider>,
        );
        expect(onDetailTabChange).toHaveBeenLastCalledWith('members');
    });
});

describe('TeacherClassDetail — 前回の提出物から始めさせる (#1202)', () => {
    const editor = (over = {}) => ({
        editorPages: [{ text: '続きを作ろう' }],
        starterMode: 'keep',
        starterSource: null,
        hasExistingStarter: true,
        isSaving: false,
        startFromPrevious: false,
        onAddPage: jest.fn(),
        onAttachPageImage: jest.fn(),
        onChangePageText: jest.fn(),
        onChangeStartFromPrevious: jest.fn(),
        onMovePage: jest.fn(),
        onRemovePage: jest.fn(),
        onRemovePageImage: jest.fn(),
        onRemoveStarter: jest.fn(),
        onSave: jest.fn(),
        onUseCurrentProject: jest.fn(),
        onUseFile: jest.fn(),
        ...over,
    });
    const renderDescription = (over) =>
        renderDetail({ assignmentEditor: editor(over), detailEntry: { tab: 'description', seq: 1 } });
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('説明タブに設定のチェックボックス (既定 OFF) を出し、切り替えを伝える', () => {
        const onChangeStartFromPrevious = jest.fn();
        renderDescription({ onChangeStartFromPrevious });
        openAdvanced();
        const checkbox = byTestId('classroom-assignment-start-from-previous');
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        expect(onChangeStartFromPrevious).toHaveBeenCalledWith(true);
    });

    test('ON のときはチェックされ、生徒視点プレビューに「前回の提出物から続けるのがおすすめ」と出す', () => {
        renderDescription({ startFromPrevious: true });
        openAdvanced();
        expect(byTestId('classroom-assignment-start-from-previous')).toBeChecked();
        expect(byTestId('classroom-description-preview-start')).toHaveTextContent(
            "continuing from last time's submission is recommended",
        );
    });

    test('OFF のときプレビューはスターター (無ければいまの作品) で始まると出す', () => {
        renderDescription();
        expect(byTestId('classroom-description-preview-start')).toHaveTextContent(
            'start from the starter with a button',
        );
        document.body.innerHTML = '';
        renderDescription({ starterMode: 'none' });
        expect(byTestId('classroom-description-preview-start')).toHaveTextContent('start with the open project');
    });
});

describe('TeacherClassDetail — 他者参照 (#1208)', () => {
    const editor = (over = {}) => ({
        editorPages: [{ text: 'みんなの作品を見よう' }],
        starterMode: 'none',
        starterSource: null,
        hasExistingStarter: false,
        isSaving: false,
        startFromPrevious: false,
        peerView: 'none',
        onAddPage: jest.fn(),
        onAttachPageImage: jest.fn(),
        onChangePageText: jest.fn(),
        onChangeStartFromPrevious: jest.fn(),
        onChangePeerView: jest.fn(),
        onMovePage: jest.fn(),
        onRemovePage: jest.fn(),
        onRemovePageImage: jest.fn(),
        onRemoveStarter: jest.fn(),
        onSave: jest.fn(),
        onUseCurrentProject: jest.fn(),
        onUseFile: jest.fn(),
        ...over,
    });
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('説明タブに 3 択の設定 (既定「しない」) を出し、変更を伝える', () => {
        const onChangePeerView = jest.fn();
        renderDetail({
            assignmentEditor: editor({ onChangePeerView }),
            detailEntry: { tab: 'description', seq: 1 },
        });
        openAdvanced();
        const select = byTestId('classroom-assignment-peer-view');
        expect(select).toHaveValue('none');
        expect(Array.from(select.options).map((o) => o.value)).toEqual(['none', 'always', 'afterSubmit']);
        fireEvent.change(select, { target: { value: 'afterSubmit' } });
        expect(onChangePeerView).toHaveBeenCalledWith('afterSubmit');
    });

    test('保存済みの値を選択状態にする', () => {
        renderDetail({
            assignmentEditor: editor({ peerView: 'always' }),
            detailEntry: { tab: 'description', seq: 1 },
        });
        openAdvanced();
        expect(byTestId('classroom-assignment-peer-view')).toHaveValue('always');
    });
});

describe('TeacherClassDetail — メッシュのグループの人数 (#1257)', () => {
    const editor = (over = {}) => ({
        editorPages: [{ text: 'みんなの作品を見よう' }],
        starterMode: 'none',
        starterSource: null,
        hasExistingStarter: false,
        isSaving: false,
        startFromPrevious: false,
        peerView: 'none',
        meshGroupLimit: 0,
        onChangeMeshGroupLimit: jest.fn(),
        onAddPage: jest.fn(),
        onAttachPageImage: jest.fn(),
        onChangePageText: jest.fn(),
        onChangeStartFromPrevious: jest.fn(),
        onChangePeerView: jest.fn(),
        onMovePage: jest.fn(),
        onRemovePage: jest.fn(),
        onRemovePageImage: jest.fn(),
        onRemoveStarter: jest.fn(),
        onSave: jest.fn(),
        onUseCurrentProject: jest.fn(),
        onUseFile: jest.fn(),
        ...over,
    });
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('この機能より前の課題 (0) は「制限なし」と表示し、変更を数値で伝える', () => {
        const onChangeMeshGroupLimit = jest.fn();
        renderDetail({
            assignmentEditor: editor({ onChangeMeshGroupLimit }),
            detailEntry: { tab: 'description', seq: 1 },
        });
        openAdvanced();
        const select = byTestId('classroom-assignment-mesh-group-limit');
        expect(select).toHaveValue('0');
        expect(Array.from(select.options).map((o) => o.value)).toEqual(['6', '0']);
        fireEvent.change(select, { target: { value: '6' } });
        expect(onChangeMeshGroupLimit).toHaveBeenCalledWith(6);
    });

    test('保存済みの「6人まで」を選択状態にする', () => {
        renderDetail({
            assignmentEditor: editor({ meshGroupLimit: 6 }),
            detailEntry: { tab: 'description', seq: 1 },
        });
        openAdvanced();
        expect(byTestId('classroom-assignment-mesh-group-limit')).toHaveValue('6');
    });
});

describe('TeacherClassDetail — 1 画面に収める (#1303)', () => {
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
    const editor = (over = {}) => ({
        editorPages: [{ text: 'ねこを動かそう' }],
        starterMode: 'none',
        starterSource: null,
        hasExistingStarter: false,
        isSaving: false,
        startFromPrevious: false,
        peerView: 'none',
        meshGroupLimit: 6,
        onAddPage: jest.fn(),
        onAttachPageImage: jest.fn(),
        onChangeMeshGroupLimit: jest.fn(),
        onChangePageText: jest.fn(),
        onChangePeerView: jest.fn(),
        onChangeStartFromPrevious: jest.fn(),
        onMovePage: jest.fn(),
        onRemovePage: jest.fn(),
        onRemovePageImage: jest.fn(),
        onRemoveStarter: jest.fn(),
        onSave: jest.fn(),
        onUseCurrentProject: jest.fn(),
        onUseFile: jest.fn(),
        ...over,
    });
    const renderDescription = (over) =>
        renderDetail({ assignmentEditor: editor(over), detailEntry: { tab: 'description', seq: 1 } });

    test('D1: 全作品ダウンロードとアーカイブは「…」の中にあり、タブの行には出さない', () => {
        const onDownloadAll = jest.fn();
        const onDeleteClassroom = jest.fn();
        // jsdom has no scrollIntoView (the confirm box scrolls into view).
        Element.prototype.scrollIntoView = jest.fn();
        renderDetail({ onDownloadAll, onDeleteClassroom });
        expect(byTestId('classroom-download-all')).not.toBeInTheDocument();
        expect(byTestId('classroom-delete-classroom')).not.toBeInTheDocument();

        fireEvent.click(byTestId('classroom-detail-more-menu'));
        fireEvent.click(byTestId('classroom-download-all'));
        expect(onDownloadAll).toHaveBeenCalled();

        fireEvent.click(byTestId('classroom-detail-more-menu'));
        fireEvent.click(byTestId('classroom-delete-classroom'));
        fireEvent.click(byTestId('classroom-delete-confirm'));
        expect(onDeleteClassroom).toHaveBeenCalledWith('c1');
    });

    test('D1: ダウンロード中は「…」の横に進み具合を出す', () => {
        renderDetail({ downloadProgress: { current: 2, total: 5 } });
        expect(byTestId('classroom-download-progress').textContent).toBe('2/5');
    });

    test('D2: 凡例の先頭に座席の色（灰色＝参加済み・青＝まだ参加していない）を出す', () => {
        renderDetail({ members: [] });
        const legend = byTestId('classroom-seat-color-legend');
        expect(legend).toBeInTheDocument();
        expect(legend.textContent).toContain('Joined');
        expect(legend.textContent).toContain('Not joined yet');
        // The seat colours come before the icon legend.
        const iconLegend = byTestId('classroom-status-legend');
        expect(legend.compareDocumentPosition(iconLegend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    test('D3: 課題名は 1 行の入力欄で、「名前を変える」は出さない (#1388)', () => {
        const onUpdateAssignmentName = jest.fn();
        renderDetail({ onUpdateAssignmentName });
        const input = byTestId('classroom-detail-assignment-name');
        expect(input.tagName).toBe('INPUT');
        expect(input).toHaveAttribute('type', 'text');
        expect(byTestId('classroom-detail-assignment-name-hint')).not.toBeInTheDocument();
        expect(document.body.textContent).not.toContain('Rename');

        fireEvent.change(input, { target: { value: '課題2' } });
        fireEvent.blur(input);
        expect(onUpdateAssignmentName).toHaveBeenCalledWith('課題2');
    });

    describe('#1388: 課題名の保存のしかたと保存結果', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        test('入力欄にカーソルがある間だけ、保存のしかたの案内を出す', () => {
            renderDetail();
            const input = byTestId('classroom-detail-assignment-name');
            expect(byTestId('classroom-detail-assignment-name-save-hint')).not.toBeInTheDocument();
            fireEvent.focus(input);
            expect(byTestId('classroom-detail-assignment-name-save-hint').textContent).toBe(
                'Press Enter or click outside the field to save',
            );
            fireEvent.blur(input);
            expect(byTestId('classroom-detail-assignment-name-save-hint')).not.toBeInTheDocument();
        });

        test('名前を変えて欄から離れると「保存しました」を 2 秒ほど出す', async () => {
            jest.useFakeTimers();
            const onUpdateAssignmentName = jest.fn(() => Promise.resolve(true));
            renderDetail({ onUpdateAssignmentName });
            const input = byTestId('classroom-detail-assignment-name');
            fireEvent.focus(input);
            fireEvent.change(input, { target: { value: '課題2' } });
            fireEvent.blur(input);
            await act(async () => {
                await Promise.resolve();
            });
            expect(byTestId('classroom-detail-assignment-name-saved').textContent).toBe('✓ Saved');
            expect(byTestId('classroom-detail-assignment-name-save-error')).not.toBeInTheDocument();
            act(() => {
                jest.advanceTimersByTime(2000);
            });
            expect(byTestId('classroom-detail-assignment-name-saved')).not.toBeInTheDocument();
        });

        test('Enter でも保存して「保存しました」を出す', async () => {
            const onUpdateAssignmentName = jest.fn(() => Promise.resolve(true));
            renderDetail({ onUpdateAssignmentName });
            const input = byTestId('classroom-detail-assignment-name');
            input.focus();
            fireEvent.change(input, { target: { value: '課題3' } });
            fireEvent.keyDown(input, { key: 'Enter' });
            await act(async () => {
                await Promise.resolve();
            });
            expect(onUpdateAssignmentName).toHaveBeenCalledWith('課題3');
            expect(byTestId('classroom-detail-assignment-name-saved')).toBeInTheDocument();
        });

        test('保存に失敗したら赤で失敗を出し、「保存しました」は出さない', async () => {
            const onUpdateAssignmentName = jest.fn(() => Promise.resolve(false));
            renderDetail({ onUpdateAssignmentName });
            const input = byTestId('classroom-detail-assignment-name');
            fireEvent.change(input, { target: { value: '課題2' } });
            fireEvent.blur(input);
            await act(async () => {
                await Promise.resolve();
            });
            const err = byTestId('classroom-detail-assignment-name-save-error');
            expect(err.textContent).toBe("Couldn't save");
            expect(err).toHaveAttribute('role', 'alert');
            expect(byTestId('classroom-detail-assignment-name-saved')).not.toBeInTheDocument();

            // Editing again clears the failure so it does not linger.
            fireEvent.change(input, { target: { value: '課題4' } });
            expect(byTestId('classroom-detail-assignment-name-save-error')).not.toBeInTheDocument();
        });

        test('保存中に入力し直したら、遅れて終わった保存の結果は出さない', async () => {
            let resolveSave;
            const onUpdateAssignmentName = jest.fn(
                () =>
                    new Promise((resolve) => {
                        resolveSave = resolve;
                    }),
            );
            renderDetail({ onUpdateAssignmentName });
            const input = byTestId('classroom-detail-assignment-name');
            fireEvent.change(input, { target: { value: '課題2' } });
            fireEvent.blur(input);
            fireEvent.change(input, { target: { value: '課題22' } });
            await act(async () => {
                resolveSave(true);
                await Promise.resolve();
            });
            expect(byTestId('classroom-detail-assignment-name-saved')).not.toBeInTheDocument();
        });

        test('名前が変わっていないときは何も出さない', async () => {
            const onUpdateAssignmentName = jest.fn(() => Promise.resolve(true));
            renderDetail({ onUpdateAssignmentName });
            const input = byTestId('classroom-detail-assignment-name');
            fireEvent.focus(input);
            fireEvent.blur(input);
            await act(async () => {
                await Promise.resolve();
            });
            expect(onUpdateAssignmentName).not.toHaveBeenCalled();
            expect(byTestId('classroom-detail-assignment-name-saved')).not.toBeInTheDocument();
            expect(byTestId('classroom-detail-assignment-name-save-error')).not.toBeInTheDocument();
        });
    });

    test('E1: ［課題を保存］はページの編集欄より前（1 画面目）にある', () => {
        const onSave = jest.fn();
        renderDescription({ onSave });
        const save = byTestId('classroom-assignment-save');
        const firstPage = byTestId('classroom-assignment-page-0');
        expect(save.compareDocumentPosition(firstPage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        fireEvent.click(save);
        expect(onSave).toHaveBeenCalled();
    });

    test('E2: 詳しい設定は畳まれていて、閉じたままでも現在の値が分かる', () => {
        renderDescription();
        expect(byTestId('classroom-assignment-start-from-previous')).not.toBeInTheDocument();
        expect(byTestId('classroom-assignment-peer-view')).not.toBeInTheDocument();
        expect(byTestId('classroom-assignment-mesh-group-limit')).not.toBeInTheDocument();
        expect(byTestId('classroom-assignment-advanced-summary').textContent).toBe(
            "From last time: No · Peer view: Don't show · Mesh: Up to 6",
        );

        fireEvent.click(byTestId('classroom-assignment-advanced-toggle'));
        expect(byTestId('classroom-assignment-advanced-toggle')).toHaveAttribute('aria-expanded', 'true');
        expect(byTestId('classroom-assignment-start-from-previous')).toBeInTheDocument();
        expect(byTestId('classroom-assignment-peer-view')).toBeInTheDocument();
        expect(byTestId('classroom-assignment-mesh-group-limit')).toBeInTheDocument();
    });

    test('E2: 要約は保存前の選択も反映する', () => {
        renderDescription({ startFromPrevious: true, peerView: 'afterSubmit', meshGroupLimit: 0 });
        expect(byTestId('classroom-assignment-advanced-summary').textContent).toBe(
            'From last time: Yes · Peer view: After submitting their own · Mesh: No limit',
        );
    });

    test('E2: 開いた詳しい設定は Escape で閉じる', () => {
        renderDescription();
        openAdvanced();
        expect(byTestId('classroom-assignment-advanced-panel')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(byTestId('classroom-assignment-advanced-panel')).not.toBeInTheDocument();
        expect(byTestId('classroom-assignment-advanced-toggle')).toHaveAttribute('aria-expanded', 'false');
    });

    test('E2: 保存した値と同じなら「保存していません」も色も出さない', () => {
        renderDescription({
            startFromPrevious: false,
            peerView: 'none',
            meshGroupLimit: 6,
            savedSettings: { startFromPrevious: false, peerView: 'none', meshGroupLimit: 6 },
        });
        expect(byTestId('classroom-assignment-advanced-unsaved')).not.toBeInTheDocument();
        expect(document.querySelector('[data-changed="true"]')).not.toBeInTheDocument();
    });

    test('E2: 保存した値から変えた設定だけ色を付け、「保存していません」を出す', () => {
        renderDescription({
            startFromPrevious: false,
            peerView: 'always',
            meshGroupLimit: 6,
            savedSettings: { startFromPrevious: false, peerView: 'none', meshGroupLimit: 6 },
        });
        expect(byTestId('classroom-assignment-advanced-unsaved').textContent).toBe('Not saved yet');
        expect(byTestId('classroom-assignment-advanced-summary-peerView')).toHaveAttribute('data-changed', 'true');
        expect(byTestId('classroom-assignment-advanced-summary-previous')).not.toHaveAttribute('data-changed');
        expect(byTestId('classroom-assignment-advanced-summary-mesh')).not.toHaveAttribute('data-changed');
        // The summary text itself is unchanged (the mark is a separate element).
        expect(byTestId('classroom-assignment-advanced-summary').textContent).toBe(
            'From last time: No · Peer view: Anytime · Mesh: Up to 6',
        );
    });

    test('E3: ページが空のときプレビューは 1 行の案内だけ', () => {
        renderDescription({ editorPages: [{ text: '  ' }] });
        expect(byTestId('classroom-description-preview-empty').textContent).toBe('Write a page and it shows up here');
        expect(byTestId('classroom-description-preview-body')).not.toBeInTheDocument();
        expect(byTestId('classroom-description-preview-start')).not.toBeInTheDocument();
    });

    test('E3: 画像だけのページは空とみなさない', () => {
        renderDescription({ editorPages: [{ text: '', imageUrl: 'https://example.com/a.png' }] });
        expect(byTestId('classroom-description-preview-empty')).not.toBeInTheDocument();
        expect(byTestId('classroom-description-preview-body')).toBeInTheDocument();
    });
});

describe('TeacherClassDetail — lesson progress (#1602)', () => {
    const lesson = {
        courseId: 'kyou-kara-programmer',
        challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say'],
        requiredChallengeIds: ['blocks-l1-click-say'],
        completion: { type: 'all' },
        submitWork: false,
        scoring: null,
    };
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    const lessonProgress = {
        classroomId: 'c1',
        lesson,
        progress: [
            {
                memberId: 'seat-01',
                seatNumber: 1,
                challenges: { 'blocks-l1-key-sound': { completedAt: recent, before: false } },
                current: {
                    challengeId: 'blocks-l1-arrow-move',
                    openedAt: new Date(Date.now() - 15 * 60000).toISOString(),
                },
                updatedAt: recent,
            },
        ],
    };
    const members = [{ memberId: 'seat-01', displayName: 'あ', lastActiveAt: recent }];

    test('colours the seats by progress and shows the count, ★ left and「!」', () => {
        renderDetail({ lessonProgress, members });
        const seat1 = document.querySelector('[data-testid="classroom-member-seat-01"]');
        expect(seat1.dataset.lessonState).toBe('inProgress');
        expect(document.querySelector('[data-testid="classroom-lesson-seat-count-1"]').textContent).toBe('1 / 3');
        expect(document.querySelector('[data-testid="classroom-lesson-seat-required-1"]')).toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-lesson-seat-stuck-1"]')).toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-member-seat-02"]').dataset.lessonState).toBe(
            'notJoined',
        );
        expect(document.querySelector('[data-testid="classroom-lesson-seat-legend"]')).toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-seat-color-legend"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-lesson-cleared-summary"]').textContent).toContain('0');
    });

    test('keeps the ordinary seat colours for an assignment without a lesson', () => {
        renderDetail({ members });
        expect(document.querySelector('[data-testid="classroom-tab-progress"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-seat-color-legend"]')).toBeInTheDocument();
    });

    test('the progress tab shows the seat × challenge table and opens the seat on click', () => {
        const onSelectMember = jest.fn();
        renderDetail({ lessonProgress, members, onSelectMember });
        fireEvent.click(document.querySelector('[data-testid="classroom-tab-progress"]'));
        expect(document.querySelector('[data-testid="classroom-lesson-progress"]')).toBeInTheDocument();
        const cell = (id) =>
            document.querySelector(`[data-testid="classroom-lesson-progress-cell-seat-01-${id}"]`).textContent;
        expect(cell('blocks-l1-key-sound')).toBe('✓');
        expect(cell('blocks-l1-arrow-move')).toBe('!');
        expect(cell('blocks-l1-click-say')).toBe('・');
        expect(
            document.querySelector('[data-testid="classroom-lesson-progress-current-blocks-l1-arrow-move"]')
                .textContent,
        ).toBe('1');
        // #1767 M1: the assignment name field and the retention line fold away on this tab.
        expect(document.querySelector('[data-testid="classroom-detail-assignment-name"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-detail-compact-code"]')).toBeInTheDocument();
        fireEvent.click(document.querySelector('[data-testid="classroom-lesson-progress-seat-seat-01"]'));
        expect(onSelectMember).toHaveBeenCalledWith('seat-01');
    });

    test('shows 読み込み中 until the first fetch instead of grey seats (#1767 M2)', () => {
        const editor = { savedLesson: lesson, editorPages: [] };
        renderDetail({ members, assignmentEditor: editor });
        expect(document.querySelector('[data-testid="classroom-lesson-progress-loading"]')).toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-members-grid"]')).not.toBeInTheDocument();
        fireEvent.click(document.querySelector('[data-testid="classroom-tab-progress"]'));
        expect(document.querySelector('[data-testid="classroom-lesson-progress-loading"]')).toBeInTheDocument();
    });

    test('a failed first fetch shows the ordinary seats and a note (#1767 M2)', () => {
        const editor = { savedLesson: lesson, editorPages: [] };
        renderDetail({ members, assignmentEditor: editor, lessonProgress: { classroomId: 'c1', error: true } });
        expect(document.querySelector('[data-testid="classroom-lesson-progress-error"]')).toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-members-grid"]')).toBeInTheDocument();
        expect(
            document.querySelector('[data-testid="classroom-member-seat-01"]').dataset.lessonState,
        ).toBeUndefined();
    });

    test('a cleared seat on a further challenge gets no「!」(#1767 Q1)', () => {
        const all = Object.fromEntries(lesson.challengeIds.map((id) => [id, { completedAt: recent, before: false }]));
        const cleared = {
            ...lessonProgress,
            lesson: {
                ...lesson,
                challengeIds: [...lesson.challengeIds, 'blocks-l1-repeat'],
                completion: { type: 'count', count: 3 },
            },
            progress: [
                {
                    ...lessonProgress.progress[0],
                    challenges: all,
                    current: {
                        challengeId: 'blocks-l1-repeat',
                        openedAt: new Date(Date.now() - 20 * 60000).toISOString(),
                    },
                },
            ],
        };
        renderDetail({ lessonProgress: cleared, members });
        expect(document.querySelector('[data-testid="classroom-member-seat-01"]').dataset.lessonState).toBe(
            'cleared',
        );
        expect(document.querySelector('[data-testid="classroom-lesson-seat-stuck-1"]')).not.toBeInTheDocument();
    });
});
