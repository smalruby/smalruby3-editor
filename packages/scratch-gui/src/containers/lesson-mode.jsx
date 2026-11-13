// レッスンモードのコンテナ。gui.jsx のメニューバーと本体のあいだに常時マウントし、
//   - startChallenge(id) で開こうとしているチャレンジを、新しい作品 → setup →
//     openChallenge(id) の順に進める
//   - レッスンモードのあいだ課題バー（LessonTaskBar）を出す
// パレットの絞り込みは Blocks コンテナが getLessonAllowedBlocks で行う。
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { connect } from 'react-redux';
import LessonTaskBar from '../components/lesson-task-bar/lesson-task-bar.jsx';
import { applyDeckSetup } from '../lib/deck-setup';
import { setupForChallenge } from '../lib/lessons/challenge-setup';
import { findChallenge } from '../lib/lessons/courses';
import { LESSON_EVENTS, sendLessonEvent } from '../lib/lessons/lesson-analytics';
import sharedMessages from '../lib/shared-messages';
import { closeCards } from '../reducers/cards';
import { requestExternalExitDnclMode, setDnclMode } from '../reducers/dncl-mode';
import { clearGoogleDriveFile } from '../reducers/google-drive-file';
import {
    cancelStartChallenge,
    closeLesson,
    dismissCompleted,
    getCurrentChallenge,
    getCurrentHint,
    hideHint,
    openChallenge,
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

const LessonMode = ({
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
    onHideHint,
    onOpenChallenge,
    onRequestNewProject,
    onShowHint,
    onStartChallenge,
    pendingChallengeId,
    projectChanged,
    teacherLoggedIn = false,
    toastVisible,
    vm,
}) => {
    const intl = useIntl();

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

    const handleOpenFullText = useCallback(() => {
        if (hint && hint.visible) onHideHint();
        if (toastVisible) onDismissCompleted();
    }, [hint, onHideHint, toastVisible, onDismissCompleted]);

    // 課題バーのボタンの GA 計測（どのチャレンジで押したか。lib/lessons/lesson-analytics.js）
    const handleQuit = useCallback(() => {
        sendLessonEvent(LESSON_EVENTS.OTHER_CHALLENGE, current, { fromAssignment, teacherLoggedIn });
        onCloseLesson();
    }, [current, fromAssignment, onCloseLesson, teacherLoggedIn]);

    const handleEnd = useCallback(() => {
        sendLessonEvent(LESSON_EVENTS.LESSON_END, current, { fromAssignment, teacherLoggedIn });
        onEndLesson();
    }, [current, fromAssignment, onEndLesson, teacherLoggedIn]);

    if (!current) return null;
    // ヒントの吹き出し（containers/lesson-hint.jsx）は document.body に portal で出るので、
    // ここに置いても本体のレイアウトには影響しない
    return (
        <>
            <LessonTaskBar
                challenge={current.challenge}
                challengeCount={current.lesson.challenges.length}
                hintAvailable={Boolean(hint && hint.count > 0)}
                hintVisible={Boolean(hint && hint.visible)}
                menuOpen={menuOpen}
                onEnd={handleEnd}
                onHint={handleHint}
                onOpenFullText={handleOpenFullText}
                onQuit={handleQuit}
                toastVisible={toastVisible}
            />
            <LessonHint />
        </>
    );
};

LessonMode.propTypes = {
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
    onEndLesson: PropTypes.func.isRequired,
    onExitDnclMode: PropTypes.func.isRequired,
    onHideHint: PropTypes.func.isRequired,
    onOpenChallenge: PropTypes.func.isRequired,
    onRequestNewProject: PropTypes.func.isRequired,
    onShowHint: PropTypes.func.isRequired,
    onStartChallenge: PropTypes.func.isRequired,
    pendingChallengeId: PropTypes.string,
    projectChanged: PropTypes.bool.isRequired,
    // 先生（クラス管理にログイン中）か（GA に送らない）
    teacherLoggedIn: PropTypes.bool,
    toastVisible: PropTypes.bool,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => {
    const { loadingState } = state.scratchGui.projectState;
    return {
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
        projectChanged: state.scratchGui.projectChanged,
        // lesson-goal-watcher.jsx が「できた！」の toast を出す条件と同じ
        toastVisible:
            state.scratchGui.lessonMode.challengeId !== null &&
            state.scratchGui.lessonMode.justCompletedId === state.scratchGui.lessonMode.challengeId,
        vm: state.scratchGui.vm,
    };
};

const mapDispatchToProps = (dispatch) => ({
    dispatch,
    onCancelStart: () => dispatch(cancelStartChallenge()),
    onCloseLesson: () => {
        // 「ほかのチャレンジへ」: いまのチャレンジを終えてレッスン表を開く（次のチャレンジをすぐ選べるように）
        dispatch(closeLesson());
        dispatch(openLessonsLibrary());
    },
    onDismissCompleted: () => dispatch(dismissCompleted()),
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
    onStartChallenge: (challengeId) => dispatch(startChallenge(challengeId)),
});

export { LessonMode };
export default connect(mapStateToProps, mapDispatchToProps)(LessonMode);
