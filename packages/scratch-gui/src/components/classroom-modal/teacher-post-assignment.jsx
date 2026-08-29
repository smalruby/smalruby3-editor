import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';

import ErrorDisplay from './error-display.jsx';

import { formatClassLabel } from '../../lib/classroom-class-label.js';
import googleClassroomIcon from '../classroom-teacher-modal/google-classroom-icon.png';
import styles from './classroom-modal.css';

const TeacherPostAssignment = ({
    error,
    errorTitle,
    isLoading,
    group,
    selectedClassroom,
    onBack,
    onPostAssignment,
}) => {
    const defaultTitle = selectedClassroom?.assignmentName || '';
    const [title, setTitle] = useState(defaultTitle);
    const [description, setDescription] = useState('');
    const [posted, setPosted] = useState(false);
    const [alternateLink, setAlternateLink] = useState(null);

    const handlePost = useCallback(async () => {
        if (!title.trim()) return;
        try {
            const result = await onPostAssignment(title.trim(), description.trim());
            setPosted(true);
            if (result?.alternateLink) {
                setAlternateLink(result.alternateLink);
            }
        } catch {
            // error is shown via parent error state
        }
    }, [title, description, onPostAssignment]);

    const handleTitleChange = useCallback((e) => {
        setTitle(e.target.value);
    }, []);

    const handleDescriptionChange = useCallback((e) => {
        setDescription(e.target.value);
    }, []);

    // 課題詳細と同じ表記（例: 技術 2026年度）。group が無ければ従来の className。
    const targetLabel = group ? formatClassLabel(group) : selectedClassroom?.className;

    return (
        <div
            className={styles.postAssignmentContainer}
            data-testid="classroom-phase-teacher-post-assignment"
        >
            {posted ? (
                // 配信後: タイトル(成功) + ヒント + フッター（左=戻る / 右=確認）。
                // 基本レイアウト（プライマリー右下・キャンセル左下）に揃える。
                <div data-testid="classroom-post-assignment-success">
                    <div className={styles.postAssignmentSuccessTitle}>
                        {'✓ '}
                        <FormattedMessage
                            defaultMessage="Assignment posted!"
                            description="Assignment posted successfully"
                            id="gui.classroom.postAssignment.success"
                        />
                    </div>
                    <p className={styles.subViewHint}>
                        <FormattedMessage
                            defaultMessage="You can edit or delete this assignment on Google Classroom."
                            description="Hint after posting assignment"
                            id="gui.classroom.postAssignment.postHint"
                        />
                    </p>
                    <div className={styles.formFooter}>
                        <button
                            className={styles.secondaryButton}
                            data-testid="classroom-post-assignment-done"
                            type="button"
                            onClick={onBack}
                        >
                            <FormattedMessage
                                defaultMessage="Back to assignment detail"
                                description="Return to the assignment detail after posting"
                                id="gui.classroom.postAssignment.backToDetail"
                            />
                        </button>
                        {alternateLink && (
                            <a
                                className={styles.primaryButton}
                                data-testid="classroom-view-posted-assignment"
                                href={alternateLink}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                <img
                                    alt=""
                                    className={styles.gcImportIcon}
                                    src={googleClassroomIcon}
                                />
                                <FormattedMessage
                                    defaultMessage="View on Google Classroom"
                                    description="View posted assignment on Google Classroom"
                                    id="gui.classroom.postAssignment.viewOnGC"
                                />
                            </a>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className={styles.phaseTitle}>
                        <FormattedMessage
                            defaultMessage="Post assignment to Google Classroom"
                            description="Post assignment page title"
                            id="gui.classroom.postAssignment.pageTitle"
                        />
                    </div>
                    {/* クラス名（対象ラベルなし・課題詳細と同じ表記） */}
                    <div className={styles.postAssignmentTarget}>{targetLabel}</div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            <FormattedMessage
                                defaultMessage="Title:"
                                description="Assignment title label"
                                id="gui.classroom.postAssignment.titleLabel"
                            />
                        </label>
                        <input
                            className={styles.input}
                            data-testid="classroom-post-assignment-title"
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            <FormattedMessage
                                defaultMessage="Assignment details (optional)"
                                description="Assignment description label"
                                id="gui.classroom.postAssignment.descriptionLabel"
                            />
                        </label>
                        <textarea
                            className={styles.commentInput}
                            data-testid="classroom-post-assignment-description"
                            rows={3}
                            value={description}
                            onChange={handleDescriptionChange}
                        />
                    </div>
                    <div className={styles.subViewHint}>
                        <FormattedMessage
                            defaultMessage="After posting, you can edit details, set assignees, points, etc. on Google Classroom. You can also delete the assignment from Google Classroom."
                            description="Hint about Google Classroom settings"
                            id="gui.classroom.postAssignment.hint"
                        />
                    </div>
                    {/* 基本レイアウト: キャンセル左下（戻ると同じ挙動）/ プライマリー右下 */}
                    <div className={styles.formFooter}>
                        <button
                            className={styles.secondaryButton}
                            data-testid="classroom-post-assignment-cancel"
                            type="button"
                            onClick={onBack}
                        >
                            <FormattedMessage
                                defaultMessage="Cancel"
                                description="Cancel posting and go back"
                                id="gui.classroom.postAssignment.cancel"
                            />
                        </button>
                        <button
                            className={styles.primaryButton}
                            data-testid="classroom-post-assignment-submit"
                            disabled={!title.trim() || isLoading}
                            onClick={handlePost}
                        >
                            <img
                                alt=""
                                className={styles.gcImportIcon}
                                src={googleClassroomIcon}
                            />
                            <FormattedMessage
                                defaultMessage="Post to Google Classroom"
                                description="Post assignment button"
                                id="gui.classroom.postAssignment.post"
                            />
                        </button>
                    </div>
                </>
            )}
            <ErrorDisplay error={error} errorTitle={errorTitle} />
        </div>
    );
};

TeacherPostAssignment.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    group: PropTypes.shape({
        name: PropTypes.string,
        year: PropTypes.number,
        section: PropTypes.string,
    }),
    isLoading: PropTypes.bool,
    onBack: PropTypes.func,
    onPostAssignment: PropTypes.func.isRequired,
    selectedClassroom: PropTypes.shape({
        assignmentName: PropTypes.string,
        className: PropTypes.string,
    }),
};

export default TeacherPostAssignment;
