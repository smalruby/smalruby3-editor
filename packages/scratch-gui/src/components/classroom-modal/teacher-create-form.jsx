import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const TeacherCreateForm = ({
    error,
    errorTitle,
    importSource,
    isLoading,
    noBackButton,
    onBack,
    onCreate,
}) => {
    const defaultName = importSource
        ? `${importSource.name}${importSource.section ? ` (${importSource.section})` : ''}`
        : '';
    const defaultCount =
        importSource?.studentCount > 0
            ? String(importSource.studentCount)
            : '35';
    const [className, setClassName] = React.useState(defaultName);
    const [studentCount, setStudentCount] = React.useState(defaultCount);

    const handleClassNameChange = useCallback((e) => {
        setClassName(e.target.value);
    }, []);

    const handleStudentCountChange = useCallback((e) => {
        setStudentCount(e.target.value);
    }, []);

    const handleSubmit = useCallback(() => {
        const count = parseInt(studentCount, 10);
        if (className.trim() && count > 0 && count <= 50) {
            onCreate({ className: className.trim(), studentCount: count });
        }
    }, [className, studentCount, onCreate]);

    return (
        <div data-testid="classroom-phase-teacher-create">
            {!noBackButton && (
                <button
                    className={styles.backLink}
                    data-testid="classroom-back"
                    onClick={onBack}
                >
                    {'<'}{' '}
                    <FormattedMessage
                        defaultMessage="Back"
                        description="Back button"
                        id="gui.classroom.back"
                    />
                </button>
            )}
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Create Classroom"
                    description="Create classroom form title"
                    id="gui.classroom.teacherCreate.title"
                />
            </div>
            <div className={styles.formHint}>
                <FormattedMessage
                    defaultMessage='Create a classroom for each assignment. Example: &quot;Lesson 3: Build a Chat App&quot;'
                    description="Hint explaining classroom = assignment"
                    id="gui.classroom.teacherCreate.hint"
                />
            </div>
            {importSource && (
                <div className={styles.importSourceInfo}>
                    <FormattedMessage
                        defaultMessage="Importing from: {source}"
                        description="Shows Google Classroom import source"
                        id="gui.classroom.teacherCreate.importSource"
                        values={{
                            source: `${importSource.name}${importSource.section ? ` (${importSource.section})` : ''}`,
                        }}
                    />
                </div>
            )}
            <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="classroom-name">
                    <FormattedMessage
                        defaultMessage="Assignment Name"
                        description="Assignment name input label"
                        id="gui.classroom.teacherCreate.assignmentName"
                    />
                </label>
                <input
                    className={styles.input}
                    data-testid="classroom-name-input"
                    id="classroom-name"
                    maxLength={50}
                    type="text"
                    value={className}
                    onChange={handleClassNameChange}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="classroom-count">
                    <FormattedMessage
                        defaultMessage="Number of Students"
                        description="Student count input label"
                        id="gui.classroom.teacherCreate.count"
                    />
                </label>
                <input
                    className={styles.input}
                    data-testid="classroom-count-input"
                    id="classroom-count"
                    max={50}
                    min={1}
                    type="number"
                    value={studentCount}
                    onChange={handleStudentCountChange}
                />
            </div>
            <div className={styles.buttonRow}>
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-create-submit"
                    disabled={!className.trim() || isLoading}
                    onClick={handleSubmit}
                >
                    <FormattedMessage
                        defaultMessage="Create"
                        description="Submit create classroom button"
                        id="gui.classroom.teacherCreate.submit"
                    />
                </button>
            </div>
            <div className={styles.formFooterHint}>
                <FormattedMessage
                    defaultMessage="After creating, you can share the assignment link to Google Classroom."
                    description="Hint about posting to Google Classroom after creation"
                    id="gui.classroom.teacherCreate.footerHint"
                />
            </div>
            <ErrorDisplay error={error} errorTitle={errorTitle} />
        </div>
    );
};

TeacherCreateForm.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    importSource: PropTypes.shape({
        name: PropTypes.string,
        section: PropTypes.string,
        studentCount: PropTypes.number,
    }),
    isLoading: PropTypes.bool,
    noBackButton: PropTypes.bool,
    onBack: PropTypes.func,
    onCreate: PropTypes.func.isRequired,
};

export default TeacherCreateForm;
