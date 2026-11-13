// レッスンの使われ方を GA に送るコンテナ（描画はしない）。gui.jsx に常時マウントする。
// state の変わり目から送るイベントを決めるのは lib/lessons/lesson-analytics.js の
// stepLessonAnalytics（純粋関数）で、ここは state を渡して analytics.event に送るだけ。
// 先生（クラス管理にログイン中）のときは送らない（stepLessonAnalytics が覚えだけ進める）。
// 覚え（どこまで送ったか）はモジュールに 1 つ持つ（lesson-analytics.js の sharedMemo）。PC 表示と
// スマホ表示の切りかえでこのコンテナがマウントし直されても、二重に送らず、滞在時間も続けて測る。
// 秒は、タブが裏にあった時間を引いた時計（activeNow）で測る。
import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { connect } from 'react-redux';
import analytics from '../lib/analytics';
import {
    activeNow,
    getSharedLessonAnalyticsMemo,
    installVisibilityTracking,
    lessonAnalyticsSnapshot,
    setSharedLessonAnalyticsMemo,
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
    teacherLoggedIn = false,
    now = activeNow,
    send = analytics.event,
}) => {
    useEffect(() => {
        installVisibilityTracking();
    }, []);
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
            teacherLoggedIn,
        };
        const { memo, events } = stepLessonAnalytics(getSharedLessonAnalyticsMemo(), snapshot, now());
        setSharedLessonAnalyticsMemo(memo);
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
        teacherLoggedIn,
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
    // 先生がクラス管理にログイン中か（そのときは送らない）
    teacherLoggedIn: PropTypes.bool,
    // テスト用: 時計と送り先
    now: PropTypes.func,
    send: PropTypes.func,
};

const mapStateToProps = (state) => lessonAnalyticsSnapshot(state);

export { LessonAnalytics };
export default connect(mapStateToProps, () => ({}))(LessonAnalytics);
