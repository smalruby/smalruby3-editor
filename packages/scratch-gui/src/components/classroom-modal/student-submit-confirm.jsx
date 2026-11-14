import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import StudentMainButton from './student-main-button.jsx';
import partStyles from './student-screen-parts.css';
import StudentTextLink from './student-text-link.jsx';

const SubmitButtonLabel = ({ isSubmitting, resubmit, submitProgress }) => {
    if (isSubmitting && submitProgress) {
        return `${submitProgress.label} (${submitProgress.current}/${submitProgress.total})`;
    }
    if (isSubmitting) {
        return (
            <FormattedMessage
                defaultMessage="Submitting..."
                description="Submitting progress"
                id="gui.classroom.submitConfirm.submitting"
            />
        );
    }
    return resubmit ? (
        <FormattedMessage
            defaultMessage="Submit again"
            description="Confirm button of the submit confirmation when the student already submitted (resubmit)"
            id="gui.classroom.submitConfirm.resubmit"
        />
    ) : (
        <FormattedMessage
            defaultMessage="Submit"
            description="Confirm submit button"
            id="gui.classroom.submitConfirm.submit"
        />
    );
};

SubmitButtonLabel.propTypes = {
    isSubmitting: PropTypes.bool,
    resubmit: PropTypes.bool,
    submitProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
        label: PropTypes.string,
    }),
};

/**
 * 提出確認 (#1795)。メニューバーの「提出する」（提出済みなら「提出済み ✓」）から開く。
 * 主ボタンは「提出する」1 つ（右）・「やめる」は小さなリンク（左）。提出済み・返却済みからは
 * 再提出の流れ（「もう一度提出します」・前の作品が置きかわる案内・返却のコメント）。
 * @param {object} props - component props
 * @param {?string} [props.thumbnailDataUrl] - 提出するサムネイル
 * @param {boolean} [props.checking] - 提出の状態をサーバーに確かめている途中。確かめ終わるまで
 *   見出しと主ボタンを出さない（あとで「もう一度提出します」に切りかわらないように）
 * @param {boolean} [props.isSubmitting] - 送信中（このときだけ「提出中...」。確かめ中には出さない）
 * @param {boolean} [props.resubmit] - この課題にもう出した（提出済み・返却済み）
 * @param {?object} [props.submitProgress] - ブロック画像を撮っている途中の進み具合
 * @param {?string} [props.teacherComment] - 返却されたときの先生のコメント（再提出のときだけ出す）
 * @param {?string} [props.error] - エラーの文
 * @param {?string} [props.errorTitle] - エラーの見出し
 * @param {Function} props.onConfirmSubmit - 「提出する」を押したとき
 * @param {Function} props.onCancelSubmit - 「やめる」を押したとき
 * @returns {React.ReactElement} the confirmation
 */
const StudentSubmitConfirm = ({
    thumbnailDataUrl,
    checking = false,
    isSubmitting = false,
    resubmit = false,
    submitProgress,
    teacherComment = null,
    error,
    errorTitle,
    onConfirmSubmit,
    onCancelSubmit,
}) =>
    checking ? (
        <div data-testid="classroom-phase-submit-confirm">
            <div className={partStyles.submitChecking} data-testid="classroom-submit-checking" role="status">
                <FormattedMessage
                    defaultMessage="Checking your submission..."
                    description="Quiet line on the submit confirmation while the submission status is being checked"
                    id="gui.classroom.submitConfirm.checking"
                />
            </div>
            <div className={partStyles.submitActions}>
                <StudentTextLink dataTestId="classroom-submit-cancel" onClick={onCancelSubmit}>
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Cancel submit button"
                        id="gui.classroom.submitConfirm.cancel"
                    />
                </StudentTextLink>
            </div>
        </div>
    ) : (
        <div data-testid="classroom-phase-submit-confirm">
            <div className={styles.phaseTitle}>
                {resubmit ? (
                    <FormattedMessage
                        defaultMessage="Submit again"
                        description="Submit confirmation title when the student already submitted (resubmit)"
                        id="gui.classroom.submitConfirm.resubmitTitle"
                    />
                ) : (
                    <FormattedMessage
                        defaultMessage="Submit your project"
                        description="Submit confirmation title"
                        id="gui.classroom.submitConfirm.title"
                    />
                )}
            </div>
            {thumbnailDataUrl && (
                <div className={styles.thumbnailPreview}>
                    <img
                        alt="Project thumbnail"
                        className={styles.thumbnailImage}
                        data-testid="classroom-submit-preview"
                        src={thumbnailDataUrl}
                    />
                </div>
            )}
            <div className={styles.description}>
                {resubmit ? (
                    <FormattedMessage
                        defaultMessage="The project you submitted before will be replaced with your current project."
                        description="Submit confirmation message when the student already submitted (resubmit)"
                        id="gui.classroom.submitConfirm.resubmitMessage"
                    />
                ) : (
                    <FormattedMessage
                        defaultMessage="Are you sure you want to submit your current project?"
                        description="Submit confirmation message"
                        id="gui.classroom.submitConfirm.message"
                    />
                )}
            </div>
            {resubmit && teacherComment && (
                <div className={styles.teacherCommentBox} data-testid="classroom-submit-teacher-comment">
                    <span className={styles.statusLabel}>
                        <FormattedMessage
                            defaultMessage="Teacher's Comment"
                            description="Teacher comment label"
                            id="gui.classroom.studentStatus.teacherComment"
                        />
                    </span>
                    <span className={styles.teacherCommentText}>{teacherComment}</span>
                </div>
            )}
            <div className={partStyles.submitActions}>
                <StudentTextLink
                    dataTestId="classroom-submit-cancel"
                    disabled={isSubmitting}
                    onClick={onCancelSubmit}
                >
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Cancel submit button"
                        id="gui.classroom.submitConfirm.cancel"
                    />
                </StudentTextLink>
                <div className={partStyles.submitActionsMain}>
                    <StudentMainButton
                        dataTestId="classroom-submit-confirm"
                        disabled={isSubmitting}
                        onClick={onConfirmSubmit}
                    >
                        <SubmitButtonLabel
                            isSubmitting={isSubmitting}
                            resubmit={resubmit}
                            submitProgress={submitProgress}
                        />
                    </StudentMainButton>
                </div>
            </div>
            <ErrorDisplay error={error} errorTitle={errorTitle} />
        </div>
    );

StudentSubmitConfirm.propTypes = {
    checking: PropTypes.bool,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isSubmitting: PropTypes.bool,
    onCancelSubmit: PropTypes.func.isRequired,
    onConfirmSubmit: PropTypes.func.isRequired,
    // この課題にもう出した（提出済み・返却済み）: 再提出の流れ
    resubmit: PropTypes.bool,
    submitProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
        label: PropTypes.string,
    }),
    // 返却されたときの先生のコメント（再提出のときだけ出す）
    teacherComment: PropTypes.string,
    thumbnailDataUrl: PropTypes.string,
};

export default StudentSubmitConfirm;
