import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { shouldMountTeacherModal } from '../lib/classroom-teacher-work.js';
import ClassroomTeacherModal from './classroom-teacher-modal.jsx';

/**
 * Keeps the teacher's class management mounted after its first open (#1990).
 *
 * Opening a work closes the modal; unmounting it then would drop the class,
 * assignment, tab, seat and the grading drafts. So once opened, the container
 * stays mounted (hidden), and opening it again shows the same screen. Only a
 * logout on purpose (teacherLogoutCount) unmounts it while hidden, so the next
 * login starts fresh. An expired login keeps it: the teacher logs in again in
 * it and finds the drafts. It is not mounted before the first open, so nothing
 * is fetched for a page where class management is never opened.
 * @returns {React.ReactElement|null} the (maybe hidden) class management
 */
const ClassroomTeacherModalHost = () => {
    const visible = useSelector((state) => !!state.scratchGui.classroom.teacherModalVisible);
    const logoutCount = useSelector((state) => state.scratchGui.classroom.teacherLogoutCount || 0);
    const [opened, setOpened] = useState(visible);
    const seenLogoutRef = useRef(logoutCount);

    useEffect(() => {
        if (visible) {
            setOpened(true);
        } else if (logoutCount !== seenLogoutRef.current) {
            setOpened(false);
        }
        seenLogoutRef.current = logoutCount;
    }, [visible, logoutCount]);

    if (!shouldMountTeacherModal({ visible, opened })) return null;
    return <ClassroomTeacherModal visible={visible} />;
};

export default ClassroomTeacherModalHost;
