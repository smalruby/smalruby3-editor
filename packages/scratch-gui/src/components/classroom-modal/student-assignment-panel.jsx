/**
 * Student assignment panel.
 *
 * Shows the assignment pages (short text + optional image) with a pager.
 * Opens automatically right after joining a classroom that carries an
 * assignment, and any time from the status view via "View Assignment".
 */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const StudentAssignmentPanel = ({
    assignment,
    error,
    errorTitle,
    isLoading,
    joinedInfo,
    pageIndex,
    onClose,
    onNextPage,
    onPrevPage,
    onReloadStarter,
}) => {
    const pages = assignment?.pages || [];
    const page = pages[pageIndex] || null;

    return (
        <div data-testid="classroom-phase-student-assignment">
            {joinedInfo && (
                <div className={styles.assignmentJoinedNotice} data-testid="classroom-assignment-joined-notice">
                    <FormattedMessage
                        defaultMessage="Joined! Seat {seatNumber}"
                        description="Small joined confirmation shown on top of the assignment panel"
                        id="gui.classroom.studentAssignment.joinedNotice"
                        values={{
                            seatNumber: String(joinedInfo.seatNumber).padStart(2, '0'),
                        }}
                    />
                </div>
            )}
            <h2 className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Assignment"
                    description="Student assignment panel title"
                    id="gui.classroom.studentAssignment.title"
                />
            </h2>

            <ErrorDisplay error={error} errorTitle={errorTitle} />

            {page && (
                <div className={styles.assignmentViewPage} data-testid="classroom-assignment-view-page">
                    {page.imageUrl && (
                        <img
                            alt=""
                            className={styles.assignmentViewImage}
                            data-testid="classroom-assignment-view-image"
                            src={page.imageUrl}
                        />
                    )}
                    <div className={styles.assignmentViewText} data-testid="classroom-assignment-view-text">
                        {page.text}
                    </div>
                </div>
            )}

            {pages.length > 1 && (
                <div className={styles.assignmentPager}>
                    <button
                        className={styles.secondaryButton}
                        data-testid="classroom-assignment-prev-page"
                        disabled={pageIndex === 0}
                        onClick={onPrevPage}
                    >
                        <FormattedMessage
                            defaultMessage="← Previous"
                            description="Assignment panel: previous page"
                            id="gui.classroom.studentAssignment.prevPage"
                        />
                    </button>
                    <span className={styles.assignmentPagerLabel} data-testid="classroom-assignment-page-indicator">
                        {`${pageIndex + 1} / ${pages.length}`}
                    </span>
                    <button
                        className={styles.secondaryButton}
                        data-testid="classroom-assignment-next-page"
                        disabled={pageIndex >= pages.length - 1}
                        onClick={onNextPage}
                    >
                        <FormattedMessage
                            defaultMessage="Next →"
                            description="Assignment panel: next page"
                            id="gui.classroom.studentAssignment.nextPage"
                        />
                    </button>
                </div>
            )}

            <div className={styles.buttonRow}>
                {assignment?.starterUrl && (
                    <button
                        className={styles.secondaryButton}
                        data-testid="classroom-assignment-reload-starter"
                        disabled={isLoading}
                        onClick={onReloadStarter}
                    >
                        <FormattedMessage
                            defaultMessage="Open the Starter Project"
                            description="Assignment panel: (re)open the starter project"
                            id="gui.classroom.studentAssignment.reloadStarter"
                        />
                    </button>
                )}
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-assignment-close"
                    onClick={onClose}
                >
                    <FormattedMessage
                        defaultMessage="Start Working!"
                        description="Assignment panel: close and start working"
                        id="gui.classroom.studentAssignment.close"
                    />
                </button>
            </div>
        </div>
    );
};

StudentAssignmentPanel.propTypes = {
    assignment: PropTypes.shape({
        pages: PropTypes.arrayOf(
            PropTypes.shape({
                text: PropTypes.string,
                imageUrl: PropTypes.string,
            }),
        ),
        starterUrl: PropTypes.string,
    }),
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    joinedInfo: PropTypes.shape({
        seatNumber: PropTypes.number,
    }),
    pageIndex: PropTypes.number.isRequired,
    onClose: PropTypes.func.isRequired,
    onNextPage: PropTypes.func.isRequired,
    onPrevPage: PropTypes.func.isRequired,
    onReloadStarter: PropTypes.func.isRequired,
};

export default StudentAssignmentPanel;
