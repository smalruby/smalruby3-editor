/**
 * The lesson scoring points in「詳しい設定」(EPIC #1592 D10 / #1598) and on the
 * grading screen (#1778): 満点 and 必須を全部こなしたときの点. The points of one
 * challenge are derived and shown below (docs/classroom/ui-ux.md「採点」).
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import {
    MAX_LESSON_TOTAL,
    canChooseRequiredPoints,
    challengePoints,
    effectiveScoring,
    requiredPointsUnusedReason,
    setScoring,
} from '../../lib/classroom-lesson-settings.js';
import styles from './classroom-modal.css';
import LessonNumberInput from './lesson-number-input.jsx';

export const lessonScoringMessages = defineMessages({
    summary: {
        defaultMessage: 'Lesson points: {total} (★ {required})',
        description: 'Assignment editor: advanced settings summary — lesson scoring (full marks and required points)',
        id: 'gui.classroom.lessonScoring.summary',
    },
    allRequired: {
        defaultMessage: '(not used: the required ones alone clear the assignment, so they share the full marks)',
        description:
            'Lesson points: why the required points field is not used when every challenge needed to clear ' +
            'the assignment is required (#1778)',
        id: 'gui.classroom.lessonScoring.unusedAllRequired',
    },
    noneRequired: {
        defaultMessage: '(not used: nothing is required)',
        description: 'Lesson points: why the required points field is not used when nothing is required (#1778)',
        id: 'gui.classroom.lessonScoring.unusedNoneRequired',
    },
    savesRightAway: {
        defaultMessage: 'Changes are saved to the assignment right away.',
        description: 'Grading screen: the lesson points are saved as soon as they are changed (#1778)',
        id: 'gui.classroom.lessonScoring.savesRightAway',
    },
});

// Show 7.5 as 7.5 and 33.333… as 33.3 (the score itself is rounded up).
const formatPoints = (value) => String(Math.round(value * 10) / 10);

const LessonScoringField = ({ className, disabled, draft, savesRightAway, title, onChange }) => {
    const intl = useIntl();
    const scoring = effectiveScoring(draft);
    const points = challengePoints(draft);
    const choosable = canChooseRequiredPoints(draft);
    const unusedReason = requiredPointsUnusedReason(draft);
    const handleTotalCommit = useCallback(
        (value) => onChange(setScoring(draft, { total: value })),
        [draft, onChange],
    );
    const handleRequiredCommit = useCallback(
        (value) => onChange(setScoring(draft, { requiredPoints: value })),
        [draft, onChange],
    );

    let perChallenge;
    if (points.required === null) {
        perChallenge = (
            <FormattedMessage
                defaultMessage="Each challenge: {points} pts"
                description="Assignment editor: lesson points of one challenge when none is required"
                id="gui.classroom.lessonScoring.perChallenge"
                values={{ points: formatPoints(points.optional || 0) }}
            />
        );
    } else {
        perChallenge = (
            <FormattedMessage
                defaultMessage="Required: {required} pts each · Others: {optional} pts each"
                description="Assignment editor: lesson points of one required and one other challenge"
                id="gui.classroom.lessonScoring.perChallengeSplit"
                values={{
                    required: formatPoints(points.required),
                    optional: points.optional === null ? '-' : formatPoints(points.optional),
                }}
            />
        );
    }

    return (
        <div className={className || styles.assignmentPeerView} data-testid="classroom-lesson-scoring">
            <span className={styles.assignmentStartFromPreviousLabel}>
                {title || (
                    <FormattedMessage
                        defaultMessage="Lesson points"
                        description="Assignment editor: label of the lesson scoring settings"
                        id="gui.classroom.lessonScoring.title"
                    />
                )}
            </span>
            <label className={styles.lessonRadio}>
                <span>
                    <FormattedMessage
                        defaultMessage="Full marks"
                        description="Assignment editor: label of the lesson full marks"
                        id="gui.classroom.lessonScoring.total"
                    />
                </span>
                <LessonNumberInput
                    className={styles.lessonCountInput}
                    disabled={disabled}
                    max={MAX_LESSON_TOTAL}
                    min={1}
                    testId="classroom-lesson-scoring-total"
                    value={scoring.total}
                    onCommit={handleTotalCommit}
                />
            </label>
            <label className={styles.lessonRadio}>
                <span>
                    <FormattedMessage
                        defaultMessage="Points for doing all required (★)"
                        description="Assignment editor: label of the points for completing all required challenges"
                        id="gui.classroom.lessonScoring.requiredPoints"
                    />
                </span>
                <LessonNumberInput
                    className={styles.lessonCountInput}
                    disabled={disabled || !choosable}
                    max={scoring.total}
                    min={0}
                    testId="classroom-lesson-scoring-required"
                    value={scoring.requiredPoints}
                    onCommit={handleRequiredCommit}
                />
                {unusedReason && (
                    <span
                        className={styles.assignmentStartFromPreviousHint}
                        data-testid="classroom-lesson-scoring-required-unused"
                    >
                        {intl.formatMessage(lessonScoringMessages[unusedReason])}
                    </span>
                )}
            </label>
            <span className={styles.assignmentStartFromPreviousHint} data-testid="classroom-lesson-scoring-each">
                {perChallenge}{' '}
                {intl.formatMessage({
                    defaultMessage: '(the score is the total of completed ones, rounded up)',
                    description: 'Assignment editor: how the lesson score is computed',
                    id: 'gui.classroom.lessonScoring.howTo',
                })}
                {savesRightAway && ` ${intl.formatMessage(lessonScoringMessages.savesRightAway)}`}
            </span>
        </div>
    );
};

LessonScoringField.propTypes = {
    className: PropTypes.string,
    disabled: PropTypes.bool,
    draft: PropTypes.object.isRequired,
    savesRightAway: PropTypes.bool,
    title: PropTypes.node,
    onChange: PropTypes.func.isRequired,
};

export default LessonScoringField;
