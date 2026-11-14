/**
 * 「おかえりなさい」の画面 (#1794)。参加中の生徒がクラスの画面を開いたとき（同じクラスに
 * 入り直したときもふくむ）に出す。番号選びは飛ばす。
 *
 * 主ボタンは「つづける」1 つ（何も読み込まずに閉じる。レッスンの課題では「レッスンを続ける」）。
 * ほかの操作は小さなリンク: 「課題を見る」「みんなの作品を見る」「出席番号がちがう」
 * 「作品を読み込み直す」、右下に離して「クラスから出る」（確認を挟む）。提出のボタンは
 * この画面に置かない（メニューバーの「提出する」から。docs/classroom/ui-ux.md の 8.）。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { formatStudentClassName } from '../../lib/classroom-class-label.js';
import { canSubmitAssignment } from '../../lib/lessons/assignment-progress.js';
import {
    AssignmentDoneCount,
    AssignmentDots,
    AssignmentRemaining,
    UnknownChallengesNote,
    messages as bandMessages,
} from '../lesson-assignment-band/lesson-assignment-band.jsx';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import StudentMainButton from './student-main-button.jsx';
import StudentPeerViewButton from './student-peer-view-button.jsx';
import partStyles from './student-screen-parts.css';
import { messages as startMessages } from './student-start-method.jsx';
import StudentTextLink from './student-text-link.jsx';

const messages = defineMessages({
    seat: {
        defaultMessage: 'Seat {seatNumber}',
        description: 'Welcome back screen: the seat number in the one-line info',
        id: 'gui.classroom.studentStatus.seatLabel',
    },
    continue: {
        defaultMessage: 'Continue',
        description: 'Welcome back screen: the main button (closes without loading anything)',
        id: 'gui.classroom.studentStatus.continue',
    },
    continueNote: {
        defaultMessage: 'Keep making the project you have open',
        description: 'Welcome back screen: second line of the main button',
        id: 'gui.classroom.studentStatus.continueNote',
    },
    wrongSeat: {
        defaultMessage: 'Wrong seat number',
        description: 'Welcome back screen: small link that frees the seat and goes back to choosing a seat',
        id: 'gui.classroom.studentStatus.wrongSeat',
    },
    reload: {
        defaultMessage: 'Open a project again',
        description: 'Welcome back screen: small link that lists the projects that can be opened',
        id: 'gui.classroom.studentStatus.reload',
    },
    leaveQuestion: {
        defaultMessage: 'Leave the class? The projects you submitted stay.',
        description: 'Welcome back screen: confirm before leaving the class',
        id: 'gui.classroom.studentStatus.leaveQuestion',
    },
    leaveConfirm: {
        defaultMessage: 'Leave',
        description: 'Welcome back screen: confirm button that leaves the class',
        id: 'gui.classroom.studentStatus.leaveConfirm',
    },
    leaveCancel: {
        defaultMessage: 'Cancel',
        description: 'Welcome back screen: small link that keeps the student in the class',
        id: 'gui.classroom.studentStatus.leaveCancel',
    },
});

const formatTime = (iso, locale) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';

const RefreshButton = ({ isLoading, onRefreshStudentStatus }) => (
    <button
        className={styles.refreshButton}
        data-testid="classroom-student-refresh"
        disabled={isLoading}
        onClick={onRefreshStudentStatus}
    >
        {'↻'}
    </button>
);

RefreshButton.propTypes = {
    isLoading: PropTypes.bool,
    onRefreshStudentStatus: PropTypes.func.isRequired,
};

const SubmissionStatus = ({ classroomState }) => {
    const intl = useIntl();
    const time = formatTime(classroomState.lastSubmittedAt, intl.locale);
    let label;
    if (classroomState.submissionStatus === 'returned') {
        label = (
            <React.Fragment>
                {'↩ '}
                <FormattedMessage
                    defaultMessage="Returned"
                    description="Returned status"
                    id="gui.classroom.studentStatus.returned"
                />
            </React.Fragment>
        );
    } else if (classroomState.submissionStatus === 'submitted') {
        label = (
            <React.Fragment>
                {'✓ '}
                <FormattedMessage
                    defaultMessage="Submitted"
                    description="Submitted status"
                    id="gui.classroom.studentStatus.submitted"
                />
            </React.Fragment>
        );
    } else {
        return (
            <span className={partStyles.welcomeInfoFixed} data-testid="classroom-submit-status">
                <FormattedMessage
                    defaultMessage="Not submitted"
                    description="Not submitted status"
                    id="gui.classroom.studentStatus.notSubmitted"
                />
            </span>
        );
    }
    return (
        <span className={partStyles.welcomeInfoFixed} data-testid="classroom-submit-status">
            {label}
            {time && ` (${time})`}
        </span>
    );
};

SubmissionStatus.propTypes = {
    classroomState: PropTypes.object.isRequired,
};

const Separator = () => (
    <span aria-hidden="true" className={partStyles.welcomeInfoSeparator}>
        {'・'}
    </span>
);

/**
 * 1 行の情報: 「クラス ・ 出席番号03 ・ 課題 ・ 未提出 ↻」。長いクラス名・課題名は「…」で切る
 * （1300×600 で 1 行に収めるため。全体は title で読める）。
 * @param {object} props - component props
 * @param {object} props.classroomState - 生徒のセッション
 * @param {boolean} props.showSubmission - 提出の状態を出すか（作品を提出しないレッスンの課題では出さない）
 * @param {boolean} props.isLoading - 読み込み中
 * @param {Function} props.onRefreshStudentStatus - ↻ を押したとき
 * @returns {React.ReactElement} the line
 */
