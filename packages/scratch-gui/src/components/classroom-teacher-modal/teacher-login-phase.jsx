/**
 * Teacher login phase with feature carousel.
 */
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useRef } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Carousel from '../carousel/carousel.jsx';
import ErrorDisplay from '../classroom-modal/error-display.jsx';
import GoogleSignInSlot from '../google-sign-in-slot/google-sign-in-slot.jsx';
import SignInButton, { SignInButtonList } from '../sign-in-button/sign-in-button.jsx';
import carouselImage1 from './carousel-1-classwork.png';
import carouselImage2 from './carousel-2-projection.png';
import carouselImage3 from './carousel-3-status-panel.png';
import carouselImage4 from './carousel-4-lesson-progress.png';
import carouselImage5 from './carousel-5-grading.png';
import styles from './classroom-teacher-modal.css';

const messages = defineMessages({
    label: {
        id: 'gui.classroom.carousel.label',
        defaultMessage: 'What Class management can do',
        description: 'Name of the carousel on the teacher sign-in screen, read by screen readers',
    },
    sameAsGcTitle: {
        id: 'gui.classroom.carousel.sameAsGcTitle',
        defaultMessage: 'Works just like Google Classroom',
        description: 'Carousel slide 1 heading',
    },
    sameAsGcDesc: {
        id: 'gui.classroom.carousel.sameAsGcDesc',
        defaultMessage:
            'Stream, Classwork and Grades tabs, and [+ Create]. If you can use Google Classroom, there is little new to learn.',
        description: 'Carousel slide 1 text',
    },
    joinCodeTitle: {
        id: 'gui.classroom.carousel.joinCodeTitle',
        defaultMessage: 'Just show the class code to start',
        description: 'Carousel slide 2 heading',
    },
    joinCodeDesc: {
        id: 'gui.classroom.carousel.joinCodeDesc',
        defaultMessage:
            'Students only type the code into "Class" in the menu and choose their seat. Students need no accounts.',
        description: 'Carousel slide 2 text',
    },
    statusPanelTitle: {
        id: 'gui.classroom.carousel.statusPanelTitle',
        defaultMessage: 'See who has submitted with the editor open',
        description: 'Carousel slide 3 heading',
    },
    statusPanelDesc: {
        id: 'gui.classroom.carousel.statusPanelDesc',
        defaultMessage:
            'Keep "Current assignment status" open to teach on your own screen and see who has submitted by the seat colors.',
        description: 'Carousel slide 3 text',
    },
    lessonProgressTitle: {
        id: 'gui.classroom.carousel.lessonProgressTitle',
        defaultMessage: 'Spot the students who are stuck',
        description: 'Carousel slide 4 heading',
    },
    lessonProgressDesc: {
        id: 'gui.classroom.carousel.lessonProgressDesc',
        defaultMessage:
            'See the lesson progress in one table. Students stopped for 10 minutes or more get a mark, so you can go and help.',
        description: 'Carousel slide 4 text',
    },
    gradingTitle: {
        id: 'gui.classroom.carousel.gradingTitle',
        defaultMessage: 'AI drafts the grades, you decide',
        description: 'Carousel slide 5 heading',
    },
    gradingDesc: {
        id: 'gui.classroom.carousel.gradingDesc',
        defaultMessage:
            'Load the submissions and AI drafts the points and comments. Fix them and return them to the students as they are.',
        description: 'Carousel slide 5 text',
    },
});

// The order follows a lesson: start it, watch over it, grade it (#2364).
// The images are cut out of the real screens with the made-up class of the docs
// (tools/playwright-verify/capture-classroom-login-carousel.mjs).
const SLIDES = [
    { key: 'sameAsGc', image: carouselImage1 },
    { key: 'joinCode', image: carouselImage2 },
    { key: 'statusPanel', image: carouselImage3 },
    { key: 'lessonProgress', image: carouselImage4 },
    { key: 'grading', image: carouselImage5 },
];

const LoginCarousel = () => {
    const intl = useIntl();
    const slides = useMemo(
        () =>
            SLIDES.map(({ key, image }) => ({
                key,
                image,
                title: intl.formatMessage(messages[`${key}Title`]),
                description: intl.formatMessage(messages[`${key}Desc`]),
            })),
        [intl],
    );
    return <Carousel label={intl.formatMessage(messages.label)} slides={slides} testId="classroom-login-carousel" />;
};

const TeacherLoginPhase = ({
    error,
    errorTitle,
    googleButtonShown,
    googleSignInRef,
    isMicrosoftAuthAvailable,
    onGoogleLogin,
    onMicrosoftLogin,
}) => {
    // Google's own button is the entry point, so the login starts as soon as
    // this phase is on screen: it only renders the button and waits for a
    // press. Runs once — re-running would restart the login every time the
    // handler identity moves.
    const startedRef = useRef(false);
    useEffect(() => {
        if (startedRef.current) {
            return;
        }
        startedRef.current = true;
        onGoogleLogin();
    }, [onGoogleLogin]);

    return (
        <div className={styles.loginArea} data-testid="classroom-phase-teacher-login">
            <div className={styles.loginTop}>
                <h2>
                    <FormattedMessage
                        defaultMessage="Sign in to manage classrooms"
                        description="Prompt for teacher sign in"
                        id="gui.classroom.management.loginPrompt"
                    />
                </h2>
                <p>
                    <FormattedMessage
                        defaultMessage="Sign in with your school account to create and manage classrooms."
                        description="Teacher login description"
                        id="gui.classroom.management.loginDescription"
                    />
                </p>
                <div className={styles.providerRow}>
                    <SignInButtonList>
                        {/* Our button only stands in while Google's script loads
                        or if it failed to load; pressing it tries again. */}
                        {!googleButtonShown && (
                            <SignInButton provider="google" testId="classroom-google-login" onClick={onGoogleLogin}>
                                <FormattedMessage
                                    defaultMessage="Sign in with Google"
                                    description="Google sign in button"
                                    id="gui.classroom.management.loginButton"
                                />
                            </SignInButton>
                        )}
                        {/* Google's own button lives here, inside the modal, so it
                        cannot float over the screen or outlive the login (#1149). */}
                        <GoogleSignInSlot
                            active={googleButtonShown}
                            className={styles.googleSignInSlot}
                            ref={googleSignInRef}
                        />
                        {isMicrosoftAuthAvailable && (
                            <SignInButton
                                provider="microsoft"
                                testId="classroom-microsoft-login"
                                onClick={onMicrosoftLogin}
                            >
                                <FormattedMessage
                                    defaultMessage="Sign in with Microsoft"
                                    description="Microsoft sign in button"
                                    id="gui.classroom.management.microsoftLoginButton"
                                />
                            </SignInButton>
                        )}
                    </SignInButtonList>
                </div>
                <ErrorDisplay error={error} errorTitle={errorTitle} />
            </div>
            <div className={styles.loginBottom}>
                <LoginCarousel />
            </div>
        </div>
    );
};

TeacherLoginPhase.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    googleButtonShown: PropTypes.bool,
    googleSignInRef: PropTypes.shape({ current: PropTypes.any }),
    isMicrosoftAuthAvailable: PropTypes.bool,
    onGoogleLogin: PropTypes.func.isRequired,
    onMicrosoftLogin: PropTypes.func.isRequired,
};

export default TeacherLoginPhase;
