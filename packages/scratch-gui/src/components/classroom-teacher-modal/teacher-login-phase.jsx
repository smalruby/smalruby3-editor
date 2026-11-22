/**
 * Teacher login phase with feature carousel.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import ErrorDisplay from '../classroom-modal/error-display.jsx';
import GoogleSignInSlot from '../google-sign-in-slot/google-sign-in-slot.jsx';
import SignInButton, { SignInButtonList } from '../sign-in-button/sign-in-button.jsx';
import carouselImage1 from './carousel-1-submit.png';
import carouselImage2 from './carousel-2-overview.png';
import carouselImage3 from './carousel-3-preview.png';
import carouselImage4 from './carousel-4-gc.png';
import styles from './classroom-teacher-modal.css';

const CAROUSEL_SLIDES = [
    {
        titleId: 'gui.classroom.carousel.submitTitle',
        titleDefault: 'Students can submit assignments',
        descId: 'gui.classroom.carousel.submitDesc',
        descDefault: 'Students join with a code and submit their work with one click.',
        image: carouselImage1,
    },
    {
        titleId: 'gui.classroom.carousel.overviewTitle',
        titleDefault: 'See submission status at a glance',
        descId: 'gui.classroom.carousel.overviewDesc',
        descDefault: 'The seat grid shows who has submitted, returned, or is still working.',
        image: carouselImage2,
    },
    {
        titleId: 'gui.classroom.carousel.screenshotTitle',
        titleDefault: 'Preview without opening',
        descId: 'gui.classroom.carousel.screenshotDesc',
        descDefault: 'Thumbnails and block screenshots let you review work quickly.',
        image: carouselImage3,
    },
    {
        titleId: 'gui.classroom.carousel.gcTitle',
        titleDefault: 'Google Classroom integration',
        descId: 'gui.classroom.carousel.gcDesc',
        descDefault: 'Import class rosters from Google Classroom and post assignment links.',
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
                {slide.image && <img alt="" className={styles.carouselImage} src={slide.image} />}
            </div>
            <div className={styles.carouselDots}>
                {CAROUSEL_SLIDES.map((_, i) => (
                    <button
                        className={`${styles.carouselDot}${i === slideIndex ? ` ${styles.carouselDotActive}` : ''}`}
                        data-index={i}
                        key={i}
                        onClick={handleDotClick}
                    />
                ))}
            </div>
        </div>
    );
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
