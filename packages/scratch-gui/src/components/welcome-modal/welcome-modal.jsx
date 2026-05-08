import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, FormattedMessage} from 'react-intl';

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
        description: 'Welcome modal lead paragraph',
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
    startTutorial: {
        id: 'gui.welcomeModal.startTutorial',
        defaultMessage: "Start the first tutorial",
        description: 'Welcome modal primary CTA — opens the tutorials library',
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

const WelcomeModal = ({onStartTutorial, onLearnMore, onLater}) => (
    <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        data-testid="welcome-modal"
    >
        <div className={styles.dialog}>
            <h2
                className={styles.title}
                id="welcome-modal-title"
            >
                <FormattedMessage {...messages.title} />
            </h2>
            <p className={styles.lead}>
                <FormattedMessage {...messages.lead} />
            </p>
            <div className={styles.cards}>
                <div className={styles.card}>
                    <div className={styles.cardEmoji}>{'🧩'}</div>
                    <h3 className={styles.cardTitle}>
                        <FormattedMessage {...messages.cardBlocksTitle} />
                    </h3>
                    <p className={styles.cardDesc}>
                        <FormattedMessage {...messages.cardBlocksDesc} />
                    </p>
                </div>
                <div className={styles.card}>
                    <div className={styles.cardEmoji}>{'💎'}</div>
                    <h3 className={styles.cardTitle}>
                        <FormattedMessage {...messages.cardRubyTitle} />
                    </h3>
                    <p className={styles.cardDesc}>
                        <FormattedMessage {...messages.cardRubyDesc} />
                    </p>
                </div>
                <div className={styles.card}>
                    <div className={styles.cardEmoji}>{'🌐'}</div>
                    <h3 className={styles.cardTitle}>
                        <FormattedMessage {...messages.cardMeshTitle} />
                    </h3>
                    <p className={styles.cardDesc}>
                        <FormattedMessage {...messages.cardMeshDesc} />
                    </p>
                </div>
            </div>
            <div className={styles.buttons}>
                <button
                    className={styles.primaryButton}
                    onClick={onStartTutorial}
                    data-testid="welcome-modal-start-tutorial"
                >
                    <FormattedMessage {...messages.startTutorial} />
                </button>
                <div className={styles.secondaryButtons}>
                    <button
                        className={styles.linkButton}
                        onClick={onLearnMore}
                        data-testid="welcome-modal-learn-more"
                    >
                        <FormattedMessage {...messages.learnMore} />
                    </button>
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

WelcomeModal.propTypes = {
    onStartTutorial: PropTypes.func.isRequired,
    onLearnMore: PropTypes.func.isRequired,
    onLater: PropTypes.func.isRequired,
};

export {messages};
export default WelcomeModal;
