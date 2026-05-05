/* eslint-disable no-console */
/**
 * Unit tests for GoogleDriveAPI
 * Tests focus on OAuth token management improvements (Phase 1):
 * - Token expiry detection
 * - Re-authentication flow
 * - OAuth scope management
 */

// Mock google-script-loader before importing google-drive-api
jest.mock('../../../src/lib/google-script-loader', () => ({
    loadAllGoogleScripts: jest.fn().mockResolvedValue(undefined),
}));

// We test the class internals by importing the module and using Jest mocking
// to simulate window.gapi and window.google environments

describe('GoogleDriveAPI', () => {
    let GoogleDriveAPI;
    let mockGapi;
    let mockGoogle;

    beforeEach(() => {
        // Reset module registry to get fresh instance
        jest.resetModules();
        jest.mock('../../../src/lib/google-script-loader', () => ({
            loadAllGoogleScripts: jest.fn().mockResolvedValue(undefined),
        }));

        // Mock process.env values
        process.env.GOOGLE_CLIENT_ID = 'test-client-id';
        process.env.GOOGLE_API_KEY = 'test-api-key';

        // Set up mock gapi
        mockGapi = {
            load: jest.fn((_, opts) => opts.callback()),
            client: {
                init: jest.fn().mockResolvedValue(undefined),
                getToken: jest.fn().mockReturnValue(null),
                drive: {
                    files: {
                        get: jest.fn(),
                    },
                },
                request: jest.fn(),
            },
        };

        // Set up mock google
        mockGoogle = {
            accounts: {
                oauth2: {
                    initTokenClient: jest.fn(),
                },
            },
            picker: {
                DocsView: jest.fn().mockReturnValue({
                    setIncludeFolders: jest.fn().mockReturnThis(),
                    setMode: jest.fn().mockReturnThis(),
                    setQuery: jest.fn().mockReturnThis(),
                    setParent: jest.fn().mockReturnThis(),
                    setSelectFolderEnabled: jest.fn().mockReturnThis(),
                }),
                DocsUploadView: jest.fn().mockReturnValue({
                    setIncludeFolders: jest.fn().mockReturnThis(),
                }),
                PickerBuilder: jest.fn().mockReturnValue({
                    addView: jest.fn().mockReturnThis(),
                    setOAuthToken: jest.fn().mockReturnThis(),
                    setDeveloperKey: jest.fn().mockReturnThis(),
                    setCallback: jest.fn().mockReturnThis(),
                    setTitle: jest.fn().mockReturnThis(),
                    setLocale: jest.fn().mockReturnThis(),
                    build: jest.fn().mockReturnValue({
                        setVisible: jest.fn(),
                    }),
                }),
                ViewId: { FOLDERS: 'folders' },
                DocsViewMode: { LIST: 'list' },
                Response: { ACTION: 'action', DOCUMENTS: 'documents' },
                Action: { PICKED: 'picked', CANCEL: 'cancel' },
                Document: { ID: 'id', NAME: 'name' },
            },
        };

        global.window = global.window || {};
        global.window.gapi = mockGapi;
        global.window.google = mockGoogle;

        // Import fresh module after mocking
        GoogleDriveAPI = require('../../../src/lib/google-drive-api').default;
    });

    afterEach(() => {
        delete global.window.gapi;
        delete global.window.google;
        jest.clearAllMocks();
    });

    describe('SCOPES', () => {
        test('should include drive.file scope', () => {
            // Verify by checking the tokenClient is initialized with correct scope
            const mockTokenClient = {
                callback: null,
                requestAccessToken: jest.fn(),
            };
            mockGoogle.accounts.oauth2.initTokenClient.mockReturnValue(mockTokenClient);

            return GoogleDriveAPI.initialize().then(() => {
                expect(mockGoogle.accounts.oauth2.initTokenClient).toHaveBeenCalledWith(
                    expect.objectContaining({
                        scope: expect.stringContaining('https://www.googleapis.com/auth/drive.file'),
                    }),
                );
            });
        });

        test('should NOT include generative-language scope (temporarily disabled until OAuth consent is approved)', () => {
            const mockTokenClient = {
                callback: null,
                requestAccessToken: jest.fn(),
            };
            mockGoogle.accounts.oauth2.initTokenClient.mockReturnValue(mockTokenClient);

            return GoogleDriveAPI.initialize().then(() => {
                const callArg = mockGoogle.accounts.oauth2.initTokenClient.mock.calls[0][0];
                expect(callArg.scope).not.toContain('https://www.googleapis.com/auth/generative-language');
            });
        });
    });

    describe('requestAccessToken', () => {
        let mockTokenClient;

        beforeEach(async () => {
            mockTokenClient = {
                callback: null,
                requestAccessToken: jest.fn(),
            };
            mockGoogle.accounts.oauth2.initTokenClient.mockReturnValue(mockTokenClient);
            await GoogleDriveAPI.initialize();
        });

        test('should resolve with access token when new token is received', () => {
            mockTokenClient.requestAccessToken.mockImplementation((config) => {
                mockTokenClient.callback({ access_token: 'new-token-123', state: config && config.state });
            });
            mockGapi.client.getToken.mockReturnValue(null);

            return expect(GoogleDriveAPI.requestAccessToken()).resolves.toBe('new-token-123');
        });

        test('should reject when authentication fails', () => {
            mockTokenClient.requestAccessToken.mockImplementation(() => {
                mockTokenClient.callback({ error: 'access_denied' });
            });
            mockGapi.client.getToken.mockReturnValue(null);

            return expect(GoogleDriveAPI.requestAccessToken()).rejects.toThrow(
                'Authentication failed: access_denied',
            );
        });

        test('should detect token expiry and request new token', () => {
            // Simulate expired token: accessToken exists but getToken() returns expired token
            GoogleDriveAPI.accessToken = 'old-expired-token';
            const expiredToken = {
                access_token: 'old-expired-token',
                expires_at: (Date.now() - 1000) / 1000, // 1 second ago (expired)
            };
            mockGapi.client.getToken.mockReturnValue(expiredToken);

            // Should request new token
            mockTokenClient.requestAccessToken.mockImplementation((config) => {
                mockTokenClient.callback({ access_token: 'fresh-token', state: config && config.state });
            });

            return GoogleDriveAPI.requestAccessToken().then((token) => {
                expect(token).toBe('fresh-token');
                expect(mockTokenClient.requestAccessToken).toHaveBeenCalled();
            });
        });

        test('should reuse valid non-expired token', () => {
            GoogleDriveAPI.accessToken = 'valid-token';
            const validToken = {
                access_token: 'valid-token',
                expires_at: (Date.now() + 3600000) / 1000, // 1 hour from now
            };
            mockGapi.client.getToken.mockReturnValue(validToken);

            return GoogleDriveAPI.requestAccessToken().then((token) => {
                expect(token).toBe('valid-token');
                expect(mockTokenClient.requestAccessToken).not.toHaveBeenCalled();
            });
        });

        test('should handle token without expires_at (treat as expired)', () => {
            GoogleDriveAPI.accessToken = 'token-no-expiry';
            const tokenWithoutExpiry = {
                access_token: 'token-no-expiry',
                // No expires_at field
            };
            mockGapi.client.getToken.mockReturnValue(tokenWithoutExpiry);

            mockTokenClient.requestAccessToken.mockImplementation((config) => {
                mockTokenClient.callback({ access_token: 'refreshed-token', state: config && config.state });
            });

            return GoogleDriveAPI.requestAccessToken().then((token) => {
                expect(token).toBe('refreshed-token');
                expect(mockTokenClient.requestAccessToken).toHaveBeenCalled();
            });
        });

        test('should update this.accessToken with new token after refresh', () => {
            GoogleDriveAPI.accessToken = 'old-token';
            const expiredToken = {
                access_token: 'old-token',
                expires_at: (Date.now() - 5000) / 1000,
            };
            mockGapi.client.getToken.mockReturnValue(expiredToken);

            mockTokenClient.requestAccessToken.mockImplementation((config) => {
                mockTokenClient.callback({ access_token: 'updated-token', state: config && config.state });
            });

            return GoogleDriveAPI.requestAccessToken().then(() => {
                expect(GoogleDriveAPI.accessToken).toBe('updated-token');
            });
        });
    });

    describe('isConfigured (static method)', () => {
        test('GoogleDriveAPI module exports a singleton with isConfigured as static class method', () => {
            // The module exports a singleton instance. The static method is on GoogleDriveAPI.constructor
            // Verify the exported instance has a constructor with static isConfigured
            expect(typeof GoogleDriveAPI.constructor.isConfigured).toBe('function');
        });
    });
});
