import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, FormattedMessage } from 'react-intl';
import rubyIcon from './icon-ruby.svg';
import styles from './welcome-modal.css';

const messages = defineMessages({
    title: {
        id: 'gui.welcomeModal.title',
        defaultMessage: 'Welcome to Smalruby',
        description: 'Welcome modal title',
    },
    lead: {
        id: 'gui.welcomeModal.lead',
        defaultMessage:
            'Smalruby is a free programming environment from Japan. ' +
            'Build with blocks, then move on to Ruby — all in your browser.',
        description: 'Welcome modal lead paragraph (desktop)',
    },
    leadShort: {
        id: 'gui.welcomeModal.leadShort',
        defaultMessage: 'Build with blocks, step up to Ruby — all in your browser.',
        description: 'Welcome modal lead paragraph (compact, narrow screens)',
    },
    cardBlocksTitle: {
        id: 'gui.welcomeModal.cardBlocksTitle',
        defaultMessage: 'Build with blocks',
        description: 'Welcome modal card 1 title',
    },
    cardBlocksDesc: {
        id: 'gui.welcomeModal.cardBlocksDesc',
        defaultMessage: 'Drag blocks to make games and animations.',
        description: 'Welcome modal card 1 description',
    },
    cardBlocksDescShort: {
        id: 'gui.welcomeModal.cardBlocksDescShort',
        defaultMessage: 'Make games and animations.',
        description: 'Welcome modal card 1 description (compact, narrow screens)',
    },
    cardRubyTitle: {
        id: 'gui.welcomeModal.cardRubyTitle',
        defaultMessage: 'Step up to Ruby',
        description: 'Welcome modal card 2 title',
    },
    cardRubyDesc: {
        id: 'gui.welcomeModal.cardRubyDesc',
        defaultMessage: 'Switch to text code with furigana support.',
        description: 'Welcome modal card 2 description',
    },
    cardRubyDescShort: {
        id: 'gui.welcomeModal.cardRubyDescShort',
        defaultMessage: 'Step up with furigana support.',
        description: 'Welcome modal card 2 description (compact, narrow screens)',
    },
    cardMeshTitle: {
        id: 'gui.welcomeModal.cardMeshTitle',
        defaultMessage: 'Connect with friends',
        description: 'Welcome modal card 3 title',
    },
    cardMeshDesc: {
        id: 'gui.welcomeModal.cardMeshDesc',
        defaultMessage: 'Use Mesh to share data between devices in real time.',
        description: 'Welcome modal card 3 description',
    },
    cardMeshDescShort: {
        id: 'gui.welcomeModal.cardMeshDescShort',
        defaultMessage: 'Connect multiple devices to play.',
        description: 'Welcome modal card 3 description (compact, narrow screens)',
    },
    startLessons: {
        id: 'gui.welcomeModal.startLessons',
        defaultMessage: 'Start the lessons',
        description: 'Welcome modal primary CTA — opens the lessons library at the next challenge to do',
    },
    courseGuideTitle: {
        id: 'gui.welcomeModal.courseGuideTitle',
        defaultMessage: 'First step: the lesson “{course}”',
        description: 'Welcome modal course guide, first line. {course} is the name of the first course',
    },
    courseGuideDetail: {
        id: 'gui.welcomeModal.courseGuideDetail',
        defaultMessage:
            '{lessonCount, plural, one {# lesson} other {# lessons}} · ' +
            '{challengeCount, plural, one {# challenge} other {# challenges}}. ' +
            'About 5 minutes each, with hints along the way.',
        description:
            'Welcome modal course guide, second line. The counts come from the course data (lessons / challenges)',
    },
    learnMore: {
        id: 'gui.welcomeModal.learnMore',
        defaultMessage: 'Learn more about Smalruby',
        description: 'Welcome modal secondary CTA — opens about.html',
    },
    later: {
        id: 'gui.welcomeModal.later',
        defaultMessage: 'Maybe later',
        description: 'Welcome modal dismiss button',
    },
});

const Card = ({ icon, titleMessage, descMessage }) => (
    <div className={styles.card}>
        {icon}
        <h3 className={styles.cardTitle}>
            <FormattedMessage {...titleMessage} />
        </h3>
        <p className={styles.cardDesc}>
            <FormattedMessage {...descMessage} />
        </p>
    </div>
);

