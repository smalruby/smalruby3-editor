import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import styles from './bug-report-consent.css';

const messages = defineMessages({
    title: {
        id: 'gui.bugReportConsent.title',
        defaultMessage: 'Before reporting a bug',
        description: 'Bug report consent dialog title',
    },
    intro: {
        id: 'gui.bugReportConsent.intro',
        defaultMessage:
            'To fix the bug, your current project is shared with the Smalruby developers.',
        description: 'Explanation that the project is shared',
    },
    pointShared: {
        id: 'gui.bugReportConsent.pointShared',
        defaultMessage: 'Only you and the developers can see the project you send.',
        description: 'Who can see the shared project',
    },
    pointLogin: {
        id: 'gui.bugReportConsent.pointLogin',
        defaultMessage:
            'You sign in with Google or Microsoft so we can tell you when it is fixed.',
        description: 'Why login is required',
    },
    pointNoPersonalInfo: {
        id: 'gui.bugReportConsent.pointNoPersonalInfo',
        defaultMessage: 'Do not write personal information (name, address, etc.) in the description.',
        description: 'Warning about personal information',
    },
    detailsToggle: {
        id: 'gui.bugReportConsent.detailsToggle',
        defaultMessage: 'More details (for parents/guardians)',
        description: 'Toggle label for detailed explanation',
    },
    detailsText: {
        id: 'gui.bugReportConsent.detailsText',
        defaultMessage:
            'Your project file, a thumbnail, screenshots, your description and your account email ' +
            'are stored securely and are visible only to you and the Smalruby developers. ' +
            'They are deleted after the bug is resolved.',
        description: 'Detailed explanation for parents',
    },
    privacyLink: {
        id: 'gui.bugReportConsent.privacyLink',
        defaultMessage: 'Privacy Policy',
        description: 'Link text for privacy policy',
    },
    consentCheckbox: {
        id: 'gui.bugReportConsent.consentCheckbox',
        defaultMessage:
            'I am 18 or older, or I have permission from a parent/guardian, and I agree to share my project.',
        description: 'Consent checkbox label',
    },
    cancel: {
        id: 'gui.bugReportConsent.cancel',
        defaultMessage: 'Not now',
        description: 'Cancel button text',
    },
    accept: {
        id: 'gui.bugReportConsent.accept',
        defaultMessage: 'OK',
        description: 'Accept button text',
    },
});

/**
 * Consent dialog shown before the first program bug report. Ensures the user
 * understands that their project is shared with the developers, that login is
 * required so the result can be communicated back, and (for minors) that they
 * have a guardian's permission.
 * @param {object} props - Component props
 * @param {function} props.onAccept - Called when the user accepts
 * @param {function} props.onCancel - Called when the user cancels
 * @param {object} props.intl - react-intl object
 * @returns {React.Element} Consent dialog
 */
const BugReportConsent = ({ onAccept, onCancel, intl }) => {
    const [checked, setChecked] = React.useState(false);
    const [detailsOpen, setDetailsOpen] = React.useState(false);

    const handleToggleDetails = React.useCallback(e => {
        setDetailsOpen(e.target.open);
    }, []);

    const handleCheckboxChange = React.useCallback(e => {
        setChecked(e.target.checked);
    }, []);

    return (
        <div
            className={styles.overlay}
            data-testid="bug-report-consent"
        >
            <div className={styles.dialog}>
                <h2 className={styles.title}>
                    {'🐛 '}
                    <FormattedMessage {...messages.title} />
                </h2>

                <p className={styles.intro}>
                    <FormattedMessage {...messages.intro} />
                </p>

                <ul className={styles.points}>
                    <li>
                        <FormattedMessage {...messages.pointShared} />
                    </li>
                    <li>
                        <FormattedMessage {...messages.pointLogin} />
                    </li>
                    <li>
                        <FormattedMessage {...messages.pointNoPersonalInfo} />
                    </li>
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
                        <p>
                            <FormattedMessage {...messages.detailsText} />
                        </p>
                        <p className={styles.links}>
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
                        data-testid="bug-report-consent-checkbox"
                    />
                    <FormattedMessage {...messages.consentCheckbox} />
                </label>

                <div className={styles.buttons}>
                    <button
                        className={styles.cancelButton}
                        onClick={onCancel}
                        data-testid="bug-report-consent-cancel"
                    >
                        <FormattedMessage {...messages.cancel} />
                    </button>
                    <button
                        className={styles.acceptButton}
                        disabled={!checked}
                        onClick={onAccept}
                        data-testid="bug-report-consent-accept"
                    >
                        <FormattedMessage {...messages.accept} />
                    </button>
                </div>
            </div>
        </div>
    );
};

BugReportConsent.propTypes = {
    intl: intlShape.isRequired,
    onAccept: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export { messages };
export default injectIntl(BugReportConsent);