const InfoLine = ({ classroomState, showSubmission, isLoading, onRefreshStudentStatus }) => {
    const intl = useIntl();
    const className = formatStudentClassName(classroomState.className, classroomState.classYear);
    return (
        <div className={partStyles.welcomeInfo} data-testid="classroom-status-info">
            <span className={partStyles.welcomeInfoText} data-testid="classroom-status-class-name" title={className}>
                {className}
            </span>
            <Separator />
            <span className={partStyles.welcomeInfoFixed} data-testid="classroom-status-seat-number">
                {intl.formatMessage(messages.seat, {
                    seatNumber: String(classroomState.seatNumber).padStart(2, '0'),
                })}
            </span>
            {classroomState.assignmentName && (
                <React.Fragment>
                    <Separator />
                    <span
                        className={partStyles.welcomeInfoText}
                        data-testid="classroom-status-assignment"
                        title={classroomState.assignmentName}
                    >
                        {classroomState.assignmentName}
                    </span>
                </React.Fragment>
            )}
            {showSubmission && (
                <React.Fragment>
                    <Separator />
                    <SubmissionStatus classroomState={classroomState} />
                </React.Fragment>
            )}
            <RefreshButton isLoading={isLoading} onRefreshStudentStatus={onRefreshStudentStatus} />
        </div>
    );
};

InfoLine.propTypes = {
    classroomState: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onRefreshStudentStatus: PropTypes.func.isRequired,
    showSubmission: PropTypes.bool,
};

/**
 * 「進み具合」 row of a lesson assignment (#1599): circles (★ = required),
 * "4 / 6 done" and "2 more to clear" / "✓ Assignment cleared".
 * @param {object} props - component props
 * @param {object} props.lessonStatus - assignmentProgress() result
 * @returns {React.ReactElement} the row
 */
const LessonProgressRow = ({ lessonStatus }) => (
    <div className={styles.statusRow} data-testid="classroom-status-lesson-progress">
        <span className={styles.statusLabel}>
            <FormattedMessage
                defaultMessage="Progress"
                description="Lesson progress label on the student status view of a lesson assignment"
                id="gui.classroom.studentStatus.lessonProgress"
            />
        </span>
        <span className={`${styles.statusValue} ${styles.lessonProgressValue}`}>
            <AssignmentDots challenges={lessonStatus.challenges} />
            <AssignmentDoneCount status={lessonStatus} />
            {/* With challenges this build does not know, "n more" can mislead: ask
                for a reload in its place (one line, so 1300x600 still fits). */}
            {lessonStatus.unknownCount > 0 && !lessonStatus.cleared ? (
                <UnknownChallengesNote testId="classroom-status-lesson-unknown" />
            ) : (
                <AssignmentRemaining status={lessonStatus} />
            )}
        </span>
    </div>
);

