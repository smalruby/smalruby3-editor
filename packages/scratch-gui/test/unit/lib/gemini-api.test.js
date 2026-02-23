/* eslint-disable no-console */
/**
 * Unit tests for GeminiAPI
 * Tests: OAuth auth, message sending, code block extraction, error handling
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock google-drive-api singleton
jest.mock('../../../src/lib/google-drive-api', () => ({
    __esModule: true,
    default: {
        isInitialized: true,
        accessToken: 'test-access-token',
        initialize: jest.fn().mockResolvedValue(undefined),
        requestAccessToken: jest.fn().mockResolvedValue('test-access-token')
    }
}));

// Mock gemini-context
jest.mock('../../../src/lib/gemini-context', () => ({
    __esModule: true,
    buildSystemInstruction: jest.fn().mockReturnValue('mock system instruction')
}));

describe('GeminiAPI', () => {
    let GeminiAPI;
    let geminiApi;
    let mockGoogleDriveAPI;

    beforeEach(() => {
        global.fetch = jest.fn();

        GeminiAPI = require('../../../src/lib/gemini-api').default;
        geminiApi = new GeminiAPI();
        mockGoogleDriveAPI = require('../../../src/lib/google-drive-api').default;

        // Reset mock implementations
        mockGoogleDriveAPI.initialize.mockResolvedValue(undefined);
        mockGoogleDriveAPI.requestAccessToken.mockResolvedValue('test-access-token');
        mockGoogleDriveAPI.accessToken = 'test-access-token';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('should initialize with empty chat history', () => {
            expect(geminiApi.history).toEqual([]);
        });

        test('should have a model name configured', () => {
            expect(geminiApi.modelName).toBeDefined();
            expect(typeof geminiApi.modelName).toBe('string');
        });
    });

    describe('sendMessage', () => {
        const mockSuccessResponse = {
            candidates: [{
                content: {
                    parts: [{
                        text: 'Here is a simple program:\n```ruby\nloop do\n  move(10)\nend\n```'
                    }]
                }
            }]
        };

        beforeEach(() => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockSuccessResponse)
            });
        });

        test('should call Gemini API with correct endpoint', async () => {
            await geminiApi.sendMessage('make sprite move', {});

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('generativelanguage.googleapis.com'),
                expect.any(Object)
            );
        });

        test('should include Bearer token in Authorization header', async () => {
            await geminiApi.sendMessage('make sprite move', {});

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-access-token'
                    })
                })
            );
        });

        test('should include system instruction in request', async () => {
            await geminiApi.sendMessage('make sprite move', {});

            const callArgs = global.fetch.mock.calls[0][1];
            const body = JSON.parse(callArgs.body);
            expect(body.system_instruction).toBeDefined();
        });

        test('should pass sprite state to buildSystemInstruction', async () => {
            const {buildSystemInstruction} = require('../../../src/lib/gemini-context');
            const spriteState = {name: 'Cat', x: 10, y: 20};
            const stateContext = {sprite: spriteState};
            await geminiApi.sendMessage('make sprite move', stateContext);

            expect(buildSystemInstruction).toHaveBeenCalledWith(stateContext);
        });

        test('should return response text from Gemini', async () => {
            const result = await geminiApi.sendMessage('make sprite move', {});
            expect(result).toBe(
                'Here is a simple program:\n```ruby\nloop do\n  move(10)\nend\n```'
            );
        });

        test('should add user message and assistant response to history', async () => {
            await geminiApi.sendMessage('make sprite move', {});

            expect(geminiApi.history).toHaveLength(2);
            expect(geminiApi.history[0].role).toBe('user');
            expect(geminiApi.history[1].role).toBe('model');
        });

        test('should maintain chat history across multiple messages', async () => {
            await geminiApi.sendMessage('first message', {});
            await geminiApi.sendMessage('second message', {});

            expect(geminiApi.history).toHaveLength(4);
        });

        test('should throw error when API returns non-ok response', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 401,
                text: jest.fn().mockResolvedValue('Unauthorized')
            });

            await expect(geminiApi.sendMessage('test', {})).rejects.toThrow();
        });

        test('should request new access token when 401 occurs', async () => {
            global.fetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    text: jest.fn().mockResolvedValue('Unauthorized')
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: jest.fn().mockResolvedValue(mockSuccessResponse)
                });

            mockGoogleDriveAPI.requestAccessToken.mockResolvedValue('new-access-token');

            const result = await geminiApi.sendMessage('test', {});
            expect(mockGoogleDriveAPI.requestAccessToken).toHaveBeenCalled();
            expect(result).toContain('loop do');
        });
    });

    describe('extractCodeBlock', () => {
        test('should extract ruby code block from markdown', () => {
            const text = 'Here is code:\n```ruby\nmove(10)\n```';
            const code = GeminiAPI.extractCodeBlock(text);
            expect(code).toBe('move(10)');
        });

        test('should extract first ruby code block when multiple exist', () => {
            const text = '```ruby\nfirst\n```\nand\n```ruby\nsecond\n```';
            const code = GeminiAPI.extractCodeBlock(text);
            expect(code).toBe('first');
        });

        test('should return null when no code block exists', () => {
            const text = 'No code here, just text';
            const code = GeminiAPI.extractCodeBlock(text);
            expect(code).toBeNull();
        });

        test('should handle code block without language specifier', () => {
            const text = '```\nmove(10)\n```';
            const code = GeminiAPI.extractCodeBlock(text);
            expect(code).toBe('move(10)');
        });

        test('should trim whitespace from extracted code', () => {
            const text = '```ruby\n  move(10)  \n```';
            const code = GeminiAPI.extractCodeBlock(text);
            expect(code).toBe('move(10)');
        });
    });

    describe('clearHistory', () => {
        test('should clear chat history', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    candidates: [{content: {parts: [{text: 'ok'}]}}]
                })
            });

            await geminiApi.sendMessage('test', {});
            expect(geminiApi.history).toHaveLength(2);

            geminiApi.clearHistory();
            expect(geminiApi.history).toHaveLength(0);
        });
    });
});
