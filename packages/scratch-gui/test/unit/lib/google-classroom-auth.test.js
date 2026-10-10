/**
 * Google Classroom OAuth token acquisition.
 *
 * The consent screen lets a teacher untick individual scopes, so a token can
 * come back without `classroom.coursework.students` — the posting call then
 * fails inside Google with no hint of why (issue #1175). These tests pin the
 * "verify what was actually granted" behaviour.
 */
jest.mock('../../../src/lib/google-script-loader', () => ({
    loadAllGoogleScripts: jest.fn(() => Promise.resolve()),
}));

const COURSEWORK_SCOPE = 'https://www.googleapis.com/auth/classroom.coursework.students';

/**
 * Install a fake Google Identity Services token client.
 * @param {Array<object>} responses - queued token responses, one per request
 * @param {Function} hasGrantedAllScopes - GIS scope check stub
 * @returns {object} The recorded requests (`requests` array).
 */
const installGis = (responses, hasGrantedAllScopes) => {
    const requests = [];
    let client = null;
    window.google = {
        accounts: {
            oauth2: {
                initTokenClient: (config) => {
                    client = {
                        ...config,
                        requestAccessToken: (options) => {
                            requests.push(options);
                            const response = responses.shift();
                            // GIS echoes the state back on success.
                            client.callback({ state: options.state, ...response });
                        },
                    };
                    return client;
                },
                hasGrantedAllScopes,
            },
        },
    };
    return { requests };
};

describe('requestClassroomAccessToken', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    });

    afterEach(() => {
        delete window.google;
    });

    test('resolves with the token when every scope is granted', async () => {
        const { requests } = installGis([{ access_token: 'tok-1', expires_in: 3600 }], () => true);
        const { requestClassroomAccessToken } = require('../../../src/lib/google-classroom-auth');
        await expect(requestClassroomAccessToken()).resolves.toBe('tok-1');
        expect(requests).toHaveLength(1);
        expect(requests[0].prompt).toBe('');
    });

    test('re-asks with an explicit consent prompt when a scope was unticked', async () => {
        let call = 0;
        const { requests } = installGis(
            [
                { access_token: 'partial', expires_in: 3600 },
                { access_token: 'full', expires_in: 3600 },
            ],
            () => ++call > 1,
        );
        const { requestClassroomAccessToken } = require('../../../src/lib/google-classroom-auth');
        await expect(requestClassroomAccessToken()).resolves.toBe('full');
        expect(requests).toHaveLength(2);
        expect(requests[1].prompt).toBe('consent');
    });

    test('rejects with an actionable error when the scope is still missing', async () => {
        installGis(
            [
                { access_token: 'partial-1', expires_in: 3600 },
                { access_token: 'partial-2', expires_in: 3600 },
            ],
            () => false,
        );
        const { requestClassroomAccessToken } = require('../../../src/lib/google-classroom-auth');
        await expect(requestClassroomAccessToken()).rejects.toThrow(/permission/i);
    });

    test('does not cache a token that is missing scopes', async () => {
        installGis(
            [
                { access_token: 'partial-1', expires_in: 3600 },
                { access_token: 'partial-2', expires_in: 3600 },
                { access_token: 'partial-3', expires_in: 3600 },
                { access_token: 'partial-4', expires_in: 3600 },
            ],
            () => false,
        );
        const { requestClassroomAccessToken } = require('../../../src/lib/google-classroom-auth');
        await expect(requestClassroomAccessToken()).rejects.toThrow();
        // A second attempt must hit Google again rather than reuse the bad token.
        await expect(requestClassroomAccessToken()).rejects.toThrow();
    });

    test('still resolves when the GIS build has no hasGrantedAllScopes helper', async () => {
        installGis([{ access_token: 'tok-legacy', expires_in: 3600 }], undefined);
        const { requestClassroomAccessToken } = require('../../../src/lib/google-classroom-auth');
        await expect(requestClassroomAccessToken()).resolves.toBe('tok-legacy');
    });
});

describe('CLASSROOM_SCOPES', () => {
    test('includes the coursework.students scope', () => {
        jest.resetModules();
        process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
        const { CLASSROOM_SCOPE_LIST } = require('../../../src/lib/google-classroom-auth');
        expect(CLASSROOM_SCOPE_LIST).toContain(COURSEWORK_SCOPE);
    });
});