LessonProgressRow.propTypes = {
    lessonStatus: PropTypes.object.isRequired,
};

const continueLessonLabel = (
    <FormattedMessage
        defaultMessage="Continue the lesson"
        description="Opens the lessons library with the lesson assignment's challenges (student status view)"
        id="gui.classroom.studentStatus.continueLesson"
    />
);

// 「作品を読み込み直す」で並べる順（始め方を決める順番と同じ。いまの作品のままは主ボタン）。
const RELOAD_KINDS = ['current', 'previous', 'starter'];

/**
 * 「作品を読み込み直す」: 押すと、開ける作品を小さなリンクで並べる。押すとその作品を開いて
 * モーダルを閉じる（開く前の確認と URL の取り直しはコンテナがする）。
 * @param {object} props - component props
 * @param {Array<string>} props.kinds - 開けるもの（RELOAD_KINDS の順）
 * @param {boolean} props.isLoading - 読み込み中
 * @param {Function} props.onLoad - 押したとき（kind を渡す）
 * @returns {React.ReactElement} the link and the list
 */
const ReloadWork = ({ kinds, isLoading, onLoad }) => {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const listId = useId();
    const toggle = useCallback(() => setOpen((v) => !v), []);
    const labelFor = (kind) => intl.formatMessage(kind === 'starter' ? startMessages.starter : startMessages[kind]);
    return (
        <React.Fragment>
            <button
                aria-controls={listId}
                aria-expanded={open}
                className={partStyles.textLink}
                data-testid="classroom-status-reload-toggle"
                disabled={isLoading}
                type="button"
                onClick={toggle}
            >
                {intl.formatMessage(messages.reload)}
                <span aria-hidden="true">{open ? ' ▴' : ' ▾'}</span>
            </button>
            {open && (
                <div
                    className={partStyles.welcomeReloadList}
                    data-testid="classroom-status-reload-options"
                    id={listId}
                >
                    {kinds.map((kind) => (
                        <StudentTextLink
                            dataTestId={`classroom-status-reload-${kind}`}
                            disabled={isLoading}
                            key={kind}
                            // eslint-disable-next-line react/jsx-no-bind
                            onClick={() => onLoad(kind)}
                        >
                            {labelFor(kind)}
                        </StudentTextLink>
                    ))}
                </div>
            )}
        </React.Fragment>
    );
};

ReloadWork.propTypes = {
    isLoading: PropTypes.bool,
    kinds: PropTypes.arrayOf(PropTypes.oneOf(RELOAD_KINDS)).isRequired,
    onLoad: PropTypes.func.isRequired,
};

/**
 * 「クラスから出る」の確認。確認の間は「出る」がこの画面のただ 1 つの主ボタン。
 * 開いたら「出る」にフォーカスを移す（押したリンクが消えてフォーカスが迷子にならないように）。
 * Esc は確認だけを閉じる（モーダルごと閉じない）。
 * @param {object} props - component props
 * @param {boolean} props.isLoading - 読み込み中
 * @param {Function} props.onCancel - 「やめる」・Esc
 * @param {Function} props.onConfirm - 「出る」
 * @returns {React.ReactElement} the confirm
 */
const LeaveConfirm = ({ isLoading, onCancel, onConfirm }) => {
    const intl = useIntl();
    const questionId = useId();
    const ref = useRef(null);
    useEffect(() => {
        ref.current?.querySelector('[data-testid="classroom-leave-confirm"]')?.focus();
    }, []);
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key !== 'Escape') return;
            // react-modal closes the whole modal on Esc from its content's onKeyDown.
            e.stopPropagation();
            onCancel();
        },
        [onCancel],
    );
    return (
        <div
            aria-labelledby={questionId}
            className={partStyles.welcomeLeaveDialog}
            data-testid="classroom-leave-dialog"
            ref={ref}
            role="alertdialog"
            onKeyDown={handleKeyDown}
        >
            <div className={partStyles.welcomeLeaveQuestion} id={questionId}>
                {intl.formatMessage(messages.leaveQuestion)}
            </div>
            <StudentMainButton dataTestId="classroom-leave-confirm" disabled={isLoading} onClick={onConfirm}>
                {intl.formatMessage(messages.leaveConfirm)}
            </StudentMainButton>
            <div className={partStyles.welcomeLinks}>
                <StudentTextLink dataTestId="classroom-leave-cancel" disabled={isLoading} onClick={onCancel}>
                    {intl.formatMessage(messages.leaveCancel)}
                </StudentTextLink>
            </div>
        </div>
    );
};

