import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import intlShape from '../../lib/intlShape.js';
import { COMPLETED_ACTIONS } from '../../lib/lessons/lesson-progress.js';
import { messages as bandMessages } from '../lesson-assignment-band/lesson-assignment-band.jsx';
import LessonCompletedQuiz from './lesson-completed-quiz.jsx';
import styles from './lesson-completed-toast.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessons.completed.title',
        defaultMessage: 'You did it!',
        description: 'Title of the toast shown when a lesson challenge is completed (the lesson is not done yet)',
    },
    remaining: {
        id: 'gui.lessons.completed.remaining',
        defaultMessage: '{count} more in this lesson',
        description: 'Shown on the completed toast under the dots: how many challenges of the lesson are left',
    },
    lessonTitle: {
        id: 'gui.lessons.completed.lessonTitle',
        defaultMessage: 'Lesson {number} complete!',
        description: 'Title of the completed toast when every challenge of the lesson is done',
    },
    lessonDetail: {
        id: 'gui.lessons.completed.lessonDetail',
        defaultMessage: 'You finished all {count} challenges of "{name}".',
        description:
            'Second line of the completed toast when every challenge of the lesson is done and the course has ' +
            'another lesson to do. {name} is the lesson name, {count} the number of its challenges',
    },
    lessonTitleSome: {
        id: 'gui.lessons.completed.lessonTitleSome',
        defaultMessage: 'Lesson {number} cleared!',
        description:
            'Title of the completed toast when a lesson needs only some of its challenges (the themes to choose ' +
            'from) and that many are done, but not all',
    },
    lessonDetailSome: {
        id: 'gui.lessons.completed.lessonDetailSome',
        defaultMessage: 'You finished {count} of the challenges of "{name}". That is enough for this lesson.',
        description:
            'Second line of the completed toast when a lesson needs only some of its challenges (the themes to ' +
            'choose from) and that many are done. {name} is the lesson name, {count} the number done',
    },
    courseDetail: {
        id: 'gui.lessons.completed.courseDetail',
        defaultMessage: 'That was every lesson in "{course}".',
        description:
            'Second line of the completed toast when every challenge of the lesson is done and no lesson of ' +
            'the course is left. {course} is the course name',
    },
    next: {
        id: 'gui.lessons.completed.next',
        defaultMessage: 'Next challenge',
        description: 'Button on the completed toast that opens the lessons library at the current lesson',
    },
    nextLesson: {
        id: 'gui.lessons.completed.nextLesson',
        defaultMessage: 'Next lesson',
        description:
            'Button on the completed toast when every challenge of the lesson is done and the course has a next ' +
            'lesson; opens the lessons library at the next lesson',
    },
    library: {
        id: 'gui.lessons.completed.library',
        defaultMessage: 'Go to the lessons',
        description:
            'Button on the completed toast when every challenge of the lesson is done and there is no next ' +
            'lesson; opens the lessons library',
    },
    assignmentTitle: {
        id: 'gui.lessons.completed.assignmentTitle',
        defaultMessage: 'Assignment cleared!',
        description:
            'Title of the completed toast when this challenge met the completion condition of the class assignment ' +
            '(shown once, instead of "Lesson n complete!")',
    },
    assignmentDetail: {
        id: 'gui.lessons.completed.assignmentDetail',
        defaultMessage: 'You met the goal of "{name}".',
        description:
            'Second line of the completed toast when the class assignment is cleared (no work to submit). ' +
            '{name} is the assignment name',
    },
    assignmentDetailNoName: {
        id: 'gui.lessons.completed.assignmentDetailNoName',
        defaultMessage: 'You met the goal of the assignment.',
        description: 'Second line of the completed toast when the class assignment (without a name) is cleared',
    },
    skipDetail: {
        id: 'gui.lessons.completed.skipDetail',
        defaultMessage:
            'All correct without a single mistake! If you already know the screen, you can go on to lesson {number}.',
        description:
            'Line of the completed toast of the "where is it?" quiz of lesson 0 when every question was answered ' +
            'right on the first click: the student may skip the rest of the lesson. {number} is the next lesson',
    },
    skipLesson: {
        id: 'gui.lessons.completed.skipLesson',
        defaultMessage: 'Go to lesson {number}',
        description:
            'Button on the completed toast of a perfect "where is it?" quiz: skips the rest of lesson 0 and starts ' +
            'the next lesson. {number} is the next lesson',
    },
    continueLesson: {
        id: 'gui.lessons.completed.continueLesson',
        defaultMessage: 'Keep going with lesson {number}',
        description:
            'Main button on the completed toast of a perfect "where is it?" quiz (instead of "Next challenge"): ' +
            'goes on with the current lesson. {number} is the current lesson',
    },
    readinessOk: {
        id: 'gui.lessons.readiness.ok',
        defaultMessage: 'Ready to go!',
        description: 'Result of the readiness check when every question was answered right on the first try',
    },
    readinessOkDetail: {
        id: 'gui.lessons.readiness.okDetail',
        defaultMessage: 'All {count} right on the first try. You know the basics of this course.',
        description: 'Line under "Ready to go!" of the readiness check. {count} is the number of questions',
    },
    readinessScore: {
        id: 'gui.lessons.readiness.score',
        defaultMessage: '{correct} of {count} right',
        description: 'Score of the readiness check: questions answered right on the first try / all questions',
    },
    readinessRecommended: {
        id: 'gui.lessons.readiness.recommended',
        defaultMessage: 'Recommended',
        description:
            'Heading of the challenges recommended by the readiness check (the questions the student missed)',
    },
    readinessRecommendedDetail: {
        id: 'gui.lessons.readiness.recommendedDetail',
        defaultMessage: 'You can practice what you missed in these challenges. It is up to you to do them.',
        description: 'Line under the "Recommended" heading of the readiness check result',
    },
    close: {
        id: 'gui.lessons.completed.close',
        defaultMessage: 'Keep looking',
        description: 'Second button on the completed toast; just closes it',
    },
});

