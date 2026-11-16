import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { shouldMountTeacherModal } from '../lib/classroom-teacher-work.js';
import ClassroomTeacherModal from './classroom-teacher-modal.jsx';

/**
 * Keeps the teacher's class management mounted after its first open (#1990).
 *
 * Opening a work closes the modal; unmounting it then would drop the class,
 * assignment, tab, seat and the grading drafts. So once opened, the container
 * stays mounted (hidden) while the teacher is logged in, and opening it again
 * shows the same screen. Logging out unmounts it, so the next login starts
 * fresh. It is not mounted before the first open, so nothing is fetched for a
 * page where class management is never opened.
 * @returns {React.ReactElement|null} the (maybe hidden) class management
 */
const ClassroomTeacherModalHost = () => {
    const visible = useSelector((state) => !!state.scratchGui.classroom.teacherModalVisible);
    const loggedIn = useSelector((state) => !!state.scratchGui.classroom.teacherLoggedIn);
    const [opened, setOpened] = useState(visible);

    useEffect(() => {
        if (visible) setOpened(true);
        else if (!loggedIn) setOpened(false);
    }, [visible, loggedIn]);

    if (!shouldMountTeacherModal({ visible, opened, loggedIn })) return null;
    return <ClassroomTeacherModal visible={visible} />;
};

export default ClassroomTeacherModalHost;
