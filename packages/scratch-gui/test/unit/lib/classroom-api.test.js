/**
 * Unit tests for ClassroomAPI
 *
 * Focused on error-body propagation — the response body for 4xx/5xx
 * needs to surface on the thrown Error so callers (notably the kick
 * detection in classroom-modal) can read reason / joinCode / className /
 * seatNumber from a 410 response.
 */

global.fetch = jest.fn();

describe('ClassroomAPI._request error handling', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('attaches HTTP status to the thrown Error', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: jest.fn().mockResolvedValue({ error: 'Invalid or expired session token' }),
        });

        await expect(classroomAPI.verifySession('bad-token')).rejects.toMatchObject({
            status: 401,
            message: 'Invalid or expired session token',
        });
    });

    test('410 errors expose the full response body so callers can read reason / kick context', async () => {
        const kickBody = {
            error: 'You were removed from the classroom by the teacher',
            reason: 'kicked',
            joinCode: 'btgyal',
            className: 'Phase1検証',
            seatNumber: 5,
        };
        global.fetch.mockResolvedValue({
            ok: false,
            status: 410,
            json: jest.fn().mockResolvedValue(kickBody),
        });

        let thrown;
        try {
            await classroomAPI.verifySession('kicked-token');
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeDefined();
        expect(thrown.status).toBe(410);
        expect(thrown.body).toEqual(kickBody);
    });

    test('errors with no JSON body still surface status and message', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: jest.fn().mockRejectedValue(new Error('not json')),
        });

        await expect(classroomAPI.verifySession('any')).rejects.toMatchObject({
            status: 500,
            message: 'API error 500',
        });
    });
});
