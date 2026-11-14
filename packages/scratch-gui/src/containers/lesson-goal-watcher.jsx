import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { connect } from 'react-redux';
import LessonCompletedToast from '../components/lesson-completed-toast/lesson-completed-toast.jsx';
import { assignmentProgress, isAssignmentJustCleared } from '../lib/lessons/assignment-progress.js';
import { findChallenge } from '../lib/lessons/courses.js';
import { attachGoalMonitor } from '../lib/lessons/goal-monitor.js';
import { evaluateGoal, validateGoal } from '../lib/lessons/goal.js';
import { completedAction, courseProgress, isChallengeCompleted } from '../lib/lessons/lesson-progress.js';
import { openAssignmentLessonsLibrary, openLessonsLibraryAt } from '../lib/lessons/open-lessons-library.js';
import { requestStudentSubmit, selectStudentLesson } from '../reducers/classroom.js';
import { closeLesson, dismissCompleted, markChallengeCompleted, openChallenge } from '../reducers/lesson-mode.js';

// Always-mounted container. While a challenge is open (lesson mode) it watches the VM
// for the challenge's goal; when the goal is met it records the challenge as completed
// and shows the "You did it!" toast. Outside lesson mode it renders nothing.
const LessonGoalWatcher = ({
    vm,
    assignmentName = null,
    challengeId,
    fromAssignment = false,
    justCompletedId,
    justCompletedNew = false,
    lesson = null,
    onCompleted,
    onDismiss,
    onNextChallenge,
    onOpenChallenge,
    onCloseLesson,
    onSubmitAssignment,
    progress,
}) => {
    const found = useMemo(() => (challengeId === null ? null : findChallenge(challengeId)), [challengeId]);
    const challenge = found ? found.challenge : null;
    const goal = challenge ? challenge.goal : null;

    const onCompletedRef = useRef(onCompleted);
    onCompletedRef.current = onCompleted;

    useEffect(() => {
        if (!vm || !goal || challengeId === null) return () => {};
        return attachGoalMonitor(vm, goal, () => onCompletedRef.current(challengeId));
    }, [vm, goal, challengeId]);

    // Debug / test hook (like window.smalruby.vm): attach a goal to the live VM without
    // opening a challenge, or open / complete a challenge without the lesson UI. Used by
    // the integration tests (and pw-check) until the lesson UI exists.
    useEffect(() => {
        if (!vm || typeof window === 'undefined') return () => {};
        window.smalruby = window.smalruby || {};
        window.smalruby.lessonGoal = {
            attach: (testGoal, onSatisfied) => attachGoalMonitor(vm, testGoal, onSatisfied),
            evaluateGoal,
            validateGoal,
            openChallenge: (id) => onOpenChallenge && onOpenChallenge(id),
            closeLesson: () => onCloseLesson && onCloseLesson(),
            markCompleted: (id) => onCompletedRef.current(id),
        };
        return () => {
            if (window.smalruby) delete window.smalruby.lessonGoal;
        };
    }, [vm, onOpenChallenge, onCloseLesson]);

    // 「次のチャレンジ」: 「できた！」を閉じて、レッスン表をいまのレッスンで開く（#1520）。
    // レッスンモードは抜けない（レッスン表を閉じたら、いまのチャレンジにもどる）
    // 課題のチャレンジからは、レッスン表を課題のチャレンジだけで開く（#1599）
    const handleNextChallenge = useCallback(() => {
        onDismiss();
        onNextChallenge(challengeId, fromAssignment);
    }, [challengeId, fromAssignment, onDismiss, onNextChallenge]);

    const handleSubmitAssignment = useCallback(() => {
        onDismiss();
        onSubmitAssignment();
    }, [onDismiss, onSubmitAssignment]);

    if (!challenge || justCompletedId !== challengeId) return null;
    const { course } = found;
    // この「できた」ではじめて課題クリアになったときだけ「課題クリア！」（段 1 の「レッスン n ぜんぶできた！」
    // より優先・1 回だけ）。課題クリアのあとにできたものはふつうの「できた！」に戻る
    const assignmentCleared = isAssignmentJustCleared(lesson, progress, challenge.id, justCompletedNew);
    return (
        <LessonCompletedToast
            action={completedAction(challenge.id, progress)}
            {...(assignmentCleared
                ? {
                      assignmentCleared: true,
                      assignmentName,
                      assignmentChallenges: assignmentProgress(lesson, progress).challenges,
                      onSubmitAssignment: lesson.submitWork ? handleSubmitAssignment : null,
                  }
                : {})}
            challengeId={challenge.id}
            challenges={found.lesson.challenges.map((c) => ({
                id: c.id,
                completed: isChallengeCompleted(progress, c.id),
            }))}
            courseCompleted={courseProgress(course, progress).allCompleted}
            courseName={course.name}
            lessonName={found.lesson.name}
            lessonNumber={course.lessons.indexOf(found.lesson) + 1}
            onClose={onDismiss}
            onNextChallenge={handleNextChallenge}
        />
    );
};

LessonGoalWatcher.propTypes = {
    // 参加している課題の名前（「課題クリア！」の 2 行目）
    assignmentName: PropTypes.string,
    challengeId: PropTypes.string,
    // いまのチャレンジをクラスの課題から開いたか
    fromAssignment: PropTypes.bool,
    justCompletedId: PropTypes.string,
    // 「できた！」のチャレンジが、この「できた」ではじめて記録に入ったか
    justCompletedNew: PropTypes.bool,
    // 参加している課題のレッスンの設定（assignment-progress.js）。無ければ null
    lesson: PropTypes.shape({
        challengeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
        submitWork: PropTypes.bool.isRequired,
    }),
    onCloseLesson: PropTypes.func,
    onCompleted: PropTypes.func.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onNextChallenge: PropTypes.func.isRequired,
    onOpenChallenge: PropTypes.func,
    onSubmitAssignment: PropTypes.func.isRequired,
    // lesson-progress.js の記録（「できた！」のボタンを決める）
    progress: PropTypes.shape({ challenges: PropTypes.object.isRequired }).isRequired,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    vm: state.scratchGui.vm,
    assignmentName: state.scratchGui.classroom ? state.scratchGui.classroom.assignmentName : null,
    challengeId: state.scratchGui.lessonMode.challengeId,
    fromAssignment: Boolean(state.scratchGui.lessonMode.fromAssignment),
    justCompletedId: state.scratchGui.lessonMode.justCompletedId,
    justCompletedNew: Boolean(state.scratchGui.lessonMode.justCompletedNew),
    lesson: selectStudentLesson(state),
    progress: state.scratchGui.lessonMode.progress,
});

const mapDispatchToProps = (dispatch) => ({
    onCompleted: (challengeId) => dispatch(markChallengeCompleted(challengeId)),
    onDismiss: () => dispatch(dismissCompleted()),
    onNextChallenge: (challengeId, fromAssignment) =>
        fromAssignment
            ? openAssignmentLessonsLibrary(dispatch, challengeId)
            : openLessonsLibraryAt(dispatch, challengeId),
    onOpenChallenge: (challengeId) => dispatch(openChallenge(challengeId)),
    onCloseLesson: () => dispatch(closeLesson()),
    onSubmitAssignment: () => dispatch(requestStudentSubmit('lesson_clear')),
});

export { LessonGoalWatcher };
export default connect(mapStateToProps, mapDispatchToProps)(LessonGoalWatcher);