// ボタンの文言（COMPLETED_ACTIONS ごと）
const BUTTON_MESSAGES = {
    [COMPLETED_ACTIONS.NEXT]: messages.next,
    [COMPLETED_ACTIONS.OTHER_LESSONS]: messages.nextLesson,
    [COMPLETED_ACTIONS.LIBRARY]: messages.library,
};

/**
 * 「できた！」の表示（#1589）。場面は 3 つ（`action` で決まる）。クラスの課題の条件をはじめて満たしたときは、
 * それより優先して「課題クリア！」（#1599。作品も提出する課題では案内と「課題を提出する」）:
 *   - next: チャレンジができた（レッスンの途中）。「できた！」＋レッスンの中のできた数の丸＋「あと n つ」（青）
 *   - otherLessons: レッスンのチャレンジが全部できた。「レッスン n ぜんぶできた！」＋レッスン名の行（オレンジ・🏆）
 *   - library: 全部できて、後ろに残っているレッスンが無い。2 行目はコース名の行（コースが全部できたとき。
 *     前のレッスンを飛ばしているときはレッスン名の行）（オレンジ・🏆）
 * チャレンジの名前は出さない（課題バーに出ている）。「もう少し見る」は閉じるだけ。
 * レッスンを飛ばせるとき（`skipLesson`。「どこでしょう？」を 1 回もまちがえずに全部答えた・lesson-progress.js の
 * lessonSkipOffer）は、「できた！」の場面だけ、そのことを書いた行と「レッスン n へ進む」を足し、主ボタンを
 * 「続けてレッスン n をやる」にする（主ボタンの動きは「次のチャレンジへ」と同じ）。
 * @param {object} props - props。
 * @param {string} props.action - 場面（lesson-progress.js の COMPLETED_ACTIONS）。
 * @param {Array<object>} props.assignmentChallenges - 課題クリアのときの、課題のチャレンジ（丸）。
 * @param {boolean} props.assignmentCleared - この「できた」ではじめて課題クリアになったか（「課題クリア！」）。
 * @param {?string} props.assignmentName - 課題の名前。
 * @param {?Function} props.onSubmitAssignment - 作品も提出する課題の「課題を提出する」。
 * @param {string} props.challengeId - できたチャレンジ id（`data-challenge-id`。テストが見る）。
 * @param {Array<{id: string, completed: boolean}>} props.challenges - レッスンのチャレンジ（並び順）。
 * @param {boolean} props.courseCompleted - コースのチャレンジが全部できたか（library の 2 行目を決める）。
 * @param {object} props.courseName - コース名（message descriptor）。
 * @param {number} props.lessonNumber - コースの中のレッスンの番号。
 * @param {object} props.lessonName - レッスン名（message descriptor）。
 * @param {Function} props.onClose - 「もう少し見る」（閉じる）。
 * @param {Function} props.onNextChallenge - 「次のチャレンジへ」など（レッスン表を開く）。
 * @param {boolean} props.hidden - いっとき隠すか（描いたまま見えなくする。クイズで選んだものを残す・#1639）。
 * @param {?object} props.quiz - できたチャレンジのふりかえりのクイズ（#1639。無ければ出さない）。
 * @param {?{lessonNumber: number}} props.skipLesson - 飛ばして進めるレッスン（無ければ出さない）。
 * @param {?Function} props.onSkipLesson - 「レッスン n へ進む」。
 * @param {?object} props.readiness - じゅんびチェックの結果（#2299。じゅんびチェックの「できた！」だけ）。全部 1 回で
 *   正解なら「じゅんび OK！」、ほかは正解の数と「おすすめ」のチャレンジ（押すとそのチャレンジを開く）。
 * @param {?Function} props.onOpenRecommended - 「おすすめ」のチャレンジを開く（チャレンジ id を渡す）。
 * @param {object} props.intl - react-intl。
 * @returns {React.ReactElement} toast。
 */
