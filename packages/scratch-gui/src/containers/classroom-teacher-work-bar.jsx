import React, { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomTeacherWorkBarComponent from '../components/classroom-teacher-work-bar/classroom-teacher-work-bar.jsx';
import { isTeacherWorkBarVisible } from '../lib/classroom-teacher-work.js';
import { clearTeacherOpenedWork, openTeacherModal } from '../reducers/classroom.js';

/**
 * The bar above the editor that goes back to class management (#1990).
 *
 * Shown while a work the teacher opened from class management is in the
 * editor. ［戻る］ only opens the modal again: class management stays mounted
 * behind the editor (ClassroomTeacherModalHost), so it shows the same class,
 * assignment, tab and seat, with the grading drafts.
 *
 * Any project loaded after it (another file, a new project, a lesson…) emits
 * the runtime's PROJECT_LOADED, and the bar goes: it no longer shows that
 * work. The teacher's own load finishes before the bar is set, so it does not
 * clear itself. Editing the opened work keeps the bar.
 * @returns {React.ReactElement|null} the bar, or null
 */
const ClassroomTeacherWorkBar = () => {
    const dispatch = useDispatch();
    const vm = useSelector((state) => state.scratchGui.vm);
    const classroom = useSelector((state) => state.scratchGui.classroom);
    const work = classroom && classroom.teacherOpenedWork;
    const hasWork = !!work;

    useEffect(() => {
        if (!hasWork || !vm || !vm.runtime) return () => {};
        const handleLoaded = () => dispatch(clearTeacherOpenedWork());
        vm.runtime.on('PROJECT_LOADED', handleLoaded);
        return () => vm.runtime.removeListener('PROJECT_LOADED', handleLoaded);
    }, [hasWork, vm, dispatch]);

    const handleBack = useCallback(() => dispatch(openTeacherModal()), [dispatch]);

    if (!isTeacherWorkBarVisible(classroom)) return null;
    return <ClassroomTeacherWorkBarComponent expired={!classroom.teacherLoggedIn} work={work} onBack={handleBack} />;
};

export default ClassroomTeacherWorkBar;
