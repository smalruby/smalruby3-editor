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
    guardianNote: {
        id: 'gui.bugReportConsent.guardianNote',
        defaultMessage:
            'For parents/guardians: the project, thumbnail, screenshots, description and account ' +
            'email are stored securely, handled only by the Smalruby developers, and deleted after ' +
            'the bug is resolved.',
        description: 'One-line informational note for guardians (not a consent gate)',
    },
    privacyLink: {
        id: 'gui.bugReportConsent.privacyLink',
        defaultMessage: 'Privacy Policy',
        description: 'Link text for privacy policy',
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
 * Light, one-time notice shown before the first program bug report. It is a
 * heads-up (not a consent gate): the project is shared only with the Smalruby
 * developers (never published), login lets us tell the reporter when it's
 * fixed, and personal info should not be written. Students can proceed casually
 * — no age/guardian-consent checkbox (data stays on our own infra, handled only
 * by the admin). A one-line guardian note is informational only.
 * @param {object} props - Component props
 * @param {function} props.onAccept - Called when the user taps OK
 * @param {function} props.onCancel - Called when the user cancels
 * @param {object} props.intl - react-intl object
 * @returns {React.Element} Notice dialog
 */
const BugReportConsent = ({ onAccept, onCancel, intl }) => (
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

            {/* Informational note for guardians — NOT a consent gate. */}
            <p className={styles.guardianNote}>
                <FormattedMessage {...messages.guardianNote} />{' '}
                <a
                    href="/privacy-policy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {intl.formatMessage(messages.privacyLink)}
                </a>
            </p>

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
                    onClick={onAccept}
                    data-testid="bug-report-consent-accept"
                >
                    <FormattedMessage {...messages.accept} />
                </button>
            </div>
        </div>
    </div>
);

BugReportConsent.propTypes = {
    intl: intlShape.isRequired,
    onAccept: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export { messages };
export default injectIntl(BugReportConsent);
