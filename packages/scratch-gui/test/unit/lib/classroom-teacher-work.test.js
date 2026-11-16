/* eslint-env jest */
/**
 * 作品を開いたあと、エディタの上の帯からクラス管理の元の画面へ戻る (#1990)。
 *
 * - クラス管理は、いちど開いたらログインしている間は隠して残す（戻ったとき同じ画面と下書き）。
 * - 帯は、先生が開いた作品があり、クラス管理が閉じている間だけ出す。
 * - 帯には出席番号と課題名だけを覚える（生徒の名前は持たない）。
 */
import { isTeacherWorkBarVisible, shouldMountTeacherModal } from '../../../src/lib/classroom-teacher-work.js';
import reducer, {
    classroomInitialState,
    clearTeacherOpenedWork,
    closeTeacherModal,
    openTeacherModal,
    requestTeacherNavigation,
    setTeacherLoggedIn,
    setTeacherOpenedWork,
} from '../../../src/reducers/classroom.js';

describe('shouldMountTeacherModal', () => {
    test.each([
        [{ visible: true, opened: false, loggedIn: false }, true],
        [{ visible: false, opened: false, loggedIn: true }, false],
        [{ visible: false, opened: true, loggedIn: true }, true],
        [{ visible: false, opened: true, loggedIn: false }, false],
    ])('%o → %s', (input, expected) => {
        expect(shouldMountTeacherModal(input)).toBe(expected);
    });
});

describe('isTeacherWorkBarVisible', () => {
    const work = { from: 'evaluation', seatNumber: 3, assignmentName: '迷路' };
    test('開いた作品があり、クラス管理が閉じていて、先生がログインしているときだけ', () => {
        expect(
            isTeacherWorkBarVisible({ teacherOpenedWork: work, teacherModalVisible: false, teacherLoggedIn: true }),
        ).toBe(true);
        expect(
            isTeacherWorkBarVisible({ teacherOpenedWork: work, teacherModalVisible: true, teacherLoggedIn: true }),
        ).toBe(false);
        expect(
            isTeacherWorkBarVisible({ teacherOpenedWork: work, teacherModalVisible: false, teacherLoggedIn: false }),
        ).toBe(false);
        expect(
            isTeacherWorkBarVisible({ teacherOpenedWork: null, teacherModalVisible: false, teacherLoggedIn: true }),
        ).toBe(false);
        expect(isTeacherWorkBarVisible(undefined)).toBe(false);
    });
});

describe('classroom reducer — teacherOpenedWork', () => {
    const opened = () =>
        reducer(
            reducer(classroomInitialState, setTeacherLoggedIn(true)),
            setTeacherOpenedWork({ from: 'evaluation', seatNumber: 3, assignmentName: '迷路', displayName: '山田' }),
        );

    test('はじめは無い', () => {
        expect(classroomInitialState.teacherOpenedWork).toBeNull();
    });

    test('出席番号と課題名と開いた場所だけを覚える（名前は持たない）', () => {
        expect(opened().teacherOpenedWork).toEqual({ from: 'evaluation', seatNumber: 3, assignmentName: '迷路' });
        expect(
            reducer(classroomInitialState, setTeacherOpenedWork({ from: 'x', seatNumber: '3' })).teacherOpenedWork,
        ).toEqual({ from: 'assignment', seatNumber: null, assignmentName: null });
    });

    test('クラス管理を閉じても残り、開くと消える', () => {
        const closed = reducer(opened(), closeTeacherModal());
        expect(closed.teacherOpenedWork).not.toBeNull();
        expect(reducer(closed, openTeacherModal()).teacherOpenedWork).toBeNull();
        expect(reducer(closed, requestTeacherNavigation('class-list')).teacherOpenedWork).toBeNull();
    });

    test('ログアウトと、ほかの作品を読み込んだとき（clear）に消える', () => {
        expect(reducer(opened(), setTeacherLoggedIn(false)).teacherOpenedWork).toBeNull();
        expect(reducer(opened(), clearTeacherOpenedWork()).teacherOpenedWork).toBeNull();
        expect(reducer(classroomInitialState, clearTeacherOpenedWork())).toBe(classroomInitialState);
    });
});
