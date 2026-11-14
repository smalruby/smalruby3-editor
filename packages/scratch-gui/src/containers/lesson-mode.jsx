// レッスンモードのコンテナ。gui.jsx のメニューバーと本体のあいだに常時マウントし、
//   - startChallenge(id) で開こうとしているチャレンジを、新しい作品 → setup →
//     openChallenge(id) の順に進める
//   - レッスンモードのあいだ課題バー（LessonTaskBar）を出す
// パレットの絞り込みは Blocks コンテナが getLessonAllowedBlocks で行う。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import LessonAssignmentBand from '../components/lesson-assignment-band/lesson-assignment-band.jsx';
import LessonTaskBar from '../components/lesson-task-bar/lesson-task-bar.jsx';
import { applyDeckSetup } from '../lib/deck-setup';
import { useChallengeActivityDiagram } from '../lib/lessons/activity-diagram/use-challenge-activity-diagram';
import { assignmentProgress, isAssignmentChallenge } from '../lib/lessons/assignment-progress';
import { setupForChallenge } from '../lib/lessons/challenge-setup';
import { findChallenge } from '../lib/lessons/courses';
import { LESSON_EVENTS, sendLessonEvent } from '../lib/lessons/lesson-analytics';
import { openAssignmentLessonsLibrary } from '../lib/lessons/open-lessons-library';
import sharedMessages from '../lib/shared-messages';
import { closeCards } from '../reducers/cards';
import { selectStudentLesson } from '../reducers/classroom';
import { requestExternalExitDnclMode, setDnclMode } from '../reducers/dncl-mode';
import { clearGoogleDriveFile } from '../reducers/google-drive-file';
import {
    cancelStartChallenge,
    closeLesson,
    dismissCompleted,
    getCurrentChallenge,
    getCurrentHint,
    hideCompleted,
    hideHint,
    openChallenge,
    showCompleted,
    showHint,
    startChallenge,
} from '../reducers/lesson-mode';
import { openLessonsLibrary } from '../reducers/modals';
import {
    getIsAnyCreatingNewState,
    getIsShowingProject,
    getIsShowingWithoutId,
    requestNewProject,
} from '../reducers/project-state';
import LessonHint from './lesson-hint.jsx';
import LessonPracticePartner from './lesson-practice-partner.jsx';

