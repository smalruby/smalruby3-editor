// レッスンの使われ方を GA に送るコンテナ（描画はしない）。gui.jsx に常時マウントする。
// state の変わり目から送るイベントを決めるのは lib/lessons/lesson-analytics.js の
// stepLessonAnalytics（純粋関数）で、ここは state を渡して analytics.event に送るだけ。
// レッスン表・課題バー・ヒントは生徒（ふつうのエディタ）の画面にだけあるので、先生の画面からは送られない。
import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import analytics from '../lib/analytics';
import {
    createLessonAnalyticsMemo,
    lessonAnalyticsSnapshot,
    stepLessonAnalytics,
} from '../lib/lessons/lesson-analytics';

const LessonAnalytics = ({
    courseId = null,
    lessonId = null,
    challengeId = null,
    fromAssignment = false,
    hintSession = 0,
    hintVisible = false,
    hintIndex = 0,
    justCompletedId = null,
    libraryVisible = false,
    libraryFocus = false,
    now = Date.now,
    send = analytics.event,
}) => {
    const memoRef = useRef(createLessonAnalyticsMemo());
    useEffect(() => {
        const snapshot = {
            courseId,
            lessonId,
            challengeId,
            fromAssignment,
            hintSession,
            hintVisible,
            hintIndex,
            justCompletedId,
            libraryVisible,
            libraryFocus,
        };
        const { memo, events } = stepLessonAnalytics(memoRef.current, snapshot, now());
        memoRef.current = memo;
        events.forEach((event) => {
            try {
                send(event);
            } catch (_e) {
                // 計測に失敗してもレッスンは止めない
            }
        });
    }, [
        courseId,
        lessonId,
        challengeId,
        fromAssignment,
        hintSession,
        hintVisible,
        hintIndex,
        justCompletedId,
        libraryVisible,
        libraryFocus,
        now,
        send,
    ]);
    return null;
};

LessonAnalytics.propTypes = {
    challengeId: PropTypes.string,
    courseId: PropTypes.string,
    fromAssignment: PropTypes.bool,
    hintIndex: PropTypes.number,
    hintSession: PropTypes.number,
    hintVisible: PropTypes.bool,
    justCompletedId: PropTypes.string,
    lessonId: PropTypes.string,
    libraryFocus: PropTypes.bool,
    libraryVisible: PropTypes.bool,
    // テスト用: 時計と送り先
    now: PropTypes.func,
    send: PropTypes.func,
};

const mapStateToProps = (state) => lessonAnalyticsSnapshot(state);

export { LessonAnalytics };
export default connect(mapStateToProps, () => ({}))(LessonAnalytics);
