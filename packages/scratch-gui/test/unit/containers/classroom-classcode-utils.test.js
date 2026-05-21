import { decideClasscodeAction } from '../../../src/containers/classroom-classcode-utils.js';

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
