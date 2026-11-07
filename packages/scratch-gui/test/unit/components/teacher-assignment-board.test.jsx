/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherAssignmentBoard from '../../../src/components/classroom-modal/teacher-assignment-board.jsx';

const classroom = (over = {}) => ({
    classroomId: 'c1',
    className: '技術',
    assignmentName: '課題1',
    joinCode: 'abc234',
    groupId: 'g1',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...over,
});

const defaultProps = () => ({
    allClassrooms: [],
    allGroups: [],
    archivedClassrooms: [],
    classrooms: [classroom()],
    group: { groupId: 'g1', name: '技術', year: 2026, topics: [] },
    isLoading: false,
    onCreateAssignmentInClass: jest.fn(),
    onDownloadClassAll: jest.fn(),
    onRestoreClassroom: jest.fn(),
    onReuseAssignment: jest.fn(),
    onSelectClassroom: jest.fn(),
    onShowClassList: jest.fn(),
    onUpdateAssignmentMeta: jest.fn(),
    onUpdateGroupTopics: jest.fn(),
});

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

// A class opens on［ストリーム］(B5). renderStream keeps it there; renderBoard
// switches to［授業］, where most of the board's operations live.
const renderStream = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherAssignmentBoard {...defaultProps()} {...props} />
        </IntlProvider>,
    );
const renderBoard = (props) => {
    const result = renderStream(props);
    // A sub view (e.g. the share step) hides the tabs.
    const classworkTab = byTestId('classroom-board-tab-classwork');
    if (classworkTab) fireEvent.click(classworkTab);
    return result;
};

// The create ways live in the［＋ 作成 ▾］menu, rare actions in「…」, and the
// per-row topic / date / share in the row's ⋮ menu (#1301).
const openCreateMenu = () => fireEvent.click(byTestId('classroom-board-create-menu'));
const clickCreateItem = (id) => {
    openCreateMenu();
    fireEvent.click(byTestId(id));
};
const openMoreMenu = () => fireEvent.click(byTestId('classroom-board-more-menu'));
const openRow = (id) => fireEvent.click(byTestId(`classroom-board-row-toggle-${id}`));

describe('TeacherAssignmentBoard — archived assignments section (issue #1051)', () => {
    test('shows no archived section when nothing is archived', () => {
        renderBoard();
        expect(byTestId('classroom-board-archived-section')).not.toBeInTheDocument();
    });

    test('archived assignments are revealed by the toggle with their retention date', () => {
        renderBoard({
            archivedClassrooms: [
                classroom({
                    classroomId: 'c2',
                    assignmentName: '課題2',
                    status: 'archived',
                    expiresAt: '2026-09-29T00:00:00.000Z',
                }),
            ],
        });

        // Collapsed by default.
        expect(byTestId('classroom-board-archived-section')).toBeInTheDocument();
        expect(byTestId('classroom-board-archived-list')).not.toBeInTheDocument();

        fireEvent.click(byTestId('classroom-board-archived-toggle'));
        expect(byTestId('classroom-board-archived-row-c2')).toBeInTheDocument();
        expect(byTestId('classroom-board-archived-row-c2').textContent).toContain('課題2');
        expect(byTestId('classroom-board-archived-row-c2').textContent).toContain('Kept until');
    });

    test('restore button reports the classroomId to onRestoreClassroom', () => {
        const props = defaultProps();
        props.archivedClassrooms = [classroom({ classroomId: 'c2', status: 'archived' })];
        renderBoard(props);

        fireEvent.click(byTestId('classroom-board-archived-toggle'));
        fireEvent.click(byTestId('classroom-board-restore-c2'));

        expect(props.onRestoreClassroom).toHaveBeenCalledWith('c2');
    });

    test('archived rows are sorted newest first by sortDate/createdAt', () => {
        renderBoard({
            archivedClassrooms: [
                classroom({ classroomId: 'old', createdAt: '2026-05-01T00:00:00.000Z' }),
                classroom({ classroomId: 'new', createdAt: '2026-07-01T00:00:00.000Z' }),
            ],
        });
        fireEvent.click(byTestId('classroom-board-archived-toggle'));
        const rows = Array.from(
            document.querySelectorAll('[data-testid^="classroom-board-archived-row-"]'),
        ).map((el) => el.getAttribute('data-testid'));
        expect(rows).toEqual(['classroom-board-archived-row-new', 'classroom-board-archived-row-old']);
    });
});

