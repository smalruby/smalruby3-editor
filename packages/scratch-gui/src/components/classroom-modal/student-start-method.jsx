/**
 * 参加したあとの始め方 (#1793)。
 *
 * 主ボタンは決めた始め方 1 つ（decideStartMethod）。押すとその作品で始まる（読み込んで
 * モーダルを閉じる）。ほかの始め方は小さなリンク「ほかの始め方」の中にしまい、開くと
 * 残りが小さなリンクで並ぶ。主ボタンと同じ重さのボタンを並べない（生徒が迷わないため。
 * docs/classroom/ui-ux.md の「生徒の画面の決まり」「始め方を決める順番」）。
 *
 * 参加しただけでは何も読み込まない（押したときに 1 回だけ読み込む）。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    CLASSROOM_STUDENT_EVENTS,
    noteClassroomStudentView,
    secondsSince,
} from '../../lib/classroom-student-analytics.js';
import { activeNow } from '../../lib/lessons/lesson-analytics.js';
import StudentMainButton from './student-main-button.jsx';
import styles from './student-screen-parts.css';
import StudentTextLink from './student-text-link.jsx';

const messages = defineMessages({
    current: {
        defaultMessage: 'Continue from what you submitted for this assignment',
        description: 'Start method: open the project already submitted for this assignment',
        id: 'gui.classroom.startMethod.current',
    },
    previous: {
        defaultMessage: "Continue from last time's work",
        description: 'Start method: open the project submitted in the previous assignment of the same class',
        id: 'gui.classroom.startMethod.previous',
    },
    starter: {
        defaultMessage: 'Start from the starter',
        description: 'Choice: open the assignment starter project',
        id: 'gui.classroom.continueChoice.starter',
    },
    start: {
        defaultMessage: 'Start',
        description: 'Close button after joining',
        id: 'gui.classroom.studentJoined.start',
    },
    keepLink: {
        defaultMessage: 'Start with the project as it is',
        description: 'Choice: start working without loading any project',
        id: 'gui.classroom.continueChoice.keep',
    },
    currentNote: {
        defaultMessage: 'Submitted {date}',
        description: 'Second line of the start button: when this assignment was submitted',
        id: 'gui.classroom.startMethod.currentNote',
    },
    previousNote: {
        defaultMessage: '“{assignmentName}” submitted {date}',
        description: 'Second line of the start button: which assignment last time’s work is from and when',
        id: 'gui.classroom.startMethod.previousNote',
    },
    starterNote: {
        defaultMessage: 'Make it from the project your teacher prepared',
        description: 'Choice detail: what the starter project is',
        id: 'gui.classroom.continueChoice.starterDetail',
    },
    keepNote: {
        defaultMessage: 'Keep making the project you have open',
        description: 'Second line of the start button when there is nothing to open',
        id: 'gui.classroom.startMethod.keepNote',
    },
    others: {
        defaultMessage: 'Other ways to start',
        description: 'Small link that shows the other ways to start under the main button',
        id: 'gui.classroom.startMethod.others',
    },
});

// 生徒が選んだ言語で日時を書く（ブラウザの言語ではなく。英語の PC でも「10:00」と出す）。
const formatSubmittedAt = (iso, locale) =>
    iso
        ? new Date(iso).toLocaleString(locale, {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';

/**
 * 始め方の文字（主ボタンと「ほかの始め方」のリンクで同じ）。
 * @param {object} intl - react-intl
 * @param {string} kind - 始め方
 * @param {boolean} asLink - 「ほかの始め方」のリンクのとき
 * @returns {string} 文字
 */
const labelFor = (intl, kind, asLink) => {
    if (kind === 'keep') return intl.formatMessage(asLink ? messages.keepLink : messages.start);
    if (kind === 'lesson') return intl.formatMessage(messages.start);
    return intl.formatMessage(messages[kind]);
};

/**
 * 主ボタンの 2 行目（何を開くか）。
 * @param {object} intl - react-intl
 * @param {string} kind - 始め方
 * @param {?object} continueOptions - normalizeContinueOptions の結果
 * @returns {?string} 2 行目（無ければ null）
 */
const noteFor = (intl, kind, continueOptions) => {
    if (kind === 'current') {
        const date = formatSubmittedAt(continueOptions?.current?.submittedAt, intl.locale);
        return date ? intl.formatMessage(messages.currentNote, { date }) : null;
    }
    if (kind === 'previous') {
        const previous = continueOptions?.previous;
        const date = formatSubmittedAt(previous?.submittedAt, intl.locale);
        if (previous?.assignmentName) {
            return intl.formatMessage(messages.previousNote, { assignmentName: previous.assignmentName, date });
        }
        return date ? intl.formatMessage(messages.currentNote, { date }) : null;
    }
    if (kind === 'starter') return intl.formatMessage(messages.starterNote);
    if (kind === 'keep') return intl.formatMessage(messages.keepNote);
    return null;
};

