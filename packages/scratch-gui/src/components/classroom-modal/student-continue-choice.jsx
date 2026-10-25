/**
 * "Where to start" choice for students (#1201).
 *
 * Offers the assignment starter, the seat's submission from the previous
 * assignment of the same class, and the seat's own submission in this
 * assignment. Laid out as one horizontal row so the student screens stay
 * within the 1300x600 classroom PC viewport (#1221).
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

const ChoiceButton = ({ kind, loadedChoice, isLoading, onSelect, children }) => {
    const handleClick = useCallback(() => onSelect(kind), [onSelect, kind]);
    return (
        <button
            aria-pressed={loadedChoice === kind}
            className={styles.continueChoiceButton}
            data-testid={`classroom-continue-${kind}`}
            disabled={isLoading}
            onClick={handleClick}
        >
            {loadedChoice === kind && <span className={styles.continueChoiceCheck}>{'✓'}</span>}
            <span className={styles.continueChoiceText}>{children}</span>
        </button>
    );
};

ChoiceButton.propTypes = {
    children: PropTypes.node,
    isLoading: PropTypes.bool,
    kind: PropTypes.string.isRequired,
    loadedChoice: PropTypes.string,
    onSelect: PropTypes.func.isRequired,
};

const submissionShape = PropTypes.shape({
    assignmentName: PropTypes.string,
    projectName: PropTypes.string,
    submittedAt: PropTypes.string,
});

const StudentContinueChoice = ({
    continueOptions,
    isLoading,
    loadedChoice,
    showStarter,
    titleKind,
    onLoadStarter,
    onLoadSubmission,
}) => {
    if (!continueOptions) return null;
    const { previous, current } = continueOptions;
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
            </div>
            <div className={styles.continueChoiceRow}>
                {showStarter && (
                    <ChoiceButton
                        isLoading={isLoading}
                        kind="starter"
                        loadedChoice={loadedChoice}
                        onSelect={onLoadStarter}
                    >
                        <FormattedMessage
                            defaultMessage="Start from the starter"
                            description="Choice: open the assignment starter project"
                            id="gui.classroom.continueChoice.starter"
                        />
                    </ChoiceButton>
                )}
                {previous && (
                    <ChoiceButton
                        isLoading={isLoading}
                        kind="previous"
                        loadedChoice={loadedChoice}
                        onSelect={onLoadSubmission}
                    >
                        <FormattedMessage
                            defaultMessage="Continue from last time's submission"
                            description="Choice: open the project submitted in the previous assignment of the same class"
                            id="gui.classroom.continueChoice.previous"
                        />
                        <span className={styles.continueChoiceDetail}>
                            {[previous.assignmentName, formatSubmittedAt(previous.submittedAt)]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </ChoiceButton>
                )}
                {current && (
                    <ChoiceButton
                        isLoading={isLoading}
                        kind="current"
                        loadedChoice={loadedChoice}
                        onSelect={onLoadSubmission}
                    >
                        <FormattedMessage
                            defaultMessage="Open what you submitted for this assignment"
                            description="Choice: open the project already submitted in this assignment"
                            id="gui.classroom.continueChoice.current"
                        />
                        <span className={styles.continueChoiceDetail}>{formatSubmittedAt(current.submittedAt)}</span>
                    </ChoiceButton>
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
    showStarter: PropTypes.bool,
    // 'start' right after joining, 'load' on the status view (no starter there)
    titleKind: PropTypes.oneOf(['start', 'load']),
    onLoadStarter: PropTypes.func,
    onLoadSubmission: PropTypes.func.isRequired,
};

export default StudentContinueChoice;