const LessonMode = ({
    assignmentLesson = null,
    completedHidden = false,
    current,
    dispatch,
    dnclMode,
    fromAssignment = false,
    hint,
    isAnyCreatingNewState,
    isShowingProject,
    isShowingWithoutId,
    menuOpen,
    onCancelStart,
    onCloseLesson,
    onDismissCompleted,
    onEndLesson,
    onExitDnclMode,
    onHideCompleted,
    onHideHint,
    onOpenChallenge,
    onRequestNewProject,
    onShowCompleted,
    onShowHint,
    onStartChallenge,
    pendingChallengeId,
    progress,
    projectChanged,
    rubyVersion,
    scratchBlocks = null,
    teacherLoggedIn = false,
    toastVisible,
    vm,
}) => {
    const intl = useIntl();
    // 答えのプログラムから描いたアクティビティ図（チャレンジの定義が出すとしたときだけ）。課題の全文の中に出す
    const activityDiagram = useChallengeActivityDiagram(current ? current.challenge : null, {
        rubyVersion,
        scratchBlocks,
    });

    // 1. 開こうとしているチャレンジがあれば、新しい作品にする（いまの作品に変更が
    //    あればメニューの「新規」と同じ確認）。新しい作品を頼んだことを ref で覚え、
    //    作品ができる前に別のチャレンジに変わっても二度は頼まない（できた作品で
    //    そのチャレンジを開く）。ref は pendingChallengeId が無くなるときに消す
    const startedForRef = useRef(null);
    useEffect(() => {
        if (pendingChallengeId === null) {
            startedForRef.current = null;
            return;
        }
        if (!isShowingProject || startedForRef.current !== null) return;
        startedForRef.current = pendingChallengeId;
        // eslint-disable-next-line no-alert
        if (projectChanged && !window.confirm(intl.formatMessage(sharedMessages.replaceProjectWarning))) {
            onCancelStart();
            return;
        }
        // 日本語モードのままだと、パレットが日本語で書けるブロックに絞られたうえにチャレンジの
        // 絞り込みが重なり、チャレンジで使うブロックが出てこない（#1735）。レッスンに入ると決まって
        // から（作品の置きかえを断ったときは変えない）、ふりがなモードに戻す
        if (dnclMode) onExitDnclMode();
        onRequestNewProject();
    }, [
        pendingChallengeId,
        isShowingProject,
        projectChanged,
        intl,
        dnclMode,
        onCancelStart,
        onExitDnclMode,
        onRequestNewProject,
    ]);

    // 2. 新しい作品ができたら setup を適用してレッスンモードに入る（titled-hoc と同じ
    //    「作成中 → 表示中」の遷移で検出する）
    const wasCreatingRef = useRef(isAnyCreatingNewState);
    const pendingRef = useRef(pendingChallengeId);
    pendingRef.current = pendingChallengeId;
    useEffect(() => {
        const finished = wasCreatingRef.current && !isAnyCreatingNewState && isShowingWithoutId;
        wasCreatingRef.current = isAnyCreatingNewState;
        if (!finished || pendingChallengeId === null) return;
        const found = findChallenge(pendingChallengeId);
        if (!found) return;
        const challengeId = pendingChallengeId;
        applyDeckSetup(setupForChallenge(found.course, found.challenge), dispatch, vm)
            .catch((err) => {
                // setup が失敗してもチャレンジは開く（拡張機能などは手で足せる）
                // eslint-disable-next-line no-console
                console.warn('[lesson-mode] setup failed:', err);
            })
            .then(() => {
                // 途中で取り消された・別のチャレンジに変わったときは開かない
                if (pendingRef.current === challengeId) onOpenChallenge(challengeId);
            });
    }, [isAnyCreatingNewState, isShowingWithoutId, pendingChallengeId, dispatch, onOpenChallenge, vm]);

    // レッスン表（別の画面）ができるまでの入口。Playwright / Selenium からも呼ぶ
    useEffect(() => {
        if (typeof window === 'undefined') return () => {};
        window.smalruby = window.smalruby || {};
        window.smalruby.startChallenge = onStartChallenge;
        return () => {
            if (window.smalruby) delete window.smalruby.startChallenge;
        };
    }, [onStartChallenge]);

    // 課題バー（画面の幅いっぱい）が出る・消えると、ステージの列がその高さの分だけ上下に動く。
    // ステージ（containers/stage.jsx）は canvas の位置を window の resize / scroll でしか測り直さない
    // ので、知らせないとマウスの位置が課題バーの高さの分ずれて、ネコにマウスを重ねても
    // 「さわった」にならない（#1581）。ブロックの作業場所も高さが変わるので同じく resize で知らせる
    const taskBarVisible = Boolean(current);
    const taskBarVisibleRef = useRef(taskBarVisible);
    useEffect(() => {
        if (taskBarVisibleRef.current === taskBarVisible) return;
        taskBarVisibleRef.current = taskBarVisible;
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('resize'));
    }, [taskBarVisible]);

    const handleHint = useCallback(() => {
        if (hint && hint.visible) onHideHint();
        else onShowHint();
    }, [hint, onHideHint, onShowHint]);

    // タップで全文を開くときは、吹き出しと「できた！」に重ねない。クイズのある「できた！」は閉じずに
    // 全文のあいだだけ隠し、全文を閉じたら出し直す（閉じるとクイズにもどれないため・#1639）
    const quizToast = Boolean(toastVisible && current && current.challenge.quiz);
    const handleOpenFullText = useCallback(() => {
        if (hint && hint.visible) onHideHint();
        if (quizToast) onHideCompleted();
        else if (toastVisible) onDismissCompleted();
    }, [hint, onHideHint, quizToast, toastVisible, onHideCompleted, onDismissCompleted]);
    const handleCloseFullText = useCallback(() => {
        if (completedHidden) onShowCompleted();
    }, [completedHidden, onShowCompleted]);

    // 課題バーのボタンの GA 計測（どのチャレンジで押したか。lib/lessons/lesson-analytics.js）
    // 課題のチャレンジからは、レッスン表を課題のチャレンジだけで開き直す（#1599）
    const handleQuit = useCallback(() => {
        sendLessonEvent(LESSON_EVENTS.OTHER_CHALLENGE, current, { fromAssignment, teacherLoggedIn });
        onCloseLesson(fromAssignment ? current.challenge.id : null);
    }, [current, fromAssignment, onCloseLesson, teacherLoggedIn]);

    const handleEnd = useCallback(() => {
        sendLessonEvent(LESSON_EVENTS.LESSON_END, current, { fromAssignment, teacherLoggedIn });
        onEndLesson();
    }, [current, fromAssignment, onEndLesson, teacherLoggedIn]);

    if (!current) return null;
    // 課題のチャレンジの中では、課題バーの同じ行に小さな課題の帯（丸と「あと n つ」）を出す（高さは変えない）
    const assignmentStatus = isAssignmentChallenge(assignmentLesson, current.challenge.id)
        ? assignmentProgress(assignmentLesson, progress)
        : null;
    // ヒントの吹き出し（containers/lesson-hint.jsx）は document.body に portal で出るので、
    // ここに置いても本体のレイアウトには影響しない
    return (
        <>
            <LessonTaskBar
                activityDiagram={activityDiagram}
                assignmentBand={
                    assignmentStatus ? <LessonAssignmentBand status={assignmentStatus} variant="compact" /> : null
                }
                challenge={current.challenge}
                challengeCount={current.lesson.challenges.length}
                hintAvailable={Boolean(hint && hint.count > 0)}
                hintVisible={Boolean(hint && hint.visible)}
                menuOpen={menuOpen}
                onEnd={handleEnd}
                onCloseFullText={handleCloseFullText}
                onHint={handleHint}
                onOpenFullText={handleOpenFullText}
                onQuit={handleQuit}
                toastVisible={toastVisible}
            />
            <LessonHint />
            {/* メッシュの練習相手（チャレンジに partner があるときだけ。これも document.body への portal） */}
            <LessonPracticePartner />
        </>
    );
};

