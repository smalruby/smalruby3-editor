import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const TeacherPostAssignment = ({
    error,
    errorTitle,
    isLoading,
    noBackButton,
    selectedClassroom,
    onBack,
    onPostAssignment,
}) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [posted, setPosted] = useState(false);

    const handlePost = useCallback(async () => {
        if (!title.trim()) return;
        try {
            await onPostAssignment(title.trim(), description.trim());
            setPosted(true);
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

    return (
        <div
            className={styles.phaseContainer}
            data-testid="classroom-phase-teacher-post-assignment"
        >
            {!noBackButton && (
                <button
                    className={styles.backButton}
                    data-testid="classroom-back"
                    onClick={onBack}
                >
                    {'< '}
                    <FormattedMessage
                        defaultMessage="Back"
                        description="Back button"
                        id="gui.classroom.back"
                    />
                </button>
            )}
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Post Assignment"
                    description="Post assignment to Google Classroom"
                    id="gui.classroom.postAssignment.title"
                />
            </div>
            <div className={styles.detailLabel}>
                {selectedClassroom?.className}
            </div>
            {posted ? (
                <div
                    className={styles.successMessage}
                    data-testid="classroom-post-assignment-success"
                >
                    <FormattedMessage
                        defaultMessage="Assignment posted!"
                        description="Assignment posted successfully"
                        id="gui.classroom.postAssignment.success"
                    />
                </div>
            ) : (
                <>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                            <FormattedMessage
                                defaultMessage="Title"
                                description="Assignment title label"
                                id="gui.classroom.postAssignment.titleLabel"
                            />
                        </label>
                        <input
                            className={styles.formInput}
                            data-testid="classroom-post-assignment-title"
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                            <FormattedMessage
                                defaultMessage="Description (optional)"
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
                    <button
                        className={styles.primaryButton}
                        data-testid="classroom-post-assignment-submit"
                        disabled={!title.trim() || isLoading}
                        onClick={handlePost}
                    >
                        <FormattedMessage
                            defaultMessage="Post to Google Classroom"
                            description="Post assignment button"
                            id="gui.classroom.postAssignment.post"
                        />
                    </button>
                </>
            )}
            <ErrorDisplay error={error} errorTitle={errorTitle} />
        </div>
    );
};

TeacherPostAssignment.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    noBackButton: PropTypes.bool,
    onBack: PropTypes.func,
    onPostAssignment: PropTypes.func.isRequired,
    selectedClassroom: PropTypes.shape({
        className: PropTypes.string,
    }),
};

export default TeacherPostAssignment;
