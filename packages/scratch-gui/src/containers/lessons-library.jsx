// レッスン表のコンテナ。gui.jsx に常時マウントし、modals.lessonsLibrary が true の間だけ
// レッスン表（components/lessons-library）を出す。
//   - 開くたびに reloadProgress()（別のタブが書いた記録を写しに取り込む）
//   - チャレンジを押すと startChallenge(id)（containers/lesson-mode.jsx が開く流れを進める）
//     → レッスン表を閉じる
//   - 「できた！」の「次のチャレンジ」で開いたとき（lessonMode.libraryFocusChallengeId・#1520）は、
//     そのレッスンへスクロールし、次のまだできていないチャレンジを目立たせる。閉じるときに消す
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo } from 'react';
import { connect } from 'react-redux';
import LessonsLibraryComponent from '../components/lessons-library/lessons-library.jsx';
import { COURSES } from '../lib/lessons/courses';
import { lessonsLibraryFocus } from '../lib/lessons/lesson-progress';
import { clearLessonsLibraryFocus, reloadProgress, startChallenge } from '../reducers/lesson-mode';
import { closeLessonsLibrary } from '../reducers/modals';

const LessonsLibrary = ({
    colorMode,
    focusChallengeId = null,
    onReloadProgress,
    onRequestClose,
    onStartChallenge,
    progress,
    visible,
}) => {
    useEffect(() => {
        if (visible) onReloadProgress();
    }, [visible, onReloadProgress]);

    const focus = useMemo(
        () => (focusChallengeId === null ? null : lessonsLibraryFocus(focusChallengeId, progress)),
        [focusChallengeId, progress],
    );

    const handleSelectChallenge = useCallback(
        (challengeId) => {
            onStartChallenge(challengeId);
            onRequestClose();
        },
        [onRequestClose, onStartChallenge],
    );

    if (!visible) return null;
    return (
        <LessonsLibraryComponent
            colorMode={colorMode}
            courses={COURSES}
            progress={progress}
            {...(focus ? { initialLanguage: focus.language } : {})}
            focusLessonId={focus ? focus.lessonId : null}
            nextChallengeId={focus ? focus.nextChallengeId : null}
            onRequestClose={onRequestClose}
            onSelectChallenge={handleSelectChallenge}
        />
    );
};

LessonsLibrary.propTypes = {
    // 色のモード。カードの帯をブロックと同じ色にする
    colorMode: PropTypes.string.isRequired,
    // 「次のチャレンジ」で開いたときの、いまのチャレンジ id（null ならふつうに開く）
    focusChallengeId: PropTypes.string,
    onReloadProgress: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onStartChallenge: PropTypes.func.isRequired,
    progress: PropTypes.shape({ challenges: PropTypes.object.isRequired }).isRequired,
    visible: PropTypes.bool.isRequired,
};

const mapStateToProps = (state) => ({
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
    onStartChallenge: (challengeId) => dispatch(startChallenge(challengeId)),
});

export { LessonsLibrary };
export default connect(mapStateToProps, mapDispatchToProps)(LessonsLibrary);
