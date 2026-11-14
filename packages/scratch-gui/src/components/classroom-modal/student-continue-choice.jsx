/**
 * 「提出した作品を読み込む」(#1201・ステータスの画面)。
 *
 * この課題で提出した作品と、同じクラスの前の課題で同じ席が提出した作品を開き直す。
 * 押すとすぐ読み込む（コンテナが読み込んでモーダルを閉じる）。参加したあとの始め方は
 * student-start-method.jsx（主ボタン 1 つ・#1793）に移った。この部品は #1794 で
 * 「作品を読み込み直す」に置きかわる。
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
    // an open folder: last time's work
    previous: 'M2.5 5.5h5l1.5 2h8.5v9h-15z M2.5 9.5h15',
    // a tray with a check: what was submitted for this assignment
    current: 'M3 11.5h4l1 2h4l1-2h4v5H3z M6.5 6.5l2.5 2.5 4.5-5',
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

const ChoiceButton = ({ kind, label, detail, loadedChoice, isLoading, onSelect }) => {
    const handleClick = useCallback(() => onSelect(kind), [onSelect, kind]);
    return (
        <button
            aria-pressed={loadedChoice === kind}
            className={styles.continueChoiceButton}
            data-testid={`classroom-continue-${kind}`}
            disabled={isLoading}
            onClick={handleClick}
        >
            <ChoiceIcon kind={kind} />
            <span className={styles.continueChoiceText}>
                <span className={styles.continueChoiceLabel}>{label}</span>
                {detail && <span className={styles.continueChoiceDetail}>{detail}</span>}
            </span>
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
    onSelect: PropTypes.func.isRequired,
};

const submissionShape = PropTypes.shape({
    assignmentName: PropTypes.string,
    projectName: PropTypes.string,
    submittedAt: PropTypes.string,
});

const StudentContinueChoice = ({ continueOptions, isLoading, loadedChoice, onLoadSubmission }) => {
    if (!continueOptions) return null;
    const { previous, current } = continueOptions;
    return (
        <div className={styles.continueChoice} data-testid="classroom-continue-choice">
            <div className={styles.continueChoiceTitle}>
                <FormattedMessage
                    defaultMessage="Open a submitted project"
                    description="Title of the submitted-project choices on the student status view"
                    id="gui.classroom.continueChoice.loadTitle"
                />
            </div>
            <div className={styles.continueChoiceRow}>
                {previous && (
                    <ChoiceButton
                        detail={[previous.assignmentName, formatSubmittedAt(previous.submittedAt)]
                            .filter(Boolean)
                            .join(' · ')}
                        isLoading={isLoading}
                        kind="previous"
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
            </div>
        </div>
    );
};

StudentContinueChoice.propTypes = {
    continueOptions: PropTypes.shape({
        current: submissionShape,
        previous: submissionShape,
    }),
    isLoading: PropTypes.bool,
    loadedChoice: PropTypes.string,
    onLoadSubmission: PropTypes.func.isRequired,
};

export default StudentContinueChoice;