LessonMode.propTypes = {
    // 参加している課題のレッスンの設定（assignment-progress.js）。無ければ null
    assignmentLesson: PropTypes.shape({
        challengeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
    current: PropTypes.shape({
        course: PropTypes.object.isRequired,
        lesson: PropTypes.object.isRequired,
        challenge: PropTypes.object.isRequired,
    }),
    dispatch: PropTypes.func.isRequired,
    dnclMode: PropTypes.bool,
    // クラスの課題から開いたか（GA の計測で送る）
    fromAssignment: PropTypes.bool,
    hint: PropTypes.shape({
        visible: PropTypes.bool.isRequired,
        index: PropTypes.number.isRequired,
        count: PropTypes.number.isRequired,
        step: PropTypes.object,
    }),
    isAnyCreatingNewState: PropTypes.bool.isRequired,
    isShowingProject: PropTypes.bool.isRequired,
    isShowingWithoutId: PropTypes.bool.isRequired,
    menuOpen: PropTypes.bool,
    onCancelStart: PropTypes.func.isRequired,
    onCloseLesson: PropTypes.func.isRequired,
    onDismissCompleted: PropTypes.func.isRequired,
    // クイズのある「できた！」を、全文のあいだだけ隠す・出し直す（#1639）
    onHideCompleted: PropTypes.func.isRequired,
    onShowCompleted: PropTypes.func.isRequired,
    // 「できた！」をいっとき隠しているか（reducers/lesson-mode.js の completedHidden）
    completedHidden: PropTypes.bool,
    onEndLesson: PropTypes.func.isRequired,
    onExitDnclMode: PropTypes.func.isRequired,
    onHideHint: PropTypes.func.isRequired,
    onOpenChallenge: PropTypes.func.isRequired,
    onRequestNewProject: PropTypes.func.isRequired,
    onShowHint: PropTypes.func.isRequired,
    onStartChallenge: PropTypes.func.isRequired,
    pendingChallengeId: PropTypes.string,
    // lesson-progress.js の記録（課題の帯の数）
    progress: PropTypes.shape({ challenges: PropTypes.object.isRequired }),
    projectChanged: PropTypes.bool.isRequired,
    rubyVersion: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    // 対応していないブロックの名前を図に書くときの Msg（reducers/block-display）
    scratchBlocks: PropTypes.object,
    // 先生（クラス管理にログイン中）か（GA に送らない）
    teacherLoggedIn: PropTypes.bool,
    toastVisible: PropTypes.bool,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => {
    const { loadingState } = state.scratchGui.projectState;
    return {
        assignmentLesson: selectStudentLesson(state),
        current: getCurrentChallenge(state),
        dnclMode: state.scratchGui.dnclMode.dnclMode,
        fromAssignment: Boolean(state.scratchGui.lessonMode.fromAssignment),
        // 先生（クラス管理にログイン中）のときは GA に送らない
        teacherLoggedIn: Boolean(state.scratchGui.classroom && state.scratchGui.classroom.teacherLoggedIn),
        hint: getCurrentHint(state),
        isAnyCreatingNewState: getIsAnyCreatingNewState(loadingState),
        isShowingProject: getIsShowingProject(loadingState),
        isShowingWithoutId: getIsShowingWithoutId(loadingState),
        // メニューバーのメニューがどれか開いているか（課題バーのホバーの全文がメニューに重ならないように）
        menuOpen: Object.values(state.scratchGui.menus).some(Boolean),
        pendingChallengeId: state.scratchGui.lessonMode.pendingChallengeId,
        progress: state.scratchGui.lessonMode.progress,
        projectChanged: state.scratchGui.projectChanged,
        rubyVersion: state.scratchGui.settings.rubyVersion,
        scratchBlocks: state.scratchGui.blockDisplay.scratchBlocks,
        // lesson-goal-watcher.jsx が「できた！」の toast を出す条件と同じ（いっとき隠しているあいだは出ていない）
        toastVisible:
            state.scratchGui.lessonMode.challengeId !== null &&
            state.scratchGui.lessonMode.justCompletedId === state.scratchGui.lessonMode.challengeId &&
            !state.scratchGui.lessonMode.completedHidden,
        completedHidden: Boolean(state.scratchGui.lessonMode.completedHidden),
        vm: state.scratchGui.vm,
    };
};

const mapDispatchToProps = (dispatch) => ({
    dispatch,
    onCancelStart: () => dispatch(cancelStartChallenge()),
    onCloseLesson: (assignmentChallengeId = null) => {
        // 「ほかのチャレンジへ」: いまのチャレンジを終えてレッスン表を開く（次のチャレンジをすぐ選べるように）。
        // 課題のチャレンジからは、課題のチャレンジだけで開き、次の課題のチャレンジに「次はこれ！」
        dispatch(closeLesson());
        if (assignmentChallengeId) openAssignmentLessonsLibrary(dispatch, assignmentChallengeId);
        else dispatch(openLessonsLibrary());
    },
    onDismissCompleted: () => dispatch(dismissCompleted()),
    onHideCompleted: () => dispatch(hideCompleted()),
    onShowCompleted: () => dispatch(showCompleted()),
    // 「レッスンをおえる」: レッスンから出るだけ（レッスン表は開かない・確認も出さない）。作品はそのまま残り、
    // パレットは getLessonAllowedBlocks が null になって全部のブロックにもどる
    onEndLesson: () => dispatch(closeLesson()),
    // 日本語モードのバナーの「Rubyふりがなモードに戻す」と同じ（containers/gui.jsx）。ブロックはすぐ全部
    // 戻し、次に Ruby タブを開いたときに日本語の表示に戻さないよう ruby-tab に知らせる
    onExitDnclMode: () => {
        dispatch(setDnclMode(false));
        dispatch(requestExternalExitDnclMode());
    },
    onHideHint: () => dispatch(hideHint()),
    onOpenChallenge: (challengeId) => dispatch(openChallenge(challengeId)),
    onRequestNewProject: () => {
        // メニューの「新規」と同じ: Google Drive のファイルとの結び付きも切る。
        // 開いていたチュートリアルのカードも閉じる（カードの allowedBlocks が
        // レッスンをやめた後のパレットに残らないように）
        dispatch(closeCards());
        dispatch(clearGoogleDriveFile());
        dispatch(requestNewProject(false));
    },
    onShowHint: () => dispatch(showHint()),
    onStartChallenge: (challengeId, options) => dispatch(startChallenge(challengeId, options)),
});

export { LessonMode };
export default connect(mapStateToProps, mapDispatchToProps)(LessonMode);
