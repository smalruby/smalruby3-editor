/**
 * メニューバーの「提出する」ボタンの出し分け (#1795)。
 *
 * 決まりは docs/classroom/ui-ux.md の「メニューバー」の表が正。参加中はいつも出し、
 * 提出の入口をここに 1 つにまとめる（クラスの画面には提出のボタンを置かない）。
 */
import { canSubmitAssignment } from './lessons/assignment-progress.js';

/** ボタンの種類。未提出 = オレンジの「提出する」、提出済み・返却済み = 緑。 */
const MENU_SUBMIT_KINDS = {
    SUBMIT: 'submit',
    SUBMITTED: 'submitted',
    RETURNED: 'returned',
};

/**
 * この課題にもう出したか（提出済み・返却済み）。出していれば提出確認は再提出の流れになる。
 * @param {?string} submissionStatus - この課題の提出状況
 * @returns {boolean} 提出済み・返却済みなら true
 */
const isResubmit = (submissionStatus) => submissionStatus === 'submitted' || submissionStatus === 'returned';

/**
 * メニューバーに出すボタンを決める。
 * @param {object} input - 生徒の状態
 * @param {boolean} input.joined - 課題に参加中か
 * @param {?string} [input.submissionStatus] - この課題の提出状況
 * @param {?object} [input.lesson] - レッスンの課題の設定（normalizeAssignmentLesson の結果）
 * @param {?object} [input.lessonStatus] - レッスンの進み具合（assignmentProgress の結果）
 * @returns {?string} MENU_SUBMIT_KINDS のどれか。出さないときは null
 */
const menuSubmitKind = ({ joined, submissionStatus = null, lesson = null, lessonStatus = null }) => {
    if (!joined) return null;
    // 作品を提出しないレッスンの課題には提出が無い（段 2 の決まり）。
    if (lesson && !lesson.submitWork) return null;
    if (submissionStatus === 'returned') return MENU_SUBMIT_KINDS.RETURNED;
    if (submissionStatus === 'submitted') return MENU_SUBMIT_KINDS.SUBMITTED;
    // 作品も提出するレッスンの課題は、条件を満たすまで出さない（一度出したら上で出し続ける）。
    if (lesson && !canSubmitAssignment(lesson, lessonStatus)) return null;
    return MENU_SUBMIT_KINDS.SUBMIT;
};

/**
 * verify-session の応答から、この課題の提出状況を読む (#1795)。
 *
 * 応答はいつも `submission` を持つ（無ければ null = まだ出していない）。ページを開いたとき・
 * クラスの画面を開いたときの確かめで、メニューバーのボタンを古いままにしないために使う。
 * 別の PC で出した・先生が返却した、もこれで反映される。
 * @param {?object} result - verify-session の応答
 * @returns {?{status: ?string, submittedAt: ?string, teacherComment: ?string}} 提出状況。
 *   応答に `submission` が無い（古いサーバーなど）ときは null（いまの値を変えない）
 */
const submissionFromVerify = (result) => {
    if (!result || typeof result !== 'object' || !('submission' in result)) return null;
    const sub = result.submission;
    if (!sub) return { status: null, submittedAt: null, teacherComment: null };
    return {
        status: sub.status || 'submitted',
        submittedAt: sub.submittedAt || null,
        teacherComment: sub.teacherComment || null,
    };
};

export { MENU_SUBMIT_KINDS, isResubmit, menuSubmitKind, submissionFromVerify };
