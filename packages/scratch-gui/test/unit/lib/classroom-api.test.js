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

    test('network failure (fetch rejects with TypeError) is flagged as a network error', async () => {
        // fetch throws a TypeError ("Failed to fetch") when the host is
        // unreachable (DNS / firewall / offline). This must be distinguished
        // from HTTP response errors so the UI can show an actionable message.
        global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

        let thrown;
        try {
            await classroomAPI.verifySession('any');
        } catch (err) {
            thrown = err;
        }
        expect(thrown).toBeDefined();
        expect(thrown.isNetworkError).toBe(true);
        // status must NOT be set — it is not an HTTP response error
        expect(thrown.status).toBeUndefined();
        // the unreachable host is exposed so callers can build a message
        expect(typeof thrown.endpointHost).toBe('string');
    });

    test('network failure is not retried and surfaces immediately', async () => {
        global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(classroomAPI.verifySession('any')).rejects.toHaveProperty('isNetworkError', true);
        // no retry loop for network failures
        expect(global.fetch).toHaveBeenCalledTimes(1);
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

describe('ClassroomAPI co-teacher methods', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const mockOk = (body) =>
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(body),
        });

    test('listCoTeachers GETs the co-teachers route with the teacher token', async () => {
        mockOk({ ownerSub: 'owner', coTeacherEmails: ['a@b.com'] });
        const data = await classroomAPI.listCoTeachers('id-token', 'class-1');
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/classrooms/class-1/co-teachers');
        expect(opts.method).toBe('GET');
        expect(opts.headers.Authorization).toBe('Bearer id-token');
        expect(data.coTeacherEmails).toEqual(['a@b.com']);
    });

    test('addCoTeacher POSTs the email in the body', async () => {
        mockOk({ coTeacherEmails: ['new@example.com'] });
        await classroomAPI.addCoTeacher('id-token', 'class-1', 'new@example.com');
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/classrooms/class-1/co-teachers');
        expect(opts.method).toBe('POST');
        expect(JSON.parse(opts.body)).toEqual({ email: 'new@example.com' });
    });

    test('removeCoTeacher DELETEs with the email URL-encoded in the path', async () => {
        mockOk({ coTeacherEmails: [] });
        await classroomAPI.removeCoTeacher('id-token', 'class-1', 'a+b@example.com');
        const [url, opts] = global.fetch.mock.calls[0];
        expect(opts.method).toBe('DELETE');
        expect(url).toContain('/classrooms/class-1/co-teachers/');
        expect(url).toContain(encodeURIComponent('a+b@example.com'));
        expect(url).not.toContain('a+b@example.com'); // raw '+'/'@' must be encoded
    });
});

describe('ClassroomAPI notification methods (EPIC #1111)', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const mockOk = (body) =>
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(body),
        });

    test('listNotifications GETs /notifications with the teacher token', async () => {
        mockOk({ notifications: [{ notificationId: 'n1' }], unreadCount: 1 });
        const data = await classroomAPI.listNotifications('id-token');
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/notifications');
        expect(opts.method).toBe('GET');
        expect(opts.headers.Authorization).toBe('Bearer id-token');
        expect(data.unreadCount).toBe(1);
    });

    test('markNotificationsRead POSTs an empty body to mark everything read', async () => {
        mockOk({ updated: 2 });
        await classroomAPI.markNotificationsRead('id-token');
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/notifications/mark-read');
        expect(opts.method).toBe('POST');
        expect(JSON.parse(opts.body)).toEqual({});
    });

    test('markNotificationsRead forwards specific ids when given', async () => {
        mockOk({ updated: 1 });
        await classroomAPI.markNotificationsRead('id-token', ['n1']);
        const [, opts] = global.fetch.mock.calls[0];
        expect(JSON.parse(opts.body)).toEqual({ notificationIds: ['n1'] });
    });
});

describe('ClassroomAPI.getContinuableSubmissions (#1201)', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('GETs the continuable submissions of the joined classroom with the session token', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ current: null, previous: null }),
        });
        const data = await classroomAPI.getContinuableSubmissions('session-token', 'c1');
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/classrooms/c1/continuable-submissions');
        expect(opts.method).toBe('GET');
        expect(opts.headers.Authorization).toBe('Bearer session-token');
        expect(data).toEqual({ current: null, previous: null });
    });
});

describe('ClassroomAPI.createClassroom — meshGroupLimit (#1257)', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: jest.fn().mockResolvedValue({ classroomId: 'c1' }),
        });
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    test('sends meshGroupLimit when given (0 = no limit)', async () => {
        await classroomAPI.createClassroom('tok', '技術', '課題', null, null, 'g1', { meshGroupLimit: 0 });
        const [, opts] = global.fetch.mock.calls[0];
        expect(JSON.parse(opts.body)).toEqual({
            className: '技術',
            assignmentName: '課題',
            groupId: 'g1',
            meshGroupLimit: 0,
        });
    });

    test('omits meshGroupLimit otherwise (the server stores 6)', async () => {
        await classroomAPI.createClassroom('tok', '技術', '課題', null, null, 'g1');
        const [, opts] = global.fetch.mock.calls[0];
        expect(JSON.parse(opts.body)).not.toHaveProperty('meshGroupLimit');
    });
});

describe('ClassroomAPI.putLessonProgress (#1600)', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('PUTs the seat progress of the joined assignment with the session token', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ challenges: {}, current: null, updatedAt: null }),
        });
        const payload = {
            challenges: { 'blocks-l1-quiz': { completedAt: '2026-11-15T01:00:00.000Z', before: true } },
            current: { challengeId: 'blocks-l1-if', openedAt: '2026-11-15T02:00:00.000Z' },
        };
        await classroomAPI.putLessonProgress('session-token', 'c1', payload);
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/classrooms/c1/lesson-progress');
        expect(opts.method).toBe('PUT');
        expect(opts.headers.Authorization).toBe('Bearer session-token');
        expect(JSON.parse(opts.body)).toEqual(payload);
    });
});

describe('ClassroomAPI.getLessonProgress (#1602)', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('GETs the lesson progress of the assignment with the teacher token', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ lesson: null, progress: [] }),
        });
        const data = await classroomAPI.getLessonProgress('id-token', 'c1');
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/classrooms/c1/lesson-progress');
        expect(opts.method).toBe('GET');
        expect(opts.headers.Authorization).toBe('Bearer id-token');
        expect(data).toEqual({ lesson: null, progress: [] });
    });
});

describe('ClassroomAPI.setLessonScoring (#1787)', () => {
    let classroomAPI;

    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
        classroomAPI = require('../../../src/lib/classroom-api.js').default;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('PATCHes only the scoring of the lesson with the teacher token', async () => {
        const lesson = { courseId: 'c', scoring: { total: 100, requiredPoints: 50, optionalPoints: 50 } };
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ lesson }),
        });
        const data = await classroomAPI.setLessonScoring('id-token', 'c1', lesson.scoring);
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toContain('/classrooms/c1/assignment/lesson-scoring');
        expect(opts.method).toBe('PATCH');
        expect(opts.headers.Authorization).toBe('Bearer id-token');
        expect(JSON.parse(opts.body)).toEqual({ scoring: lesson.scoring });
        expect(data).toEqual({ lesson });
    });

    test('sends scoring: null to go back to the defaults', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ lesson: { courseId: 'c', scoring: null } }),
        });
        await classroomAPI.setLessonScoring('id-token', 'c1', null);
        expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ scoring: null });
    });
});
