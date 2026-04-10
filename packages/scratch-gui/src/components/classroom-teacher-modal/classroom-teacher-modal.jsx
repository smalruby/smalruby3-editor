/**
 * Teacher fullscreen class management modal.
 *
 * Separate from the student ClassroomModal. Renders a fullscreen overlay
 * with a sidebar (class list) and a main area that shows phase content.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';

import Modal from '../../containers/modal.jsx';

import ClassCodeDisplay from '../classroom-modal/class-code-display.jsx';
import ErrorDisplay from '../classroom-modal/error-display.jsx';
import GoogleCourseList from '../classroom-modal/google-course-list.jsx';
import TeacherClassDetail from '../classroom-modal/teacher-class-detail.jsx';
import TeacherCreateForm from '../classroom-modal/teacher-create-form.jsx';
import TeacherPostAssignment from '../classroom-modal/teacher-post-assignment.jsx';
import ClassroomTutorial from '../classroom-tutorial/classroom-tutorial.jsx';
import Spinner from '../spinner/spinner.jsx';

import {
    isTutorialSeen,
    markClassroomTutorialSeen,
} from '../../reducers/classroom-tutorial.js';

import googleAuthHintImage from './google-auth-hint.png';
import googleClassroomIcon from './google-classroom-icon.png';
import carouselImage1 from './carousel-1-submit.png';
import carouselImage2 from './carousel-2-overview.png';
import carouselImage3 from './carousel-3-preview.png';
import carouselImage4 from './carousel-4-gc.png';
import styles from './classroom-teacher-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Class Management',
        description: 'Title for the teacher class management modal',
        id: 'gui.classroom.management.title',
    },
});

/**
 * Carousel showing feature highlights on the login screen.
 * Auto-advances every 5 seconds with dot indicators.
 */
const CAROUSEL_SLIDES = [
    {
        titleId: 'gui.classroom.carousel.submitTitle',
        titleDefault: 'Students can submit assignments',
        descId: 'gui.classroom.carousel.submitDesc',
        descDefault:
            'Students join with a code and submit their work with one click.',
        image: carouselImage1,
    },
    {
        titleId: 'gui.classroom.carousel.overviewTitle',
        titleDefault: 'See submission status at a glance',
        descId: 'gui.classroom.carousel.overviewDesc',
        descDefault:
            'The seat grid shows who has submitted, returned, or is still working.',
        image: carouselImage2,
    },
    {
        titleId: 'gui.classroom.carousel.screenshotTitle',
        titleDefault: 'Preview without opening',
        descId: 'gui.classroom.carousel.screenshotDesc',
        descDefault:
            'Thumbnails and block screenshots let you review work quickly.',
        image: carouselImage3,
    },
    {
        titleId: 'gui.classroom.carousel.gcTitle',
        titleDefault: 'Google Classroom integration',
        descId: 'gui.classroom.carousel.gcDesc',
        descDefault:
            'Import class rosters from Google Classroom and post assignment links.',
        image: carouselImage4,
    },
];