const LessonCompletedToast = ({
    action = COMPLETED_ACTIONS.NEXT,
    assignmentChallenges = [],
    assignmentCleared = false,
    assignmentName = null,
    onSubmitAssignment = null,
    challengeId,
    challenges = [],
    courseCompleted = false,
    courseName,
    hidden = false,
    lessonName,
    lessonNumber,
    onClose,
    onNextChallenge,
    quiz = null,
    skipLesson = null,
    onSkipLesson = null,
    readiness = null,
    onOpenRecommended = null,
    intl,
}) => {
    const handleOpenRecommended = useCallback(
        (event) => {
            if (onOpenRecommended) onOpenRecommended(event.currentTarget.dataset.challengeId);
        },
        [onOpenRecommended],
    );
    // 課題クリア（#1599）: 段 1 の「レッスン n ぜんぶできた！」より優先。同じお祝いの形で、丸は課題のチャレンジ
    const lessonDone = assignmentCleared || action !== COMPLETED_ACTIONS.NEXT;
    const dots = assignmentCleared ? assignmentChallenges : challenges;
    const total = dots.length;
    const remaining = challenges.filter((c) => !c.completed).length;
    // 「できた！」の場面（レッスンの途中・課題クリアでない）でだけ、レッスンを飛ばす道を出す
    const skip = !lessonDone && skipLesson && onSkipLesson && onNextChallenge ? skipLesson : null;
    let detail = null;
    // 「これで全部です」はコースのチャレンジが全部できたときだけ。library は「後ろに残っているレッスンが無い」
    // だけなので、前のレッスンを飛ばした生徒には出さず、レッスン名の行にする
    if (assignmentCleared) {
        if (onSubmitAssignment) detail = intl.formatMessage(bandMessages.submitGuide);
        else if (assignmentName) detail = intl.formatMessage(messages.assignmentDetail, { name: assignmentName });
        else detail = intl.formatMessage(messages.assignmentDetailNoName);
    } else if (action === COMPLETED_ACTIONS.LIBRARY && courseCompleted && courseName) {
        detail = intl.formatMessage(messages.courseDetail, { course: intl.formatMessage(courseName) });
    } else if (lessonDone && lessonName && remaining > 0) {
        // テーマを選ぶレッスン（checkCount がチャレンジの数より少ない）: できた数だけ書く（「全部」と言わない）
        detail = intl.formatMessage(messages.lessonDetailSome, {
            name: intl.formatMessage(lessonName),
            count: total - remaining,
        });
    } else if (lessonDone && lessonName) {
        detail = intl.formatMessage(messages.lessonDetail, { name: intl.formatMessage(lessonName), count: total });
    }
    return (
        <div
            className={classNames(styles.toast, {
                [styles.lessonDone]: lessonDone,
                [styles.withQuiz]: quiz || readiness,
            })}
            role="status"
            hidden={hidden}
            data-testid="lesson-completed-toast"
            data-action={action}
            data-assignment-cleared={assignmentCleared ? 'true' : 'false'}
            data-challenge-id={challengeId}
            data-has-quiz={quiz ? 'true' : 'false'}
        >
            <span className={styles.icon} aria-hidden="true">
                {lessonDone ? '🏆' : '🎉'}
            </span>
            <div className={styles.body}>
                <div className={styles.title} data-testid="lesson-completed-toast-title">
                    {assignmentCleared
                        ? intl.formatMessage(messages.assignmentTitle)
                        : lessonDone
                          ? intl.formatMessage(
                                // テーマを選ぶレッスンで残りがあるときは「ぜんぶ」と言わない
                                remaining > 0 ? messages.lessonTitleSome : messages.lessonTitle,
                                { number: lessonNumber },
                            )
                          : intl.formatMessage(messages.title)}
                </div>
                <div className={styles.progress}>
                    {total > 0 && (
                        <span className={styles.dots} data-testid="lesson-completed-toast-dots" aria-hidden="true">
                            {dots.map((c) => (
                                <span
                                    key={c.id}
                                    className={classNames(styles.dot, {
                                        [styles.dotRequired]: c.required,
                                        [styles.dotCompleted]: c.completed,
                                        [styles.dotCurrent]: c.id === challengeId,
                                    })}
                                    data-testid="lesson-completed-toast-dot"
                                    data-completed={c.completed ? 'true' : 'false'}
                                    data-current={c.id === challengeId ? 'true' : 'false'}
                                >
                                    {c.required ? '★' : null}
                                </span>
                            ))}
                        </span>
                    )}
                    {lessonDone
                        ? detail && (
                              <span className={styles.detail} data-testid="lesson-completed-toast-detail">
                                  {detail}
                              </span>
                          )
                        : total > 0 && (
                              <span className={styles.detail} data-testid="lesson-completed-toast-remaining">
                                  {intl.formatMessage(messages.remaining, { count: remaining })}
                              </span>
                          )}
                </div>
                {/* ふりかえりのクイズ（#1639）: どの場面（できた！／レッスン n ぜんぶできた！／課題クリア！）でも出す。
                    答えなくてもボタンで先へ進める。チャレンジが変わったら選んだものを消す（key） */}
                {quiz && <LessonCompletedQuiz key={challengeId} quiz={quiz} />}
                {readiness && (
                    <div
                        className={styles.readiness}
                        data-testid="lesson-readiness-result"
                        data-all-correct={readiness.allCorrect ? 'true' : 'false'}
                    >
                        {readiness.allCorrect ? (
                            <>
                                <div className={styles.readinessTitle} data-testid="lesson-readiness-result-ok">
                                    {intl.formatMessage(messages.readinessOk)}
                                </div>
                                <div className={styles.readinessDetail}>
                                    {intl.formatMessage(messages.readinessOkDetail, { count: readiness.total })}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={styles.readinessDetail} data-testid="lesson-readiness-result-score">
                                    {intl.formatMessage(messages.readinessScore, {
                                        correct: readiness.correctCount,
                                        count: readiness.total,
                                    })}
                                </div>
                                {readiness.recommended.length > 0 && (
                                    <>
                                        <div className={styles.readinessTitle}>
                                            {intl.formatMessage(messages.readinessRecommended)}
                                        </div>
                                        <div className={styles.readinessDetail}>
                                            {intl.formatMessage(messages.readinessRecommendedDetail)}
                                        </div>
                                        <ul className={styles.recommendedList}>
                                            {readiness.recommended.map((r) => (
                                                <li key={r.id}>
                                                    <button
                                                        type="button"
                                                        className={styles.recommended}
                                                        onClick={handleOpenRecommended}
                                                        disabled={!onOpenRecommended}
                                                        data-testid="lesson-readiness-recommended"
                                                        data-challenge-id={r.id}
                                                    >
                                                        <span className={styles.recommendedName}>
                                                            {intl.formatMessage(r.name)}
                                                        </span>
                                                        <span className={styles.recommendedWhere}>
                                                            {`${intl.formatMessage(r.courseName)} ${r.lessonNumber}-${r.number}`}
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
                {skip && (
                    <div className={styles.skipDetail} data-testid="lesson-completed-toast-skip-detail">
                        {intl.formatMessage(messages.skipDetail, { number: skip.lessonNumber })}
                    </div>
                )}
                <div className={styles.actions}>
                    {assignmentCleared && onSubmitAssignment ? (
                        <button
                            type="button"
                            className={styles.next}
                            onClick={onSubmitAssignment}
                            data-testid="lesson-completed-toast-submit"
                        >
                            {intl.formatMessage(bandMessages.submit)}
                        </button>
                    ) : onNextChallenge ? (
                        <button
                            type="button"
                            className={styles.next}
                            onClick={onNextChallenge}
                            data-testid="lesson-completed-toast-next"
                            data-action={action}
                        >
                            {skip
                                ? intl.formatMessage(messages.continueLesson, { number: lessonNumber })
                                : intl.formatMessage(BUTTON_MESSAGES[action])}
                        </button>
                    ) : null}
                    {skip && (
                        <button
                            type="button"
                            className={styles.close}
                            onClick={onSkipLesson}
                            data-testid="lesson-completed-toast-skip"
                            data-lesson-number={skip.lessonNumber}
                        >
                            {intl.formatMessage(messages.skipLesson, { number: skip.lessonNumber })}
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.close}
                        onClick={onClose}
                        data-testid="lesson-completed-toast-close"
                    >
                        {intl.formatMessage(messages.close)}
                    </button>
                </div>
            </div>
        </div>
    );
};

LessonCompletedToast.propTypes = {
    // 場面。next =「できた！」、otherLessons / library はレッスンのチャレンジが全部できたとき。
    // 決め方は lesson-progress.js の completedAction
    action: PropTypes.oneOf(Object.values(COMPLETED_ACTIONS)),
    // 課題クリアのとき（#1599）の、課題のチャレンジ（丸。★ は必須）
    assignmentChallenges: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            completed: PropTypes.bool.isRequired,
            required: PropTypes.bool,
        }),
    ),
    // この「できた」ではじめてクラスの課題の条件を満たしたか（「課題クリア！」を出す）
    assignmentCleared: PropTypes.bool,
    assignmentName: PropTypes.string,
    // 作品も提出する課題の「課題を提出する」。課題クリアのときだけ主ボタンにする
    onSubmitAssignment: PropTypes.func,
    challengeId: PropTypes.string,
    // レッスンのチャレンジ（丸の数と塗り。いまできた `challengeId` は強調）
    challenges: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            completed: PropTypes.bool.isRequired,
        }),
    ),
    // コースのチャレンジが全部できたか。library のとき、true なら「これで全部です」、false ならレッスン名の行
    courseCompleted: PropTypes.bool,
    courseName: PropTypes.object,
    // いっとき隠す（課題バーの全文を開いているあいだ）。閉じたのとちがい、クイズで選んだものは残る
    hidden: PropTypes.bool,
    intl: intlShape.isRequired,
    lessonName: PropTypes.object,
    lessonNumber: PropTypes.number,
    onClose: PropTypes.func.isRequired,
    // 「次のチャレンジへ」など。レッスン表を開く。無ければボタンを出さない
    onNextChallenge: PropTypes.func,
    // 「レッスン n へ進む」（レッスンを飛ばす）。skipLesson と onNextChallenge もあるときだけ出す
    onSkipLesson: PropTypes.func,
    // 飛ばして進めるレッスン（lesson-progress.js の lessonSkipOffer）。無ければ出さない
    skipLesson: PropTypes.shape({ lessonNumber: PropTypes.number.isRequired }),
    // 「おすすめ」のチャレンジを開く（チャレンジ id）。readiness があるときだけ
    onOpenRecommended: PropTypes.func,
    // じゅんびチェックの結果（containers/lesson-goal-watcher.jsx が lib/lessons/readiness.js から作る）
    readiness: PropTypes.shape({
        allCorrect: PropTypes.bool.isRequired,
        correctCount: PropTypes.number.isRequired,
        total: PropTypes.number.isRequired,
        recommended: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.string.isRequired,
                name: PropTypes.object.isRequired,
                courseName: PropTypes.object.isRequired,
                lessonNumber: PropTypes.number.isRequired,
                number: PropTypes.number.isRequired,
            }),
        ).isRequired,
    }),
    // ふりかえりのクイズ（courses.js の challengeQuiz の形）。無ければ出さない
    quiz: PropTypes.shape({
        question: PropTypes.object.isRequired,
        choices: PropTypes.arrayOf(PropTypes.object).isRequired,
        answer: PropTypes.number.isRequired,
        explanation: PropTypes.object.isRequired,
    }),
};

export { messages };
export default injectIntl(LessonCompletedToast);
