/**
 * "Where to start" choice for students (#1201).
 *
 * Offers the assignment starter, the seat's submission from the previous
 * assignment of the same class, the seat's own submission in this
 * assignment and — right after joining — starting with the open project as
 * it is. Each choice is a button that starts right away (the container loads
 * the project and closes the modal), so the screen has a single kind of
 * "start" action. Laid out as one horizontal row so the student screens stay
 * within the 1300x600 classroom PC viewport (#1221).
 *
 * Nothing is loaded before the student presses a choice. With the teacher's
 * "start from the previous submission" setting (#1202) one choice is marked
 * as recommended and a one-line notice next to the title says why — next to
 * the title, so it costs no extra height at 1300x600.
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './classroom-modal.css';

const formatSubmittedAt = (iso) =>
    iso
        ? new Date(iso).toLocaleString([], {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';

// Inline icons (stroke = currentColor) so each choice is recognizable at a
// glance and looks the same on every OS, unlike emoji.
const ICON_PATHS = {
    // a sheet of paper: the teacher's starter project
    starter: 'M5 2.5h6.5L15 6v11.5H5z M11.5 2.5V6H15 M7.5 10h5 M7.5 13h5',
    // an open folder: last time's work
    previous: 'M2.5 5.5h5l1.5 2h8.5v9h-15z M2.5 9.5h15',
    // a tray with a check: what was submitted for this assignment
    current: 'M3 11.5h4l1 2h4l1-2h4v5H3z M6.5 6.5l2.5 2.5 4.5-5',
    // a pencil: keep working on the open project
    keep: 'M12.5 3.5l4 4-9 9h-4v-4z M10.5 5.5l4 4',
};

const ChoiceIcon = ({ kind }) => (
    <svg
        aria-hidden="true"
        className={styles.continueChoiceIcon}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
        viewBox="0 0 20 20"
    >
        <path d={ICON_PATHS[kind]} />
    </svg>
);

ChoiceIcon.propTypes = {
    kind: PropTypes.oneOf(Object.keys(ICON_PATHS)).isRequired,
};

const ChoiceButton = ({ kind, label, detail, plain, recommended, loadedChoice, isLoading, onSelect }) => {
    const handleClick = useCallback(() => onSelect(kind), [onSelect, kind]);
    const className = [
        styles.continueChoiceButton,
        plain ? styles.continueChoicePlain : null,
        recommended ? styles.continueChoiceRecommended : null,
    ]
        .filter(Boolean)
        .join(' ');
    return (
        <button
            aria-pressed={loadedChoice === kind}
            className={className}
            data-testid={`classroom-continue-${kind}`}
            disabled={isLoading}
            onClick={handleClick}
        >
            <ChoiceIcon kind={kind} />
            <span className={styles.continueChoiceText}>
                <span className={styles.continueChoiceLabel}>{label}</span>
                {detail && <span className={styles.continueChoiceDetail}>{detail}</span>}
            </span>
            {recommended && (
                <span className={styles.continueChoiceBadge} data-testid={`classroom-continue-${kind}-recommended`}>
                    <FormattedMessage
                        defaultMessage="Recommended"
                        description="Badge on the start choice recommended by the teacher's setting"
                        id="gui.classroom.continueChoice.recommended"
                    />
                </span>
            )}
            {loadedChoice === kind && <span className={styles.continueChoiceCheck}>{'✓'}</span>}
        </button>
    );
};

ChoiceButton.propTypes = {
    detail: PropTypes.node,
    isLoading: PropTypes.bool,
    kind: PropTypes.string.isRequired,
    label: PropTypes.node.isRequired,
    loadedChoice: PropTypes.string,
    plain: PropTypes.bool,
    recommended: PropTypes.bool,
    onSelect: PropTypes.func.isRequired,
};

const submissionShape = PropTypes.shape({
    assignmentName: PropTypes.string,
    projectName: PropTypes.string,
    submittedAt: PropTypes.string,
});

const StartNotice = ({ notice, showStarter }) => {
    if (notice === 'recommendPrevious') {
        return (
            <FormattedMessage
                defaultMessage="Your teacher recommends continuing from last time's submission."
                description="Notice: the teacher's setting recommends the previous submission"
                id="gui.classroom.continueChoice.noticeRecommendPrevious"
            />
        );
    }
    if (showStarter) {
        return (
            <FormattedMessage
                defaultMessage="There was no submission from last time. Start from the starter."
                description="Notice: the teacher's setting wanted the previous submission but there was none; the starter is recommended"
                id="gui.classroom.continueChoice.noticeNoPreviousUseStarter"
            />
        );
    }
    return (
        <FormattedMessage
            defaultMessage="There was no submission from last time."
            description="Notice: the teacher's setting wanted the previous submission but there was none (no starter either)"
            id="gui.classroom.continueChoice.noticeNoPrevious"
        />
    );
};

StartNotice.propTypes = {
    notice: PropTypes.oneOf(['recommendPrevious', 'noPrevious']).isRequired,
    showStarter: PropTypes.bool,
};

const StudentContinueChoice = ({
    continueOptions,
    isLoading,
    loadedChoice,
    recommend,
    showStarter,
    startNotice,
    titleKind,
    onKeepCurrent,
    onLoadStarter,
    onLoadSubmission,
}) => {
    const notice = startNotice ? (
        <span className={styles.continueChoiceNotice} data-testid="classroom-continue-notice">
            <StartNotice notice={startNotice} showStarter={showStarter} />
        </span>
    ) : null;
    if (!continueOptions && !showStarter) {
        return notice ? <div className={styles.continueChoice}>{notice}</div> : null;
    }
    const { previous, current } = continueOptions || {};
    return (
        <div className={styles.continueChoice} data-testid="classroom-continue-choice">
            <div className={styles.continueChoiceTitle}>
                {titleKind === 'load' ? (
                    <FormattedMessage
                        defaultMessage="Open a submitted project"
                        description="Title of the submitted-project choices on the student status view"
                        id="gui.classroom.continueChoice.loadTitle"
                    />
                ) : (
                    <FormattedMessage
                        defaultMessage="Where do you want to start?"
                        description="Title of the choice between the starter and earlier submitted projects"
                        id="gui.classroom.continueChoice.title"
                    />
                )}
                {notice}
            </div>
            <div className={styles.continueChoiceRow}>
                {showStarter && (
                    <ChoiceButton
                        detail={
                            <FormattedMessage
                                defaultMessage="Make it from the project your teacher prepared"
                                description="Choice detail: what the starter project is"
                                id="gui.classroom.continueChoice.starterDetail"
                            />
                        }
                        isLoading={isLoading}
                        kind="starter"
                        recommended={recommend === 'starter'}
                        label={
                            <FormattedMessage
                                defaultMessage="Start from the starter"
                                description="Choice: open the assignment starter project"
                                id="gui.classroom.continueChoice.starter"
                            />
                        }
                        loadedChoice={loadedChoice}
                        onSelect={onLoadStarter}
                    />
                )}
                {previous && (
                    <ChoiceButton
                        detail={[previous.assignmentName, formatSubmittedAt(previous.submittedAt)]
                            .filter(Boolean)
                            .join(' · ')}
                        isLoading={isLoading}
                        kind="previous"
                        recommended={recommend === 'previous'}
                        label={
                            <FormattedMessage
                                defaultMessage="Continue from last time's submission"
                                description="Choice: open the project submitted in the previous assignment of the same class"
                                id="gui.classroom.continueChoice.previous"
                            />
                        }
                        loadedChoice={loadedChoice}
                        onSelect={onLoadSubmission}
                    />
                )}
                {current && (
                    <ChoiceButton
                        detail={formatSubmittedAt(current.submittedAt)}
                        isLoading={isLoading}
                        kind="current"
                        label={
                            <FormattedMessage
                                defaultMessage="Open what you submitted for this assignment"
                                description="Choice: open the project already submitted in this assignment"
                                id="gui.classroom.continueChoice.current"
                            />
                        }
                        loadedChoice={loadedChoice}
                        onSelect={onLoadSubmission}
                    />
                )}
                {onKeepCurrent && (
                    <ChoiceButton
                        plain
                        detail={
                            <FormattedMessage
                                defaultMessage="Make it without opening anything"
                                description="Choice detail: start without loading any project"
                                id="gui.classroom.continueChoice.keepDetail"
                            />
                        }
                        isLoading={isLoading}
                        kind="keep"
                        label={
                            <FormattedMessage
                                defaultMessage="Start with the project as it is"
                                description="Choice: start working without loading any project"
                                id="gui.classroom.continueChoice.keep"
                            />
                        }
                        onSelect={onKeepCurrent}
                    />
                )}
            </div>
        </div>
    );
};

StudentContinueChoice.defaultProps = {
    titleKind: 'start',
};

StudentContinueChoice.propTypes = {
    continueOptions: PropTypes.shape({
        current: submissionShape,
        previous: submissionShape,
    }),
    isLoading: PropTypes.bool,
    loadedChoice: PropTypes.string,
    // the choice the teacher's setting recommends (#1202)
    recommend: PropTypes.oneOf(['starter', 'previous']),
    showStarter: PropTypes.bool,
    // why a choice is recommended, or that there was no previous submission (#1202)
    startNotice: PropTypes.oneOf(['recommendPrevious', 'noPrevious']),
    // 'start' right after joining, 'load' on the status view (no starter there)
    titleKind: PropTypes.oneOf(['start', 'load']),
    // start without loading anything (offered right after joining, not on the status view)
    onKeepCurrent: PropTypes.func,
    onLoadStarter: PropTypes.func,
    onLoadSubmission: PropTypes.func.isRequired,
};

export default StudentContinueChoice;