describe('TeacherAssignmentBoard — class-wide bulk download (issue #1055)', () => {
    test('the header button downloads active and archived assignments together', () => {
        const props = defaultProps();
        props.classrooms = [classroom()];
        props.archivedClassrooms = [classroom({ classroomId: 'c2', status: 'archived' })];
        props.onDownloadClassAll = jest.fn();
        renderBoard(props);

        openMoreMenu();
        fireEvent.click(byTestId('classroom-board-download-class'));

        expect(props.onDownloadClassAll).toHaveBeenCalledWith(
            props.group,
            expect.arrayContaining([
                expect.objectContaining({ classroomId: 'c1' }),
                expect.objectContaining({ classroomId: 'c2' }),
            ]),
        );
    });

    test('shows progress and disables the button while downloading', () => {
        renderBoard({ downloadProgress: { current: 2, total: 5 } });
        openMoreMenu();
        const button = byTestId('classroom-board-download-class');
        expect(button).toBeDisabled();
        expect(button.textContent).toContain('2/5');
    });
});

describe('TeacherAssignmentBoard — share entry (#1109)', () => {
    const sharedStub = (over = {}) => ({
        shareTarget: null,
        showCatalog: false,
        lastShared: null,
        lastImported: null,
        handleOpenShareFor: jest.fn(),
        handleCloseShareForm: jest.fn(),
        handleShareAssignment: jest.fn(),
        handleOpenCatalog: jest.fn(),
        ...over,
    });

    test('a 共有 button appears only for assignments with content, and opens the share step', () => {
        const shared = sharedStub();
        renderBoard({ shared, classrooms: [classroom({ hasAssignment: true })] });
        fireEvent.click(byTestId('classroom-board-row-menu-c1'));
        const btn = byTestId('classroom-board-share-c1');
        expect(btn).toBeInTheDocument();
        fireEvent.click(btn);
        expect(shared.handleOpenShareFor).toHaveBeenCalledWith(expect.objectContaining({ classroomId: 'c1' }));
    });

    test('no 共有 button when the assignment has no content (説明/スターターなし)', () => {
        const shared = sharedStub();
        renderBoard({ shared, classrooms: [classroom({ hasAssignment: false })] });
        fireEvent.click(byTestId('classroom-board-row-menu-c1'));
        expect(byTestId('classroom-board-share-c1')).not.toBeInTheDocument();
    });

    test('with a shareTarget the share step replaces the board body', () => {
        const shared = sharedStub({ shareTarget: classroom() });
        renderBoard({ shared });
        expect(byTestId('classroom-phase-share-step')).toBeInTheDocument();
        // The create action bar is hidden while sharing.
        expect(byTestId('classroom-board-create-menu')).not.toBeInTheDocument();
    });

    test('no 共有 button when the shared hook is absent', () => {
        renderBoard();
        fireEvent.click(byTestId('classroom-board-row-menu-c1'));
        expect(byTestId('classroom-board-share-c1')).not.toBeInTheDocument();
    });
});

