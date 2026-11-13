/**
 * 生徒の画面の「進む順の帯」（① 参加 → ② 番号 → ③ はじめる → ④ つくる → ⑤ 提出）の状態 (#1792)。
 *
 * どの画面でどの段が「いま」かは docs/classroom/ui-ux.md の「進む順の帯」の表が正。
 * 手順を説明する文（「つぎにやること」）の代わりに、いまどこにいるかを帯で伝える。
 */

/** 帯の段（左から順に）。 */
const STUDENT_STEPS = ['join', 'seat', 'start', 'make', 'submit'];

/** 全部すんだ（提出済み・返却済み）ときの値。帯は全部緑で ⑤ に ✓ を付ける。 */
const STEPS_COMPLETE = 'complete';

const PHASE_STEP = {
    'student-join': 'join',
    'student-seat': 'seat',
    'student-joined': 'start',
    'student-assignment': 'start',
    'student-status': 'make',
    'student-submit-confirm': 'submit',
};

// 提出してから開いた画面（提出できました・おかえりなさい・課題パネル）は全部すんだ。
// 参加完了と提出確認は、提出済みでもその段にいる（入り直し・再提出の途中のため）。
const PHASES_DONE_WHEN_SUBMITTED = ['student-assignment', 'student-status'];

const isSubmitted = (submissionStatus) => submissionStatus === 'submitted' || submissionStatus === 'returned';

/**
 * いまの段を決める。
 * @param {object} input - 画面の状態
 * @param {string} [input.phase] - クラスの画面のフェーズ（`student-*`）
 * @param {?string} [input.submissionStatus] - この課題の提出状況（submitted / returned / それ以外）
 * @param {boolean} [input.assignmentReopened] - 課題パネルを「課題を見る」から開き直した
 * @param {?{submitWork: boolean, cleared: boolean}} [input.lesson] - レッスンの課題の設定と進み具合
 * @returns {?string} 段の名前（STUDENT_STEPS）、全部すんだら 'complete'、生徒の画面でなければ null
 */
const studentCurrentStep = ({ phase, submissionStatus = null, assignmentReopened = false, lesson = null } = {}) => {
    const step = PHASE_STEP[phase];
    if (!step) return null;
    if (PHASES_DONE_WHEN_SUBMITTED.includes(phase)) {
        if (isSubmitted(submissionStatus)) return STEPS_COMPLETE;
        // 作品を提出しないレッスンの課題には ⑤ 提出が無いので、課題クリアで全部すんだとする。
        if (lesson && lesson.submitWork === false && lesson.cleared) return STEPS_COMPLETE;
    }
    if (phase === 'student-assignment' && assignmentReopened) return 'make';
    return step;
};

/**
 * 帯の各段の状態（done = すんだ・now = いま・todo = まだ）。
 * @param {object} input - studentCurrentStep と同じ
 * @returns {?{complete: boolean, steps: Array<{step: string, state: string}>}} 生徒の画面でなければ null
 */
const studentStepStates = (input) => {
    const current = studentCurrentStep(input);
    if (!current) return null;
    const complete = current === STEPS_COMPLETE;
    const currentIndex = complete ? STUDENT_STEPS.length : STUDENT_STEPS.indexOf(current);
    return {
        complete,
        steps: STUDENT_STEPS.map((step, index) => {
            let state = 'todo';
            if (index < currentIndex) state = 'done';
            else if (index === currentIndex) state = 'now';
            return { step, state };
        }),
    };
};

export { STEPS_COMPLETE, STUDENT_STEPS, studentCurrentStep, studentStepStates };
