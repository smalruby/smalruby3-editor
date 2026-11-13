// クラスの課題の帯（#1599）。1 行の文「［課題］<課題名> 条件: 6 つ あと 5 つ（★ 5 つ）で課題クリア」（#1771）。
// 課題クリアのあとは「✓ 課題クリア」。作品も提出する課題では、提出の案内と［課題を提出する］を出す。
// どのチャレンジができたか・必須かはカードの ✓ と ★ で分かるので、帯にはチャレンジごとの丸を出さない。
//   - variant="full": レッスン表の上（components/lessons-library）
//   - variant="compact": チャレンジの中の課題バーの同じ行（高さを変えない・「あと 5 つ（★ 5 つ）」だけ）
// 数え方は lib/lessons/assignment-progress.js（assignmentProgress の結果を `status` で受け、
// 文の数は assignmentRemainingParts で決める）。
// 丸（AssignmentDots）・AssignmentRemaining・AssignmentDoneCount はクラスの画面の「進み具合」で使う。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { assignmentRemainingParts } from '../../lib/lessons/assignment-progress';
import styles from './lesson-assignment-band.css';

const messages = defineMessages({
    label: {
        id: 'gui.lessons.assignment.label',
        description: 'Label in front of the assignment name on the lesson assignment band',
        defaultMessage: 'Assignment',
    },
    conditionAll: {
        id: 'gui.lessons.assignment.conditionAll',
        description: 'Completion condition of a lesson assignment: every chosen challenge',
        defaultMessage: 'Goal: all {count}',
    },
    conditionCount: {
        id: 'gui.lessons.assignment.conditionCount',
        description: 'Completion condition of a lesson assignment: n challenges including the required (★) ones',
        defaultMessage: 'Goal: {count}, including ★',
    },
    conditionCountNoRequired: {
        id: 'gui.lessons.assignment.conditionCountNoRequired',
        description: 'Completion condition of a lesson assignment: n challenges (no required ones)',
        defaultMessage: 'Goal: {count}',
    },
    remaining: {
        id: 'gui.lessons.assignment.remaining',
        description: 'How many more challenges are needed to clear the lesson assignment',
        defaultMessage: '{count} more to clear the assignment',
    },
    bandRemaining: {
        id: 'gui.lessons.assignment.bandRemaining',
        description:
            'Lesson assignment band: how many more challenges clear the assignment, and how many of them ' +
            'are required (★)',
        defaultMessage: '{total} more (★ {required}) to clear the assignment',
    },
    bandRemainingShort: {
        id: 'gui.lessons.assignment.bandRemainingShort',
        description:
            'Short form inside a challenge: how many more challenges clear the assignment, and how many ' +
            'of them are required (★)',
        defaultMessage: '{total} more (★ {required})',
    },
    bandRemainingShortNoRequired: {
        id: 'gui.lessons.assignment.bandRemainingShortNoRequired',
        description: 'Short form inside a challenge: how many more challenges clear the assignment (none required)',
        defaultMessage: '{total} more',
    },
    requiredRemaining: {
        id: 'gui.lessons.assignment.requiredRemaining',
        description: 'How many required (★) challenges of the lesson assignment are left',
        defaultMessage: '★ {count} left',
    },
    cleared: {
        id: 'gui.lessons.assignment.cleared',
        description: 'Shown when the lesson assignment is cleared (its completion condition is met)',
        defaultMessage: 'Assignment cleared',
    },
    done: {
        id: 'gui.lessons.assignment.done',
        description: 'How many challenges of the lesson assignment are done out of the condition count',
        defaultMessage: '{done} / {total} done',
    },
    required: {
        id: 'gui.lessons.assignment.required',
        description: 'Accessible label of the ★ mark of a required challenge',
        defaultMessage: 'Required',
    },
    dotDone: {
        id: 'gui.lessons.assignment.dotDone',
        description: 'Accessible label of a filled circle on the lesson assignment band (a done challenge)',
        defaultMessage: 'Done',
    },
    dotNotDone: {
        id: 'gui.lessons.assignment.dotNotDone',
        description: 'Accessible label of an empty circle on the lesson assignment band (a challenge not done yet)',
        defaultMessage: 'Not yet',
    },
    submitGuide: {
        id: 'gui.lessons.assignment.submitGuide',
        description:
            'Guidance shown once a lesson assignment that also asks for a work submission is cleared: make your ' +
            'own program and submit it',
        defaultMessage: 'Use what you learned in the lessons to make your own program. When it is ready, submit it.',
    },
    unknownChallenges: {
        id: 'gui.lessons.assignment.unknownChallenges',
        description:
            'Shown when the class assignment has challenges this (older) page does not know yet: reload the page',
        defaultMessage: 'There are new lessons. Please reload the page.',
    },
    submit: {
        id: 'gui.lessons.assignment.submit',
        description: 'Button that submits the work of a cleared lesson assignment',
        defaultMessage: 'Submit assignment',
    },
});

