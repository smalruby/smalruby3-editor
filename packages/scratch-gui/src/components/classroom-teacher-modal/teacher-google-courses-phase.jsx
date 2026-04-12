/**
 * Google Classroom course selection phase.
 *
 * When this component mounts, it auto-loads courses if the
 * authorization-checkbox tutorial has been seen, or shows the auth hint
 * overlay otherwise.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';

import ErrorDisplay from '../classroom-modal/error-display.jsx';
import GoogleCourseList from '../classroom-modal/google-course-list.jsx';
import Spinner from '../spinner/spinner.jsx';

import {
    isTutorialSeen,
    markClassroomTutorialSeen,
} from '../../reducers/classroom-tutorial.js';

import googleAuthHintImage from './google-auth-hint.png';
import styles from './classroom-teacher-modal.css';

const TeacherGoogleCoursesPhase = ({
    error,
    errorTitle,
    googleCourses,
    isLoading,
    selectedGoogleCourse,
    onBack,
    onConfirmGoogleImport,
    onLoadGoogleCourses,
    onSelectGoogleCourse,
}) => {
    const dispatch = useDispatch();
    const checkboxesSeen = useSelector((state) =>
        isTutorialSeen(state, 'checkboxes'),
    );
    const [showAuthHint, setShowAuthHint] = useState(false);

    // On mount: auto-load courses or show auth hint.
    // Deps intentionally empty — runs once when the phase component mounts.
    useEffect(() => {
        if (checkboxesSeen) {
            onLoadGoogleCourses();
        } else {
            setShowAuthHint(true);
        }
    }, []);

    const handleAuthHintDismiss = useCallback(() => {
        dispatch(markClassroomTutorialSeen('checkboxes'));
        setShowAuthHint(false);
        onLoadGoogleCourses();
    }, [dispatch, onLoadGoogleCourses]);

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
                            <figcaption className={styles.authHintCaption}>
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
                onClick={onBack}
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
                    selectedCourseId={selectedGoogleCourse?.courseId}
                    onSelect={onSelectGoogleCourse}
                />
            )}
            <div className={styles.mainFooter}>
                <button
                    className={styles.loginButton}
                    data-testid="classroom-google-import-confirm"
                    disabled={!selectedGoogleCourse || isLoading}
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
};

TeacherGoogleCoursesPhase.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    googleCourses: PropTypes.arrayOf(PropTypes.object),
    isLoading: PropTypes.bool,
    onBack: PropTypes.func.isRequired,
    onConfirmGoogleImport: PropTypes.func.isRequired,
    onLoadGoogleCourses: PropTypes.func.isRequired,
    onSelectGoogleCourse: PropTypes.func.isRequired,
    selectedGoogleCourse: PropTypes.object,
};

export default TeacherGoogleCoursesPhase;