describe('TeacherAssignmentBoard — retention (B4: red only within 7 days)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const inDays = (days) => new Date(Date.now() + days * DAY).toISOString();

    test('20 days left is not red: no mark on the row, a grey deadline inside', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: inDays(20) })] });
        expect(byTestId('classroom-board-expiry-mark-c1')).not.toBeInTheDocument();
        openRow('c1');
        expect(byTestId('classroom-board-expiry-c1')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-retention-c1').textContent).toContain('Kept until');
    });

    test('within 7 days: a small red mark on the closed row and the warning inside', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: inDays(5) })] });
        // R5: the meaning of the mark is visible on the row, not only in a tooltip.
        expect(byTestId('classroom-board-expiry-mark-c1').textContent).toContain('Kept until');
        openRow('c1');
        const notice = byTestId('classroom-board-expiry-c1');
        expect(notice.textContent).toContain('deleted automatically');
        expect(byTestId('classroom-board-retention-c1')).not.toBeInTheDocument();
    });

    test('the warning download button downloads that one assignment', () => {
        const onDownloadClassAll = jest.fn();
        renderBoard({
            classrooms: [classroom({ expiresAt: inDays(5) })],
            onDownloadClassAll,
        });
        openRow('c1');
        fireEvent.click(byTestId('classroom-board-download-c1'));
        expect(onDownloadClassAll).toHaveBeenCalledWith(
            expect.objectContaining({ groupId: 'g1' }),
            [expect.objectContaining({ classroomId: 'c1' })],
        );
    });

    test('never shows a deadline for assignments without one', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: null })] });
        openRow('c1');
        expect(byTestId('classroom-board-expiry-c1')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-retention-c1')).not.toBeInTheDocument();
    });
});

