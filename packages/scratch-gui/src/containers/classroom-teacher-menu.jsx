import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomTeacherMenuComponent from '../components/classroom-teacher-menu/classroom-teacher-menu.jsx';
import { decideTeacherRestore, loadTeacherSession, teacherMenuItems } from '../lib/classroom-teacher-session.js';
import { getUrlParams } from '../lib/url-params.js';
import {
    clearTeacherSelection,
    closeTeacherModal,
    requestTeacherNavigation,
    setTeacherLoggedIn,
    setTeacherUnreadCount,
} from '../reducers/classroom.js';
import {
    getCachedTeacherIdToken,
    logoutCachedTeacher,
    restoreTeacherLogin,
    setCachedTeacherIdToken,
} from './use-teacher-auth.js';
import { loadDailyNotifications } from './use-teacher-notifications.js';

/**
 * Teacher "クラス管理" menu for the menu bar (#1199).
 *
 * Mounted for the whole page lifetime (unlike the teacher modal), so it also
 * owns bringing the teacher login back after a reload: `?devlogin=` from the
 * URL, otherwise the provider's silent re-authentication when a previous
 * login was persisted. Renders nothing while no teacher is logged in.
 * @param {object} props - component props
 * @param {string} props.className - class of the menu bar button
 * @param {string} props.activeClassName - class added while the menu is open
 * @param {string} props.menuClassName - class of the dropdown wrapper
 * @param {string} props.place - dropdown placement ('left' | 'right')
 * @returns {React.ReactElement|null} the menu, or null when logged out
 */
const ClassroomTeacherMenu = ({ className, activeClassName, menuClassName, place }) => {
    const dispatch = useDispatch();
    const loggedIn = useSelector((state) => state.scratchGui.classroom.teacherLoggedIn);
    const unreadCount = useSelector((state) => state.scratchGui.classroom.teacherUnreadCount);
    const lastSelection = useSelector((state) => state.scratchGui.classroom.teacherLastSelection);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const strategy = decideTeacherRestore({
            session: loadTeacherSession(),
            cachedToken: getCachedTeacherIdToken(),
            devlogin: getUrlParams().devlogin,
        });
        if (strategy === 'none') return () => {};
        let cancelled = false;
        (async () => {
            let token = null;
            if (strategy === 'devlogin') {
                token = getUrlParams().devlogin;
                setCachedTeacherIdToken(token);
            } else {
                token = await restoreTeacherLogin(loadTeacherSession().provider);
            }
            if (cancelled || !token) return;
            dispatch(setTeacherLoggedIn(true));
            try {
                const { unreadCount: unread } = await loadDailyNotifications(token);
                if (!cancelled) dispatch(setTeacherUnreadCount(unread));
            } catch {
                // The badge is a hint only; the modal fetches again when opened.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [dispatch]);

    const handleOpen = useCallback(() => setOpen(true), []);
    const handleRequestClose = useCallback(() => setOpen(false), []);

    const handleSelect = useCallback(
        (id) => {
            setOpen(false);
            if (id === 'logout') {
                logoutCachedTeacher();
                dispatch(closeTeacherModal());
                dispatch(clearTeacherSelection());
                dispatch(setTeacherLoggedIn(false));
                return;
            }
            dispatch(requestTeacherNavigation(id));
        },
        [dispatch],
    );

    if (!loggedIn) return null;

    return (
        <ClassroomTeacherMenuComponent
            activeClassName={activeClassName}
            className={className}
            items={teacherMenuItems({
                lastClassroomId: lastSelection && lastSelection.classroomId,
                unreadCount,
            })}
            menuClassName={menuClassName}
            open={open}
            place={place}
            onOpen={handleOpen}
            onRequestClose={handleRequestClose}
            onSelect={handleSelect}
        />
    );
};

ClassroomTeacherMenu.propTypes = {
    activeClassName: PropTypes.string,
    className: PropTypes.string,
    menuClassName: PropTypes.string,
    place: PropTypes.oneOf(['left', 'right']),
};

export default ClassroomTeacherMenu;