const StudentStartMethod = ({
    continueOptions = null,
    isLoading = false,
    method,
    onKeepCurrent,
    onLoadStarter,
    onLoadSubmission,
    onStartLesson,
    onTrack,
    now = activeNow,
}) => {
    const intl = useIntl();
    const [othersOpen, setOthersOpen] = useState(false);
    const othersId = useId();
    // GA (#1831): start_view once when the choices come up, start_choose with the seconds since.
    // Coming back to the last page of the assignment panel or switching between the PC and the
    // mobile layout mounts this again: noteClassroomStudentView keeps it to one view (and its time).
    const shownAtRef = useRef(null);
    const othersOpenedRef = useRef(false);
    useEffect(() => {
        const { send, at } = noteClassroomStudentView('start', now());
        shownAtRef.current = at;
        if (!send) return;
        onTrack?.(CLASSROOM_STUDENT_EVENTS.START_VIEW, {
            main: method.main,
            others_count: (method.others || []).length,
        });
        // Only when it comes up, not on every change of the props.
    }, []);
    const start = useCallback(
        (kind, via = 'main') => {
            onTrack?.(CLASSROOM_STUDENT_EVENTS.START_CHOOSE, {
                kind,
                via,
                others_opened: othersOpenedRef.current,
                seconds: secondsSince(shownAtRef.current, now()),
            });
            if (kind === 'starter') onLoadStarter?.();
            else if (kind === 'previous' || kind === 'current') onLoadSubmission?.(kind);
            else if (kind === 'lesson') onStartLesson?.();
            else onKeepCurrent?.();
        },
        [onKeepCurrent, onLoadStarter, onLoadSubmission, onStartLesson, onTrack, now],
    );
    const handleMain = useCallback(() => start(method.main), [start, method.main]);
    const toggleOthers = useCallback(() => {
        othersOpenedRef.current = true;
        setOthersOpen((open) => !open);
    }, []);
    const others = method.others || [];
    return (
        <div className={styles.startMethod} data-main={method.main} data-testid="classroom-start-method">
            <StudentMainButton
                dataTestId="classroom-start-main"
                disabled={isLoading}
                note={noteFor(intl, method.main, continueOptions)}
                onClick={handleMain}
            >
                {labelFor(intl, method.main, false)}
            </StudentMainButton>
            {others.length > 0 && (
                <div className={styles.startOthers}>
                    <button
                        aria-controls={othersId}
                        aria-expanded={othersOpen}
                        className={styles.textLink}
                        data-testid="classroom-start-others-toggle"
                        disabled={isLoading}
                        type="button"
                        onClick={toggleOthers}
                    >
                        {intl.formatMessage(messages.others)}
                        <span aria-hidden="true">{othersOpen ? ' ▴' : ' ▾'}</span>
                    </button>
                    {othersOpen && (
                        <div className={styles.startOthersList} data-testid="classroom-start-others" id={othersId}>
                            {others.map((kind) => (
                                <StudentTextLink
                                    dataTestId={`classroom-start-other-${kind}`}
                                    disabled={isLoading}
                                    key={kind}
                                    // eslint-disable-next-line react/jsx-no-bind
                                    onClick={() => start(kind, 'others')}
                                >
                                    {labelFor(intl, kind, true)}
                                </StudentTextLink>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const submissionShape = PropTypes.shape({
    assignmentName: PropTypes.string,
    submittedAt: PropTypes.string,
});

StudentStartMethod.propTypes = {
    continueOptions: PropTypes.shape({
        current: submissionShape,
        previous: submissionShape,
    }),
    isLoading: PropTypes.bool,
    // decideStartMethod の結果
    method: PropTypes.shape({
        main: PropTypes.oneOf(['current', 'previous', 'starter', 'keep', 'lesson']).isRequired,
        others: PropTypes.arrayOf(PropTypes.oneOf(['current', 'previous', 'starter', 'keep'])),
    }).isRequired,
    onKeepCurrent: PropTypes.func,
    onLoadStarter: PropTypes.func,
    onLoadSubmission: PropTypes.func,
    onStartLesson: PropTypes.func,
    // sends a classroom_student GA event: (action, params) (#1831)
    onTrack: PropTypes.func,
    // テスト用: タブが裏にあった時間を引いた時計
    now: PropTypes.func,
};

export { formatSubmittedAt, messages };
export default StudentStartMethod;
