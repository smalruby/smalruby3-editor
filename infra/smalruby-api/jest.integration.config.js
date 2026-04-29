module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/lambda/tests'],
    testMatch: ['**/*.integration.test.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    // Each network call to upstream Scratch API may be slow under cold start;
    // give individual tests up to 30 seconds.
    testTimeout: 30000,
    // Load .env so SMALRUBY_API_ENDPOINT is picked up automatically.
    setupFiles: ['dotenv/config'],
};
