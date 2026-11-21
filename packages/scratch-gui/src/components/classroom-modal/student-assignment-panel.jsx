/**
 * Student assignment panel.
 *
 * Shows the assignment pages (short text + optional image) with a pager.
 * Opens automatically right after joining a classroom that carries an
 * assignment, and any time from the status view via "View Assignment".
 * One main button (#1793): 「つぎのページ」 until the last page, then — right
 * after joining — the way to start decided by decideStartMethod (nothing is
 * loaded until the student presses it), with the other ways under
 * 「ほかの始め方」. Reopened later from 「課題を見る」, the last page's main
 * button is 「とじる」 (no start method: the student is already working).
 *
 * The page text gets the light formatting of AssignmentPageText; a lesson assignment shows its
 * 「ゴール」 card on the last page; right after joining, the start buttons wait a few seconds
 * (「よく読もう… 3」, readWaitSeconds) so the student reads before starting. Reopening never waits.
 */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { READ_WAIT_GOAL_CHARS, readWaitSeconds } from '../../lib/classroom-read-wait.js';
import AssignmentPageText from './assignment-page-text.jsx';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import StudentAssignmentGoal from './student-assignment-goal.jsx';
import StudentMainButton from './student-main-button.jsx';
import StudentPreviousComment from './student-previous-comment.jsx';
import StudentStartMethod from './student-start-method.jsx';
import useReadCountdown from './use-read-countdown.js';

const StudentAssignmentPanel = ({
    assignment,
    assignmentReopened = false,
    continueOptions,
    error,
    errorTitle,
    isLoading,
    joinedInfo,
    pageIndex,
    startMethod,
    studentLesson = null,
    onChooseStarter,
    onClose,
    onLoadSubmission,
    onNextPage,
    onPrevPage,
    onStartLesson,
    onTrack,
}) => {
    const pages = assignment?.pages || [];
    const page = pages[pageIndex] || null;
    // Read first, then start: the start method waits for the last page (#1793).
    const isLastPage = pageIndex >= pages.length - 1;
    // Just joined: the way to start. Reopened from 「課題を見る」 (the container's
    // assignmentReopened; joinedInfo stays set once joined): 「とじる」.
    const justJoined = !assignmentReopened && !!joinedInfo;
    const showStart = isLastPage && justJoined && !!startMethod;
    // The goal card sits on the last page of a lesson assignment (also when reopened: the
    // student can check how many challenges are left to do).
    const lessonNotice = isLastPage && !!studentLesson;
    // Read before starting: the wait grows with the last page's text (and the goal card),
    // shorter when the student already paged through earlier pages.
    const waitSeconds = showStart
        ? readWaitSeconds({
              textLength: ((page && page.text) || '').length + (lessonNotice ? READ_WAIT_GOAL_CHARS : 0),
              readEarlierPages: pages.length > 1,
          })
        : 0;
    const waitLeft = useReadCountdown(waitSeconds, showStart);

    return (
        <div data-testid="classroom-phase-student-assignment">
            {/* One header row (title + joined badge + pager) so the panel fits the
                1300x600 classroom PC without scrolling (#1201 / #1221). */}
            <div className={styles.assignmentHeader}>
                <h2 className={styles.assignmentHeaderTitle}>
                    <FormattedMessage
                        defaultMessage="Assignment"
                        description="Student assignment panel title"
                        id="gui.classroom.studentAssignment.title"
                    />
                </h2>
                {justJoined && (
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
                        <span
                            className={styles.assignmentPagerLabel}
                            data-testid="classroom-assignment-page-indicator"
                        >
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
            </div>
            {justJoined && <StudentPreviousComment previousComment={joinedInfo.previousComment} />}

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
                    <AssignmentPageText
                        className={styles.assignmentViewText}
                        dataTestId="classroom-assignment-view-text"
                        text={page.text}
                    />
                </div>
            )}

            {lessonNotice && (
                <div data-testid="classroom-assignment-lesson-notice">
                    <StudentAssignmentGoal dataTestId="classroom-assignment-goal" lesson={studentLesson} />
                </div>
            )}

            {!isLastPage && (
                <div className={styles.assignmentMain}>
                    <StudentMainButton dataTestId="classroom-assignment-main-next" onClick={onNextPage}>
                        <FormattedMessage
                            defaultMessage="Next page"
                            description="Assignment panel: the main button before the last page"
                            id="gui.classroom.studentAssignment.mainNextPage"
                        />
                    </StudentMainButton>
                </div>
            )}
            {showStart && (
                <StudentStartMethod
                    continueOptions={continueOptions}
                    isLoading={isLoading}
                    method={startMethod}
                    onKeepCurrent={onClose}
                    onLoadStarter={onChooseStarter}
                    onLoadSubmission={onLoadSubmission}
                    onStartLesson={onStartLesson}
                    waitSeconds={waitLeft}
                    onTrack={onTrack}
                />
            )}
            {isLastPage && !showStart && (
                <div className={styles.assignmentMain}>
                    <StudentMainButton dataTestId="classroom-assignment-close" onClick={onClose}>
                        <FormattedMessage
                            defaultMessage="Close"
                            description="Assignment panel reopened while working: the main button on the last page"
                            id="gui.classroom.studentAssignment.closeReopened"
                        />
                    </StudentMainButton>
                </div>
            )}
        </div>
    );
};

StudentAssignmentPanel.propTypes = {
    // 「課題を見る」から開き直した（始め方は出さず、最後のページは「とじる」）
    assignmentReopened: PropTypes.bool,
    assignment: PropTypes.shape({
        pages: PropTypes.arrayOf(
            PropTypes.shape({
                text: PropTypes.string,
                imageUrl: PropTypes.string,
            }),
        ),
        starterUrl: PropTypes.string,
    }),
    continueOptions: PropTypes.object,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    joinedInfo: PropTypes.shape({
        seatNumber: PropTypes.number,
        previousComment: PropTypes.object,
    }),
    pageIndex: PropTypes.number.isRequired,
    // decideStartMethod の結果 (#1793)。参加した直後だけ使う
    startMethod: PropTypes.shape({
        main: PropTypes.string.isRequired,
        others: PropTypes.arrayOf(PropTypes.string),
    }),
    onChooseStarter: PropTypes.func,
    onClose: PropTypes.func.isRequired,
    onLoadSubmission: PropTypes.func,
    onNextPage: PropTypes.func.isRequired,
    onPrevPage: PropTypes.func.isRequired,
    onStartLesson: PropTypes.func,
    // sends a classroom_student GA event (#1831)
    onTrack: PropTypes.func,
    // normalized lesson setting of the joined assignment (null = not a lesson assignment)
    studentLesson: PropTypes.shape({
        challengeIds: PropTypes.arrayOf(PropTypes.string),
        submitWork: PropTypes.bool,
    }),
};

export default StudentAssignmentPanel;
