// レッスン表のコンテナ。gui.jsx に常時マウントし、modals.lessonsLibrary が true の間だけ
// レッスン表（components/lessons-library）を出す。
//   - 開くたびに reloadProgress()（別のタブが書いた記録を写しに取り込む）
//   - チャレンジを押すと startChallenge(id)（containers/lesson-mode.jsx が開く流れを進める）
//     → レッスン表を閉じる
//   - 「できた！」の「次のチャレンジ」で開いたとき（lessonMode.libraryFocusChallengeId・#1520）は、
//     そのレッスンへスクロールし、次のまだできていないチャレンジを目立たせる。閉じるときに消す
//   - クラスのレッスンの課題に参加しているとき（classroom.studentLesson・#1599）は、上に課題の帯を出し、
//     先生が必須にしたチャレンジに ★ を付ける。「はじめる」「レッスンを続ける」で開いたとき
//     （lessonMode.libraryAssignmentOnly）は、課題のコースの課題のチャレンジだけを出し、次にやる課題の
//     チャレンジに「次はこれ！」。メニューの「レッスン」から開いたときはコース全体＋課題の帯
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo } from 'react';
import { connect } from 'react-redux';
import LessonAssignmentBand from '../components/lesson-assignment-band/lesson-assignment-band.jsx';
import LessonsLibraryComponent from '../components/lessons-library/lessons-library.jsx';
import {
    assignmentLibraryFocus,
    assignmentProgress,
    canSubmitAssignment,
    isAssignmentChallenge,
} from '../lib/lessons/assignment-progress';
import { COURSES, findCourse } from '../lib/lessons/courses';
import { lessonsLibraryFocus } from '../lib/lessons/lesson-progress';
import { requestStudentSubmit, selectStudentLesson } from '../reducers/classroom';
import { clearLessonsLibraryFocus, reloadProgress, startChallenge } from '../reducers/lesson-mode';
import { closeLessonsLibrary } from '../reducers/modals';

const LessonsLibrary = ({
    assignmentName = null,
    assignmentOnly = false,
    colorMode,
    focusChallengeId = null,
    lesson = null,
    onReloadProgress,
    onRequestClose,
    onStartChallenge,
    onSubmitAssignment,
    progress,
    submitted = false,
    visible,
}) => {
    useEffect(() => {
        if (visible) onReloadProgress();
    }, [visible, onReloadProgress]);

    // 課題のコースがこの版に無いとき（版のずれ）は、課題だけの表示をあきらめてコース全体を出す
    const assignmentCourse = lesson ? findCourse(lesson.courseId) : null;
    const restricted = assignmentOnly && Boolean(assignmentCourse);
    const focus = useMemo(() => {
        if (restricted) return assignmentLibraryFocus(lesson, progress, focusChallengeId);
        return focusChallengeId === null ? null : lessonsLibraryFocus(focusChallengeId, progress);
    }, [restricted, lesson, focusChallengeId, progress]);
    const status = useMemo(() => assignmentProgress(lesson, progress), [lesson, progress]);
    const courses = useMemo(() => (restricted ? [assignmentCourse] : COURSES), [restricted, assignmentCourse]);

    const handleSelectChallenge = useCallback(
        (challengeId) => {
            // 課題のチャレンジを開いたときだけ「課題から」（GA の計測・クラスへ送る分 #1600）
            onStartChallenge(challengeId, { fromAssignment: isAssignmentChallenge(lesson, challengeId) });
            onRequestClose();
        },
        [lesson, onRequestClose, onStartChallenge],
    );

    const handleSubmitAssignment = useCallback(() => {
        onRequestClose();
        onSubmitAssignment();
    }, [onRequestClose, onSubmitAssignment]);

    if (!visible) return null;
    return (
        <LessonsLibraryComponent
            assignmentBand={
                status ? (
                    <LessonAssignmentBand
                        assignmentName={assignmentName}
                        completionAll={lesson.completion.type !== 'count'}
                        canSubmit={canSubmitAssignment(lesson, status)}
                        status={status}
                        submitted={submitted}
                        onSubmit={handleSubmitAssignment}
                    />
                ) : null
            }
            assignmentChallengeIds={restricted ? lesson.challengeIds : null}
            colorMode={colorMode}
            courses={courses}
            progress={progress}
            requiredChallengeIds={lesson ? lesson.requiredChallengeIds : []}
            {...(focus ? { initialLanguage: focus.language } : {})}
            focusLessonId={focus ? focus.lessonId : null}
            nextChallengeId={focus ? focus.nextChallengeId : null}
            onRequestClose={onRequestClose}
            onSelectChallenge={handleSelectChallenge}
        />
    );
};

LessonsLibrary.propTypes = {
    // 参加している課題の名前（課題の帯に出す）
    assignmentName: PropTypes.string,
    // 課題のチャレンジだけで開くか（「はじめる」「レッスンを続ける」）
    assignmentOnly: PropTypes.bool,
    // 色のモード。カードの帯をブロックと同じ色にする
    colorMode: PropTypes.string.isRequired,
    // 「次のチャレンジ」で開いたときの、いまのチャレンジ id（null ならふつうに開く）
    focusChallengeId: PropTypes.string,
    // 参加している課題のレッスンの設定（assignment-progress.js の normalizeAssignmentLesson）。無ければ null
    lesson: PropTypes.shape({
        courseId: PropTypes.string.isRequired,
        challengeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
        requiredChallengeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
        completion: PropTypes.shape({ type: PropTypes.string.isRequired }).isRequired,
        submitWork: PropTypes.bool.isRequired,
    }),
    onReloadProgress: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onStartChallenge: PropTypes.func.isRequired,
    onSubmitAssignment: PropTypes.func.isRequired,
    progress: PropTypes.shape({ challenges: PropTypes.object.isRequired }).isRequired,
    // 作品をもう提出したか（帯の提出の案内はクラスの画面と同じく、はじめて提出するまで）
    submitted: PropTypes.bool,
    visible: PropTypes.bool.isRequired,
};

const mapStateToProps = (state) => ({
    assignmentName: state.scratchGui.classroom ? state.scratchGui.classroom.assignmentName : null,
    assignmentOnly: Boolean(state.scratchGui.lessonMode.libraryAssignmentOnly),
    lesson: selectStudentLesson(state),
    submitted: Boolean(state.scratchGui.classroom && state.scratchGui.classroom.submissionStatus),
    colorMode: state.scratchGui.settings.colorMode,
    focusChallengeId: state.scratchGui.lessonMode.libraryFocusChallengeId,
    progress: state.scratchGui.lessonMode.progress,
    visible: state.scratchGui.modals.lessonsLibrary,
});

const mapDispatchToProps = (dispatch) => ({
    onReloadProgress: () => dispatch(reloadProgress()),
    onRequestClose: () => {
        dispatch(closeLessonsLibrary());
        dispatch(clearLessonsLibraryFocus());
    },
    onStartChallenge: (challengeId, options) => dispatch(startChallenge(challengeId, options)),
    onSubmitAssignment: () => dispatch(requestStudentSubmit('lessons_library')),
});

export { LessonsLibrary };
export default connect(mapStateToProps, mapDispatchToProps)(LessonsLibrary);
