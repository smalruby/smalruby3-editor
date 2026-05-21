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

describe('ClassroomAPI.createKickRequest', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('POSTs to /classrooms/lookup/kick-request with joinCode + seatNumber + reason', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 201,
            json: jest.fn().mockResolvedValue({ requestId: 'req-1' }),
        });
        await classroomAPI.createKickRequest('abcdef', 5, 'これは私の席です');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/classrooms/lookup/kick-request');
        expect(opts.method).toBe('POST');
        expect(JSON.parse(opts.body)).toEqual({
            joinCode: 'abcdef',
            seatNumber: 5,
            reason: 'これは私の席です',
        });
    });

    test('omits reason from the body when none is provided', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 201,
            json: jest.fn().mockResolvedValue({ requestId: 'req-2' }),
        });
        await classroomAPI.createKickRequest('abcdef', 3);
        const [, opts] = global.fetch.mock.calls[0];
        expect(JSON.parse(opts.body)).toEqual({ joinCode: 'abcdef', seatNumber: 3 });
    });

    test('does not send any Authorization header (anonymous endpoint)', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 201,
            json: jest.fn().mockResolvedValue({ requestId: 'r' }),
        });
        await classroomAPI.createKickRequest('abcdef', 1);
        const [, opts] = global.fetch.mock.calls[0];
        expect(opts.headers.Authorization).toBeUndefined();
    });
});
