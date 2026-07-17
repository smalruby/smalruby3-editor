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

describe('TeacherClassDetail — retention banner (issue #1052)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const inDays = (days) => new Date(Date.now() + days * DAY).toISOString();
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('shows no banner while the deadline is far away', () => {
        renderDetail({ selectedClassroom: classroom({ expiresAt: inDays(60) }) });
        expect(byTestId('classroom-retention-banner')).not.toBeInTheDocument();
    });

    test('shows the banner with the deadline within 30 days of deletion', () => {
        renderDetail({ selectedClassroom: classroom({ expiresAt: inDays(20) }) });
        const banner = byTestId('classroom-retention-banner');
        expect(banner).toBeInTheDocument();
        expect(banner.textContent).toContain('deleted automatically');
    });

    test('the banner download button triggers onDownloadAll', () => {
        const onDownloadAll = jest.fn();
        renderDetail({
            selectedClassroom: classroom({ expiresAt: inDays(5) }),
            onDownloadAll,
        });
        fireEvent.click(byTestId('classroom-retention-banner-download'));
        expect(onDownloadAll).toHaveBeenCalled();
    });
});
