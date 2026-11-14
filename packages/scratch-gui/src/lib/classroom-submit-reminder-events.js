/**
 * 「提出しよう」の吹き出し (#1835) の出来事を外へ知らせる口。
 *
 * GA の計測（#1831）はここに聞き手を足すだけで済むようにしておく（ここでは何も送らない）。
 * 出来事は次の 3 つ:
 * - `{type: 'shown', first, resumed, minutesSinceStart}`: 吹き出しを出した
 *   - first: この課題ではじめて出した（セッションが切れて同じ課題に入り直しても、もう true にしない）
 *   - resumed: 同じ回の出し直し（モーダルを閉じた・リロードした）。「出した回数」には resumed でないものだけを数える
 *   - minutesSinceStart: 数え始めから何分後か
 * - `{type: 'dismissed', reason}`: 消した（reason = 'close'（×）/ 'outside'（ほかの操作）/ 'submit'（「提出する」））
 * - `{type: 'submitted_after_shown', minutesSinceShown}`: 吹き出しを出したあとで提出した
 */

const listeners = new Set();

/**
 * 聞き手を足す。
 * @param {Function} listener - 出来事を受け取る関数
 * @returns {Function} 聞き手を外す関数
 */
const addSubmitReminderListener = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/**
 * 出来事を聞き手に渡す。聞き手が失敗しても吹き出しとエディタは止めない。
 * @param {object} event - 出来事
 */
const emitSubmitReminderEvent = (event) => {
    listeners.forEach((listener) => {
        try {
            listener(event);
        } catch (_e) {
            // 計測の失敗で画面を壊さない
        }
    });
};

export { addSubmitReminderListener, emitSubmitReminderEvent };
