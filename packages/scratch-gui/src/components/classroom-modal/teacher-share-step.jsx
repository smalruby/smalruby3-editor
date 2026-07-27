/**
 * 課題の共有設定ステップ（#1109）。ボード（課題一覧）の各行「共有」から開く。
 * 深さは クラス > 課題 > 共有 に収める。公開範囲を選ぶ:
 * - 限定公開（合言葉）: 内輪だけに合言葉で共有。同意・属性なしのかんたん発行で、
 *   研究授業で少し試した課題でも出せる（完璧さの圧を下げる）。あとで全体公開へ。
 * - 全体公開（みんなの課題）: 既存の SharedAssignmentForm（属性・CC BY 同意）。
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import SharedAssignmentForm from './shared-assignment-form.jsx';
import styles from './classroom-modal.css';

const TeacherShareStep = ({ classroom, isLoading, lastShared, onShare, onCancel }) => {
    const [mode, setMode] = useState('limited');
    const [title, setTitle] = useState(classroom.assignmentName || classroom.className || '');
    const [copied, setCopied] = useState(false);

    const handleTitleChange = useCallback((e) => setTitle(e.target.value), []);
    const handleModeLimited = useCallback(() => setMode('limited'), []);
    const handleModePublic = useCallback(() => setMode('public'), []);
    const handleShareLimited = useCallback(() => {
        if (!title.trim()) return;
        onShare({ classroomId: classroom.classroomId, title: title.trim(), visibility: 'limited' });
    }, [onShare, classroom.classroomId, title]);
    const handleCopyPasscode = useCallback(() => {
        if (lastShared && lastShared.passcode && navigator.clipboard) {
            navigator.clipboard.writeText(lastShared.passcode).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [lastShared]);

    // 発行後の確認。限定公開なら合言葉を大きく表示し、配布を促す。
    if (lastShared) {
        return (
            <div className={styles.boardInnerView} data-testid="classroom-phase-share-step">
                <div className={styles.phaseTitle}>
                    <FormattedMessage
                        defaultMessage="Shared"
                        description="Title after sharing an assignment"
                        id="gui.classroom.shared.shareDoneTitle"
                    />
                </div>
                {lastShared.passcode ? (
                    <>
                        <div className={styles.sharePasscodeBox} data-testid="classroom-share-passcode">
                            <span className={styles.sharePasscodeLabel}>
                                <FormattedMessage
                                    defaultMessage="Passcode"
                                    description="Label for the 合言葉"
                                    id="gui.classroom.shared.passcodeLabel"
                                />
                                {': '}
                            </span>
                            <span
                                className={styles.sharePasscodeValue}
                                data-testid="classroom-share-passcode-value"
                            >
                                {lastShared.passcode}
                            </span>
                            <button
                                className={styles.secondaryButton}
                                data-testid="classroom-share-passcode-copy"
                                type="button"
                                onClick={handleCopyPasscode}
                            >
                                {copied ? (
                                    <FormattedMessage
                                        defaultMessage="Copied"
                                        description="Copied confirmation"
                                        id="gui.classroom.codeDisplay.copied"
                                    />
                                ) : (
                                    <FormattedMessage
                                        defaultMessage="Copy"
                                        description="Copy the passcode"
                                        id="gui.classroom.shared.copyPasscode"
                                    />
                                )}
                            </button>
                        </div>
                        <p className={styles.postAssignmentHint}>
                            <FormattedMessage
                                defaultMessage={
                                    'Share this passcode so fellow teachers can import it with ' +
                                    '"Import by passcode". You can widen it to the public library later.'
                                }
                                description="Hint after limited sharing"
                                id="gui.classroom.shared.passcodeHint"
                            />
                        </p>
                    </>
                ) : (
                    <p className={styles.sharedFormSuccess} data-testid="shared-form-success">
                        <FormattedMessage
                            defaultMessage={'Published to みんなの課題: "{title}"'}
                            description="Confirmation after publishing to the public library"
                            id="gui.classroom.shared.publishedShort"
                            values={{ title: lastShared.title }}
                        />
                    </p>
                )}
                <div className={styles.formFooter}>
                    <span />
                    <button
                        className={styles.primaryButton}
                        data-testid="classroom-share-done"
                        type="button"
                        onClick={onCancel}
                    >
                        <FormattedMessage
                            defaultMessage="Close"
                            description="Close the share step"
                            id="gui.classroom.shared.shareClose"
                        />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.boardInnerView} data-testid="classroom-phase-share-step">
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Share this assignment"
                    description="Share step title"
                    id="gui.classroom.shared.shareStepTitle"
                />
            </div>
            <div className={styles.postAssignmentTarget}>
                {classroom.assignmentName || classroom.className}
            </div>

            {/* 公開範囲の選択 */}
            <div className={styles.shareModeRow} role="radiogroup">
                <button
                    className={classNames(styles.shareModeCard, mode === 'limited' && styles.shareModeCardActive)}
                    data-testid="classroom-share-mode-limited"
                    type="button"
                    onClick={handleModeLimited}
                >
                    <span className={styles.shareModeName}>
                        <FormattedMessage
                            defaultMessage="Limited (passcode)"
                            description="Limited sharing mode"
                            id="gui.classroom.shared.modeLimited"
                        />
                    </span>
                    <span className={styles.shareModeDesc}>
                        <FormattedMessage
                            defaultMessage="Share with fellow teachers by passcode. Easy — it doesn't have to be perfect."
                            description="Limited sharing description"
                            id="gui.classroom.shared.modeLimitedDesc"
                        />
                    </span>
                </button>
                <button
                    className={classNames(styles.shareModeCard, mode === 'public' && styles.shareModeCardActive)}
                    data-testid="classroom-share-mode-public"
                    type="button"
                    onClick={handleModePublic}
                >
                    <span className={styles.shareModeName}>
                        <FormattedMessage
                            defaultMessage="Public (みんなの課題)"
                            description="Public sharing mode"
                            id="gui.classroom.shared.modePublic"
                        />
                    </span>
                    <span className={styles.shareModeDesc}>
                        <FormattedMessage
                            defaultMessage="Publish to the catalog everyone can browse."
                            description="Public sharing description"
                            id="gui.classroom.shared.modePublicDesc"
                        />
                    </span>
                </button>
            </div>

            {mode === 'limited' ? (
                <>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            <FormattedMessage
                                defaultMessage="Title:"
                                description="Title label for limited sharing"
                                id="gui.classroom.shared.limitedTitleLabel"
                            />
                        </label>
                        <input
                            className={styles.input}
                            data-testid="classroom-share-limited-title"
                            maxLength={50}
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                        />
                    </div>
                    <p className={styles.postAssignmentHint}>
                        <FormattedMessage
                            defaultMessage={
                                'A passcode will be issued. Even a lesson you only tried a little in a ' +
                                'research class is fine. You can widen it to the public library later.'
                            }
                            description="Hint for limited sharing"
                            id="gui.classroom.shared.limitedHint"
                        />
                    </p>
                    <div className={styles.formFooter}>
                        <button
                            className={styles.secondaryButton}
                            data-testid="classroom-share-cancel"
                            type="button"
                            onClick={onCancel}
                        >
                            <FormattedMessage
                                defaultMessage="Cancel"
                                description="Cancel sharing"
                                id="gui.classroom.shared.shareCancel"
                            />
                        </button>
                        <button
                            className={styles.primaryButton}
                            data-testid="classroom-share-limited-submit"
                            disabled={!title.trim() || isLoading}
                            type="button"
                            onClick={handleShareLimited}
                        >
                            <FormattedMessage
                                defaultMessage="Issue a passcode and share (limited)"
                                description="Limited share submit button"
                                id="gui.classroom.shared.limitedSubmit"
                            />
                        </button>
                    </div>
                </>
            ) : (
                <SharedAssignmentForm
                    isLoading={isLoading}
                    selectedClassroom={classroom}
                    onCancel={onCancel}
                    onShare={onShare}
                />
            )}
        </div>
    );
};

TeacherShareStep.propTypes = {
    classroom: PropTypes.shape({
        classroomId: PropTypes.string,
        assignmentName: PropTypes.string,
        className: PropTypes.string,
    }).isRequired,
    isLoading: PropTypes.bool,
    lastShared: PropTypes.shape({
        title: PropTypes.string,
        passcode: PropTypes.string,
    }),
    onCancel: PropTypes.func.isRequired,
    onShare: PropTypes.func.isRequired,
};

export default TeacherShareStep;
