/* eslint-env jest */
/**
 * 先生のログイン期限切れ (#1250)。401 の判定と、ユーザー操作からの再認証の成功 / 失敗の分岐。
 */
import { isTeacherAuthExpired, reauthenticateTeacher } from '../../../src/lib/classroom-teacher-reauth.js';

describe('isTeacherAuthExpired (#1250)', () => {
    test('is true only for a 401 from the classroom API', () => {
        const unauthorized = Object.assign(new Error('API error 401'), { status: 401 });
        expect(isTeacherAuthExpired(unauthorized)).toBe(true);
        expect(isTeacherAuthExpired(Object.assign(new Error('x'), { status: 403 }))).toBe(false);
        expect(isTeacherAuthExpired(Object.assign(new Error('x'), { status: 500 }))).toBe(false);
        expect(isTeacherAuthExpired(new TypeError('Failed to fetch'))).toBe(false);
        expect(isTeacherAuthExpired(null)).toBe(false);
        expect(isTeacherAuthExpired(undefined)).toBe(false);
    });
});

describe('reauthenticateTeacher (#1250)', () => {
    test('returns the new token from the provider of the current login', async () => {
        const reauth = jest.fn().mockResolvedValue('new-token');
        await expect(reauthenticateTeacher({ provider: 'microsoft', reauth })).resolves.toBe('new-token');
        expect(reauth).toHaveBeenCalledWith('microsoft');
    });

    test('returns null when the provider gives no token (prompt closed, timed out)', async () => {
        const reauth = jest.fn().mockResolvedValue(null);
        await expect(reauthenticateTeacher({ provider: 'google', reauth })).resolves.toBeNull();
    });

    test('returns null when the re-authentication throws', async () => {
        const reauth = jest.fn().mockRejectedValue(new Error('popup blocked'));
        await expect(reauthenticateTeacher({ provider: 'google', reauth })).resolves.toBeNull();
    });

    test('does not try the provider for a ?devlogin= session', async () => {
        const reauth = jest.fn().mockResolvedValue('new-token');
        await expect(reauthenticateTeacher({ provider: null, reauth, devlogin: 'secret' })).resolves.toBeNull();
        expect(reauth).not.toHaveBeenCalled();
    });
});
