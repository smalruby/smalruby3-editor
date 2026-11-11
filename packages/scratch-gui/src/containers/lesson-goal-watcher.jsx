import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { connect } from 'react-redux';
import LessonCompletedToast from '../components/lesson-completed-toast/lesson-completed-toast.jsx';
import { findChallenge } from '../lib/lessons/courses.js';
import { attachGoalMonitor } from '../lib/lessons/goal-monitor.js';
import { evaluateGoal, validateGoal } from '../lib/lessons/goal.js';
import { isLastChallengeOfLesson } from '../lib/lessons/lesson-progress.js';
import { openLessonsLibraryAt } from '../lib/lessons/open-lessons-library.js';
import { closeLesson, dismissCompleted, markChallengeCompleted, openChallenge } from '../reducers/lesson-mode.js';

// Always-mounted container. While a challenge is open (lesson mode) it watches the VM
// for the challenge's goal; when the goal is met it records the challenge as completed
// and shows the "You did it!" toast. Outside lesson mode it renders nothing.
const LessonGoalWatcher = ({
    vm,
    challengeId,
    justCompletedId,
    onCompleted,
    onDismiss,
    onNextChallenge,
    onOpenChallenge,
    onCloseLesson,
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
    const handleNextChallenge = useCallback(() => {
        onDismiss();
        onNextChallenge(challengeId);
    }, [challengeId, onDismiss, onNextChallenge]);

    if (!challenge || justCompletedId !== challengeId) return null;
    return (
        <LessonCompletedToast
            challenge={challenge}
            isLastChallenge={isLastChallengeOfLesson(challenge.id)}
            onClose={onDismiss}
            onNextChallenge={handleNextChallenge}
        />
    );
};

LessonGoalWatcher.propTypes = {
    challengeId: PropTypes.string,
    justCompletedId: PropTypes.string,
    onCloseLesson: PropTypes.func,
    onCompleted: PropTypes.func.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onNextChallenge: PropTypes.func.isRequired,
    onOpenChallenge: PropTypes.func,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    vm: state.scratchGui.vm,
    challengeId: state.scratchGui.lessonMode.challengeId,
    justCompletedId: state.scratchGui.lessonMode.justCompletedId,
});

const mapDispatchToProps = (dispatch) => ({
    onCompleted: (challengeId) => dispatch(markChallengeCompleted(challengeId)),
    onDismiss: () => dispatch(dismissCompleted()),
    onNextChallenge: (challengeId) => openLessonsLibraryAt(dispatch, challengeId),
    onOpenChallenge: (challengeId) => dispatch(openChallenge(challengeId)),
    onCloseLesson: () => dispatch(closeLesson()),
});

export { LessonGoalWatcher };
export default connect(mapStateToProps, mapDispatchToProps)(LessonGoalWatcher);