const LoginCarousel = () => {
    const [slideIndex, setSlideIndex] = useState(0);
    const intl = useIntl();

    useEffect(() => {
        const timer = setInterval(() => {
            setSlideIndex((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const handleDotClick = useCallback((e) => {
        setSlideIndex(Number(e.currentTarget.dataset.index));
    }, []);

    const slide = CAROUSEL_SLIDES[slideIndex];
    return (
        <div className={styles.carousel}>
            <div className={styles.carouselSlide}>
                <div className={styles.carouselTitle}>
                    {intl.formatMessage({
                        id: slide.titleId,
                        defaultMessage: slide.titleDefault,
                    })}
                </div>
                <div className={styles.carouselDesc}>
                    {intl.formatMessage({
                        id: slide.descId,
                        defaultMessage: slide.descDefault,
                    })}
                </div>
                {slide.image && (
                    <img
                        alt=""
                        className={styles.carouselImage}
                        src={slide.image}
                    />
                )}
            </div>
            <div className={styles.carouselDots}>
                {CAROUSEL_SLIDES.map((_, i) => (
                    <button
                        className={classNames(
                            styles.carouselDot,
                            i === slideIndex && styles.carouselDotActive,
                        )}
                        data-index={i}
                        key={i}
                        onClick={handleDotClick}
                    />
                ))}
            </div>
        </div>
    );
};

const ClassroomTeacherModal = ({ containerProps, onClose }) => {
    const intl = useIntl();
    const {
        phase,
        classrooms,
        selectedClassroom,
        members,
        error,
        errorTitle,
        errorActionLabel,
        errorActionHandler,
        isLoading,
        selectedMember,
        codeDisplayClassroom,
        codeDisplayFullscreen,
        downloadProgress,
        googleCourses,
        selectedGoogleCourse,
        onTeacherLogin,
        onTeacherLogout,
        onShowCreateForm,
        onCreateClassroom,
        onSelectClassroom,
        onBackToDashboard,
        onDeleteClassroom,
        onDeleteMember,
        onRefreshDetail,
        onSelectMember,
        onOpenSubmission,
        onReturnSubmission,
        onDownloadAll,
        onShowCodeDisplay,
        onCloseCodeDisplay,
        onCopyInviteLink,
        onToggleCodeFullscreen,
        onShowPostAssignment,
        onBackToDetail,
        onPostAssignment,
        onShowGoogleCourses,
        onLoadGoogleCourses,
        onSelectGoogleCourse,
        onConfirmGoogleImport,
        onUpdateAssignmentName,
        onUpdateStudentCount,
    } = containerProps;

    const dispatch = useDispatch();
    const checkboxesSeen = useSelector((state) =>
        isTutorialSeen(state, 'checkboxes'),
    );
    const [showAuthHint, setShowAuthHint] = useState(false);

    const handleImportClick = useCallback(() => {
        onShowGoogleCourses();
        if (checkboxesSeen) {
            onLoadGoogleCourses();
        } else {
            setShowAuthHint(true);
        }
    }, [checkboxesSeen, onShowGoogleCourses, onLoadGoogleCourses]);

    const handleAuthHintDismiss = useCallback(() => {
        dispatch(markClassroomTutorialSeen('checkboxes'));
        setShowAuthHint(false);
        onLoadGoogleCourses();
    }, [dispatch, onLoadGoogleCourses]);

    const handleSelectClassroom = useCallback(
        (e) => {
            onSelectClassroom(e.currentTarget.dataset.classroomId);
        },
        [onSelectClassroom],
    );

    const handleDeleteMember = useCallback(
        (e) => {
            onDeleteMember(e.currentTarget.dataset.memberId);
        },
        [onDeleteMember],
    );

    // Group classrooms by className for sidebar display
    const groupedClassrooms = useMemo(() => {
        const groups = {};
        for (const c of classrooms) {
            const name = c.className || '';
            if (!groups[name]) {
                groups[name] = [];
            }
            groups[name].push(c);
        }
        const sortedGroupNames = Object.keys(groups).sort((a, b) =>
            a.localeCompare(b, 'ja'),
        );
        for (const name of sortedGroupNames) {
            groups[name].sort((a, b) => {
                const nameComp = (a.assignmentName || '').localeCompare(
                    b.assignmentName || '',
                    'ja',
                );
                if (nameComp !== 0) return nameComp;
                return (
                    new Date(b.createdAt || 0) -
                    new Date(a.createdAt || 0)
                );
            });
        }
        return sortedGroupNames.map((name) => ({
            className: name,
            hasGoogleClassroom: groups[name].some(
                (c) => c.googleClassroomCourseId,
            ),
            classrooms: groups[name],
        }));
    }, [classrooms]);

    const renderMain = () => {
        // Fullscreen code display overlay (portal)
        if (codeDisplayFullscreen && codeDisplayClassroom) {
            return (
                <ClassCodeDisplay
                    classroom={codeDisplayClassroom}
                    isFullscreen
                    onClose={onCloseCodeDisplay}
                    onCopyInviteLink={onCopyInviteLink}
                    onToggleFullscreen={onToggleCodeFullscreen}
                />
            );
        }

        if (phase === 'teacher-login') {
            return (
                <div
                    className={styles.loginArea}
                    data-testid="classroom-phase-teacher-login"
                >
                    <div className={styles.loginTop}>
                        <h2>
                            <FormattedMessage
                                defaultMessage="Sign in with Google"
                                description="Prompt for teacher Google sign in"
                                id="gui.classroom.management.loginPrompt"
                            />
                        </h2>
                        <p>
                            <FormattedMessage
                                defaultMessage="Sign in with your Google account to manage classrooms."
                                description="Teacher login description"
                                id="gui.classroom.management.loginDescription"
                            />
                        </p>
                        <p className={styles.loginHint}>
                            <FormattedMessage
                                defaultMessage="Use your school's Google Workspace for Education account to integrate with Google Classroom."
                                description="Hint about using school Google account"
                                id="gui.classroom.management.loginHint"
                            />
                        </p>
                        <button
                            className={styles.loginButton}
                            data-testid="classroom-google-login"
                            onClick={onTeacherLogin}
                        >
                            <FormattedMessage
                                defaultMessage="Sign in with Google"
                                description="Google sign in button"
                                id="gui.classroom.management.loginButton"
                            />
                        </button>
                        <ErrorDisplay
                            error={error}
                            errorTitle={errorTitle}
                        />
                    </div>
                    <div className={styles.loginBottom}>
                        <LoginCarousel />
                    </div>
                </div>
            );
        }

        if (phase === 'teacher-class-detail' && selectedClassroom) {
            return (
                <div className={styles.mainRelative}>
                    <TeacherClassDetail
                        codeDisplayClassroom={codeDisplayClassroom}
                        codeDisplayFullscreen={false}
                        downloadProgress={downloadProgress}
                        error={error}
                        errorActionLabel={errorActionLabel}
                        errorActionHandler={errorActionHandler}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        members={members}
                        noBackButton
                        selectedClassroom={selectedClassroom}
                        selectedMember={selectedMember}
                        onCloseCodeDisplay={onCloseCodeDisplay}
                        onCopyInviteLink={onCopyInviteLink}
                        onDeleteClassroom={onDeleteClassroom}
                        onDeleteMember={handleDeleteMember}
                        onDownloadAll={onDownloadAll}
                        onOpenSubmission={onOpenSubmission}
                        onRefresh={onRefreshDetail}
                        onReturnSubmission={onReturnSubmission}
                        onSelectMember={onSelectMember}
                        onShowCodeDisplay={onShowCodeDisplay}
                        onShowPostAssignment={onShowPostAssignment}
                        onToggleCodeFullscreen={onToggleCodeFullscreen}
                        onUpdateAssignmentName={onUpdateAssignmentName}
                        onUpdateStudentCount={onUpdateStudentCount}
                    />
                </div>
            );
        }

        if (phase === 'teacher-create') {
            return (
                <div className={styles.mainRelative}>
                    <TeacherCreateForm
                        error={error}
                        errorTitle={errorTitle}
                        importSource={selectedGoogleCourse}
                        isLoading={isLoading}
                        noBackButton
                        onBack={onBackToDashboard}
                        onCreate={onCreateClassroom}
                        onImportFromGC={handleImportClick}

                    />
                </div>
            );
        }

        if (phase === 'teacher-google-courses') {
            return (
                <div
                    className={styles.mainRelative}
                    data-testid="classroom-phase-teacher-google-courses"
                >
                    {showAuthHint && (
                        <div className={styles.authHintOverlay}>
                            <div className={styles.authHint}>
                                <div className={styles.mainPhaseTitle}>
                                    <FormattedMessage
                                        defaultMessage="Before importing from Google Classroom"
                                        description="Auth hint title"
                                        id="gui.classroom.management.authHintTitle"
                                    />
                                </div>
                                <p className={styles.mainPhaseGuide}>
                                    <FormattedMessage
                                        defaultMessage="When the authorization screen appears, make sure to check all the checkboxes as shown below."
                                        description="Auth hint guide"
                                        id="gui.classroom.management.authHintGuide"
                                    />
                                </p>
                                <figure className={styles.authHintFigure}>
                                    <figcaption
                                        className={styles.authHintCaption}
                                    >
                                        <FormattedMessage
                                            defaultMessage="▼ Example"
                                            description="Caption for auth hint example image"
                                            id="gui.classroom.management.authHintCaption"
                                        />
                                    </figcaption>
                                    <img
                                        alt="Google authorization checkboxes"
                                        className={styles.authHintImage}
                                        src={googleAuthHintImage}
                                    />
                                </figure>
                                <div className={styles.mainFooter}>
                                    <button
                                        className={styles.loginButton}
                                        data-testid="classroom-auth-hint-ok"
                                        onClick={handleAuthHintDismiss}
                                    >
                                        <FormattedMessage
                                            defaultMessage="OK"
                                            description="Dismiss auth hint"
                                            id="gui.classroom.tutorial.dismiss"
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    <button
                        className={styles.backLink}
                        data-testid="classroom-back"
                        onClick={onShowCreateForm}
                    >
                        {'< '}
                        <FormattedMessage
                            defaultMessage="Back"
                            description="Back button"
                            id="gui.classroom.back"
                        />
                    </button>
                    <div className={styles.mainPhaseTitle}>
                        <FormattedMessage
                            defaultMessage="Google Classroom Classes"
                            description="Google Classroom courses list title"
                            id="gui.classroom.management.googleCoursesTitle"
                        />
                    </div>
                    <p className={styles.mainPhaseGuide}>
                        <FormattedMessage
                            defaultMessage="Select a class to import and click the Import button."
                            description="Guide for Google Classroom course selection"
                            id="gui.classroom.management.googleCoursesGuide"
                        />
                    </p>
                    <ErrorDisplay error={error} errorTitle={errorTitle} />
                    {isLoading ? (
                        <div className={styles.courseListLoading}>
                            <Spinner large level="primary" />
                        </div>
                    ) : googleCourses.length === 0 ? (
                        <div>
                            <FormattedMessage
                                defaultMessage="No courses found"
                                description="No Google Classroom courses"
                                id="gui.classroom.management.noCourses"
                            />
                        </div>
                    ) : (
                        <GoogleCourseList
                            courses={googleCourses}
                            selectedCourseId={
                                selectedGoogleCourse?.courseId
                            }
                            onSelect={onSelectGoogleCourse}
                        />
                    )}
                    <div className={styles.mainFooter}>
                        <button
                            className={styles.loginButton}
                            data-testid="classroom-google-import-confirm"
                            disabled={
                                !selectedGoogleCourse || isLoading
                            }
                            onClick={onConfirmGoogleImport}
                        >
                            <FormattedMessage
                                defaultMessage="Import"
                                description="Import Google Classroom course"
                                id="gui.classroom.management.importButton"
                            />
                        </button>
                    </div>
                </div>
            );
        }

        if (phase === 'teacher-post-assignment') {
            return (
                <TeacherPostAssignment
                    error={error}
                    errorTitle={errorTitle}
                    isLoading={isLoading}
                    selectedClassroom={selectedClassroom}
                    onBack={onBackToDetail}
                    onPostAssignment={onPostAssignment}
                />
            );
        }

        // Default: dashboard (no class selected)
        if (isLoading) {
            return (
                <div className={styles.mainEmpty}>
                    <Spinner large level="primary" />
                </div>
            );
        }
        return (
            <div className={styles.mainEmpty}>
                <ClassroomTutorial name="classCreation">
                    <FormattedMessage
                        defaultMessage={'Let\'s start by creating a "Class"!\nCreate one class per lesson, e.g. "Lesson 3: Make a Chat App".\nClick the "Create Classroom" button in the sidebar on the left.'}
                        description="Tutorial: class creation onboarding after first login"
                        id="gui.classroom.tutorial.classCreation"
                    />
                </ClassroomTutorial>
                <FormattedMessage
                    defaultMessage="Select a classroom from the sidebar"
                    description="Prompt to select a classroom in teacher management"
                    id="gui.classroom.teacherDetail.selectClassroom"
                />
            </div>
        );
    };

    return (
        <Modal
            contentLabel={intl.formatMessage(messages.title)}
            fullScreen
            id="classroomTeacherModal"
            onRequestClose={onClose}
        >
            <div
                className={styles.layout}
                data-testid="classroom-teacher-modal"
            >
                {/* Sidebar: visible when logged in */}
                {phase !== 'teacher-login' && (
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            <FormattedMessage
                                defaultMessage="Your Classes & Assignments"
                                description="Teacher sidebar title"
                                id="gui.classroom.management.sidebarTitle"
                            />
                        </div>
                        <ul className={styles.sidebarList}>
                            {isLoading && classrooms.length === 0 && (
                                <li className={styles.sidebarItem}>
                                    <FormattedMessage
                                        defaultMessage="Loading..."
                                        description="Loading indicator in sidebar"
                                        id="gui.classroom.management.loading"
                                    />
                                </li>
                            )}
                            {groupedClassrooms.map((group) => (
                                <React.Fragment key={group.className}>
                                    <li
                                        className={
                                            styles.sidebarGroupHeader
                                        }
                                        data-testid={`classroom-sidebar-group-${group.className}`}
                                    >
                                        {group.hasGoogleClassroom && (
                                            <img
                                                alt=""
                                                className={
                                                    styles.sidebarGroupIcon
                                                }
                                                src={
                                                    googleClassroomIcon
                                                }
                                            />
                                        )}
                                        <span>
                                            {group.className}
                                        </span>
                                    </li>
                                    {group.classrooms.map((c) => (
                                        <li
                                            className={classNames(
                                                styles.sidebarItem,
                                                styles.sidebarItemIndented,
                                                selectedClassroom &&
                                                    selectedClassroom.classroomId ===
                                                        c.classroomId &&
                                                    styles.sidebarItemSelected,
                                            )}
                                            data-classroom-id={
                                                c.classroomId
                                            }
                                            data-testid={`classroom-sidebar-item-${c.classroomId}`}
                                            key={c.classroomId}
                                            onClick={
                                                handleSelectClassroom
                                            }
                                        >
                                            <span
                                                className={
                                                    styles.sidebarItemName
                                                }
                                            >
                                                {c.assignmentName ||
                                                    '-'}
                                            </span>
                                            <span
                                                className={
                                                    styles.sidebarItemMeta
                                                }
                                            >
                                                {`${c.studentCount} · ${c.joinCode.toLowerCase()}`}
                                            </span>
                                        </li>
                                    ))}
                                </React.Fragment>
                            ))}
                        </ul>
                        <div className={styles.sidebarFooter}>
                            <button
                                className={classNames(
                                    styles.sidebarButton,
                                    styles.sidebarButtonPrimary,
                                )}
                                data-testid="classroom-create"
                                onClick={onShowCreateForm}
                            >
                                <FormattedMessage
                                    defaultMessage="Create Classroom"
                                    description="Create new classroom button in sidebar"
                                    id="gui.classroom.management.create"
                                />
                            </button>
                            <button
                                className={classNames(
                                    styles.sidebarButton,
                                    styles.sidebarButtonDanger,
                                )}
                                data-testid="classroom-teacher-logout"
                                onClick={onTeacherLogout}
                            >
                                <FormattedMessage
                                    defaultMessage="Logout"
                                    description="Teacher logout button in sidebar"
                                    id="gui.classroom.management.logout"
                                />
                            </button>
                        </div>
                    </aside>
                )}
                {/* Main area */}
                <main className={styles.main}>{renderMain()}</main>
            </div>
        </Modal>
    );
};

ClassroomTeacherModal.propTypes = {
    containerProps: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default ClassroomTeacherModal;