Card.propTypes = {
    descMessage: PropTypes.object.isRequired,
    icon: PropTypes.node.isRequired,
    titleMessage: PropTypes.object.isRequired,
};

// はじめの一歩のコースの案内（コース名と、レッスン・チャレンジの数。数はコースのデータから出す）
const CourseGuide = ({ course }) => (
    <div className={styles.courseGuide} data-testid="welcome-modal-course-guide">
        <p className={styles.courseGuideTitle}>
            <FormattedMessage
                {...messages.courseGuideTitle}
                values={{ course: <FormattedMessage {...course.name} /> }}
            />
        </p>
        <p className={styles.courseGuideDetail}>
            <FormattedMessage
                {...messages.courseGuideDetail}
                values={{ lessonCount: course.lessonCount, challengeCount: course.challengeCount }}
            />
        </p>
    </div>
);

const coursePropType = PropTypes.shape({
    challengeCount: PropTypes.number.isRequired,
    lessonCount: PropTypes.number.isRequired,
    name: PropTypes.shape({ id: PropTypes.string.isRequired, defaultMessage: PropTypes.string }).isRequired,
});

CourseGuide.propTypes = {
    course: coursePropType.isRequired,
};

// The primary CTA is 「レッスンを始める」 on every screen (#1888). The lessons library works on
// narrow screens too. On narrow screens the course guide is left out to save height.
const WelcomeModal = ({ course, isNarrow, onStartLessons, onLearnMore, onLater }) => {
    const primary = (
        <button className={styles.primaryButton} onClick={onStartLessons} data-testid="welcome-modal-start-lessons">
            <FormattedMessage {...messages.startLessons} />
        </button>
    );

    const dialog = (
        <div
            className={styles.overlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-modal-title"
            data-testid="welcome-modal"
        >
            <div className={classNames(styles.dialog, { [styles.narrow]: isNarrow })}>
                <div className={styles.header} data-testid="welcome-modal-header">
                    <h2 className={styles.title} id="welcome-modal-title">
                        <FormattedMessage {...messages.title} />
                    </h2>
                </div>
                <div className={styles.dialogBody}>
                    <p className={styles.lead}>
                        <FormattedMessage {...(isNarrow ? messages.leadShort : messages.lead)} />
                    </p>
                    <div className={styles.cards}>
                        <Card
                            icon={<div className={styles.cardEmoji}>{'🧩'}</div>}
                            titleMessage={messages.cardBlocksTitle}
                            descMessage={isNarrow ? messages.cardBlocksDescShort : messages.cardBlocksDesc}
                        />
                        <Card
                            icon={<img alt="" aria-hidden="true" className={styles.cardIcon} src={rubyIcon} />}
                            titleMessage={messages.cardRubyTitle}
                            descMessage={isNarrow ? messages.cardRubyDescShort : messages.cardRubyDesc}
                        />
                        <Card
                            icon={<div className={styles.cardEmoji}>{'🌐'}</div>}
                            titleMessage={messages.cardMeshTitle}
                            descMessage={isNarrow ? messages.cardMeshDescShort : messages.cardMeshDesc}
                        />
                    </div>
                    {!isNarrow && course && <CourseGuide course={course} />}
                </div>
                <div className={styles.buttons}>
                    {primary}
                    <div className={styles.secondaryButtons}>
                        <button
                            className={styles.linkButton}
                            onClick={onLearnMore}
                            data-testid="welcome-modal-learn-more"
                        >
                            <FormattedMessage {...messages.learnMore} />
                        </button>
                        <button className={styles.linkButton} onClick={onLater} data-testid="welcome-modal-later">
                            <FormattedMessage {...messages.later} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
    // document.body の直下に出す（スマホの画面では左のレールやお知らせの帯が上に重なるため。
    // レッスン表など共有の Modal と同じ重なり方にする）
    return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
};

WelcomeModal.propTypes = {
    // はじめの一歩のコース（無ければ案内を出さない）
    course: coursePropType,
    isNarrow: PropTypes.bool,
    onLater: PropTypes.func.isRequired,
    onLearnMore: PropTypes.func.isRequired,
    onStartLessons: PropTypes.func.isRequired,
};

WelcomeModal.defaultProps = {
    course: null,
    isNarrow: false,
};

export { messages };
export default WelcomeModal;
