/* eslint-env jest */
/**
 * 作品を開いたあと、エディタの上の帯からクラス管理の元の画面へ戻る (#1990)。
 *
 * - クラス管理は、いちど開いたらログインしている間は隠して残す（戻ったとき同じ画面と下書き）。
 * - 帯は、先生が開いた作品があり、クラス管理が閉じている間だけ出す。
 * - 帯には出席番号と課題名だけを覚える（生徒の名前は持たない）。
 */
import {
    isTeacherWorkBarVisible,
    memberCommentDraftKey,
    memberDraftsForClassroom,
    shouldMountTeacherModal,
    unsavedMemberCommentDrafts,
} from '../../../src/lib/classroom-teacher-work.js';
import reducer, {
    classroomInitialState,
    clearTeacherOpenedWork,
    closeTeacherModal,
    openTeacherModal,
    requestTeacherNavigation,
    setTeacherHasUnsavedWork,
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

describe('メンバーのタブのコメントの下書き', () => {
    const drafts = {
        [memberCommentDraftKey('c1', 'seat-03')]: { text: 'もう少し', base: '' },
        [memberCommentDraftKey('c2', 'seat-01')]: { text: 'いいね', base: 'いいね' },
    };

    test('表示中の課題の下書きだけを席ごとに渡す', () => {
        expect(memberDraftsForClassroom(drafts, 'c1')).toEqual({ 'seat-03': 'もう少し' });
        expect(memberDraftsForClassroom(drafts, null)).toEqual({});
    });

    test('空でなく、返却したコメントと違えば「返却していない」', () => {
        expect(unsavedMemberCommentDrafts(drafts, 'c1', [{ memberId: 'seat-03', teacherComment: '' }])).toBe(true);
        // 返却したら（members の teacherComment が同じになったら）残っていない扱い。
        expect(unsavedMemberCommentDrafts(drafts, 'c1', [{ memberId: 'seat-03', teacherComment: 'もう少し' }])).toBe(
            false,
        );
        // 表示していない課題は、書き始めたときの返却済みのコメントと比べる。
        expect(
            unsavedMemberCommentDrafts(
                { [memberCommentDraftKey('c2', 'seat-01')]: { text: '直した', base: 'いいね' } },
                'c1',
                [],
            ),
        ).toBe(true);
        expect(
            unsavedMemberCommentDrafts(
                { [memberCommentDraftKey('c1', 'seat-03')]: { text: '  ', base: '' } },
                'c1',
                [],
            ),
        ).toBe(false);
        expect(unsavedMemberCommentDrafts({}, 'c1', [])).toBe(false);
    });
});

describe('classroom reducer — teacherHasUnsavedWork', () => {
    test('立てて、ログアウトで戻る', () => {
        const on = reducer(reducer(classroomInitialState, setTeacherLoggedIn(true)), setTeacherHasUnsavedWork(true));
        expect(on.teacherHasUnsavedWork).toBe(true);
        expect(reducer(on, setTeacherHasUnsavedWork(true))).toBe(on);
        expect(reducer(on, setTeacherLoggedIn(false)).teacherHasUnsavedWork).toBe(false);
    });
});
