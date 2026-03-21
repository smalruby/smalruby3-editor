module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lambda/tests'],
  testMatch: ['**/*.integration.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  // Anthropic Claude APIへのリクエストがあるため、タイムアウトを30秒に設定
  testTimeout: 30000,
  // .env から RUBYTEE_RELAY_ENDPOINT などを読み込む
  setupFiles: ['dotenv/config']
};
