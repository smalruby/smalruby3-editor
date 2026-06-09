import React from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import intlShape from '../../lib/intlShape.js';

import styles from './bug-report-modal.css';

const messages = defineMessages({
    title: {
        id: 'gui.bugReportModal.title',
        defaultMessage: 'Report a bug',
        description: 'Bug report modal title',
    },
    loginIntro: {
        id: 'gui.bugReportModal.loginIntro',
        defaultMessage:
            'Sign in so we can attach your project and tell you when the bug is fixed.',
        description: 'Login step explanation',
    },
    loginGoogle: {
        id: 'gui.bugReportModal.loginGoogle',
        defaultMessage: 'Sign in with Google',
        description: 'Google login button',
    },
    loginMicrosoft: {
        id: 'gui.bugReportModal.loginMicrosoft',
        defaultMessage: 'Sign in with Microsoft',
        description: 'Microsoft login button',
    },
    descriptionLabel: {
        id: 'gui.bugReportModal.descriptionLabel',
        defaultMessage: 'What happened? (what you did, what went wrong, what you expected)',
        description: 'Bug description field label',
    },
    descriptionPlaceholder: {
        id: 'gui.bugReportModal.descriptionPlaceholder',
        defaultMessage: 'Example: When I clicked the green flag, the sprite disappeared.',
        description: 'Bug description placeholder',
    },
    attachmentNote: {
        id: 'gui.bugReportModal.attachmentNote',
        defaultMessage: 'Your current project and block screenshots are attached automatically.',
        description: 'Note that the project is attached',
    },
    submit: {
        id: 'gui.bugReportModal.submit',
        defaultMessage: 'Send report',
        description: 'Submit button',
    },
    sending: {
        id: 'gui.bugReportModal.sending',
        defaultMessage: 'Sending…',
        description: 'Sending progress label',
    },
    successTitle: {
        id: 'gui.bugReportModal.successTitle',
        defaultMessage: 'Thank you! Your report was sent.',
        description: 'Success message',
    },
    successBody: {
        id: 'gui.bugReportModal.successBody',
        defaultMessage:
            'The developers will look into it. You can check the reply later from "My bug reports".',
        description: 'Success explanation',
    },
    viewMyReports: {
        id: 'gui.bugReportModal.viewMyReports',
        defaultMessage: 'My bug reports',
        description: 'Link to my reports',
    },
    backToForm: {
        id: 'gui.bugReportModal.backToForm',
        defaultMessage: 'Report another bug',
        description: 'Back to the report form',
    },
    close: {
        id: 'gui.bugReportModal.close',
        defaultMessage: 'Close',
        description: 'Close button',
    },
    noReports: {
        id: 'gui.bugReportModal.noReports',
        defaultMessage: 'You have not reported any bugs yet.',
        description: 'Empty my-reports message',
    },
    reportsLoading: {
        id: 'gui.bugReportModal.reportsLoading',
        defaultMessage: 'Loading…',
        description: 'Reports loading label',
    },
    replyLabel: {
        id: 'gui.bugReportModal.replyLabel',
        defaultMessage: 'Reply from the developers:',
        description: 'Developer reply label',
    },
    statusOpen: {
        id: 'gui.bugReportModal.statusOpen',
        defaultMessage: 'Received',
        description: 'Status: open',
    },
    statusInProgress: {
        id: 'gui.bugReportModal.statusInProgress',
        defaultMessage: 'In progress',
        description: 'Status: in progress',
    },
    statusResolved: {
        id: 'gui.bugReportModal.statusResolved',
        defaultMessage: 'Fixed',
        description: 'Status: resolved',
    },
    statusWontFix: {
        id: 'gui.bugReportModal.statusWontFix',
        defaultMessage: 'Closed',
        description: 'Status: wont_fix',
    },
});

const STATUS_MESSAGE = {
    open: messages.statusOpen,
    in_progress: messages.statusInProgress,
    resolved: messages.statusResolved,
    wont_fix: messages.statusWontFix,
};

const ReportRow = ({ report, intl }) => {
    const statusMsg = STATUS_MESSAGE[report.status] || messages.statusOpen;
    return (
        <li
            className={styles.reportRow}
            data-testid="bug-report-item"
        >
            <div className={styles.reportRowHeader}>
                <span
                    className={styles.reportStatus}
                    data-status={report.status}
                    data-testid="bug-report-item-status"
                >
                    {intl.formatMessage(statusMsg)}
                </span>
                <span className={styles.reportDate}>{(report.createdAt || '').slice(0, 10)}</span>
            </div>
            <p className={styles.reportDescription}>{report.description}</p>
            {report.developerReply ? (
                <div
                    className={styles.reportReply}
                    data-testid="bug-report-item-reply"
                >
                    <span className={styles.reportReplyLabel}>
                        <FormattedMessage {...messages.replyLabel} />
                    </span>
                    {report.developerReply}
                </div>
            ) : null}
        </li>
    );
};

ReportRow.propTypes = {
    intl: intlShape.isRequired,
    report: PropTypes.shape({
        status: PropTypes.string,
        createdAt: PropTypes.string,
        description: PropTypes.string,
        developerReply: PropTypes.string,
    }).isRequired,
};

/**
 * Presentational bug report modal. Renders one of several phases (login, form,
 * submitting, success, my reports) based on props. All side effects live in the
 * connected container.
 * @param {object} props - component props
 * @returns {React.Element} the modal
 */
