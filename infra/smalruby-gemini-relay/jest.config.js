module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lambda/tests'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['\\.integration\\.test\\.ts$'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
