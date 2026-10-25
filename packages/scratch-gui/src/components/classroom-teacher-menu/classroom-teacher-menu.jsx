import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import MenuBarMenu from '../menu-bar/menu-bar-menu.jsx';
import { MenuItem, MenuSection } from '../menu/menu.jsx';
import styles from './classroom-teacher-menu.css';

const ITEM_LABELS = {
    'kick-requests': (count) => (
        <FormattedMessage
            defaultMessage="Kick requests ({count})"
            description="Teacher menu item: open the pending kick requests (#1200)"
            id="gui.classroomTeacherMenu.kickRequests"
            values={{ count }}
        />
    ),
    'current-assignment': (
        <FormattedMessage
            defaultMessage="Open current assignment"
            description="Teacher menu item: jump back to the assignment the teacher last opened (#1199)"
            id="gui.classroomTeacherMenu.currentAssignment"
        />
    ),
    'class-list': (
        <FormattedMessage
            defaultMessage="Open class list"
            description="Teacher menu item: open the class list in class management (#1199)"
            id="gui.classroomTeacherMenu.classList"
        />
    ),
    notifications: (
        <FormattedMessage
            defaultMessage="Notifications"
            description="Teacher menu item: open the notification list in class management (#1199)"
            id="gui.classroomTeacherMenu.notifications"
        />
    ),
    logout: (
        <FormattedMessage
            defaultMessage="Log out"
            description="Teacher menu item: log the teacher out (#1199)"
            id="gui.classroomTeacherMenu.logout"
        />
    ),
};

/**
 * One entry of the teacher menu.
 * @param {object} props - component props
 * @param {string} props.id - item id (teacherMenuItems)
 * @param {boolean} props.badge - show the "!" badge
 * @param {number} [props.count] - number shown in the label (kick requests)
 * @param {Function} props.onSelect - called with the item id
 * @returns {React.ReactElement} the menu item
 */
const TeacherMenuItem = ({ id, badge, count, onSelect }) => {
    const label = ITEM_LABELS[id];
    const handleClick = useCallback(() => onSelect(id), [id, onSelect]);
    return (
        <MenuItem onClick={handleClick}>
            <span
                className={styles.item}
                data-testid={`classroom-teacher-menu-${id}`}
            >
                {typeof label === 'function' ? label(count || 0) : label}
                {badge ? (
                    <span
                        className={styles.badge}
                        data-testid={`classroom-teacher-menu-${id}-badge`}
                    >
                        {'!'}
                    </span>
                ) : null}
            </span>
        </MenuItem>
    );
};

TeacherMenuItem.propTypes = {
    badge: PropTypes.bool,
    count: PropTypes.number,
    id: PropTypes.string.isRequired,
    onSelect: PropTypes.func.isRequired,
};

/**
 * Teacher "クラス管理" menu in the menu bar (#1199). Shown while a teacher is
 * logged in; a "!" badge flags unread お知らせ.
 * @param {object} props - component props
 * @param {string} props.className - class of the menu bar button
 * @param {string} props.activeClassName - class added while the menu is open
 * @param {string} props.menuClassName - class of the dropdown wrapper
 * @param {Array<{id: string, badge: boolean}>} props.items - menu items (teacherMenuItems)
 * @param {boolean} props.open - whether the dropdown is open
 * @param {string} props.place - dropdown placement ('left' | 'right')
 * @param {Function} props.onOpen - open the dropdown
 * @param {Function} props.onRequestClose - close the dropdown
 * @param {Function} props.onSelect - called with the chosen item id
 * @returns {React.ReactElement} the menu
 */
const ClassroomTeacherMenu = ({
    className,
    activeClassName,
    menuClassName,
    items, open, place, onOpen, onRequestClose, onSelect }) => {
    const hasBadge = items.some((item) => item.badge);
    return (
        <div
            className={classNames(className, { [activeClassName]: open })}
            data-testid="classroom-teacher-menu-button"
            onClick={onOpen}
        >
            <span data-testid="classroom-teacher-menu-label">
                <FormattedMessage
                    defaultMessage="Class Management"
                    description="Menu bar button shown while a teacher is logged in (#1199)"
                    id="gui.classroomTeacherMenu.label"
                />
            </span>
            {hasBadge ? (
                <span
                    className={styles.badge}
                    data-testid="classroom-teacher-menu-badge"
                >
                    {'!'}
                </span>
            ) : null}
            <MenuBarMenu
                className={menuClassName}
                open={open}
                place={place}
                onRequestClose={onRequestClose}
            >
                <MenuSection>
                    {items.map((item) => (
                        <TeacherMenuItem
                            badge={item.badge}
                            count={item.count}
                            id={item.id}
                            key={item.id}
                            onSelect={onSelect}
                        />
                    ))}
                </MenuSection>
            </MenuBarMenu>
        </div>
    );
};

ClassroomTeacherMenu.propTypes = {
    activeClassName: PropTypes.string,
    className: PropTypes.string,
    menuClassName: PropTypes.string,
    items: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            badge: PropTypes.bool,
            count: PropTypes.number,
        }),
    ).isRequired,
    open: PropTypes.bool,
    place: PropTypes.oneOf(['left', 'right']),
    onOpen: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onSelect: PropTypes.func.isRequired,
};

export default ClassroomTeacherMenu;