/**
 * 条件の文（「条件: 全部（6 つ）」など）。
 * @param {object} intl - react-intl。
 * @param {object} status - assignmentProgress の結果。
 * @param {boolean} all - 条件が「全部」か。
 * @returns {string} 文。
 */
const conditionText = (intl, status, all) => {
    if (all) return intl.formatMessage(messages.conditionAll, { count: status.conditionCount });
    return intl.formatMessage(
        status.requiredCount > 0 ? messages.conditionCount : messages.conditionCountNoRequired,
        {
            count: status.conditionCount,
        },
    );
};

/**
 * チャレンジごとの丸（できた = 塗り、まだ = 白。必須は ★）。クラスの画面の進み具合でも使う。
 * @param {object} props - props。
 * @param {Array<{id: string, required: boolean, completed: boolean}>} props.challenges - 課題のチャレンジ。
 * @param {string} [props.className] - 外側のクラス。
 * @returns {React.ReactElement} 丸の並び。
 */
export const AssignmentDots = ({ challenges, className }) => {
    const intl = useIntl();
    return (
        <span className={classNames(styles.dots, className)} data-testid="lesson-assignment-dots">
            {challenges.map((c) => (
                <span
                    key={c.id}
                    className={classNames(styles.dot, {
                        [styles.dotCompleted]: c.completed,
                        [styles.dotRequired]: c.required,
                    })}
                    data-testid="lesson-assignment-dot"
                    data-challenge-id={c.id}
                    data-completed={c.completed ? 'true' : 'false'}
                    data-required={c.required ? 'true' : 'false'}
                    role="img"
                    aria-label={[
                        intl.formatMessage(c.completed ? messages.dotDone : messages.dotNotDone),
                        c.required ? intl.formatMessage(messages.required) : null,
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    {...(c.required ? { title: intl.formatMessage(messages.required) } : {})}
                >
                    {c.required ? '★' : null}
                </span>
            ))}
        </span>
    );
};

AssignmentDots.propTypes = {
    challenges: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            required: PropTypes.bool.isRequired,
            completed: PropTypes.bool.isRequired,
        }),
    ).isRequired,
    className: PropTypes.string,
};

/**
 * 「あと n つで課題クリア」「★ あと n」または「✓ 課題クリア」。
 * @param {object} props - props。
 * @param {object} props.status - assignmentProgress の結果。
 * @returns {React.ReactElement} 文。
 */
export const AssignmentRemaining = ({ status }) => {
    const intl = useIntl();
    if (status.cleared) {
        return (
            <span className={styles.cleared} data-testid="lesson-assignment-cleared">
                {`✓ ${intl.formatMessage(messages.cleared)}`}
            </span>
        );
    }
    return (
        <span className={styles.remaining} data-testid="lesson-assignment-remaining" data-count={status.remaining}>
            {status.requiredRemaining > 0 ? (
                <span className={styles.requiredRemaining} data-testid="lesson-assignment-required-remaining">
                    {intl.formatMessage(messages.requiredRemaining, { count: status.requiredRemaining })}
                </span>
            ) : null}
            {intl.formatMessage(messages.remaining, { count: status.remaining })}
        </span>
    );
};

AssignmentRemaining.propTypes = {
    status: PropTypes.shape({
        cleared: PropTypes.bool.isRequired,
        remaining: PropTypes.number.isRequired,
        requiredRemaining: PropTypes.number.isRequired,
    }).isRequired,
};

/**
 * 帯の文「あと 5 つ（★ 5 つ）で課題クリア」（short なら「あと 5 つ（★ 5 つ）」）または「✓ 課題クリア」。
 * 残っている必須が 0 なら「（★ R つ）」を出さない。
 * @param {object} props - props。
 * @param {boolean} [props.short] - チャレンジの中の短い形か。
 * @param {object} props.status - assignmentProgress の結果。
 * @returns {React.ReactElement} 文。
 */
export const AssignmentBandRemaining = ({ short = false, status }) => {
    const intl = useIntl();
    const parts = assignmentRemainingParts(status);
    if (!parts) {
        return (
            <span className={styles.cleared} data-testid="lesson-assignment-cleared">
                {`✓ ${intl.formatMessage(messages.cleared)}`}
            </span>
        );
    }
    let message;
    if (short) message = parts.required > 0 ? messages.bandRemainingShort : messages.bandRemainingShortNoRequired;
    else message = parts.required > 0 ? messages.bandRemaining : messages.remaining;
    return (
        <span
            className={styles.remaining}
            data-testid="lesson-assignment-remaining"
            data-count={parts.total}
            data-required={parts.required}
        >
            {intl.formatMessage(message, { total: parts.total, required: parts.required, count: parts.total })}
        </span>
    );
};

