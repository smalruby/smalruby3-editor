import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { menuSubmitKind } from '../lib/classroom-menu-submit.js';
import { assignmentProgress } from '../lib/lessons/assignment-progress.js';
import { selectStudentLesson } from '../reducers/classroom.js';

/**
 * メニューバーの「提出する」ボタンの種類を、いまの生徒の状態から読む (#1795)。
 * ボタンと「提出しよう」の吹き出し (#1835) が同じ決まりを使うために 1 か所にまとめる。
 * @returns {?string} MENU_SUBMIT_KINDS のどれか。出さないときは null
 */
const useMenuSubmitKind = () => {
    const classroom = useSelector((state) => state.scratchGui.classroom);
    const lesson = useSelector(selectStudentLesson);
    const records = useSelector((state) => state.scratchGui.lessonMode.progress);
    const lessonStatus = useMemo(() => assignmentProgress(lesson, records), [lesson, records]);
    const joined = !!(classroom && classroom.role === 'student' && classroom.sessionToken && classroom.seatNumber);
    return menuSubmitKind({
        joined,
        submissionStatus: classroom ? classroom.submissionStatus : null,
        lesson,
        lessonStatus,
    });
};

export default useMenuSubmitKind;