describe('TeacherAssignmentBoard — reuse excludes archived (review feedback)', () => {
    test('reuse candidates and the class filter exclude archived classes and assignments', () => {
        const allGroups = [
            { groupId: 'g1', name: 'A', year: 2026, status: 'active', topics: [] },
            { groupId: 'gArch', name: 'B', year: 2026, status: 'archived', topics: [] },
        ];
        const allClassrooms = [
            { classroomId: 'active1', groupId: 'g1', assignmentName: 'A課題', status: 'active' },
            { classroomId: 'archAssign', groupId: 'g1', assignmentName: 'アーカイブ課題', status: 'archived' },
            { classroomId: 'inArchGroup', groupId: 'gArch', assignmentName: 'アーカイブ組の課題', status: 'active' },
        ];
        renderBoard({
            group: { groupId: 'g1', name: 'A', year: 2026, topics: [] },
            allGroups,
            allClassrooms,
        });
        clickCreateItem('classroom-board-reuse');

        // Only the active assignment of an active class is a candidate.
        expect(byTestId('classroom-board-reuse-copy-active1')).toBeInTheDocument();
        expect(byTestId('classroom-board-reuse-copy-archAssign')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-reuse-copy-inArchGroup')).not.toBeInTheDocument();

        // The class filter lists only the active class.
        const values = [...byTestId('classroom-board-reuse-filter').options].map((o) => o.value);
        expect(values).toContain('g1');
        expect(values).not.toContain('gArch');
    });

    test('共有おすすめマーク (#1106): recommendedForSharing の行だけに出る', () => {
        renderBoard({
            classrooms: [
                classroom({ recommendedForSharing: true }),
                classroom({ classroomId: 'c2', assignmentName: '課題2' }),
            ],
        });
        expect(byTestId('classroom-board-share-suggested-c1')).toBeInTheDocument();
        expect(byTestId('classroom-board-share-suggested-c2')).not.toBeInTheDocument();
    });
});

describe('TeacherAssignmentBoard — mesh group size on the create screen (#1257)', () => {
    test('defaults to "Up to 6" and sends the choice with the new assignment', () => {
        const props = defaultProps();
        renderBoard(props);
        clickCreateItem('classroom-board-create');
        const select = byTestId('classroom-board-create-mesh-group-limit');
        expect(select.value).toBe('6');

        fireEvent.change(byTestId('classroom-board-create-name'), { target: { value: '課題2' } });
        fireEvent.click(byTestId('classroom-board-create-submit'));
        expect(props.onCreateAssignmentInClass).toHaveBeenCalledWith(props.group, '課題2', { meshGroupLimit: 6 });
    });

    test('"No limit" is sent as 0', () => {
        const props = defaultProps();
        renderBoard(props);
        clickCreateItem('classroom-board-create');
        fireEvent.change(byTestId('classroom-board-create-mesh-group-limit'), { target: { value: '0' } });
        fireEvent.change(byTestId('classroom-board-create-name'), { target: { value: '課題2' } });
        fireEvent.click(byTestId('classroom-board-create-submit'));
        expect(props.onCreateAssignmentInClass).toHaveBeenCalledWith(props.group, '課題2', { meshGroupLimit: 0 });
    });
    test.each([
        ['cancel', () => fireEvent.click(byTestId('classroom-board-create-cancel'))],
        ['the assignments breadcrumb', () => fireEvent.click(byTestId('classroom-breadcrumb-assignments'))],
    ])('leaving by %s resets the form, so reopening shows the defaults (review FYI4)', (_label, leave) => {
        const props = defaultProps();
        renderBoard(props);
        clickCreateItem('classroom-board-create');
        fireEvent.change(byTestId('classroom-board-create-name'), { target: { value: '書きかけ' } });
        fireEvent.change(byTestId('classroom-board-create-mesh-group-limit'), { target: { value: '0' } });
        leave();

        clickCreateItem('classroom-board-create');
        expect(byTestId('classroom-board-create-name').value).toBe('');
        expect(byTestId('classroom-board-create-mesh-group-limit').value).toBe('6');
    });

    test('after creating, reopening shows the defaults', () => {
        const props = defaultProps();
        renderBoard(props);
        clickCreateItem('classroom-board-create');
        fireEvent.change(byTestId('classroom-board-create-name'), { target: { value: '課題2' } });
        fireEvent.change(byTestId('classroom-board-create-mesh-group-limit'), { target: { value: '0' } });
        fireEvent.click(byTestId('classroom-board-create-submit'));

        clickCreateItem('classroom-board-create');
        expect(byTestId('classroom-board-create-name').value).toBe('');
        expect(byTestId('classroom-board-create-mesh-group-limit').value).toBe('6');
    });

    test('the reuse class filter is reset when the reuse screen is closed', () => {
        renderBoard({
            allGroups: [
                { groupId: 'g1', name: 'A', year: 2026, status: 'active', topics: [] },
                { groupId: 'g2', name: 'B', year: 2026, status: 'active', topics: [] },
            ],
        });
        clickCreateItem('classroom-board-reuse');
        fireEvent.change(byTestId('classroom-board-reuse-filter'), { target: { value: 'g2' } });
        expect(byTestId('classroom-board-reuse-filter').value).toBe('g2');
        fireEvent.click(byTestId('classroom-board-reuse-cancel'));

        clickCreateItem('classroom-board-reuse');
        expect(byTestId('classroom-board-reuse-filter').value).toBe('');
    });
});

describe('TeacherAssignmentBoard — Stream / Classwork tabs (#1301, B5)', () => {
    test('opens on Stream; Classwork shows the assignment list and the create menu', () => {
        renderStream();
        expect(byTestId('classroom-board-tab-stream')).toHaveAttribute('aria-selected', 'true');
        expect(byTestId('classroom-board-stream')).toBeInTheDocument();
        expect(byTestId('classroom-board-row-c1')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-create-menu')).not.toBeInTheDocument();

        fireEvent.click(byTestId('classroom-board-tab-classwork'));
        expect(byTestId('classroom-board-tab-classwork')).toHaveAttribute('aria-selected', 'true');
        expect(byTestId('classroom-board-row-c1')).toBeInTheDocument();
        expect(byTestId('classroom-board-stream')).not.toBeInTheDocument();
    });

    test('initialTab opens on Classwork and onTabChange reports the switches', () => {
        const onTabChange = jest.fn();
        renderStream({ initialTab: 'classwork', onTabChange });
        expect(byTestId('classroom-board-tab-classwork')).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(byTestId('classroom-board-tab-stream'));
        expect(onTabChange).toHaveBeenLastCalledWith('stream');
    });
});

describe('TeacherAssignmentBoard — stream entries (B5)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const soon = () => new Date(Date.now() + 2 * DAY).toISOString();
    const far = () => new Date(Date.now() + 60 * DAY).toISOString();
    const streamKeys = () =>
        Array.from(document.querySelectorAll('[data-testid^="classroom-board-stream-item-"]')).map((el) =>
            el.getAttribute('data-testid').replace('classroom-board-stream-item-', ''),
        );

    test('lists created / archived / expiring entries with the assignment names', () => {
        renderStream({
            classrooms: [
                classroom({ classroomId: 'a', assignmentName: '新しい課題', createdAt: '2026-10-20T00:00:00.000Z', expiresAt: far() }),
                classroom({ classroomId: 'b', assignmentName: 'もうすぐ消える', createdAt: '2026-09-01T00:00:00.000Z', expiresAt: soon() }),
            ],
            archivedClassrooms: [
                classroom({
                    classroomId: 'x',
                    assignmentName: '片付けた課題',
                    status: 'archived',
                    createdAt: '2026-08-01T00:00:00.000Z',
                    archivedAt: '2026-10-10T00:00:00.000Z',
                    expiresAt: far(),
                }),
            ],
        });
        expect(streamKeys()).toEqual(['expiring-b', 'created-a', 'archived-x', 'created-b', 'created-x']);
        expect(byTestId('classroom-board-stream-item-created-a').textContent).toContain(
            'Created the assignment "新しい課題"',
        );
        expect(byTestId('classroom-board-stream-item-archived-x').textContent).toContain(
            'Archived the assignment "片付けた課題"',
        );
        expect(byTestId('classroom-board-stream-item-expiring-b').textContent).toContain(
            'The assignment "もうすぐ消える" will be deleted automatically on',
        );
    });

    test('an empty class shows the empty message', () => {
        renderStream({ classrooms: [], archivedClassrooms: [] });
        expect(byTestId('classroom-board-stream-empty')).toBeInTheDocument();
    });

    test('an active entry opens that assignment on Classwork', async () => {
        const onLoadAssignmentSummary = jest.fn().mockResolvedValue({ joined: 0, capacity: 40, submitted: 0 });
        renderStream({ onLoadAssignmentSummary });
        fireEvent.click(byTestId('classroom-board-stream-item-created-c1'));
        expect(byTestId('classroom-board-tab-classwork')).toHaveAttribute('aria-selected', 'true');
        expect(byTestId('classroom-board-open-c1')).toBeInTheDocument();
        await waitFor(() => expect(onLoadAssignmentSummary).toHaveBeenCalledTimes(1));
    });

    test('an archived entry opens the archived section with its restore button', () => {
        renderStream({
            classrooms: [],
            archivedClassrooms: [
                classroom({ classroomId: 'x', status: 'archived', archivedAt: '2026-10-10T00:00:00.000Z' }),
            ],
        });
        fireEvent.click(byTestId('classroom-board-stream-item-archived-x'));
        expect(byTestId('classroom-board-tab-classwork')).toHaveAttribute('aria-selected', 'true');
        expect(byTestId('classroom-board-archived-list')).toBeInTheDocument();
        expect(byTestId('classroom-board-restore-x')).toBeInTheDocument();
    });
});

describe('TeacherAssignmentBoard — one［＋ 作成 ▾］menu (B6)', () => {
    const sharedStub = () => ({
        handleOpenCatalog: jest.fn(),
        handleOpenPasscodeImport: jest.fn(),
        handleOpenShareFor: jest.fn(),
    });

    test('the create ways are menu items, not buttons on the board', () => {
        renderBoard({ shared: sharedStub() });
        expect(byTestId('classroom-board-create')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-reuse')).not.toBeInTheDocument();
        expect(byTestId('classroom-topic-add-input')).not.toBeInTheDocument();

        openCreateMenu();
        const items = Array.from(
            byTestId('classroom-board-create-menu-list').querySelectorAll('[role="menuitem"]'),
        ).map((el) => el.getAttribute('data-testid'));
        expect(items).toEqual([
            'classroom-board-create',
            'classroom-board-reuse',
            'classroom-board-shared-catalog',
            'classroom-board-passcode-import',
            'classroom-board-create-topic',
        ]);
    });

    test('catalog and passcode items open those steps', () => {
        const shared = sharedStub();
        renderBoard({ shared });
        clickCreateItem('classroom-board-shared-catalog');
        expect(shared.handleOpenCatalog).toHaveBeenCalled();
        clickCreateItem('classroom-board-passcode-import');
        expect(shared.handleOpenPasscodeImport).toHaveBeenCalled();
    });

    test('「トピック」 opens the add-topic dialog, which adds the trimmed name', () => {
        const props = defaultProps();
        renderBoard(props);
        clickCreateItem('classroom-board-create-topic');
        expect(byTestId('classroom-topic-add-dialog')).toBeInTheDocument();
        expect(byTestId('classroom-topic-add')).toBeDisabled();

        fireEvent.change(byTestId('classroom-topic-add-input'), { target: { value: ' 第1回 ' } });
        fireEvent.click(byTestId('classroom-topic-add'));
        expect(props.onUpdateGroupTopics).toHaveBeenCalledWith('g1', { action: 'add', name: '第1回' });
        expect(byTestId('classroom-topic-add-dialog')).not.toBeInTheDocument();
    });

    test('cancelling the add-topic dialog adds nothing and clears the input', () => {
        const props = defaultProps();
        renderBoard(props);
        clickCreateItem('classroom-board-create-topic');
        fireEvent.change(byTestId('classroom-topic-add-input'), { target: { value: '書きかけ' } });
        fireEvent.click(byTestId('classroom-topic-add-cancel'));
        expect(props.onUpdateGroupTopics).not.toHaveBeenCalled();

        clickCreateItem('classroom-board-create-topic');
        expect(byTestId('classroom-topic-add-input').value).toBe('');
    });
});

describe('TeacherAssignmentBoard — topic sections (B6)', () => {
    test('every section has a heading, including "no topic", and empty topics are listed', () => {
        renderBoard({
            group: { groupId: 'g1', name: '技術', year: 2026, topics: ['第1回', '第2回'] },
            classrooms: [classroom(), classroom({ classroomId: 'c2', topic: '第1回' })],
        });
        expect(byTestId('classroom-board-section-title-none').textContent).toBe('No topic');
        expect(byTestId('classroom-board-section-title-第1回').textContent).toBe('第1回');
        expect(byTestId('classroom-board-section-第2回')).toBeInTheDocument();
    });

    test('a topic is renamed and removed from its heading menu', () => {
        const props = defaultProps();
        props.group = { groupId: 'g1', name: '技術', year: 2026, topics: ['第1回'] };
        renderBoard(props);

        fireEvent.click(byTestId('classroom-topic-menu-第1回'));
        fireEvent.click(byTestId('classroom-topic-rename-第1回'));
        const input = byTestId('classroom-topic-rename-input-第1回');
        // R1: a visible label, not only an aria-label.
        expect(document.querySelector('label[for="classroom-topic-rename-input-第1回"]').textContent).toBe('Topic');
        fireEvent.change(input, { target: { value: '第一回' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(props.onUpdateGroupTopics).toHaveBeenCalledWith('g1', {
            action: 'rename',
            name: '第1回',
            to: '第一回',
        });

        fireEvent.click(byTestId('classroom-topic-menu-第1回'));
        fireEvent.click(byTestId('classroom-topic-remove-第1回'));
        expect(props.onUpdateGroupTopics).toHaveBeenCalledWith('g1', { action: 'remove', name: '第1回' });
    });
});

describe('TeacherAssignmentBoard — rows open in place (B3・B7)', () => {
    const summary = { submitted: 3, joined: 5, capacity: 30, descriptionLine: 'ねこを10歩動かそう' };

    test('the closed row shows the name and a labelled lesson date only', () => {
        renderBoard({ classrooms: [classroom({ sortDate: '2026-07-03T00:00:00.000Z' })] });
        const row = byTestId('classroom-board-row-c1');
        expect(row.textContent).toContain('課題1');
        expect(byTestId('classroom-board-row-date-c1').textContent).toContain('Lesson date');
        expect(row.textContent).not.toContain('abc234');
        expect(byTestId('classroom-board-row-detail-c1')).not.toBeInTheDocument();
    });

    test('opening a row shows the labelled join code, the summary, and［課題を開く］', async () => {
        const props = defaultProps();
        props.onLoadAssignmentSummary = jest.fn().mockResolvedValue(summary);
        renderBoard(props);
        openRow('c1');

        expect(props.onLoadAssignmentSummary).toHaveBeenCalledWith(expect.objectContaining({ classroomId: 'c1' }));
        const code = byTestId('classroom-board-row-code-c1');
        expect(code.textContent).toContain('Join code');
        expect(code.textContent).toContain('abc234');

        await waitFor(() => expect(byTestId('classroom-board-row-counts-c1').textContent).toContain('3'));
        expect(byTestId('classroom-board-row-counts-c1').textContent).toContain('5');
        expect(byTestId('classroom-board-row-counts-c1').textContent).toContain('30');
        expect(byTestId('classroom-board-row-description-c1').textContent).toBe('ねこを10歩動かそう');

        fireEvent.click(byTestId('classroom-board-open-c1'));
        expect(props.onSelectClassroom).toHaveBeenCalledWith('c1');
    });

    test('only one row is open at a time, and the summary is loaded once per row', async () => {
        const props = defaultProps();
        props.classrooms = [classroom(), classroom({ classroomId: 'c2', assignmentName: '課題2' })];
        props.onLoadAssignmentSummary = jest.fn().mockResolvedValue(summary);
        renderBoard(props);

        openRow('c1');
        await waitFor(() => expect(byTestId('classroom-board-row-counts-c1').textContent).toContain('3'));
        openRow('c2');
        expect(byTestId('classroom-board-row-detail-c1')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-row-detail-c2')).toBeInTheDocument();
        openRow('c1');
        expect(props.onLoadAssignmentSummary).toHaveBeenCalledTimes(2);

        openRow('c1');
        expect(byTestId('classroom-board-row-detail-c1')).not.toBeInTheDocument();
    });

    test('a row whose summary failed shows "-" and loads again when reopened', async () => {
        const props = defaultProps();
        props.onLoadAssignmentSummary = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(summary);
        renderBoard(props);

        openRow('c1');
        await waitFor(() => expect(byTestId('classroom-board-row-counts-c1').textContent).toBe('-'));
        openRow('c1');
        openRow('c1');
        await waitFor(() => expect(byTestId('classroom-board-row-counts-c1').textContent).toContain('30'));
        expect(props.onLoadAssignmentSummary).toHaveBeenCalledTimes(2);
    });

    test('the row menu edits the topic and the lesson date', () => {
        const props = defaultProps();
        props.group = { groupId: 'g1', name: '技術', year: 2026, topics: ['第1回'] };
        renderBoard(props);
        fireEvent.click(byTestId('classroom-board-row-menu-c1'));
        fireEvent.change(byTestId('classroom-board-topic-c1'), { target: { value: '第1回' } });
        expect(props.onUpdateAssignmentMeta).toHaveBeenCalledWith('c1', { topic: '第1回' });
        fireEvent.change(byTestId('classroom-board-date-c1'), { target: { value: '2026-07-10' } });
        expect(props.onUpdateAssignmentMeta).toHaveBeenCalledWith('c1', {
            sortDate: new Date('2026-07-10T00:00:00').toISOString(),
        });
    });
});
