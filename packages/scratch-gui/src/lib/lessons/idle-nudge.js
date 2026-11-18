// 手が止まったときに「ヒント」を光らせるかの判定（純粋関数）。#2129 の Q5。
// プログラム（ブロックの変化）もステージ（スプライトの位置・見た目・実行）も 2 分変わらなければ、課題バーの
// 「ヒント」ボタン（小さくしたヒントの札を含む）をゆっくり光らせ、「ヒントを見てみよう」と文字で出す。音は出さない。
// 何か操作したら止める（止めたところから、また 2 分を数える）。変化の検知は VM のイベントを使う（use-idle-nudge.js）。

/** 何も変わらなければ光らせるまでの時間（ms）。 */
export const IDLE_NUDGE_MS = 2 * 60 * 1000;

/**
 * いま光らせるか。
 * @param {object} args - 引数。
 * @param {number} args.now - いまの時刻（ms）。
 * @param {number} args.lastChangeAt - 最後にプログラム・ステージ・ヒントが変わった時刻（ms）。
 * @param {?number} [args.lastDismissAt] - 光っているときに操作して止めた時刻（ms。無ければ null）。
 * @param {boolean} args.hintAvailable - ヒントのあるチャレンジか。
 * @param {boolean} args.hintVisible - ヒントの吹き出しを大きく出しているか（読んでいるあいだは光らせない）。
 * @param {boolean} [args.blocked] - ほかの表示（「できた！」・課題の全文・モーダル）が出ているか。
 * @param {number} [args.idleMs] - 光らせるまでの時間（ms）。
 * @returns {boolean} 光らせるか。
 */
export const shouldNudgeHint = ({
    now,
    lastChangeAt,
    lastDismissAt = null,
    hintAvailable,
    hintVisible,
    blocked = false,
    idleMs = IDLE_NUDGE_MS,
}) => {
    if (!hintAvailable || hintVisible || blocked) return false;
    const since = Math.max(lastChangeAt, lastDismissAt === null ? -Infinity : lastDismissAt);
    return now - since >= idleMs;
};

/**
 * 次に判定し直すまでの時間（ms）。光らせる時刻にタイマーを 1 つだけ置くため（毎フレーム見ない）。
 * @param {object} args - 引数（shouldNudgeHint と同じ）。
 * @param {number} args.now - いまの時刻（ms）。
 * @param {number} args.lastChangeAt - 最後に変わった時刻（ms）。
 * @param {?number} [args.lastDismissAt] - 光っているときに操作して止めた時刻（ms）。
 * @param {number} [args.idleMs] - 光らせるまでの時間（ms）。
 * @returns {number} 待つ時間（ms。0 以上）。
 */
export const nextNudgeCheckIn = ({ now, lastChangeAt, lastDismissAt = null, idleMs = IDLE_NUDGE_MS }) => {
    const since = Math.max(lastChangeAt, lastDismissAt === null ? -Infinity : lastDismissAt);
    return Math.max(0, since + idleMs - now);
};
