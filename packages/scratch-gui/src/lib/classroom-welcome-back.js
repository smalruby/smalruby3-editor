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
 * どれかの target（スプライト・ステージ）にブロックがあるか。読めない target はブロックがある
 * とみなす（迷ったら「つづける」）。
 * @param {?Array<object>} targets - vm.runtime.targets
 * @returns {boolean} ブロックがあるとき true
 */
export const projectHasBlocks = (targets) => {
    if (!Array.isArray(targets)) return true;
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
