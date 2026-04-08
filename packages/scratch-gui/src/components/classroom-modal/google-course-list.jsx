import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import styles from './classroom-modal.css';

const GoogleCourseList = ({ courses, selectedCourseId, onSelect }) => {
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
                </button>
            ))}
        </div>
    );
};

GoogleCourseList.propTypes = {
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