LeaveConfirm.propTypes = {
    isLoading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};

const StudentStatusView = ({
    classroomState,
    continueOptions = null,
    hasAssignment = false,
    hasStarter = false,
    lessonStatus = null,
    studentLesson = null,
    teacherComment = null,
    isLoading = false,
    error = null,
    errorTitle = null,
    errorActionLabel = null,
    errorActionHandler = null,
    onContinue,
    onLeaveClassroom,
    onLoadStarter,
    onLoadSubmission,
    onOpenAssignment,
    onRefreshStudentStatus,
    onStartLesson,
    onWrongSeat,
}) => {
    const intl = useIntl();
    const [confirmingLeave, setConfirmingLeave] = useState(false);
    // After 「やめる」 the focus goes back to 「クラスから出る」 (it was unmounted meanwhile).
    const [refocusLeave, setRefocusLeave] = useState(false);
    const leaveRef = useRef(null);
    const askLeave = useCallback(() => setConfirmingLeave(true), []);
    const cancelLeave = useCallback(() => {
        setConfirmingLeave(false);
        setRefocusLeave(true);
    }, []);
    useEffect(() => {
        if (!refocusLeave || confirmingLeave) return;
        setRefocusLeave(false);
        leaveRef.current?.querySelector('[data-testid="classroom-leave"]')?.focus();
    }, [refocusLeave, confirmingLeave]);
    const lesson = lessonStatus && studentLesson ? studentLesson : null;
    // A lesson assignment shows its submission only when it also asks for a work (#1599).
    const showSubmission = !lesson || lesson.submitWork;
    // Also when the lesson has challenges this build does not know yet: the
    // goal cannot be met here, and the student must still be able to submit.
    const lessonSubmitReady = !!lesson && canSubmitAssignment(lesson, lessonStatus);
    // The main button: 「レッスンを続ける」 until the lesson's goal is met, then 「つづける」
    // (make a work of one's own). The lesson stays reachable as a small link.
    const mainIsLesson = !!lesson && !lessonSubmitReady;
    const reloadKinds = RELOAD_KINDS.filter((kind) => (kind === 'starter' ? hasStarter : !!continueOptions?.[kind]));
    const handleReload = useCallback(
        (kind) => (kind === 'starter' ? onLoadStarter?.() : onLoadSubmission?.(kind)),
        [onLoadStarter, onLoadSubmission],
    );
    return (
        <div data-testid="classroom-phase-student-status">
            <div className={styles.phaseTitle} data-testid="classroom-status-title">
                <FormattedMessage
                    defaultMessage="Welcome back"
                    description="Student status title"
                    id="gui.classroom.studentStatus.title"
                />
            </div>
            <InfoLine
                classroomState={classroomState}
                isLoading={isLoading}
                showSubmission={showSubmission}
                onRefreshStudentStatus={onRefreshStudentStatus}
            />
            {lesson && <LessonProgressRow lessonStatus={lessonStatus} />}
            {classroomState.submissionStatus === 'returned' && teacherComment && (
                <div className={styles.teacherCommentBox} data-testid="classroom-status-teacher-comment">
                    <span className={styles.statusLabel}>
                        <FormattedMessage
                            defaultMessage="Teacher's Comment"
                            description="Teacher comment label"
                            id="gui.classroom.studentStatus.teacherComment"
                        />
                    </span>
                    <span className={styles.teacherCommentText}>{teacherComment}</span>
                </div>
            )}
            {/* Like the usual "submit when ready" hint: only until the first submission. */}
            {lessonSubmitReady && !classroomState.submissionStatus && (
                <div className={partStyles.startNotice} data-testid="classroom-status-lesson-submit-guide">
                    {intl.formatMessage(bandMessages.submitGuide)}
                </div>
            )}
            {confirmingLeave ? (
                <LeaveConfirm isLoading={isLoading} onCancel={cancelLeave} onConfirm={onLeaveClassroom} />
            ) : (
                <div className={partStyles.welcomeMain}>
                    {mainIsLesson ? (
                        <StudentMainButton
                            dataTestId="classroom-continue-lesson-button"
                            disabled={isLoading}
                            onClick={onStartLesson}
                        >
                            {continueLessonLabel}
                        </StudentMainButton>
                    ) : (
                        <StudentMainButton
                            dataTestId="classroom-status-continue"
                            disabled={isLoading}
                            note={intl.formatMessage(messages.continueNote)}
                            onClick={onContinue}
                        >
                            {intl.formatMessage(messages.continue)}
                        </StudentMainButton>
                    )}
                    <div className={partStyles.welcomeLinks}>
                        {lesson && !mainIsLesson && (
                            <StudentTextLink
                                dataTestId="classroom-continue-lesson-button"
                                disabled={isLoading}
                                onClick={onStartLesson}
                            >
                                {continueLessonLabel}
                            </StudentTextLink>
                        )}
                        {hasAssignment && onOpenAssignment && (
                            <StudentTextLink
                                dataTestId="classroom-view-assignment-button"
                                disabled={isLoading}
                                onClick={onOpenAssignment}
                            >
                                <FormattedMessage
                                    defaultMessage="View Assignment"
                                    description="Open the assignment panel from the student status view"
                                    id="gui.classroom.studentAssignment.viewButton"
                                />
                            </StudentTextLink>
                        )}
                        <StudentPeerViewButton disabled={isLoading} />
                        <StudentTextLink
                            dataTestId="classroom-status-wrong-seat"
                            disabled={isLoading}
                            onClick={onWrongSeat}
                        >
                            {intl.formatMessage(messages.wrongSeat)}
                        </StudentTextLink>
                        {reloadKinds.length > 0 && (
                            <ReloadWork isLoading={isLoading} kinds={reloadKinds} onLoad={handleReload} />
                        )}
                    </div>
                    {/* Away from the other links (right, bottom) so it is not pressed by mistake. */}
                    <div className={partStyles.welcomeLeave} ref={leaveRef}>
                        <StudentTextLink dataTestId="classroom-leave" disabled={isLoading} onClick={askLeave}>
                            <FormattedMessage
                                defaultMessage="Leave the class"
                                description="Small link on the welcome back screen; asks before leaving"
                                id="gui.classroom.studentStatus.leave"
                            />
                        </StudentTextLink>
                    </div>
                </div>
            )}
            <ErrorDisplay
                actionLabel={errorActionLabel}
                error={error}
                errorTitle={errorTitle}
                onAction={errorActionHandler}
            />
        </div>
    );
};

