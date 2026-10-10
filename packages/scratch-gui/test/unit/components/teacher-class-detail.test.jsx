/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
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
// a class co-teacher who is not a teacher of the linked course cannot share.
describe('TeacherClassDetail — Google Classroom share gate (issue #1184)', () => {
    const linkedProps = (googleCourseAccess) => ({
        selectedClassroom: classroom({ googleClassroomCourseId: null }),
        group: { groupId: 'g1', googleClassroomCourseId: 'course-123' },
        googleCourseAccess: googleCourseAccess && { groupId: 'g1', ...googleCourseAccess },
    });
    const postButton = () => document.querySelector('[data-testid="classroom-post-assignment"]');
    const blockedNote = () => document.querySelector('[data-testid="classroom-post-assignment-blocked"]');

    test('disables the share button and names who to ask when the teacher is not a course teacher', () => {
        renderDetail(linkedProps({ status: 'notTeacher', linkedByEmail: 'owner@example.com' }));
        expect(postButton()).toBeDisabled();
        expect(blockedNote()).toBeInTheDocument();
        expect(blockedNote().textContent).toContain('owner@example.com');
    });

    test('stays generic rather than guessing when the linking teacher is unknown', () => {
        renderDetail(linkedProps({ status: 'notTeacher', linkedByEmail: null }));
        expect(postButton()).toBeDisabled();
        expect(blockedNote().textContent).toContain('another teacher');
    });

    test('keeps the share button usable for a teacher of the course', () => {
        renderDetail(linkedProps({ status: 'teacher', linkedByEmail: 'owner@example.com' }));
        expect(postButton()).not.toBeDisabled();
        expect(blockedNote()).not.toBeInTheDocument();
    });

    test('keeps the share button usable when the check was inconclusive', () => {
        renderDetail(linkedProps({ status: 'unknown', linkedByEmail: null }));
        expect(postButton()).not.toBeDisabled();
        expect(blockedNote()).not.toBeInTheDocument();
    });

    test('keeps the share button usable when the check never ran', () => {
        renderDetail(linkedProps(null));
        expect(postButton()).not.toBeDisabled();
        expect(blockedNote()).not.toBeInTheDocument();
    });

    test('falls back to the class attribution when the probe carries no email', () => {
        renderDetail({
            selectedClassroom: classroom({ googleClassroomCourseId: null }),
            group: {
                groupId: 'g1',
                googleClassroomCourseId: 'course-123',
                googleClassroomLinkedByEmail: 'linker@example.com',
            },
            googleCourseAccess: { groupId: 'g1', status: 'notTeacher', linkedByEmail: null },
        });
        expect(blockedNote().textContent).toContain('linker@example.com');
    });

    // The probe is async, so switching classes leaves the previous class's
    // verdict in state until the new answer lands (and answers can arrive out
    // of order). It must not gate a class it was never about.
    test('ignores a verdict that was about a different class', () => {
        renderDetail({
            selectedClassroom: classroom({ googleClassroomCourseId: null }),
            group: { groupId: 'gB', googleClassroomCourseId: 'course-B' },
            googleCourseAccess: { groupId: 'gA', status: 'notTeacher', linkedByEmail: 'a@example.com' },
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

    test('shows no inline alert while the deadline is far away', () => {
        renderDetail({ selectedClassroom: classroom({ expiresAt: inDays(60) }) });
        expect(byTestId('classroom-retention-banner')).not.toBeInTheDocument();
    });

    test('shows the inline alert next to the deadline within 30 days of deletion', () => {
        renderDetail({ selectedClassroom: classroom({ expiresAt: inDays(20) }) });
        const alert = byTestId('classroom-retention-banner');
        expect(alert).toBeInTheDocument();
        expect(alert.textContent).toContain('deleted automatically');
    });

    test('the download-all button triggers onDownloadAll near the deadline', () => {
        const onDownloadAll = jest.fn();
        renderDetail({
            selectedClassroom: classroom({ expiresAt: inDays(5) }),
            onDownloadAll,
        });
        fireEvent.click(byTestId('classroom-download-all'));
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
