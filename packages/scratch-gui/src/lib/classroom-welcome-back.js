/**
 * おかえりなさいの画面で「この課題で出した作品から続ける」を主ボタンにするか (#1825)。
 *
 * 提出したあとにページを読み込み直すと、作品は新しい作品に戻る。そのまま「つづける」を押すと
 * 空の作品で続きを作ることになり、出した作品がどこにあるか分からなくなる。そこで、いまの作品が
 * 「新しい作品のまま」で、この課題で出した作品があり、このタブでまだそれを読み込んでいないときだけ、
 * 主ボタンを「この課題で出した作品から続ける」にする（「このまま つづける」は小さなリンク）。
 * 作品が空なので、読み込む前の上書きの確認は出さない。
 *
 * どれか 1 つでも確かめられないときは、いつもどおり「つづける」（作品を勝手に置きかえない側に倒す）。
 * docs/classroom/ui-ux.md の「おかえりなさい」。
 */

/**
 * 提出物を 1 つに決めるキー（課題 + 提出した時刻）。出し直すと別のキーになる。
 * このタブで読み込んだ提出物を覚えるのに使う（Redux だけに置き、保存しない。読み込み直すと忘れる）。
 * @param {?object} submission - 続きに使える提出物（normalizeContinueOptions の current）
 * @returns {?string} キー（決められないときは null）
 */
export const submissionKey = (submission) =>
    submission && submission.submittedAt ? `${submission.classroomId || ''}:${submission.submittedAt}` : null;

/**
 * どれかの target（スプライト・ステージ）にブロックがあるか。target がまだ無いときや、読めない
 * target があるときはブロックがあるとみなす（迷ったら「つづける」）。
 * @param {?Array<object>} targets - vm.runtime.targets
 * @returns {boolean} ブロックがあるとき true
 */
export const projectHasBlocks = (targets) => {
    // No targets yet (before the first load or while one project replaces
    // another) is "not sure", not "empty" (#1825 review FYI2).
    if (!Array.isArray(targets) || targets.length === 0) return true;
    return targets.some((target) => {
        const blocks = target && target.blocks && target.blocks._blocks;
        if (!blocks || typeof blocks !== 'object') return true;
        return Object.keys(blocks).length > 0;
    });
};

/**
 * 「この課題で出した作品から続ける」を主ボタンにするか。すべて満たすときだけ true:
 * 1. クラスに参加中で、セッションを確かめられた
 * 2. いまの作品が新しい作品のまま（ブロックが無い・変更が無い・ファイルや Google ドライブなどから開いていない）
 * 3. この課題で出した作品がある（返却済みもふくむ）
 * 4. このタブで、その提出物をまだ読み込んでいない
 * レッスンの課題では出さない（いまの主ボタンのまま）。
 * @param {object} input - 判断の材料
 * @param {boolean} [input.sessionVerified] - セッションを確かめられた
 * @param {boolean} [input.lesson] - レッスンの課題
 * @param {boolean} [input.projectChanged] - 開いてから変更があった
 * @param {boolean} [input.projectFromOutside] - ファイル・Google ドライブ・提出物などから開いた作品
 * @param {boolean} [input.hasBlocks] - ブロックがある（projectHasBlocks）
 * @param {?object} [input.current] - この課題で出した作品（normalizeContinueOptions の current）
 * @param {?string} [input.loadedSubmission] - このタブで読み込んだ提出物のキー（submissionKey）
 * @returns {boolean} 主ボタンにするとき true
 */
export const shouldOfferCurrentSubmission = ({
    sessionVerified = false,
    lesson = false,
    projectChanged = false,
    projectFromOutside = false,
    hasBlocks = true,
    current = null,
    loadedSubmission = null,
}) => {
    if (!sessionVerified || lesson) return false;
    if (projectChanged || projectFromOutside || hasBlocks) return false;
    if (!current || typeof current.projectUrl !== 'string' || !current.projectUrl) return false;
    const key = submissionKey(current);
    return !key || key !== loadedSubmission;
};

/**
 * 「スターターから始める」を主ボタンにするか。読み込み直したあと、まだ提出して
 * いない課題で、作品が新しい作品のまま（空）のときは、そのまま「つづける」を押すと空の作品で
 * 作り直すことになる。先生が用意したスタータープロジェクトがあるなら、そこから始めるのが
 * 主ボタン。shouldOfferCurrentSubmission との違いは、この課題で出した作品が無いことだけ。
 * すべて満たすときだけ true:
 * 1. クラスに参加中で、セッションを確かめられた
 * 2. いまの作品が新しい作品のまま（ブロックが無い・変更が無い・ファイルなどから開いていない）
 * 3. この課題で出した作品が無い（あれば shouldOfferCurrentSubmission の主ボタン）。提出の状態
 *    （ページを開いたときの確認の結果）でも未提出であること。出した作品の問い合わせに失敗して
 *    current が無いだけのときに、スターターを主ボタンにしないため。
 * 4. 課題にスタータープロジェクトがある
 * レッスンの課題では出さない（いまの主ボタンのまま）。
 * @param {object} input - 判断の材料（shouldOfferCurrentSubmission と同じ名前）
 * @param {boolean} [input.sessionVerified] - セッションを確かめられた
 * @param {boolean} [input.lesson] - レッスンの課題
 * @param {boolean} [input.projectChanged] - 開いてから変更があった
 * @param {boolean} [input.projectFromOutside] - ファイル・Google ドライブ・提出物などから開いた作品
 * @param {boolean} [input.hasBlocks] - ブロックがある（projectHasBlocks）
 * @param {?object} [input.current] - この課題で出した作品（normalizeContinueOptions の current）
 * @param {?string} [input.submissionStatus] - 提出の状態（未提出は null）
 * @param {boolean} [input.hasStarter] - 課題にスタータープロジェクトがある
 * @returns {boolean} 主ボタンにするとき true
 */
export const shouldOfferStarter = ({
    sessionVerified = false,
    lesson = false,
    projectChanged = false,
    projectFromOutside = false,
    hasBlocks = true,
    current = null,
    submissionStatus = null,
    hasStarter = false,
}) => {
    if (!sessionVerified || lesson || !hasStarter) return false;
    if (projectChanged || projectFromOutside || hasBlocks) return false;
    return !current && !submissionStatus;
};
