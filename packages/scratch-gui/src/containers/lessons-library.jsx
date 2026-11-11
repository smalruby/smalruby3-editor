// レッスン表のコンテナ。gui.jsx に常時マウントし、modals.lessonsLibrary が true の間だけ
// レッスン表（components/lessons-library）を出す。
//   - 開くたびに reloadProgress()（別のタブが書いた記録を写しに取り込む）
//   - チャレンジを押すと startChallenge(id)（containers/lesson-mode.jsx が開く流れを進める）
//     → レッスン表を閉じる
import PropTypes from 'prop-types';
import React, { useCallback, useEffect } from 'react';
import { connect } from 'react-redux';
import LessonsLibraryComponent from '../components/lessons-library/lessons-library.jsx';
import { COURSES } from '../lib/lessons/courses';
import { reloadProgress, startChallenge } from '../reducers/lesson-mode';
import { closeLessonsLibrary } from '../reducers/modals';

const LessonsLibrary = ({ onReloadProgress, onRequestClose, onStartChallenge, progress, visible }) => {
    useEffect(() => {
        if (visible) onReloadProgress();
    }, [visible, onReloadProgress]);

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
            courses={COURSES}
            progress={progress}
            onRequestClose={onRequestClose}
            onSelectChallenge={handleSelectChallenge}
        />
    );
};

LessonsLibrary.propTypes = {
    onReloadProgress: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onStartChallenge: PropTypes.func.isRequired,
    progress: PropTypes.shape({ challenges: PropTypes.object.isRequired }).isRequired,
    visible: PropTypes.bool.isRequired,
};

const mapStateToProps = (state) => ({
    progress: state.scratchGui.lessonMode.progress,
    visible: state.scratchGui.modals.lessonsLibrary,
});

const mapDispatchToProps = (dispatch) => ({
    onReloadProgress: () => dispatch(reloadProgress()),
    onRequestClose: () => dispatch(closeLessonsLibrary()),
    onStartChallenge: (challengeId) => dispatch(startChallenge(challengeId)),
});

export { LessonsLibrary };
export default connect(mapStateToProps, mapDispatchToProps)(LessonsLibrary);
