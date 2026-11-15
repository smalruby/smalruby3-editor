/**
 * Where the teacher is: 「クラス管理 › クラス名 › 課題名」 (#1956 Q2).
 *
 * The path is shown in the purple header of the class management screen, not
 * in a row of its own. Each screen still says its own path (it knows its sub
 * views), and this component carries it up to the header through a portal
 * (`BreadcrumbSlotContext`). Items with an onClick render as links that go
 * back up; the last item is the current place (bold).
 *
 * Outside the header (no provider, e.g. a unit test of one screen) the path is
 * drawn in place, so every screen keeps working on its own.
 */
import PropTypes from 'prop-types';
import React, { useContext } from 'react';
import ReactDOM from 'react-dom';
import { defineMessages } from 'react-intl';
import styles from './classroom-modal.css';

/**
 * The header's slot element. `false` = no header (draw in place),
 * `null` = the header is not mounted yet (draw nothing for now).
 */
export const BreadcrumbSlotContext = React.createContext(false);

export const breadcrumbMessages = defineMessages({
    // The top of the path. The same descriptor as the modal's title.
    top: {
        defaultMessage: 'Class Management',
        description: 'Title for the teacher class management modal',
        id: 'gui.classroom.management.title',
    },
});

const BreadcrumbList = ({ items }) => (
    <nav className={styles.breadcrumbs} data-testid="classroom-breadcrumbs">
        {items.map((item, index) => {
            const handleItemClick = item.onClick;
            return (
                // label は node (FormattedMessage) のこともあり key にすると
                // "[object Object]" で衝突するため、位置を key にする
                // (パンくずは 1 レンダリング内で並べ替わらない)。
                <React.Fragment key={index}>
                    {index > 0 ? (
                        <span aria-hidden="true" className={styles.breadcrumbSeparator}>
                            {'›'}
                        </span>
                    ) : null}
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
                        <span aria-current="page" className={styles.breadcrumbCurrent} data-testid={item.testId}>
                            {item.label}
                        </span>
                    )}
                </React.Fragment>
            );
        })}
    </nav>
);

const itemsShape = PropTypes.arrayOf(
    PropTypes.shape({
        label: PropTypes.node.isRequired,
        onClick: PropTypes.func,
        testId: PropTypes.string,
    }),
);

BreadcrumbList.propTypes = {
    items: itemsShape.isRequired,
};

const TeacherBreadcrumbs = ({ items }) => {
    const slot = useContext(BreadcrumbSlotContext);
    if (slot === false) return <BreadcrumbList items={items} />;
    if (!slot) return null;
    return ReactDOM.createPortal(<BreadcrumbList items={items} />, slot);
};

TeacherBreadcrumbs.propTypes = {
    items: itemsShape.isRequired,
};

export default TeacherBreadcrumbs;
