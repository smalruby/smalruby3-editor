// レッスンモードのコンテナ。gui.jsx のエディタ列の先頭に常時マウントし、
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
import sharedMessages from '../lib/shared-messages';
import { closeCards } from '../reducers/cards';
import { clearGoogleDriveFile } from '../reducers/google-drive-file';
import {
    cancelStartChallenge,
    closeLesson,
    getCurrentChallenge,
    getCurrentHint,
    hideHint,
    openChallenge,
    showHint,
    startChallenge,
} from '../reducers/lesson-mode';
import {
    getIsAnyCreatingNewState,
    getIsShowingProject,
    getIsShowingWithoutId,
    requestNewProject,
} from '../reducers/project-state';

const LessonMode = ({
    current,
    dispatch,
    hint,
    isAnyCreatingNewState,
    isShowingProject,
    isShowingWithoutId,
    onCancelStart,
    onCloseLesson,
    onHideHint,
    onOpenChallenge,
    onRequestNewProject,
    onShowHint,
    onStartChallenge,
    pendingChallengeId,
    projectChanged,
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
        onRequestNewProject();
    }, [pendingChallengeId, isShowingProject, projectChanged, intl, onCancelStart, onRequestNewProject]);

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

    const handleHint = useCallback(() => {
        if (hint && hint.visible) onHideHint();
        else onShowHint();
    }, [hint, onHideHint, onShowHint]);

    if (!current) return null;
    // ヒントの吹き出しは <LessonTaskBar> の次に置く（状態は getCurrentHint）
    return (
        <LessonTaskBar
            challenge={current.challenge}
            challengeCount={current.lesson.challenges.length}
            hintAvailable={Boolean(hint && hint.count > 0)}
            onHint={handleHint}
            onQuit={onCloseLesson}
        />
    );
};

LessonMode.propTypes = {
    current: PropTypes.shape({
        course: PropTypes.object.isRequired,
        lesson: PropTypes.object.isRequired,
        challenge: PropTypes.object.isRequired,
    }),
    dispatch: PropTypes.func.isRequired,
    hint: PropTypes.shape({
        visible: PropTypes.bool.isRequired,
        index: PropTypes.number.isRequired,
        count: PropTypes.number.isRequired,
        step: PropTypes.object,
    }),
    isAnyCreatingNewState: PropTypes.bool.isRequired,
    isShowingProject: PropTypes.bool.isRequired,
    isShowingWithoutId: PropTypes.bool.isRequired,
    onCancelStart: PropTypes.func.isRequired,
    onCloseLesson: PropTypes.func.isRequired,
    onHideHint: PropTypes.func.isRequired,
    onOpenChallenge: PropTypes.func.isRequired,
    onRequestNewProject: PropTypes.func.isRequired,
    onShowHint: PropTypes.func.isRequired,
    onStartChallenge: PropTypes.func.isRequired,
    pendingChallengeId: PropTypes.string,
    projectChanged: PropTypes.bool.isRequired,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => {
    const { loadingState } = state.scratchGui.projectState;
    return {
        current: getCurrentChallenge(state),
        hint: getCurrentHint(state),
        isAnyCreatingNewState: getIsAnyCreatingNewState(loadingState),
        isShowingProject: getIsShowingProject(loadingState),
        isShowingWithoutId: getIsShowingWithoutId(loadingState),
        pendingChallengeId: state.scratchGui.lessonMode.pendingChallengeId,
        projectChanged: state.scratchGui.projectChanged,
        vm: state.scratchGui.vm,
    };
};

const mapDispatchToProps = (dispatch) => ({
    dispatch,
    onCancelStart: () => dispatch(cancelStartChallenge()),
    onCloseLesson: () => dispatch(closeLesson()),
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
