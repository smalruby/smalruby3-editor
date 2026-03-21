// === Smalruby: This file is Smalruby-specific (Rubytee consent dialog) ===
import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, injectIntl, FormattedMessage} from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import styles from './rubytee-consent.css';

const messages = defineMessages({
    title: {
        id: 'gui.rubyteeConsent.title',
        defaultMessage: 'Before using Rubytee',
        description: 'Consent dialog title'
    },
    aiDisclosure: {
        id: 'gui.rubyteeConsent.aiDisclosure',
        defaultMessage: 'Rubytee is an AI (artificial intelligence). It is not a human.',
        description: 'AI disclosure statement'
    },
    warningIncorrect: {
        id: 'gui.rubyteeConsent.warningIncorrect',
        defaultMessage: 'Answers may sometimes be wrong',
        description: 'Warning about incorrect answers'
    },
    warningPersonalInfo: {
        id: 'gui.rubyteeConsent.warningPersonalInfo',
        defaultMessage: 'Do not enter personal information (name, address, etc.)',
        description: 'Warning about personal information'
    },
    warningAskAdult: {
        id: 'gui.rubyteeConsent.warningAskAdult',
        defaultMessage: 'If something worries you, talk to an adult',
        description: 'Warning to ask an adult for help'
    },
    detailsToggle: {
        id: 'gui.rubyteeConsent.detailsToggle',
        defaultMessage: 'More details (for parents/guardians)',
        description: 'Toggle label for detailed explanation'
    },
    detailsText: {
        id: 'gui.rubyteeConsent.detailsText',
        defaultMessage: 'Rubytee is an AI code generation assistant powered by Anthropic\'s Claude API. ' +
            'Your input is sent to Anthropic via our relay server. ' +
            'No personal data is stored.',
        description: 'Detailed explanation for parents'
    },
    termsLink: {
        id: 'gui.rubyteeConsent.termsLink',
        defaultMessage: 'Terms of Service',
        description: 'Link text for terms of service'
    },
    privacyLink: {
        id: 'gui.rubyteeConsent.privacyLink',
        defaultMessage: 'Privacy Policy',
        description: 'Link text for privacy policy'
    },
    consentCheckbox: {
        id: 'gui.rubyteeConsent.consentCheckbox',
        defaultMessage: 'I am 18 or older, or I have permission from a parent/guardian',
        description: 'Consent checkbox label'
    },
    cancel: {
        id: 'gui.rubyteeConsent.cancel',
        defaultMessage: 'Not now',
        description: 'Cancel button text'
    },
    accept: {
        id: 'gui.rubyteeConsent.accept',
        defaultMessage: 'OK, let\'s go!',
        description: 'Accept button text'
    }
});

/**
 * Rubytee consent dialog component.
 * Shown before the first use of Rubytee to ensure users understand
 * they are interacting with AI and have parental consent if under 18.
 * @param {object} props - Component props
 * @param {function} props.onAccept - Called when user accepts
 * @param {function} props.onCancel - Called when user cancels
 * @param {object} props.intl - react-intl object
 * @returns {React.Element} Consent dialog
 */
const RubyteeConsent = ({onAccept, onCancel, intl}) => {
    const [checked, setChecked] = React.useState(false);
    const [detailsOpen, setDetailsOpen] = React.useState(false);

    const handleToggleDetails = React.useCallback(e => {
        setDetailsOpen(e.target.open);
    }, []);

    const handleCheckboxChange = React.useCallback(e => {
        setChecked(e.target.checked);
    }, []);

    return (
        <div className={styles.overlay}>
            <div className={styles.dialog}>
                <h2 className={styles.title}>
                    {'🍵 '}
                    <FormattedMessage {...messages.title} />
                </h2>

                <p className={styles.disclosure}>
                    <FormattedMessage {...messages.aiDisclosure} />
                </p>

                <ul className={styles.warnings}>
                    <li><FormattedMessage {...messages.warningIncorrect} /></li>
                    <li><FormattedMessage {...messages.warningPersonalInfo} /></li>
                    <li><FormattedMessage {...messages.warningAskAdult} /></li>
                </ul>

                <details
                    className={styles.details}
                    open={detailsOpen}
                    onToggle={handleToggleDetails}
                >
                    <summary className={styles.detailsSummary}>
                        <FormattedMessage {...messages.detailsToggle} />
                    </summary>
                    <div className={styles.detailsContent}>
                        <p><FormattedMessage {...messages.detailsText} /></p>
                        <p className={styles.links}>
                            <a
                                href="/terms-of-service.html"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {intl.formatMessage(messages.termsLink)}
                            </a>
                            {' / '}
                            <a
                                href="/privacy-policy.html"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {intl.formatMessage(messages.privacyLink)}
                            </a>
                        </p>
                    </div>
                </details>

                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={handleCheckboxChange}
                        className={styles.checkbox}
                    />
                    <FormattedMessage {...messages.consentCheckbox} />
                </label>

                <div className={styles.buttons}>
                    <button
                        className={styles.cancelButton}
                        onClick={onCancel}
                    >
                        <FormattedMessage {...messages.cancel} />
                    </button>
                    <button
                        className={styles.acceptButton}
                        disabled={!checked}
                        onClick={onAccept}
                    >
                        <FormattedMessage {...messages.accept} />
                    </button>
                </div>
            </div>
        </div>
    );
};

RubyteeConsent.propTypes = {
    intl: intlShape.isRequired,
    onAccept: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export {messages};
export default injectIntl(RubyteeConsent);
