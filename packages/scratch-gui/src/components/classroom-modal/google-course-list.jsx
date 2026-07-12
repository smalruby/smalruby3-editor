import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './classroom-modal.css';

const GoogleCourseList = ({ courses, importedCourseIds, selectedCourseId, onSelect }) => {
    const handleClick = useCallback(
        (e) => {
            const courseId = e.currentTarget.dataset.courseId;
            const course = courses.find((c) => c.courseId === courseId);
            if (course) onSelect(course);
        },
        [courses, onSelect],
    );

    return (
        <div className={styles.courseTileGrid}>
            {courses.map((course) => (
                <button
                    className={classNames(styles.courseTile, {
                        [styles.courseTileSelected]:
                            selectedCourseId === course.courseId,
                    })}
                    data-course-id={course.courseId}
                    data-testid={`classroom-google-course-${course.courseId}`}
                    key={course.courseId}
                    onClick={handleClick}
                >
                    <span className={styles.courseTileName}>
                        {course.name}
                    </span>
                    {course.section && (
                        <span className={styles.courseTileSection}>
                            {course.section}
                        </span>
                    )}
                    {(importedCourseIds || []).includes(course.courseId) && (
                        <span
                            className={styles.courseTileImported}
                            data-testid={`classroom-google-course-imported-${course.courseId}`}
                        >
                            <FormattedMessage
                                defaultMessage="Imported"
                                description="Badge on a Google Classroom course that was already imported"
                                id="gui.classroom.management.importedBadge"
                            />
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
};

GoogleCourseList.propTypes = {
    importedCourseIds: PropTypes.arrayOf(PropTypes.string),
    courses: PropTypes.arrayOf(
        PropTypes.shape({
            courseId: PropTypes.string,
            name: PropTypes.string,
            section: PropTypes.string,
            studentCount: PropTypes.number,
        }),
    ).isRequired,
    onSelect: PropTypes.func.isRequired,
    selectedCourseId: PropTypes.string,
};

export default GoogleCourseList;