AssignmentBandRemaining.propTypes = {
    short: PropTypes.bool,
    status: PropTypes.shape({
        cleared: PropTypes.bool.isRequired,
        remaining: PropTypes.number.isRequired,
        requiredRemaining: PropTypes.number.isRequired,
    }).isRequired,
};

/**
 * 「4 / 6 できた」（できた数は条件の数で止める）。
 * @param {object} props - props。
 * @param {object} props.status - assignmentProgress の結果。
 * @returns {React.ReactElement} 文。
 */
export const AssignmentDoneCount = ({ status }) => {
    const intl = useIntl();
    return (
        <span className={styles.doneCount} data-testid="lesson-assignment-done-count">
            {intl.formatMessage(messages.done, { done: status.cappedCount, total: status.conditionCount })}
        </span>
    );
};

AssignmentDoneCount.propTypes = {
    status: PropTypes.shape({
        cappedCount: PropTypes.number.isRequired,
        conditionCount: PropTypes.number.isRequired,
    }).isRequired,
};

/**
 * 「新しいレッスンがあります。ページを読み込み直してね」（この版のコースに無いチャレンジがあるとき・#1599 M1）。
 * @param {object} props - props。
 * @param {string} [props.className] - クラス。
 * @param {string} props.testId - data-testid。
 * @returns {React.ReactElement} 文。
 */
export const UnknownChallengesNote = ({ className, testId }) => {
    const intl = useIntl();
    return (
        <span className={classNames(styles.unknownNote, className)} data-testid={testId} role="note">
            {intl.formatMessage(messages.unknownChallenges)}
        </span>
    );
};

UnknownChallengesNote.propTypes = {
    className: PropTypes.string,
    testId: PropTypes.string.isRequired,
};

const LessonAssignmentBand = ({
    assignmentName = null,
    canSubmit = false,
    completionAll = true,
    onSubmit = null,
    status,
    submitted = false,
    variant = 'full',
}) => {
    const intl = useIntl();
    // クラスの画面の提出の案内とそろえて、はじめて提出するまでだけ出す（#1599 FYI3）
    const showSubmit = canSubmit && !submitted && Boolean(onSubmit);
    if (variant === 'compact') {
        return (
            <span
                className={styles.compact}
                data-testid="lesson-task-bar-assignment"
                data-cleared={status.cleared ? 'true' : 'false'}
            >
                <AssignmentBandRemaining short status={status} />
            </span>
        );
    }
    return (
        <div
            className={classNames(styles.band, { [styles.bandCleared]: status.cleared })}
            data-testid="lesson-assignment-band"
            data-cleared={status.cleared ? 'true' : 'false'}
        >
            <div className={styles.row}>
                <span className={styles.label}>{intl.formatMessage(messages.label)}</span>
                {assignmentName ? (
                    <span className={styles.name} data-testid="lesson-assignment-band-name">
                        {assignmentName}
                    </span>
                ) : null}
                <span className={styles.condition} data-testid="lesson-assignment-band-condition">
                    {conditionText(intl, status, completionAll)}
                </span>
                <AssignmentBandRemaining status={status} />
                {status.unknownCount > 0 ? <UnknownChallengesNote testId="lesson-assignment-band-unknown" /> : null}
            </div>
            {showSubmit ? (
                <div className={styles.submitRow}>
                    <span className={styles.submitGuide} data-testid="lesson-assignment-band-submit-guide">
                        {intl.formatMessage(messages.submitGuide)}
                    </span>
                    <button
                        type="button"
                        className={styles.submit}
                        data-testid="lesson-assignment-band-submit"
                        onClick={onSubmit}
                    >
                        {intl.formatMessage(messages.submit)}
                    </button>
                </div>
            ) : null}
        </div>
    );
};

LessonAssignmentBand.propTypes = {
    assignmentName: PropTypes.string,
    // 提出の案内と［課題を提出する］を出してよいか（assignment-progress.js の canSubmitAssignment）
    canSubmit: PropTypes.bool,
    // 完了の条件が「全部」か（false なら「n つ」）
    completionAll: PropTypes.bool,
    // 「課題を提出する」（canSubmit で、まだ提出していないときだけ出す）
    onSubmit: PropTypes.func,
    // assignment-progress.js の assignmentProgress の結果
    status: PropTypes.shape({
        cleared: PropTypes.bool.isRequired,
        conditionCount: PropTypes.number.isRequired,
        requiredCount: PropTypes.number.isRequired,
        remaining: PropTypes.number.isRequired,
        requiredRemaining: PropTypes.number.isRequired,
        unknownCount: PropTypes.number,
    }).isRequired,
    // 作品をもう提出したか（提出したあとは案内とボタンを出さない）
    submitted: PropTypes.bool,
    variant: PropTypes.oneOf(['full', 'compact']),
};

export { messages };
export default LessonAssignmentBand;
