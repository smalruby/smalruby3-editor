import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
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
    startTutorial: {
        id: 'gui.welcomeModal.startTutorial',
        defaultMessage: 'Start the first tutorial',
        description: 'Welcome modal primary CTA on desktop — opens the tutorials library',
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

// On narrow viewports the tipsLibrary (image-heavy, fixed-width) is hidden and
// /about.html is promoted to the primary CTA instead.
const WelcomeModal = ({ isNarrow, onStartTutorial, onLearnMore, onLater }) => {
    const primary = isNarrow ? (
        <button
            className={styles.primaryButton}
            onClick={onLearnMore}
            data-testid="welcome-modal-learn-more"
        >
            <FormattedMessage {...messages.learnMore} />
        </button>
    ) : (
        <button
            className={styles.primaryButton}
            onClick={onStartTutorial}
            data-testid="welcome-modal-start-tutorial"
        >
            <FormattedMessage {...messages.startTutorial} />
        </button>
    );

    return (
        <div
            className={styles.overlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-modal-title"
            data-testid="welcome-modal"
        >
            <div className={classNames(styles.dialog, { [styles.narrow]: isNarrow })}>
                <div className={styles.dialogBody}>
                    <h2 className={styles.title} id="welcome-modal-title">
                        <FormattedMessage {...messages.title} />
                    </h2>
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
                            icon={
                                <img
                                    alt=""
                                    aria-hidden="true"
                                    className={styles.cardIcon}
                                    src={rubyIcon}
                                />
                            }
                            titleMessage={messages.cardRubyTitle}
                            descMessage={isNarrow ? messages.cardRubyDescShort : messages.cardRubyDesc}
                        />
                        <Card
                            icon={<div className={styles.cardEmoji}>{'🌐'}</div>}
                            titleMessage={messages.cardMeshTitle}
                            descMessage={isNarrow ? messages.cardMeshDescShort : messages.cardMeshDesc}
                        />
                    </div>
                </div>
                <div className={styles.buttons}>
                    {primary}
                    <div className={styles.secondaryButtons}>
                        {!isNarrow && (
                            <button
                                className={styles.linkButton}
                                onClick={onLearnMore}
                                data-testid="welcome-modal-learn-more"
                            >
                                <FormattedMessage {...messages.learnMore} />
                            </button>
                        )}
                        <button
                            className={styles.linkButton}
                            onClick={onLater}
                            data-testid="welcome-modal-later"
                        >
                            <FormattedMessage {...messages.later} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

WelcomeModal.propTypes = {
    isNarrow: PropTypes.bool,
    onLater: PropTypes.func.isRequired,
    onLearnMore: PropTypes.func.isRequired,
    onStartTutorial: PropTypes.func.isRequired,
};

WelcomeModal.defaultProps = {
    isNarrow: false,
};

export { messages };
export default WelcomeModal;
