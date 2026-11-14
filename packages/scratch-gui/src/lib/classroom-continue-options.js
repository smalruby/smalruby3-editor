/**
 * Submissions a student can continue from (#1201).
 *
 * `GET /classrooms/{id}/continuable-submissions` returns the seat's own
 * submission in this assignment (`current`) and the same seat's submission
 * in the previous assignment of the same class (`previous`). The response
 * also carries the old assignment setting `startFromPrevious` (#1202), which
 * the GUI no longer reads (#1825).
 */

/** Choice kinds other than the starter, in display order. */
export const CONTINUE_KINDS = ['previous', 'current'];

const usable = (item) => (item && typeof item.projectUrl === 'string' && item.projectUrl ? item : null);

/**
 * Normalize the API response into the choices to offer.
 * @param {?object} data - API response ({current, previous})
 * @returns {?{current: ?object, previous: ?object}} null when there is
 *   nothing to continue from
 */
export const normalizeContinueOptions = (data) => {
    const current = usable(data?.current);
    const previous = usable(data?.previous);
    if (!current && !previous) return null;
    return { current, previous };
};

/** 始め方（主ボタン・ほかの始め方）の種類。決める順番どおり（#1793）。 */
export const START_METHODS = ['current', 'previous', 'starter', 'keep'];

/**
 * 参加したあとの始め方を 1 つに決める（#1793・docs/classroom/ui-ux.md の「始め方を決める順番」）。
 *
 * 上から順に見て最初に当てはまったものを主ボタンにする: この課題で提出済み → 前回の提出物 →
 * スターター → いまの作品のまま（`keep`）。ほかの始め方は、主ボタンにしなかった使えるものを
 * 同じ順に並べ、最後に「いまの作品のまま」を置く。主ボタンが `keep` なら使えるものは無いので、
 * ほかの始め方は出さない（空）。
 *
 * 先生の設定で順番は変えない（「前回の提出物から始めさせる」は #1825 で廃止。保存済みの値は読まない）。
 *
 * レッスンの課題では、主ボタンは「はじめる」（`lesson` = レッスン表を開く）。チャレンジは毎回
 * 新しい作品から始まるので、始め方は課題クリアのあとの作品づくりにだけ使う。スターターのある
 * 課題だけ、ほかの始め方に使えるもの（この課題・前回・スターター）を入れる。
 * @param {object} input - 生徒の状態と先生の設定
 * @param {?{current: ?object, previous: ?object}} input.options - normalizeContinueOptions の結果
 * @param {boolean} [input.hasStarter] - 課題にスターターがある
 * @param {boolean} [input.lesson] - レッスンの課題
 * @returns {{main: string, others: Array<string>}} main は START_METHODS か 'lesson'
 */
export const decideStartMethod = ({ options, hasStarter = false, lesson = false }) => {
    const usableKinds = [
        options?.current ? 'current' : null,
        options?.previous ? 'previous' : null,
        hasStarter ? 'starter' : null,
    ].filter(Boolean);
    if (lesson) {
        return { main: 'lesson', others: hasStarter ? usableKinds : [] };
    }
    const main = usableKinds[0] || 'keep';
    const others = main === 'keep' ? [] : [...usableKinds.slice(1), 'keep'];
    return { main, others };
};
