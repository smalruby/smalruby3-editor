import {
    initialStudentPhase,
    decideClasscodeAction,
    decideTeacherSelectionSync,
    resolveAutoJoinCode,
} from '../../../src/containers/classroom-classcode-utils.js';

describe('decideClasscodeAction', () => {
    test('returns fresh_join when there is no existing session', () => {
        expect(decideClasscodeAction({ sessionToken: null, joinCode: null, classroomId: null }, 'abcdef')).toEqual({
            type: 'fresh_join',
            code: 'abcdef',
        });
    });

    test('returns same_class when the URL classcode matches the existing session', () => {
        expect(
            decideClasscodeAction(
                {
                    sessionToken: 'tok-a',
                    joinCode: 'abcdef',
                    classroomId: 'cid-a',
                },
                'abcdef',
            ),
        ).toEqual({ type: 'same_class' });
    });

    test('returns switch_class when an existing session points to a different classroom', () => {
        expect(
            decideClasscodeAction(
                {
                    sessionToken: 'tok-old',
                    joinCode: 'oldcde',
                    classroomId: 'cid-old',
                },
                'newcde',
            ),
        ).toEqual({
            type: 'switch_class',
            leaveSessionToken: 'tok-old',
            leaveClassroomId: 'cid-old',
            code: 'newcde',
        });
    });

    test('case-insensitive match treats upper/lower joinCode as same class', () => {
        // Server / DB stores join codes in lower-case (handler.ts validateJoinCode),
        // but the URL parameter may arrive in any case. Treat 'ABCDEF' and 'abcdef'
        // as the same class so we do not bounce the student off their own seat.
        expect(
            decideClasscodeAction({ sessionToken: 'tok', joinCode: 'abcdef', classroomId: 'cid' }, 'ABCDEF'),
        ).toEqual({ type: 'same_class' });
    });

    test('returns fresh_join when sessionToken exists but classroomId is missing (malformed state)', () => {
        expect(
            decideClasscodeAction({ sessionToken: 'tok', joinCode: 'oldcde', classroomId: null }, 'newcde'),
        ).toEqual({ type: 'fresh_join', code: 'newcde' });
    });
});

describe('decideTeacherSelectionSync (#1199)', () => {
    const joined = { sessionToken: 'tok-a', joinCode: 'aaaaaa', classroomId: 'cid-a' };

    test('does nothing without a selected join code', () => {
        expect(decideTeacherSelectionSync(joined, null)).toEqual({ type: 'none' });
    });

    test('does nothing when not joined as a student', () => {
        expect(decideTeacherSelectionSync({ sessionToken: null }, 'bbbbbb')).toEqual({ type: 'none' });
        expect(decideTeacherSelectionSync(null, 'bbbbbb')).toEqual({ type: 'none' });
    });

    test('stays in the class when the teacher selects the same assignment (case-insensitive)', () => {
        expect(decideTeacherSelectionSync(joined, 'AAAAAA')).toEqual({ type: 'none' });
    });

    test('leaves the joined class when the teacher selects another assignment', () => {
        expect(decideTeacherSelectionSync(joined, 'bbbbbb')).toEqual({
            type: 'leave',
            leaveSessionToken: 'tok-a',
            leaveClassroomId: 'cid-a',
        });
    });

    test('only clears a local session that cannot be released on the server', () => {
        expect(decideTeacherSelectionSync({ sessionToken: 'tok-a', joinCode: 'aaaaaa' }, 'bbbbbb')).toEqual({
            type: 'clear',
        });
    });
});

describe('resolveAutoJoinCode (#1199)', () => {
    test('returns null for the normal flow', () => {
        expect(resolveAutoJoinCode({})).toBeNull();
        expect(resolveAutoJoinCode()).toBeNull();
    });

    test('prefers the ?classcode= URL over the teacher selection', () => {
        expect(resolveAutoJoinCode({ urlClasscode: 'urlcde', teacherJoinCode: 'tchcde' })).toEqual({
            code: 'urlcde',
            source: 'url',
        });
    });

    test("uses the teacher's selected assignment when not joined", () => {
        expect(resolveAutoJoinCode({ teacherJoinCode: 'tchcde', session: { sessionToken: null } })).toEqual({
            code: 'tchcde',
            source: 'teacher',
        });
    });

    test('keeps a joined class instead of following the teacher selection', () => {
        expect(resolveAutoJoinCode({ teacherJoinCode: 'tchcde', session: { sessionToken: 'tok' } })).toBeNull();
    });
});

describe('initialStudentPhase', () => {
    const session = { role: 'student', sessionToken: 'tok', joinCode: 'abcdef', classroomId: 'c1' };

    test('セッションが無ければ参加画面', () => {
        expect(initialStudentPhase({}, null)).toBe('student-join');
        expect(initialStudentPhase({}, 'abcdef')).toBe('student-join');
    });

    test('セッションがあり URL の参加コードが無ければ、状況画面（セッションを確かめる）', () => {
        expect(initialStudentPhase(session, null)).toBe('student-status');
    });

    test('URL の参加コードが同じクラスなら状況画面', () => {
        expect(initialStudentPhase(session, 'ABCDEF')).toBe('student-status');
    });

    // 別のクラスへ移るときに古いセッションを確かめると、移る処理が古い席を
    // 空けた直後に 401 が返り「セッションが無効になりました」が出てしまう。
    test('URL の参加コードが別のクラスなら、古いセッションを確かめずに参加画面から始める', () => {
        expect(initialStudentPhase(session, 'zzzzzz')).toBe('student-join');
    });
});
