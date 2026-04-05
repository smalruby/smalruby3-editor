import { FormattedMessage } from 'react-intl';
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
        <ul className={styles.classList}>
            {courses.map((course) => (
                <li
                    className={`${styles.classItem} ${selectedCourseId === course.courseId ? styles.classItemSelected : ''}`}
                    data-course-id={course.courseId}
                    data-testid={`classroom-google-course-${course.courseId}`}
                    key={course.courseId}
                    onClick={handleClick}
                >
                    <div className={styles.classItemMain}>
                        <span className={styles.classItemName}>
                            {course.name}
                        </span>
                        {course.section && (
                            <span className={styles.classItemCode}>
                                {course.section}
                            </span>
                        )}
                    </div>
                    <div className={styles.classItemMeta}>
                        <span>
                            <FormattedMessage
                                defaultMessage="{count} students"
                                description="Student count"
                                id="gui.classroom.googleCourses.students"
                                values={{ count: course.studentCount }}
                            />
                        </span>
                    </div>
                </li>
            ))}
        </ul>
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
