/**
 * Breadcrumb navigation for the teacher views (v2: no sidebar — this is the
 * only way back). Items with an onClick render as links; the last item is
 * the current view.
 */
import PropTypes from 'prop-types';
import React from 'react';

import styles from './classroom-modal.css';

const TeacherBreadcrumbs = ({ items }) => (
    <nav className={styles.breadcrumbs} data-testid="classroom-breadcrumbs">
        {items.map((item, index) => {
            const handleItemClick = item.onClick;
            return (
                <React.Fragment key={item.label}>
                    {index > 0 ? <span className={styles.breadcrumbSeparator}>{'>'}</span> : null}
                    {handleItemClick ? (
                        <button
                            className={styles.breadcrumbLink}
                            data-testid={item.testId}
                            type="button"
                            onClick={handleItemClick}
                        >
                            {item.label}
                        </button>
                    ) : (
                        <span className={styles.breadcrumbCurrent}>{item.label}</span>
                    )}
                </React.Fragment>
            );
        })}
    </nav>
);

TeacherBreadcrumbs.propTypes = {
    items: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.node.isRequired,
            onClick: PropTypes.func,
            testId: PropTypes.string,
        }),
    ).isRequired,
};

export default TeacherBreadcrumbs;