const BugReportModal = (props) => {
    const {
        intl,
        phase,
        error,
        isBusy,
        microsoftAvailable,
        description,
        reports,
        reportsLoading,
        submitProgressLabel,
        onRequestClose,
        onLoginGoogle,
        onLoginMicrosoft,
        onDescriptionChange,
        onSubmit,
        onShowMyReports,
        onShowForm,
    } = props;

    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            fullScreen
            headerClassName={styles.header}
            id="bugReportModal"
            onRequestClose={onRequestClose}
        >
            <Box
                className={styles.body}
                grow={1}
                data-testid="bug-report-modal"
                data-phase={phase}
            >
                <div className={styles.content}>
                {error ? (
                    <div
                        className={styles.error}
                        data-testid="bug-report-error"
                    >
                        {error}
                    </div>
                ) : null}

                {phase === 'login' && (
                    <div className={styles.loginPhase}>
                        <p>
                            <FormattedMessage {...messages.loginIntro} />
                        </p>
                        <button
                            className={styles.loginButton}
                            disabled={isBusy}
                            onClick={onLoginGoogle}
                            data-testid="bug-report-login-google"
                        >
                            <FormattedMessage {...messages.loginGoogle} />
                        </button>
                        {microsoftAvailable ? (
                            <button
                                className={styles.loginButton}
                                disabled={isBusy}
                                onClick={onLoginMicrosoft}
                                data-testid="bug-report-login-microsoft"
                            >
                                <FormattedMessage {...messages.loginMicrosoft} />
                            </button>
                        ) : null}
                    </div>
                )}

                {phase === 'form' && (
                    <div className={styles.formPhase}>
                        <label
                            className={styles.fieldLabel}
                            htmlFor="bug-report-description"
                        >
                            <FormattedMessage {...messages.descriptionLabel} />
                        </label>
                        <textarea
                            id="bug-report-description"
                            className={styles.descriptionInput}
                            value={description}
                            maxLength={2000}
                            rows={6}
                            placeholder={intl.formatMessage(messages.descriptionPlaceholder)}
                            onChange={onDescriptionChange}
                            data-testid="bug-report-description"
                        />
                        <p className={styles.attachmentNote}>
                            <FormattedMessage {...messages.attachmentNote} />
                        </p>
                        <div className={styles.buttons}>
                            <button
                                className={styles.secondaryButton}
                                onClick={onShowMyReports}
                                data-testid="bug-report-view-my-reports"
                            >
                                <FormattedMessage {...messages.viewMyReports} />
                            </button>
                            <button
                                className={styles.primaryButton}
                                disabled={isBusy || !description.trim()}
                                onClick={onSubmit}
                                data-testid="bug-report-submit"
                            >
                                <FormattedMessage {...messages.submit} />
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'submitting' && (
                    <div
                        className={styles.submittingPhase}
                        data-testid="bug-report-submitting"
                    >
                        <p>
                            <FormattedMessage {...messages.sending} />
                        </p>
                        {submitProgressLabel ? <p className={styles.progress}>{submitProgressLabel}</p> : null}
                    </div>
                )}

                {phase === 'success' && (
                    <div
                        className={styles.successPhase}
                        data-testid="bug-report-success"
                    >
                        <h3>
                            {'🎉 '}
                            <FormattedMessage {...messages.successTitle} />
                        </h3>
                        <p>
                            <FormattedMessage {...messages.successBody} />
                        </p>
                        <div className={styles.buttons}>
                            <button
                                className={styles.secondaryButton}
                                onClick={onShowMyReports}
                                data-testid="bug-report-success-my-reports"
                            >
                                <FormattedMessage {...messages.viewMyReports} />
                            </button>
                            <button
                                className={styles.primaryButton}
                                onClick={onRequestClose}
                                data-testid="bug-report-success-close"
                            >
                                <FormattedMessage {...messages.close} />
                            </button>
                        </div>
                    </div>
                )}

                {phase === 'myReports' && (
                    <div className={styles.myReportsPhase}>
                        {reportsLoading ? (
                            <p data-testid="bug-report-list-loading">
                                <FormattedMessage {...messages.reportsLoading} />
                            </p>
                        ) : reports.length === 0 ? (
                            <p data-testid="bug-report-list-empty">
                                <FormattedMessage {...messages.noReports} />
                            </p>
                        ) : (
                            <ul
                                className={styles.reportList}
                                data-testid="bug-report-list"
                            >
                                {reports.map((report) => (
                                    <ReportRow
                                        key={report.reportId}
                                        report={report}
                                        intl={intl}
                                    />
                                ))}
                            </ul>
                        )}
                        <div className={styles.buttons}>
                            <button
                                className={styles.secondaryButton}
                                onClick={onShowForm}
                                data-testid="bug-report-back-to-form"
                            >
                                <FormattedMessage {...messages.backToForm} />
                            </button>
                        </div>
                    </div>
                )}
                </div>
            </Box>
        </Modal>
    );
};

BugReportModal.propTypes = {
    intl: intlShape.isRequired,
    phase: PropTypes.oneOf(['login', 'form', 'submitting', 'success', 'myReports']).isRequired,
    error: PropTypes.string,
    isBusy: PropTypes.bool,
    microsoftAvailable: PropTypes.bool,
    description: PropTypes.string,
    reports: PropTypes.arrayOf(PropTypes.object),
    reportsLoading: PropTypes.bool,
    submitProgressLabel: PropTypes.string,
    onRequestClose: PropTypes.func.isRequired,
    onLoginGoogle: PropTypes.func.isRequired,
    onLoginMicrosoft: PropTypes.func.isRequired,
    onDescriptionChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    onShowMyReports: PropTypes.func.isRequired,
    onShowForm: PropTypes.func.isRequired,
};

BugReportModal.defaultProps = {
    error: null,
    isBusy: false,
    microsoftAvailable: false,
    description: '',
    reports: [],
    reportsLoading: false,
    submitProgressLabel: null,
};

export { messages };
export default injectIntl(BugReportModal);