const submissionShape = PropTypes.shape({
    assignmentName: PropTypes.string,
    submittedAt: PropTypes.string,
});

StudentStatusView.propTypes = {
    classroomState: PropTypes.object.isRequired,
    // normalizeContinueOptions の結果（作品を読み込み直す: この課題・前回）
    continueOptions: PropTypes.shape({
        current: submissionShape,
        previous: submissionShape,
    }),
    error: PropTypes.string,
    errorActionHandler: PropTypes.func,
    errorActionLabel: PropTypes.string,
    errorTitle: PropTypes.string,
    hasAssignment: PropTypes.bool,
    // 課題にスターターがある（作品を読み込み直す: スターター）
    hasStarter: PropTypes.bool,
    isLoading: PropTypes.bool,
    // assignmentProgress() of the joined lesson assignment (null when not a lesson assignment)
    lessonStatus: PropTypes.object,
    // normalized lesson setting of the joined assignment
    studentLesson: PropTypes.shape({ submitWork: PropTypes.bool }),
    teacherComment: PropTypes.string,
    // 「つづける」: 何も読み込まずに閉じる
    onContinue: PropTypes.func.isRequired,
    onLeaveClassroom: PropTypes.func.isRequired,
    onLoadStarter: PropTypes.func,
    onLoadSubmission: PropTypes.func,
    onOpenAssignment: PropTypes.func,
    onRefreshStudentStatus: PropTypes.func.isRequired,
    onStartLesson: PropTypes.func,
    // 「出席番号がちがう」: いまの席を空けて同じ課題の番号選びへ
    onWrongSeat: PropTypes.func.isRequired,
};

export default StudentStatusView;
